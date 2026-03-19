const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const routes = require('./routes');
const { CLIENT_URL, LOG_LEVEL } = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { globalLimiter } = require('./middleware/rateLimiter');
const { sessionFingerprint } = require('./middleware/sessionFingerprint');

const app = express();

// ─── Security headers ───
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      connectSrc: ["'self'", 'https://accounts.google.com', 'https://www.googleapis.com'],
    },
  },
}));

// ─── CORS ───
app.use(cors({
  origin: CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
}));

// ─── Rate limiting ───
app.use(globalLimiter);

// ─── Body parsers ───
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ─── Input sanitization (after body parsing) ───
// Using manual sanitization instead of express-mongo-sanitize/hpp 
// to avoid Express 5 getter incompatibility
app.use((req, res, next) => {
  const sanitize = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    for (const key of Object.keys(obj)) {
      if (key.startsWith('$') || key.includes('.')) {
        delete obj[key];
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    }
    return obj;
  };
  if (req.body) sanitize(req.body);
  next();
});

// ─── Logging & fingerprint ───
app.use(morgan(LOG_LEVEL));
app.use(sessionFingerprint);

// ─── Routes ───
app.use('/api', routes);

// ─── Error handling ───
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
