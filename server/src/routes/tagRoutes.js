const express = require('express');
const router = express.Router();
const tags = require('../controllers/tagsController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);
router.get('/', tags.getTags);
router.post('/', tags.createTag);
router.put('/:id', tags.updateTag);
router.delete('/:id', tags.deleteTag);

module.exports = router;
