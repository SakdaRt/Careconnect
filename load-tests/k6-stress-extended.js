/**
 * Extended Stress Test — Find True Breaking Point
 * VU: ramp 300 → 500 → 700 → 1000, Duration: ~10 min
 * Goal: หา VU ที่ทำให้ error rate > 5% หรือ p95 > 2s จริงๆ
 *
 * Run: k6 run load-tests/k6-stress-extended.js
 */

import { sleep } from 'k6';
import { login, HIRER_EMAIL, CAREGIVER_EMAIL, TEST_PASSWORD } from './lib/auth.js';
import { runAuthGroup, runHirerJobGroup, runCGJobGroup, runWalletGroup } from './lib/checks.js';

export const options = {
  stages: [
    { duration: '30s', target: 300  },
    { duration: '60s', target: 500  },
    { duration: '60s', target: 700  },
    { duration: '60s', target: 1000 },
    { duration: '2m',  target: 1000 },
    { duration: '30s', target: 0    },
  ],
  thresholds: {
    http_req_failed:   ['rate<0.10'],   // ยอมรับ error ได้ถึง 10% เพื่อหา breaking point
    http_req_duration: ['p(95)<5000'],  // threshold กว้างเพื่อไม่ stop early
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

  sleep(Math.random() * 0.3 + 0.1); // aggressive: 0.1–0.4s think time
}
