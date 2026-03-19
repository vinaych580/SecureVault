const express = require('express');
const router = express.Router();
const sharing = require('../controllers/sharingController');
const { protect } = require('../middleware/authMiddleware');
const { shareViewLimiter } = require('../middleware/rateLimiter');

// Authenticated sharing management
router.post('/notes/:id', protect, sharing.createShareLink);
router.get('/notes/:id/links', protect, sharing.getNoteShareLinks);
router.delete('/links/:token', protect, sharing.revokeShareLink);

// Public view — no auth
router.get('/view/:token', shareViewLimiter, sharing.viewSharedNote);
router.post('/view/:token/verify', shareViewLimiter, sharing.verifySharePassword);

module.exports = router;
