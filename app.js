require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const session = require('express-session');
const flash = require('connect-flash');
const cookieParser = require('cookie-parser');
const methodOverride = require('method-override');
const rateLimit = require('express-rate-limit');
const path = require('path');

const resumeRoutes = require('./routes/resume');
const homeRoutes = require('./routes/home');

const app = express();
const PORT = process.env.PORT || 3000;

─── Security Middleware ────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "https:" ],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://cdn.jsdelivr.net"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// ─── Rate Limiting ──────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const pdfLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 10,
  message: { error: 'PDF generation limit reached. Please wait before downloading again.' },
});

app.use(generalLimiter);

// ─── Core Middleware ────────────────────────────────────────────────
app.use(compression());
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));
app.use(methodOverride('_method'));
app.use(cookieParser(process.env.COOKIE_SECRET || 'resume-builder-secret-2024'));

// ─── Session ────────────────────────────────────────────────────────
app.use(session({
  secret: process.env.SESSION_SECRET || 'resume-session-secret-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24h
    sameSite: 'strict',
  },
  name: 'resumeSessionId',
}));

app.use(flash());

// ─── Static Files ───────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  etag: true,
}));

// ─── View Engine ────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ─── Global Locals ──────────────────────────────────────────────────
app.use((req, res, next) => {
  res.locals.success = req.flash('success');
  res.locals.error = req.flash('error');
  res.locals.currentYear = new Date().getFullYear();
  next();
});

// ─── Routes ─────────────────────────────────────────────────────────
app.use('/', homeRoutes);
app.use('/resume', resumeRoutes);
app.use('/pdf', pdfLimiter, resumeRoutes);

// ─── 404 Handler ────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).render('404', { title: '404 - Page Not Found' });
});

// ─── Error Handler ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).render('error', {
    title: 'Something went wrong',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred.' : err.message,
    status,
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Resume Builder running at http://localhost:${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}\n`);
});

module.exports = app;
