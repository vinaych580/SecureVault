const express = require('express');
const router = express.Router();
const folders = require('../controllers/foldersController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/', folders.getFolders);
router.post('/', folders.createFolder);
router.put('/:id', folders.updateFolder);
router.delete('/:id', folders.deleteFolder);
router.post('/reorder', folders.reorderFolders);

module.exports = router;
