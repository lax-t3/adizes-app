---
name: deploy-lambda
description: Deploy the LEAP PDF Lambda v2 (adizes-pdf-generator-v2) to AWS ECR/Lambda. Guards against using the local dev Supabase key instead of the production key.
context: fork
---

## CRITICAL: Use production keys only
The Lambda must use the **production** Supabase SERVICE_ROLE_KEY (HS256, `iss: supabase`).
Never use the local dev key (ES256, `iss: supabase-demo`) — it causes silent 401 errors where
the Lambda appears to succeed but never patches Supabase. See CLAUDE.md Key Decisions.

## Pre-flight
Ask the user to confirm:
1. "Have you confirmed the SUPABASE_SERVICE_ROLE_KEY is the **production** key (not the local dev key)?"
2. "Is this deploying Lambda v2 (`adizes-pdf-generator-v2`)?"

## Deploy

```bash
cd /Users/vrln/adizes-backend/lambda/pdf-generator-v2

AWS_PROFILE=lax-t3-assumed \
  SUPABASE_URL="https://swiznkamzxyfzgckebqi.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="<production-key-from-.env>" \
  S3_BUCKET_NAME="adizes-pdf-reports" \
  ./deploy.sh 2>&1
```

Read the production key from the user's environment or ask them to provide it — never hardcode it.

## Verify
```bash
AWS_PROFILE=lax-t3-assumed aws lambda get-function-configuration \
  --function-name adizes-pdf-generator-v2 \
  --region ap-south-1 \
  --query '{Runtime:Runtime,LastModified:LastModified,State:State}' \
  --output table 2>&1
```

## Rollback
To roll back to v1, change `PDF_LAMBDA_FUNCTION_NAME` in App Runner env vars:
`adizes-pdf-generator` (v1) or `adizes-pdf-generator-v2` (v2)
