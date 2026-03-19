const express = require('express');
const mongoose = require('mongoose');

const router = express.Router();

router.get('/', (req, res) => {
  const dbState = mongoose.connection.readyState;
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now(), dbState });
});

module.exports = router;

