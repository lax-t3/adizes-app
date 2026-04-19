'use strict';

const chromium    = require('@sparticuz/chromium');
const puppeteer   = require('puppeteer-core');
const ejs         = require('ejs');
const fs          = require('fs');
const path        = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const {
  computeTensions, getTopTensions, computeActionPath, generateActionPathMessages,
  ROLES, ROLE_NAMES, ROLE_COLORS, ROLE_TINTS, TYPE_LABELS, ACTION_CUES,
} = require('./lib/tensions');

const TEMPLATE_PATH = path.join(__dirname, 'template', 'report.html');

/**
 * Inline CSS and convert ./assets/* src references to base64 data URIs.
 * page.setContent() does not resolve relative paths — everything must be inline.
 */
function inlineAssets(html) {
  const templateDir = path.join(__dirname, 'template');

  const css = fs.readFileSync(path.join(templateDir, 'styles.css'), 'utf8');
  const beforeCss = html;
  html = html.replace(
    /<link rel="stylesheet" href="\.\/styles\.css">/,
    `<style>${css}</style>`,
  );
  if (html === beforeCss) {
    console.warn('[pdf-v2] WARNING: styles.css <link> tag not found — PDF will be unstyled');
  }

  html = html.replace(/src="\.\/assets\/([^"]+)"/g, (_match, filename) => {
    const assetPath = path.join(templateDir, 'assets', filename);
    if (!fs.existsSync(assetPath)) {
      console.warn(`[pdf-v2] Asset not found: ${assetPath}`);
      return `src=""`;
    }
    const ext  = path.extname(filename).toLowerCase();
    const mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`;
    const b64  = fs.readFileSync(assetPath).toString('base64');
    return `src="data:${mime};base64,${b64}"`;
  });

  return html;
}

exports.handler = async (event) => {
  const {
    assessment_id,
    user_name,
    completed_at,
    profile,
    scaled_scores,
    gaps,
    interpretation,
  } = event;

  console.log(`[pdf-v2] Starting PDF for assessment ${assessment_id}, user: ${user_name}`);

  // ── Compute derived data ───────────────────────────────────────────────────
  const tensions       = computeTensions(scaled_scores);
  const topTensions    = getTopTensions(tensions, 2);
  const actionPath     = computeActionPath(tensions);
  const actionPathMsgs = generateActionPathMessages(tensions, actionPath);

  const gapsMap = {};
  for (const g of gaps) gapsMap[g.role] = g;

  const identityLine = interpretation.combined_description
    ? interpretation.combined_description.split(' — ')[0].replace(/^The /, '')
    : interpretation.style_label;

  // ── Render EJS template ────────────────────────────────────────────────────
  const templateSrc = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const renderedHtml = ejs.render(templateSrc, {
    user_name,
    completed_at,
    profile,
    scaled_scores,
    interpretation,
    gaps,
    tensions,
    topTensions,
    actionPath: actionPathMsgs,
    gapsMap,
    identityLine,
    ROLES,
    ROLE_NAMES,
    ROLE_COLORS,
    ROLE_TINTS,
    TYPE_LABELS,
    ACTION_CUES,
  });

  const html = inlineAssets(renderedHtml);

  // ── Puppeteer — render to PDF ──────────────────────────────────────────────
  const browser = await puppeteer.launch({
    args:            chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath:  await chromium.executablePath(),
    headless:        chromium.headless,
  });

  let pdfBytes;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });

    pdfBytes = await page.pdf({
      format:          'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '22mm', left: '15mm', right: '15mm' },
    });

    console.log(`[pdf-v2] PDF generated, ${pdfBytes.length} bytes`);
  } finally {
    await browser.close();
  }

  // ── Upload to S3 ───────────────────────────────────────────────────────────
  const s3  = new S3Client({ region: process.env.AWS_REGION });
  const key = `reports/${assessment_id}.pdf`;

  await s3.send(new PutObjectCommand({
    Bucket:      process.env.S3_BUCKET_NAME,
    Key:         key,
    Body:        pdfBytes,
    ContentType: 'application/pdf',
  }));

  const pdfUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  console.log(`[pdf-v2] Uploaded to S3: ${pdfUrl}`);

  // ── PATCH Supabase assessments.pdf_url ─────────────────────────────────────
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/assessments?id=eq.${assessment_id}`,
        {
          method: 'PATCH',
          headers: {
            apikey:         process.env.SUPABASE_SERVICE_ROLE_KEY,
            Authorization:  `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            Prefer:         'return=minimal',
          },
          body: JSON.stringify({ pdf_url: pdfUrl }),
        },
      );
      if (!resp.ok) throw new Error(`Supabase PATCH ${resp.status}: ${await resp.text()}`);
      console.log(`[pdf-v2] Supabase pdf_url updated for ${assessment_id}`);
      break;
    } catch (err) {
      console.error(`[pdf-v2] Supabase PATCH attempt ${attempt} failed: ${err.message}`);
      // Intentional: PDF is already in S3. DB update failure is non-fatal — caller can retry via assessment status check.
      if (attempt === 2) console.error(`[pdf-v2] Giving up on Supabase PATCH`);
    }
  }

  return { statusCode: 200, assessment_id, pdf_url: pdfUrl };
};
