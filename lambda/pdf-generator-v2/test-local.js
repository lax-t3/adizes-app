'use strict';

/**
 * Local test runner for pdf-generator-v2.
 * Skips S3 upload and Supabase PATCH — writes PDF to /tmp/report-v2-test.pdf instead.
 *
 * Usage: node test-local.js
 * Requires: npm install (including @sparticuz/chromium which bundles Chromium locally)
 */

const ejs      = require('ejs');
const fs       = require('fs');
const path     = require('path');
const puppeteer = require('puppeteer-core');
const chromium  = require('@sparticuz/chromium');

const {
  computeTensions, getTopTensions, computeActionPath, generateActionPathMessages,
  ROLES, ROLE_NAMES, ROLE_COLORS, ROLE_TINTS, TYPE_LABELS, ACTION_CUES,
} = require('./lib/tensions');

const TEMPLATE_PATH = path.join(__dirname, 'template', 'report.html');
const OUTPUT_PATH   = '/tmp/report-v2-test.pdf';

function inlineAssets(html) {
  const templateDir = path.join(__dirname, 'template');
  const css = fs.readFileSync(path.join(templateDir, 'styles.css'), 'utf8');
  html = html.replace(/<link rel="stylesheet" href="\.\/styles\.css">/, `<style>${css}</style>`);
  html = html.replace(/src="\.\/assets\/([^"]+)"/g, (_match, filename) => {
    const assetPath = path.join(templateDir, 'assets', filename);
    if (!fs.existsSync(assetPath)) return `src=""`;
    const ext = path.extname(filename).toLowerCase();
    const mime = ext === '.svg' ? 'image/svg+xml' : `image/${ext.slice(1)}`;
    return `src="data:${mime};base64,${fs.readFileSync(assetPath).toString('base64')}"`;
  });
  return html;
}

async function run() {
  const scaled_scores = {
    is:     { P: 28, A: 37, E: 34, I: 25 },
    should: { P: 22, A: 30, E: 42, I: 28 },
    want:   { P: 18, A: 42, E: 38, I: 30 },
  };
  const interpretation = {
    dominant_roles: ['A', 'E'],
    style_label: 'Administrator',
    style_tagline: 'The Reliable Architect',
    strengths: 'You bring discipline, consistency, and rigour to everything you touch. Your ability to create systems, maintain standards, and catch errors before they become problems makes you invaluable in any organisation.',
    blind_spots: 'Your preference for process and precedent can slow adaptation to change. Trust that not every decision requires a procedure — learn to tolerate calculated ambiguity and speed.',
    working_with_others: 'Producers can seem reckless to you — channel their energy by building systems they can operate within.',
    combined_description: 'The Innovative Organiser — you vision the future and build the systems to get there.',
    mismanagement_risks: [
      'Bureaucrat — may become overly rigid, inflexible, and change-resistant under stress.',
      'Arsonist — may become impractical, chaotic, and idea-without-delivery under stress.',
    ],
  };
  const gaps = [
    { role: 'P', external_message: 'Your current work style is more action-driven than your job requires. This extra energy can be a strength but watch for impatience with process.', internal_message: 'You prefer more action and results than your current role allows. Seek opportunities for direct ownership and tangible outcomes.' },
    { role: 'A', external_message: 'You are more process-focused than your role demands. While thoroughness is valuable, ensure it does not slow decision-making.', internal_message: 'You have a stronger preference for structure than your current role exercises. Seek ways to bring more order and clarity to your work.' },
    { role: 'E', external_message: 'Your organisation expects more entrepreneurial, visionary behaviour than you are currently showing. Look for opportunities to propose new ideas and challenge the status quo.', internal_message: 'You crave more creative freedom than your current role provides. Seek stretch assignments or side projects that allow strategic thinking.' },
    { role: 'I', external_message: 'You are more people-focused than your role requires. Your relational strengths are an asset — ensure tasks and results are not secondary.', internal_message: 'You value collaboration more than your role currently provides. Seek cross-functional projects to satisfy your integrative nature.' },
  ];

  const tensions       = computeTensions(scaled_scores);
  const topTensions    = getTopTensions(tensions, 2);
  const actionPath     = computeActionPath(tensions);
  const actionPathMsgs = generateActionPathMessages(tensions, actionPath);
  const gapsMap        = {};
  for (const g of gaps) gapsMap[g.role] = g;
  const identityLine   = interpretation.combined_description
    ? interpretation.combined_description.split(' — ')[0].replace(/^The /, '')
    : interpretation.style_label;

  const tpl  = fs.readFileSync(TEMPLATE_PATH, 'utf8');
  const html = inlineAssets(ejs.render(tpl, {
    user_name: 'Erika Garcia', completed_at: '2026-04-19T10:00:00Z',
    profile: { is: 'pAei', should: 'paEi', want: 'pAEi' },
    scaled_scores, interpretation, gaps,
    tensions, topTensions, actionPath: actionPathMsgs, gapsMap, identityLine,
    ROLES, ROLE_NAMES, ROLE_COLORS, ROLE_TINTS, TYPE_LABELS, ACTION_CUES,
  }));

  // @sparticuz/chromium ships a Linux ELF binary; on macOS fall back to system Chrome.
  const isMac = process.platform === 'darwin';
  const executablePath = isMac
    ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    : await chromium.executablePath();
  const launchArgs = isMac
    ? [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--headless=new',
      ]
    : chromium.args;
  const browser = await puppeteer.launch({
    args: launchArgs,
    defaultViewport: chromium.defaultViewport,
    executablePath,
    headless: isMac ? 'new' : chromium.headless,
    pipe: true,
  });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123 });
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const pdfBytes = await page.pdf({ format: 'A4', printBackground: true,
      margin: { top: '18mm', bottom: '22mm', left: '15mm', right: '15mm' } });
    fs.writeFileSync(OUTPUT_PATH, pdfBytes);
    console.log(`[test-local] PDF written: ${OUTPUT_PATH} (${pdfBytes.length} bytes)`);
  } finally {
    await browser.close();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
