const express = require('express');
const router = express.Router();
const settings = require('../controllers/settingsController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/', settings.getSettings);
router.put('/', settings.updateSettings);
router.post('/change-password', settings.changePassword);
router.get('/audit-log', settings.getAuditLog);
router.post('/delete-account', settings.deleteAccount);

module.exports = router;
