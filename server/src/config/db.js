const mongoose = require('mongoose');
const { MONGO_URI } = require('./env');

async function connectToDatabase() {
  if (!MONGO_URI) {
    console.warn('MONGO_URI not set; skipping database connection for now.');
    return;
  }

  // Disable buffering globally so API calls fail instantly if DB is disconnected
  mongoose.set('bufferCommands', false);

  try {
    await mongoose.connect(MONGO_URI, {
      autoIndex: true,
      serverSelectionTimeoutMS: 2000, // Fail fast if no DB
      connectTimeoutMS: 2000,
    });
    console.log('MongoDB connected');
  } catch (err) {
    console.warn('MongoDB connection failed (non-fatal):', err.message);
    console.warn('Server will start without database. Auth and notes APIs will fail until DB is available.');
  }
}

module.exports = { connectToDatabase };
