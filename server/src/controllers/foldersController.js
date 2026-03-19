const mongoose = require('mongoose');
const Folder = require('../models/Folder');
const ApiResponse = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getFolders = asyncHandler(async (req, res) => {
  const folders = await Folder.find({ userId: req.user.id }).sort({ order: 1 });
  ApiResponse.success(res, folders);
});

const createFolder = asyncHandler(async (req, res) => {
  const { id, _id, name, parentId, color } = req.body;
  if (!name) {
    return ApiResponse.error(res, 400, 'NAME_REQUIRED', 'Folder name is required');
  }

  const folder = await Folder.create({
    ...(mongoose.isValidObjectId(id || _id) ? { _id: id || _id } : {}),
    userId: req.user.id, name, parentId: parentId || null, color: color || null,
  });
  ApiResponse.created(res, folder);
});

const updateFolder = asyncHandler(async (req, res) => {
  const { name, color } = req.body;
  const folder = await Folder.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.id },
    { ...(name && { name }), ...(color !== undefined && { color }) },
    { new: true }
  );
  if (!folder) return ApiResponse.error(res, 404, 'FOLDER_NOT_FOUND', 'Folder not found');
  ApiResponse.success(res, folder);
});

const deleteFolder = asyncHandler(async (req, res) => {
  const folder = await Folder.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
  if (!folder) return ApiResponse.error(res, 404, 'FOLDER_NOT_FOUND', 'Folder not found');
  // Move notes from deleted folder to root
  const Note = require('../models/Note');
  await Note.updateMany({ folderId: folder._id, userId: req.user.id }, { folderId: null });
  ApiResponse.success(res, null, 'Folder deleted');
});

const reorderFolders = asyncHandler(async (req, res) => {
  const { orders } = req.body; // [{ id, order }]
  const bulk = orders.map(({ id, order }) => ({
    updateOne: { filter: { _id: id, userId: req.user.id }, update: { order } },
  }));
  await Folder.bulkWrite(bulk);
  ApiResponse.success(res, null, 'Reordered');
});

module.exports = { getFolders, createFolder, updateFolder, deleteFolder, reorderFolders };
