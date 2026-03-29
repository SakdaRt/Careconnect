/**
 * Phase 4 — Soak Test (Endurance)
 * VU: 30 sustained, Duration: 10 min
 * Goal: ดู memory leak, connection pool exhaustion, response time drift
 *
 * Run: k6 run load-tests/k6-soak.js
 */

import { sleep } from 'k6';
import { login, HIRER_EMAIL, CAREGIVER_EMAIL, TEST_PASSWORD } from './lib/auth.js';
import { runAuthGroup, runHirerJobGroup, runCGJobGroup, runWalletGroup } from './lib/checks.js';

export const options = {
  stages: [
    { duration: '30s', target: 30 },
    { duration: '10m', target: 30 },
    { duration: '30s', target: 0  },
  ],
  thresholds: {
    http_req_failed:   ['rate<0.01'],
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    'http_req_duration{name:GET /api/auth/me}':              ['p(95)<400'],
    'http_req_duration{name:GET /api/jobs/feed}':            ['p(95)<700'],
    'http_req_duration{name:GET /api/wallet/balance}':       ['p(95)<400'],
  },
};

export function setup() {
  const hirerToken     = login(HIRER_EMAIL, TEST_PASSWORD);
  const caregiverToken = login(CAREGIVER_EMAIL, TEST_PASSWORD);

  if (!hirerToken || !caregiverToken) {
    throw new Error('Setup failed: ไม่สามารถ login ได้');
  }
  return { hirerToken, caregiverToken };
}

export default function ({ hirerToken, caregiverToken }) {
  const r       = Math.random();
  const isHirer = __VU % 2 === 0;
  const token   = isHirer ? hirerToken : caregiverToken;

  if (r < 0.40) {
    runAuthGroup(token);
  } else if (r < 0.75) {
    if (isHirer) {
      runHirerJobGroup(hirerToken);
    } else {
      runCGJobGroup(caregiverToken);
    }
  } else {
    runWalletGroup(token);
  }

  sleep(Math.random() * 1.5 + 0.5);
}
