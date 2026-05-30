---
name: retrigger-pdf
description: "Re-trigger PDF generation for a stuck assessment where pdf_url is null. Uses boto3 to invoke adizes-pdf-generator-v2 synchronously. Usage: /retrigger-pdf <assessment_id>"
---

Use this when an assessment has completed scoring but `pdf_url` is still null.

## IMPORTANT: Use boto3, NOT aws lambda invoke --payload file://
AWS CLI v2 with `file://` causes double-encoding (`Invalid base64`). Always use Python boto3.

## Step 1: Fetch the assessment row
Query Supabase (use the MCP `execute_sql` tool or curl) to get the full assessment:
```sql
SELECT id, user_id, cohort_id, user_name, completed_at,
       profile, scaled_scores, gaps, interpretation, pdf_url
FROM assessments
WHERE id = '<assessment_id>';
```

## Step 2: Build the Lambda payload
The payload must match what adizes-pdf-generator-v2 expects:
```python
payload = {
    "assessment_id": "<id>",
    "user_id": "<user_id>",
    "cohort_id": "<cohort_id>",
    "user_name": "<user_name>",
    "completed_at": "<completed_at ISO string>",
    "profile": { "is": {...}, "should": {...}, "want": {...} },
    "scaled_scores": { "is": {...}, "should": {...}, "want": {...} },
    "gaps": { "P": {...}, "A": {...}, "E": {...}, "I": {...} },
    "interpretation": { ... }
}
```

## Step 3: Invoke Lambda via boto3
Create a temporary Python script `/tmp/retrigger_<id[:8]>.py`:
```python
import boto3, json

session = boto3.Session(profile_name='lax-t3-assumed')
client = session.client('lambda', region_name='ap-south-1')

payload = <paste payload dict here>

resp = client.invoke(
    FunctionName='adizes-pdf-generator-v2',
    InvocationType='RequestResponse',
    Payload=json.dumps(payload).encode('utf-8')
)

result = json.loads(resp['Payload'].read())
print("StatusCode:", resp['StatusCode'])
print("Result:", json.dumps(result, indent=2))
```

Run: `AWS_PROFILE=lax-t3-assumed python3 /tmp/retrigger_<id[:8]>.py`

## Step 4: Verify
Check that `pdf_url` is now set in Supabase:
```sql
SELECT id, pdf_url, completed_at FROM assessments WHERE id = '<assessment_id>';
```

Lambda patches Supabase directly on success. Backend also patches from the returned `pdf_url`.
