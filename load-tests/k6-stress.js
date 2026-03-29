/**
 * Phase 3 — Stress Test (Breaking Point)
 * VU: ramp 50 → 100 → 200 → 300, Duration: ~8 min
 * Goal: หา breaking point — VU ที่ error rate > 5% หรือ p95 > 2s
 *
 * Run: k6 run load-tests/k6-stress.js
 */

import { sleep } from 'k6';
import { login, HIRER_EMAIL, CAREGIVER_EMAIL, TEST_PASSWORD } from './lib/auth.js';
import { runAuthGroup, runHirerJobGroup, runCGJobGroup, runWalletGroup } from './lib/checks.js';

export const options = {
  stages: [
    { duration: '30s', target: 50  },
    { duration: '60s', target: 100 },
    { duration: '60s', target: 200 },
    { duration: '60s', target: 300 },
    { duration: '2m',  target: 300 },
    { duration: '30s', target: 0   },
  ],
  thresholds: {
    // stress thresholds — looser than load
    http_req_failed:   ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
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

  sleep(Math.random() * 0.5 + 0.1);
}
