-- 017_pdf_url_custom_domain.sql
-- Repoint existing report URLs from the raw S3 host to the custom domain
-- (leap-reports.turiyaskills.co → Cloudflare Worker → adizes-pdf-reports S3 bucket).
-- New reports get the custom domain from the Lambda (PDF_PUBLIC_BASE_URL).
-- Data migration — applied to production via Supabase MCP on 2026-06-13.

update assessments
set pdf_url = replace(pdf_url,
      'https://adizes-pdf-reports.s3.ap-south-1.amazonaws.com',
      'https://leap-reports.turiyaskills.co')
where pdf_url like 'https://adizes-pdf-reports.s3.%';
