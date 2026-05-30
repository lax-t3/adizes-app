---
name: check-prod
description: Quick health check of all production LEAP services — App Runner API, Supabase, Lambda, S3. Prints a status summary.
---

Run these checks:

## 1. App Runner API health
```bash
curl -s --max-time 5 https://adizes-api.turiyaskills.co/health 2>&1 || echo "UNREACHABLE"
```

## 2. App Runner service status
```bash
AWS_PROFILE=lax-t3-assumed aws apprunner list-services \
  --region ap-south-1 \
  --query 'ServiceSummaryList[?contains(ServiceName,`adizes`)].{Name:ServiceName,Status:Status,Updated:UpdatedAt}' \
  --output table 2>&1
```

## 3. Lambda function status
```bash
AWS_PROFILE=lax-t3-assumed aws lambda get-function-configuration \
  --function-name adizes-pdf-generator-v2 \
  --region ap-south-1 \
  --query '{State:State,LastModified:LastModified}' \
  --output table 2>&1
```

## 4. Recent App Runner logs (last 20 lines)
```bash
LOG_GROUP=$(AWS_PROFILE=lax-t3-assumed aws logs describe-log-groups \
  --log-group-name-prefix "/aws/apprunner" \
  --region ap-south-1 \
  --query 'logGroups[0].logGroupName' \
  --output text 2>&1)

AWS_PROFILE=lax-t3-assumed aws logs tail "$LOG_GROUP" \
  --since 1h --region ap-south-1 2>&1 | tail -20
```

## 5. Supabase connectivity
```bash
curl -s --max-time 5 \
  "https://swiznkamzxyfzgckebqi.supabase.co/rest/v1/questions?select=count&limit=1" \
  -H "apikey: <anon-key>" \
  -o /dev/null -w "Supabase: HTTP %{http_code}\n" 2>&1
```

Report all results as a summary table with ✓/✗ indicators and any error details.
