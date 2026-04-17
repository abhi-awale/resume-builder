'use strict';

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const xss = require('xss');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { execSync } = require('child_process');

// ─── Sanitise helpers ──────────────────────────────────────────────
function sanitize(str) {
  if (!str) return '';
  return xss(sanitizeHtml(String(str), { allowedTags: [], allowedAttributes: {} }));
}

function sanitizeResumeData(data) {
  const clean = {};

  clean.personal = {
    name:     sanitize(data.name),
    title:    sanitize(data.title),
    email:    sanitize(data.email),
    phone:    sanitize(data.phone),
    location: sanitize(data.location),
    website:  sanitize(data.website),
    linkedin: sanitize(data.linkedin),
    github:   sanitize(data.github),
    summary:  sanitize(data.summary),
  };

  clean.experience = (Array.isArray(data.exp_company) ? data.exp_company : [])
    .map((val, i) => !val ? null : ({
      company:     sanitize(val),
      position:    sanitize(data.exp_position?.[i]),
      startDate:   sanitize(data.exp_start?.[i]),
      endDate:     sanitize(data.exp_end?.[i]),
      current:     data.exp_current?.[i] === 'on',
      description: sanitize(data.exp_desc?.[i]),
    })).filter(Boolean);

  clean.education = (Array.isArray(data.edu_school) ? data.edu_school : [])
    .map((val, i) => !val ? null : ({
      school:    sanitize(val),
      degree:    sanitize(data.edu_degree?.[i]),
      field:     sanitize(data.edu_field?.[i]),
      startDate: sanitize(data.edu_start?.[i]),
      endDate:   sanitize(data.edu_end?.[i]),
      gpa:       sanitize(data.edu_gpa?.[i]),
    })).filter(Boolean);

  clean.skills = (Array.isArray(data.skill_category) ? data.skill_category : [])
    .map((val, i) => !val ? null : ({
      category: sanitize(val),
      items:    sanitize(data.skill_items?.[i]),
    })).filter(Boolean);

  clean.projects = (Array.isArray(data.proj_name) ? data.proj_name : [])
    .map((val, i) => !val ? null : ({
      name:        sanitize(val),
      tech:        sanitize(data.proj_tech?.[i]),
      url:         sanitize(data.proj_url?.[i]),
      description: sanitize(data.proj_desc?.[i]),
    })).filter(Boolean);

  clean.certifications = (Array.isArray(data.cert_name) ? data.cert_name : [])
    .map((val, i) => !val ? null : ({
      name:   sanitize(val),
      issuer: sanitize(data.cert_issuer?.[i]),
      date:   sanitize(data.cert_date?.[i]),
      url:    sanitize(data.cert_url?.[i]),
    })).filter(Boolean);

  clean.languages = (Array.isArray(data.lang_name) ? data.lang_name : [])
    .map((val, i) => !val ? null : ({
      name:  sanitize(val),
      level: sanitize(data.lang_level?.[i]),
    })).filter(Boolean);

  clean.template    = sanitize(data.template) || 'modern';
  clean.accentColor = /^#[0-9A-Fa-f]{6}$/.test(data.accentColor)
    ? data.accentColor : '#6C63FF';

  return clean;
}

// ─── Find system Chrome / Edge / Brave ────────────────────────────
function findSystemBrowser() {
  const map = {
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    ],
    linux: [
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/snap/bin/chromium',
      '/usr/bin/microsoft-edge-stable',
    ],
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      (process.env.LOCALAPPDATA  || '') + '\\Google\\Chrome\\Application\\chrome.exe',
      (process.env.PROGRAMFILES  || '') + '\\Microsoft\\Edge\\Application\\msedge.exe',
      (process.env.LOCALAPPDATA  || '') + '\\Microsoft\\Edge\\Application\\msedge.exe',
    ],
  };

  const paths = map[process.platform] || map.linux;
  for (const p of paths) {
    try { if (p && fs.existsSync(p)) return p; } catch {}
  }

  // unix fallback: `which`
  if (process.platform !== 'win32') {
    for (const cmd of ['google-chrome', 'google-chrome-stable', 'chromium-browser', 'chromium']) {
      try {
        const r = execSync(`which ${cmd} 2>/dev/null`, { timeout: 2000 }).toString().trim();
        if (r) return r;
      } catch {}
    }
  }
  return null;
}

// ─── Core PDF generator ────────────────────────────────────────────
async function generatePDF(html) {
  // Require puppeteer (full, ships with bundled Chromium)
  const puppeteer = require('puppeteer');

  const ARGS = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    '--disable-extensions',
    '--no-first-run',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-sync',
    '--hide-scrollbars',
    '--mute-audio',
  ];

  const PDF_OPTS = {
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
  };

  // Build strategy list: system browser first, then bundled
  const strategies = [];
  const systemExe = findSystemBrowser();

  if (systemExe) {
    // Try system browser with and without single-process
    strategies.push({ label: `System browser (${systemExe.split('/').pop()})`, opts: { executablePath: systemExe, headless: true, args: ARGS } });
    strategies.push({ label: `System browser no-single-process`, opts: { executablePath: systemExe, headless: true, args: ARGS.filter(a => a !== '--single-process') } });
  }

  // Puppeteer bundled Chromium — several arg permutations
  strategies.push({ label: 'Bundled Chromium',                  opts: { headless: true, args: ARGS } });
  strategies.push({ label: 'Bundled Chromium headless=shell',   opts: { headless: 'shell', args: ARGS } });
  strategies.push({ label: 'Bundled Chromium minimal args',     opts: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'] } });

  let lastErr;
  for (const { label, opts } of strategies) {
    let browser;
    try {
      console.log(`[PDF] Trying: ${label}`);
      browser = await puppeteer.launch(opts);
      const page = await browser.newPage();
      await page.setViewport({ width: 794, height: 1123 });
      await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout?.(400).catch(() => new Promise(r => setTimeout(r, 400)));
      const buf = await page.pdf(PDF_OPTS);
      console.log(`[PDF] ✅ Success: ${label}`);
      return buf;
    } catch (err) {
      lastErr = err;
      console.error(`[PDF] ✗ "${label}": ${err.message.split('\n')[0]}`);
    } finally {
      if (browser) { try { await browser.close(); } catch {} }
    }
  }

  throw lastErr || new Error('All PDF strategies exhausted');
}

// ══════════════════════════════════════════════════════════════════
// ROUTES
// ══════════════════════════════════════════════════════════════════

// GET /resume/builder
router.get('/builder', (req, res) => {
  res.render('builder', {
    title: 'Build Your Resume — ResumeForge',
    resumeData: req.session.resumeData || null,
    errors: [],
  });
});

// POST /resume/preview
router.post('/preview', [
  body('name').trim().notEmpty().withMessage('Full name is required').isLength({ max: 100 }),
  body('email').optional({ checkFalsy: true }).isEmail().withMessage('Invalid email address'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    req.flash('error', errors.array().map(e => e.msg).join(', '));
    return res.redirect('/resume/builder');
  }
  const resumeData = sanitizeResumeData(req.body);
  req.session.resumeData = resumeData;
  req.session.resumeId   = req.session.resumeId || uuidv4();
  res.render('preview', {
    title: `${resumeData.personal.name} — Resume Preview`,
    resumeData,
    resumeId: req.session.resumeId,
  });
});

// GET /resume/preview  (load from session)
router.get('/preview', (req, res) => {
  const resumeData = req.session.resumeData;
  if (!resumeData) {
    req.flash('error', 'No resume data found. Please fill in the builder first.');
    return res.redirect('/resume/builder');
  }
  res.render('preview', {
    title: `${resumeData.personal.name} — Resume Preview`,
    resumeData,
    resumeId: req.session.resumeId,
  });
});

// GET /resume/download-pdf
router.get('/download-pdf', async (req, res) => {
  const resumeData = req.session.resumeData;
  if (!resumeData) {
    return res.status(400).json({ error: 'No resume data. Please build your resume first.' });
  }

  // Render HTML
  let html;
  try {
    html = await new Promise((resolve, reject) => {
      req.app.render('resume-print', { resumeData }, (err, out) => {
        if (err) reject(err); else resolve(out);
      });
    });
  } catch (err) {
    console.error('[PDF] Template render error:', err);
    return res.status(500).json({ error: 'Failed to render resume template.', detail: err.message });
  }

  // Generate PDF
  try {
    const pdfBuf = await generatePDF(html);
    const safeName = (resumeData.personal.name || 'resume')
      .replace(/[^a-z0-9]/gi, '_').toLowerCase();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}_resume.pdf"`);
    res.setHeader('Content-Length', pdfBuf.length);
    res.setHeader('Cache-Control', 'no-store');
    return res.end(pdfBuf);
  } catch (err) {
    console.error('[PDF] Generation failed:', err.message);
    return res.status(500).json({
      error: 'PDF generation failed.',
      detail: err.message,
      tip: 'Ensure Google Chrome is installed, or run: npm install puppeteer',
    });
  }
});

// POST /resume/save-session  (debounced auto-save)
router.post('/save-session', express.json({ limit: '1mb' }), (req, res) => {
  try {
    const resumeData = sanitizeResumeData(req.body);
    req.session.resumeData = resumeData;
    req.session.resumeId   = req.session.resumeId || uuidv4();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Could not save progress.' });
  }
});

// GET /resume/clear
router.get('/clear', (req, res) => {
  req.session.resumeData = null;
  req.session.resumeId   = null;
  req.flash('success', 'Resume cleared. Start fresh!');
  res.redirect('/resume/builder');
});

module.exports = router;
