/**
 * Mock Provider Endpoints for Testing
 * Simulates external services like Twilio, payment providers, etc.
 */

import express from 'express';
import { beforeAll, afterAll } from '@jest/globals';

const mockProviders = {};

// Mock Twilio SMS Service
mockProviders.twilio = express();
mockProviders.twilio.post('/2010-04-01/Accounts/testsid/Messages.json', (req, res) => {
  res.status(201).json({
    sid: 'SM' + Math.random().toString(36).substr(2, 9),
    status: 'queued',
    to: req.body.To,
    from: req.body.From,
    body: req.body.Body
  });
});

// Mock Payment Provider
mockProviders.payment = express();
mockProviders.payment.post('/charges', (req, res) => {
  res.status(200).json({
    id: 'ch_' + Math.random().toString(36).substr(2, 9),
    status: 'succeeded',
    amount: req.body.amount,
    currency: req.body.currency || 'usd',
    source: req.body.source
  });
});

mockProviders.payment.post('/refunds', (req, res) => {
  res.status(200).json({
    id: 're_' + Math.random().toString(36).substr(2, 9),
    status: 'succeeded',
    amount: req.body.amount,
    charge: req.body.charge
  });
});

// Mock Email Service
mockProviders.email = express();
mockProviders.email.post('/send', (req, res) => {
  res.status(200).json({
    messageId: 'msg_' + Math.random().toString(36).substr(2, 9),
    status: 'sent',
    to: req.body.to,
    subject: req.body.subject
  });
});

// Mock KYC Provider
mockProviders.kyc = express();
mockProviders.kyc.post('/verifications', (req, res) => {
  res.status(200).json({
    id: 'ver_' + Math.random().toString(36).substr(2, 9),
    status: 'pending',
    documents: req.body.documents
  });
});

mockProviders.kyc.get('/verifications/:id', (req, res) => {
  res.status(200).json({
    id: req.params.id,
    status: 'approved',
    verified_at: new Date().toISOString()
  });
});

// Mock File Upload Service
mockProviders.upload = express();
mockProviders.upload.post('/upload', (req, res) => {
  res.status(200).json({
    url: `https://mock-cdn.example.com/files/${Math.random().toString(36).substr(2, 9)}.jpg`,
    filename: req.body.filename || 'test-file.jpg',
    size: req.body.size || 1024
  });
});

// Mock Geocoding Service
mockProviders.geocoding = express();
mockProviders.geocoding.get('/geocode', (req, res) => {
  res.status(200).json({
    lat: 13.7563,
    lng: 100.5018,
    address: req.query.address || '123 Test St, Bangkok, Thailand'
  });
});

mockProviders.geocoding.get('/reverse', (req, res) => {
  res.status(200).json({
    address: '123 Test St, Bangkok, Thailand',
    city: 'Bangkok',
    country: 'Thailand',
    postal_code: '10110'
  });
});

// Start mock servers
let servers = [];

export const startMockProviders = async () => {
  const portPromises = Object.entries(mockProviders).map(async ([name, app]) => {
    return new Promise((resolve) => {
      const server = app.listen(0, () => {
        const port = server.address().port;
        servers.push({ name, server, port });
        resolve({ name, port });
      });
    });
  });

  const ports = await Promise.all(portPromises);
  
  // Set environment variables for mock providers
  process.env.TWILIO_MOCK_URL = `http://localhost:${ports.find(p => p.name === 'twilio').port}`;
  process.env.PAYMENT_MOCK_URL = `http://localhost:${ports.find(p => p.name === 'payment').port}`;
  process.env.EMAIL_MOCK_URL = `http://localhost:${ports.find(p => p.name === 'email').port}`;
  process.env.KYC_MOCK_URL = `http://localhost:${ports.find(p => p.name === 'kyc').port}`;
  process.env.UPLOAD_MOCK_URL = `http://localhost:${ports.find(p => p.name === 'upload').port}`;
  process.env.GEOCODING_MOCK_URL = `http://localhost:${ports.find(p => p.name === 'geocoding').port}`;
  
  return ports;
};

export const stopMockProviders = async () => {
  const closePromises = servers.map(({ name, server }) => {
    return new Promise((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });
  
  await Promise.all(closePromises);
  servers = [];
};

// Global setup and teardown
beforeAll(async () => {
  await startMockProviders();
});

afterAll(async () => {
  await stopMockProviders();
});

export default mockProviders;
