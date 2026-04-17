const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const sanitizeHtml = require('sanitize-html');
const xss = require('xss');
const { v4: uuidv4 } = require('uuid');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

// ─── Sanitize helper ──────────────────────────────────────────────
function sanitize(str) {
  if (!str) return '';
  return xss(sanitizeHtml(String(str), { allowedTags: [], allowedAttributes: {} }));
}

function sanitizeResumeData(data) {
  const clean = {};

  // Personal Info
  clean.personal = {
    name: sanitize(data.name),
    title: sanitize(data.title),
    email: sanitize(data.email),
    phone: sanitize(data.phone),
    location: sanitize(data.location),
    website: sanitize(data.website),
    linkedin: sanitize(data.linkedin),
    github: sanitize(data.github),
    summary: sanitize(data.summary),
  };

  // Experience
  clean.experience = [];
  if (Array.isArray(data.exp_company)) {
    for (let i = 0; i < data.exp_company.length; i++) {
      if (data.exp_company[i]) {
        clean.experience.push({
          company: sanitize(data.exp_company[i]),
          position: sanitize(data.exp_position?.[i]),
          startDate: sanitize(data.exp_start?.[i]),
          endDate: sanitize(data.exp_end?.[i]),
          current: data.exp_current?.[i] === 'on',
          description: sanitize(data.exp_desc?.[i]),
        });
      }
    }
  }

  // Education
  clean.education = [];
  if (Array.isArray(data.edu_school)) {
    for (let i = 0; i < data.edu_school.length; i++) {
      if (data.edu_school[i]) {
        clean.education.push({
          school: sanitize(data.edu_school[i]),
          degree: sanitize(data.edu_degree?.[i]),
          field: sanitize(data.edu_field?.[i]),
          startDate: sanitize(data.edu_start?.[i]),
          endDate: sanitize(data.edu_end?.[i]),
          gpa: sanitize(data.edu_gpa?.[i]),
        });
      }
    }
  }

  // Skills
  clean.skills = [];
  if (Array.isArray(data.skill_category)) {
    for (let i = 0; i < data.skill_category.length; i++) {
      if (data.skill_category[i]) {
        clean.skills.push({
          category: sanitize(data.skill_category[i]),
          items: sanitize(data.skill_items?.[i]),
        });
      }
    }
  }

  // Projects
  clean.projects = [];
  if (Array.isArray(data.proj_name)) {
    for (let i = 0; i < data.proj_name.length; i++) {
      if (data.proj_name[i]) {
        clean.projects.push({
          name: sanitize(data.proj_name[i]),
          tech: sanitize(data.proj_tech?.[i]),
          url: sanitize(data.proj_url?.[i]),
          description: sanitize(data.proj_desc?.[i]),
        });
      }
    }
  }

  // Certifications
  clean.certifications = [];
  if (Array.isArray(data.cert_name)) {
    for (let i = 0; i < data.cert_name.length; i++) {
      if (data.cert_name[i]) {
        clean.certifications.push({
          name: sanitize(data.cert_name[i]),
          issuer: sanitize(data.cert_issuer?.[i]),
          date: sanitize(data.cert_date?.[i]),
          url: sanitize(data.cert_url?.[i]),
        });
      }
    }
  }

  // Languages
  clean.languages = [];
  if (Array.isArray(data.lang_name)) {
    for (let i = 0; i < data.lang_name.length; i++) {
      if (data.lang_name[i]) {
        clean.languages.push({
          name: sanitize(data.lang_name[i]),
          level: sanitize(data.lang_level?.[i]),
        });
      }
    }
  }

  clean.template = sanitize(data.template) || 'modern';
  clean.accentColor = /^#[0-9A-Fa-f]{6}$/.test(data.accentColor) ? data.accentColor : '#6C63FF';

  return clean;
}

// ─── GET /resume/builder ───────────────────────────────────────────
router.get('/builder', (req, res) => {
  const savedData = req.session.resumeData || null;
  res.render('builder', {
    title: 'Build Your Resume — ResumeForge',
    resumeData: savedData,
    errors: [],
  });
});

// ─── POST /resume/preview ──────────────────────────────────────────
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
  req.session.resumeId = req.session.resumeId || uuidv4();

  res.render('preview', {
    title: `${resumeData.personal.name} — Resume Preview`,
    resumeData,
    resumeId: req.session.resumeId,
  });
});

// ─── GET /resume/preview (from session) ───────────────────────────
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

// ─── Chrome executable finder (cross-platform) ────────────────────
function findChrome() {
  const { execSync } = require('child_process');
  const fs = require('fs');

  // macOS paths
  const macPaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];
  // Linux paths
  const linuxPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ];
  // Windows paths
  const winPaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ];

  const allPaths = [...macPaths, ...linuxPaths, ...winPaths];
  for (const p of allPaths) {
    try { if (p && fs.existsSync(p)) return p; } catch {}
  }

  // Try `which` on unix
  try { return execSync('which google-chrome || which chromium-browser || which chromium', { stdio: ['pipe','pipe','ignore'] }).toString().trim(); } catch {}

  return null; // fall back to puppeteer bundled
}

// ─── GET /resume/download-pdf ──────────────────────────────────────
router.get('/download-pdf', async (req, res) => {
  const resumeData = req.session.resumeData;
  if (!resumeData) {
    return res.status(400).json({ error: 'No resume data found.' });
  }

  let browser;
  try {
    // Render the print template
    const html = await new Promise((resolve, reject) => {
      res.app.render('resume-print', { resumeData, layout: false }, (err, html) => {
        if (err) reject(err);
        else resolve(html);
      });
    });

    const chromePath = findChrome();
    const launchOptions = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
        '--no-first-run',
        '--no-zygote',
      ],
    };
    if (chromePath) {
      console.log(`Using system Chrome: ${chromePath}`);
      launchOptions.executablePath = chromePath;
    } else {
      console.log('Using bundled Puppeteer Chromium');
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    const filename = `${(resumeData.personal.name || 'resume').replace(/[^a-z0-9]/gi, '_').toLowerCase()}_resume.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('PDF generation error:', err);
    res.status(500).json({ error: 'Failed to generate PDF. Please try again.' });
  } finally {
    if (browser) await browser.close();
  }
});

// ─── POST /resume/save-session ─────────────────────────────────────
router.post('/save-session', express.json(), (req, res) => {
  try {
    const resumeData = sanitizeResumeData(req.body);
    req.session.resumeData = resumeData;
    req.session.resumeId = req.session.resumeId || uuidv4();
    res.json({ success: true, message: 'Progress saved!' });
  } catch (err) {
    res.status(500).json({ error: 'Could not save progress.' });
  }
});

// ─── GET /resume/clear ─────────────────────────────────────────────
router.get('/clear', (req, res) => {
  req.session.resumeData = null;
  req.session.resumeId = null;
  req.flash('success', 'Resume cleared. Start fresh!');
  res.redirect('/resume/builder');
});

module.exports = router;
