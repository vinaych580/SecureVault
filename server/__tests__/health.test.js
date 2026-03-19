const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');

describe('GET /api/health', () => {
  it('returns ok status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptime).toBe('number');
  });

  it('returns 503 for database-backed routes when MongoDB is disconnected', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');

    Object.defineProperty(mongoose.connection, 'readyState', {
      configurable: true,
      get: () => 0,
    });

    try {
      const res = await request(app).get('/api/auth/verify-email?token=test-token');

      expect(res.status).toBe(503);
      expect(res.body.error.code).toBe('DATABASE_UNAVAILABLE');
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(mongoose.connection, 'readyState', originalDescriptor);
      }
    }
  });
});

