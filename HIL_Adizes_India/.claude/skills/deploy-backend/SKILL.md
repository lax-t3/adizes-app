---
name: deploy-backend
description: Build linux/amd64 Docker image, push to AWS ECR, and trigger App Runner redeploy for adizes-backend. Requires Docker running and lax-t3-assumed AWS profile.
context: fork
---

## Pre-flight checks
1. Confirm Docker is running: `docker info --format '{{.ServerVersion}}' 2>&1`
2. Confirm AWS credentials: `AWS_PROFILE=lax-t3-assumed aws sts get-caller-identity --region ap-south-1 2>&1`
3. Ask the user: "Confirm deploy to production? This will update the live App Runner service."

## Build and push

```bash
cd /Users/vrln/adizes-backend

AWS_ACCOUNT_ID=094492115510
AWS_REGION=ap-south-1
ECR_REPO="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/adizes-backend"
IMAGE="${ECR_REPO}:latest"   # full ref — brace-delimited so the tag never fuses into the repo name

# Authenticate Docker to ECR (lax-t3-assumed profile)
AWS_PROFILE=lax-t3-assumed aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Build for linux/amd64 — REQUIRED for Apple Silicon (M-series) Macs.
# --push builds and pushes in one step, so there is no separate `docker push`
# and no chance of a mis-tagged local image (avoids the `$ECR_REPO:latest`
# concatenation glitch that produced `adizes-backendatest:latest`).
docker buildx build --platform linux/amd64 --provenance=false -t "$IMAGE" --push .

# Sanity-check the pushed digest matches what App Runner will pull
AWS_PROFILE=lax-t3-assumed aws ecr describe-images \
  --repository-name adizes-backend --image-ids imageTag=latest \
  --region "$AWS_REGION" --query 'imageDetails[0].imageDigest' --output text 2>&1
```

> If `buildx --push` is unavailable in the environment, fall back to two steps —
> but always quote the ref: `docker buildx build ... -t "$IMAGE" .` then `docker push "$IMAGE"`.
> Never write `-t $ECR_REPO:latest` unquoted/unbraced.

## Verify deployment
Wait ~2 min, then check App Runner status:
```bash
AWS_PROFILE=lax-t3-assumed aws apprunner list-services \
  --region ap-south-1 \
  --query 'ServiceSummaryList[?contains(ServiceName,`adizes`)].{Name:ServiceName,Status:Status}' \
  --output table 2>&1
```

Then hit the production health endpoint: `curl -s https://adizes-api.turiyaskills.co/health`

**IMPORTANT:** If `.dockerignore` is ever removed, `.env` gets baked into the image — see CLAUDE.md Key Decisions.
