const Tag = require('../models/Tag');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getTags = asyncHandler(async (req, res) => {
  const tags = await Tag.find({ userId: req.user.id });
  ApiResponse.success(res, tags);
});

const createTag = asyncHandler(async (req, res) => {
  const tag = await Tag.create({ userId: req.user.id, name: req.body.name, color: req.body.color || null });
  ApiResponse.created(res, tag);
});

const updateTag = asyncHandler(async (req, res) => {
  const tag = await Tag.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { ...(req.body.name && { name: req.body.name }), ...(req.body.color !== undefined && { color: req.body.color }) },
    { new: true }
  );
  if (!tag) return ApiResponse.error(res, 404, 'TAG_NOT_FOUND', 'Tag not found');
  ApiResponse.success(res, tag);
});

const deleteTag = asyncHandler(async (req, res) => {
  const tag = await Tag.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!tag) return ApiResponse.error(res, 404, 'TAG_NOT_FOUND', 'Tag not found');
  ApiResponse.success(res, null, 'Tag deleted');
});

module.exports = { getTags, createTag, updateTag, deleteTag };
