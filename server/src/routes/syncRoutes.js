const express = require('express');
const router = express.Router();
const sync = require('../controllers/syncController');
const { protect } = require('../middleware/authMiddleware');
const { syncLimiter } = require('../middleware/rateLimiter');

router.use(protect);
router.use(syncLimiter);

router.post('/delta', sync.deltaSync);
router.post('/conflicts/:noteId/resolve', sync.resolveConflict);
router.get('/history', sync.getSyncHistory);

module.exports = router;
