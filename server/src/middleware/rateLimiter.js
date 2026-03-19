const rateLimit = require('express-rate-limit');

const createLimiter = (windowMs, max, message) =>
  rateLimit({ windowMs, max, message: { success: false, error: { code: 'RATE_LIMIT', message } }, standardHeaders: true, legacyHeaders: false });

const authRegisterLimiter = createLimiter(60 * 60 * 1000, 5, 'Too many registration attempts, try again in an hour');
const authLoginLimiter = createLimiter(15 * 60 * 1000, 10, 'Too many login attempts, try again in 15 minutes');
const authForgotPasswordLimiter = createLimiter(60 * 60 * 1000, 3, 'Too many password reset requests, try again in an hour');
const authResendVerifyLimiter = createLimiter(60 * 60 * 1000, 3, 'Too many verification emails, try again in an hour');
const tokenRefreshLimiter = createLimiter(60 * 60 * 1000, 30, 'Too many token refreshes');
const notesCrudLimiter = createLimiter(60 * 1000, 100, 'Too many requests, slow down');
const exportLimiter = createLimiter(60 * 60 * 1000, 10, 'Too many exports, try again in an hour');
const syncLimiter = createLimiter(60 * 60 * 1000, 20, 'Too many sync requests');
const shareViewLimiter = createLimiter(60 * 1000, 60, 'Too many view requests');
const globalLimiter = createLimiter(15 * 60 * 1000, 500, 'Too many requests from this IP');

module.exports = {
  authRegisterLimiter, authLoginLimiter, authForgotPasswordLimiter,
  authResendVerifyLimiter, tokenRefreshLimiter, notesCrudLimiter,
  exportLimiter, syncLimiter, shareViewLimiter, globalLimiter,
};
