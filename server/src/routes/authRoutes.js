const express = require('express');
const router = express.Router();
const auth = require('../controllers/authController');
const validateRequest = require('../middleware/validateRequest');
const { registerValidator, loginValidator, forgotPasswordValidator, resetPasswordValidator, twoFACodeValidator } = require('../validators/authValidators');
const { protect } = require('../middleware/authMiddleware');
const { authRegisterLimiter, authLoginLimiter, authForgotPasswordLimiter, authResendVerifyLimiter, tokenRefreshLimiter } = require('../middleware/rateLimiter');

router.post('/register', authRegisterLimiter, registerValidator, validateRequest, auth.register);
router.post('/login', authLoginLimiter, loginValidator, validateRequest, auth.login);
router.post('/logout', protect, auth.logout);
router.post('/refresh', tokenRefreshLimiter, auth.refresh);
router.get('/verify-email', auth.verifyEmail);
router.post('/resend-verification', authResendVerifyLimiter, auth.resendVerification);
router.post('/forgot-password', authForgotPasswordLimiter, forgotPasswordValidator, validateRequest, auth.forgotPassword);
router.post('/reset-password', resetPasswordValidator, validateRequest, auth.resetPassword);

// 2FA
router.post('/2fa/setup', protect, auth.setup2FA);
router.post('/2fa/verify-setup', protect, twoFACodeValidator, validateRequest, auth.verifySetup2FA);
router.post('/2fa/verify', auth.verify2FA);
router.post('/2fa/disable', protect, auth.disable2FA);

// Sessions
router.get('/sessions', protect, auth.getSessions);
router.delete('/sessions/:sessionId', protect, auth.revokeSession);
router.delete('/sessions', protect, auth.revokeAllSessions);

module.exports = router;
