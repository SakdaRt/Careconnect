/**
 * Phase 1 — Smoke Test
 * VU: 1→5, Duration: 30s
 * Goal: ยืนยันว่า endpoints ทั้งหมดตอบสนองปกติก่อนรัน load จริง
 *
 * Run: k6 run load-tests/k6-smoke.js
 */

import { sleep } from 'k6';
import { login, HIRER_EMAIL, CAREGIVER_EMAIL, TEST_PASSWORD } from './lib/auth.js';
import { runAuthGroup, runHirerJobGroup, runCGJobGroup, runWalletGroup } from './lib/checks.js';

export const options = {
  stages: [
    { duration: '10s', target: 1 },
    { duration: '15s', target: 5 },
    { duration: '5s',  target: 0 },
  ],
  thresholds: {
    http_req_failed:              ['rate<0.01'],
    http_req_duration:            ['p(95)<1000'],
    'http_req_duration{name:GET /api/auth/me}':             ['p(95)<500'],
    'http_req_duration{name:GET /api/jobs/feed}':           ['p(95)<800'],
    'http_req_duration{name:GET /api/wallet/balance}':      ['p(95)<500'],
  },
};

export function setup() {
  const hirerToken     = login(HIRER_EMAIL, TEST_PASSWORD);
  const caregiverToken = login(CAREGIVER_EMAIL, TEST_PASSWORD);

  if (!hirerToken || !caregiverToken) {
    throw new Error('Setup failed: ไม่สามารถ login ได้ — ตรวจสอบ backend และ seed data');
  }
  return { hirerToken, caregiverToken };
}

export default function ({ hirerToken, caregiverToken }) {
  const isHirer = __VU % 2 === 0;
  const token   = isHirer ? hirerToken : caregiverToken;

  runAuthGroup(token);
  if (isHirer) {
    runHirerJobGroup(hirerToken);
  } else {
    runCGJobGroup(caregiverToken);
  }
  runWalletGroup(token);

  sleep(1);
}
