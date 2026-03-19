const express = require('express');
const router = express.Router();

const healthRoutes = require('./healthRoutes');
const authRoutes = require('./authRoutes');
const noteRoutes = require('./noteRoutes');
const folderRoutes = require('./folderRoutes');
const tagRoutes = require('./tagRoutes');
const syncRoutes = require('./syncRoutes');
const sharingRoutes = require('./sharingRoutes');
const settingsRoutes = require('./settingsRoutes');
const requireDatabase = require('../middleware/requireDatabase');

router.use('/health', healthRoutes);
router.use(requireDatabase);
router.use('/auth', authRoutes);
router.use('/notes', noteRoutes);
router.use('/folders', folderRoutes);
router.use('/tags', tagRoutes);
router.use('/sync', syncRoutes);
router.use('/share', sharingRoutes);
router.use('/settings', settingsRoutes);

module.exports = router;
