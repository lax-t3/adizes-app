'use strict';

const puppeteer = require('puppeteer');
const ejs = require('ejs');
const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

const TEMPLATE_PATH = path.join(__dirname, 'template', 'report.html');
const CHARTJS_PATH = path.join(__dirname, 'node_modules', 'chart.js', 'dist', 'chart.umd.min.js');

/**
 * Inline CSS and convert asset src= references to base64 data URIs.
 * Required because page.setContent() does not support baseURL — relative paths
 * like ./styles.css and ./assets/logo.png will not resolve without this step.
 */
function inlineAssets(html) {
  const templateDir = path.join(__dirname, 'template');

  // Inline styles.css
  const css = fs.readFileSync(path.join(templateDir, 'styles.css'), 'utf8');
  html = html.replace(
    /<link rel="stylesheet" href="\.\/styles\.css">/,
    `<style>${css}</style>`
  );

  // Convert all ./assets/*.{png,svg} references to base64 data URIs
  html = html.replace(/src="\.\/assets\/([^"]+)"/g, (_match, filename) => {
    const assetPath = path.join(templateDir, 'assets', filename);
    if (!fs.existsSync(assetPath)) {
      console.warn(`[pdf-generator] Asset not found, skipping: ${assetPath}`);
      return `src=""`;
    }
    const ext = path.extname(filename).toLowerCase();
    const mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`;
    const b64 = fs.readFileSync(assetPath).toString('base64');
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

  console.log(`[pdf-generator] Starting PDF for assessment ${assessment_id}, user: ${user_name}`);

  // 1. Render EJS template + inline all assets
  const templateSrc = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const renderedHtml = ejs.render(templateSrc, {
    user_name,
    completed_at,
    profile,
    scaled_scores,
    gaps,
    interpretation,
  });
  const html = inlineAssets(renderedHtml);

  // 2. Launch Puppeteer
  // executablePath() returns Chrome downloaded into PUPPETEER_CACHE_DIR during npm ci
  const browser = await puppeteer.launch({
    executablePath: puppeteer.executablePath(),
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--single-process',
      '--no-zygote',
      '--disable-setuid-sandbox',
    ],
    headless: 'new',
  });

  let pdfBytes;

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });  // A4 at 96dpi

    // 3. Load fully self-contained HTML (CSS + assets already inlined)
    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // 4. Inject Chart.js from local node_modules
    // Lambda has no internet access — CDN scripts would fail; inject from disk.
    await page.addScriptTag({ path: CHARTJS_PATH });

    // 5. Call initCharts() now that Chart.js is available
    await page.evaluate((ss, gapsData) => {
      window.initCharts(ss, gapsData);
    }, scaled_scores, gaps);

    // 6. Wait for Chart.js to finish rendering
    // initCharts() sets window.__chartsReady = true as its last line.
    await page.waitForFunction(() => window.__chartsReady === true, {
      timeout: 10000,
    });

    // 7. Generate PDF bytes
    pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', bottom: '22mm', left: '15mm', right: '15mm' },
    });

    console.log(`[pdf-generator] PDF generated, size: ${pdfBytes.length} bytes`);
  } finally {
    await browser.close();
  }

  // 8. Upload to S3
  // AWS_REGION is auto-injected by Lambda runtime — do not set it in env vars.
  const s3 = new S3Client({ region: process.env.AWS_REGION });
  const key = `reports/${assessment_id}.pdf`;

  await s3.send(new PutObjectCommand({
    Bucket: process.env.S3_BUCKET_NAME,
    Key: key,
    Body: pdfBytes,
    ContentType: 'application/pdf',
    ACL: 'public-read',
  }));

  const pdfUrl = `https://${process.env.S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
  console.log(`[pdf-generator] Uploaded to S3: ${pdfUrl}`);

  // 9. PATCH Supabase assessments.pdf_url — retry once on failure
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const resp = await fetch(
        `${process.env.SUPABASE_URL}/rest/v1/assessments?id=eq.${assessment_id}`,
        {
          method: 'PATCH',
          headers: {
            'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({ pdf_url: pdfUrl }),
        }
      );
      if (!resp.ok) {
        throw new Error(`Supabase PATCH returned ${resp.status}: ${await resp.text()}`);
      }
      console.log(`[pdf-generator] Supabase pdf_url updated for assessment ${assessment_id}`);
      break;
    } catch (err) {
      console.error(`[pdf-generator] Supabase PATCH attempt ${attempt} failed: ${err.message}`);
      if (attempt === 2) {
        console.error(`[pdf-generator] Giving up on Supabase PATCH after 2 attempts`);
      }
    }
  }

  return {
    statusCode: 200,
    assessment_id,
    pdf_url: pdfUrl,
  };
};
