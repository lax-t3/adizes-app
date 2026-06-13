#!/bin/bash
set -euo pipefail

REGION="ap-south-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="adizes-pdf-generator-v2"
LAMBDA_NAME="adizes-pdf-generator-v2"
LAMBDA_ROLE="arn:aws:iam::${ACCOUNT_ID}:role/adizes-pdf-lambda-role"
IMAGE_URI="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPO}:latest"

# ── Required environment variables ────────────────────────────────────────────
: "${SUPABASE_URL:?Need to set SUPABASE_URL}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Need to set SUPABASE_SERVICE_ROLE_KEY}"
: "${S3_BUCKET_NAME:?Need to set S3_BUCKET_NAME}"
# Public base for report URLs — custom domain (Cloudflare → S3). Falls back to
# the S3 REST endpoint inside the Lambda if unset.
: "${PDF_PUBLIC_BASE_URL:=https://leap-reports.turiyaskills.co}"

# ── Copy logo from frontend repo ───────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOGO_SRC="${SCRIPT_DIR}/../../../adizes-frontend/public/HIL-Isotope.png"
if [ -f "$LOGO_SRC" ]; then
  cp "$LOGO_SRC" "${SCRIPT_DIR}/template/assets/HIL-Isotope.png"
  echo "✓ Copied HIL-Isotope.png from $LOGO_SRC"
else
  echo "⚠ HIL-Isotope.png not found at $LOGO_SRC — using existing asset if present"
fi

# ── Authenticate Docker to ECR ─────────────────────────────────────────────────
aws ecr get-login-password --region "$REGION" | \
  docker login --username AWS --password-stdin \
  "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

# ── Create ECR repository if it doesn't exist ─────────────────────────────────
aws ecr describe-repositories --repository-names "$ECR_REPO" \
  --region "$REGION" 2>/dev/null || \
  aws ecr create-repository --repository-name "$ECR_REPO" \
  --region "$REGION" --image-scanning-configuration scanOnPush=true

# ── Build for linux/amd64 and push ────────────────────────────────────────────
docker buildx build --platform linux/amd64 --provenance=false -t "$IMAGE_URI" --push "$SCRIPT_DIR"

# ── Create Lambda (first deploy) or update image URI (subsequent deploys) ──────
if aws lambda get-function --function-name "$LAMBDA_NAME" --region "$REGION" 2>/dev/null; then
  echo "Updating existing Lambda function..."
  aws lambda update-function-code \
    --function-name "$LAMBDA_NAME" \
    --image-uri "$IMAGE_URI" \
    --region "$REGION"
  aws lambda wait function-updated \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION"
  aws lambda update-function-configuration \
    --function-name "$LAMBDA_NAME" \
    --timeout 90 \
    --memory-size 1024 \
    --region "$REGION" \
    --environment "Variables={SUPABASE_URL=${SUPABASE_URL},SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY},S3_BUCKET_NAME=${S3_BUCKET_NAME},PDF_PUBLIC_BASE_URL=${PDF_PUBLIC_BASE_URL}}"
else
  echo "Creating new Lambda function..."
  aws lambda create-function \
    --function-name "$LAMBDA_NAME" \
    --package-type Image \
    --code "ImageUri=${IMAGE_URI}" \
    --role "$LAMBDA_ROLE" \
    --timeout 90 \
    --memory-size 1024 \
    --architectures x86_64 \
    --region "$REGION" \
    --environment "Variables={SUPABASE_URL=${SUPABASE_URL},SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY},S3_BUCKET_NAME=${S3_BUCKET_NAME},PDF_PUBLIC_BASE_URL=${PDF_PUBLIC_BASE_URL}}"
  aws lambda wait function-active \
    --function-name "$LAMBDA_NAME" \
    --region "$REGION"
fi

echo "✓ Lambda deployed: ${LAMBDA_NAME} → ${IMAGE_URI}"
