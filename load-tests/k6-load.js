/**
 * Phase 2 — Load Test (Normal Load)
 * VU: ramp 10 → 50 → 100, Duration: ~5 min
 * Goal: วัด p95 response time และ error rate ที่ load ปกติ
 *
 * Run: k6 run load-tests/k6-load.js
 */

import { sleep } from 'k6';
import { login, HIRER_EMAIL, CAREGIVER_EMAIL, TEST_PASSWORD } from './lib/auth.js';
import { runAuthGroup, runHirerJobGroup, runCGJobGroup, runWalletGroup } from './lib/checks.js';

export const options = {
  stages: [
    { duration: '30s', target: 10  },
    { duration: '60s', target: 50  },
    { duration: '60s', target: 100 },
    { duration: '3m',  target: 100 },
    { duration: '30s', target: 0   },
  ],
  thresholds: {
    http_req_failed:                                          ['rate<0.01'],
    http_req_duration:                                        ['p(95)<500', 'p(99)<1000'],
    'http_req_duration{name:GET /api/auth/me}':               ['p(95)<300'],
    'http_req_duration{name:GET /api/auth/profile}':          ['p(95)<300'],
    'http_req_duration{name:GET /api/jobs/feed}':             ['p(95)<600'],
    'http_req_duration{name:GET /api/jobs/my-jobs}':          ['p(95)<500'],
    'http_req_duration{name:GET /api/jobs/stats}':            ['p(95)<400'],
    'http_req_duration{name:GET /api/wallet/balance}':        ['p(95)<300'],
    'http_req_duration{name:GET /api/wallet/transactions}':   ['p(95)<500'],
    'http_req_duration{name:POST /api/auth/login/email}':     ['p(95)<800'],
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

  sleep(Math.random() * 1 + 0.5);
}
