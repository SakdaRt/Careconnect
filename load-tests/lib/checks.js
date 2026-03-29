import { check, group } from 'k6';
import http from 'k6/http';
import { BASE_URL, authHeaders } from './auth.js';

export function checkStatus(res, name, expectedStatus = 200) {
  return check(res, {
    [`${name}: status ${expectedStatus}`]: (r) => r.status === expectedStatus,
    [`${name}: has body`]: (r) => r.body && r.body.length > 0,
  });
}

// ------------------------------------------------------------------
// Auth group
// ------------------------------------------------------------------
export function runAuthGroup(token) {
  group('Auth', () => {
    const meRes = http.get(
      `${BASE_URL}/api/auth/me`,
      { ...authHeaders(token), tags: { name: 'GET /api/auth/me' } }
    );
    checkStatus(meRes, 'GET /me');

    const profileRes = http.get(
      `${BASE_URL}/api/auth/profile`,
      { ...authHeaders(token), tags: { name: 'GET /api/auth/profile' } }
    );
    checkStatus(profileRes, 'GET /profile');
  });
}

// ------------------------------------------------------------------
// Job group — Hirer (my-jobs + stats)
// ------------------------------------------------------------------
export function runHirerJobGroup(token) {
  group('Jobs-Hirer', () => {
    const myJobsRes = http.get(
      `${BASE_URL}/api/jobs/my-jobs?page=1&limit=10`,
      { ...authHeaders(token), tags: { name: 'GET /api/jobs/my-jobs' } }
    );
    checkStatus(myJobsRes, 'GET /jobs/my-jobs');

    const statsRes = http.get(
      `${BASE_URL}/api/jobs/stats`,
      { ...authHeaders(token), tags: { name: 'GET /api/jobs/stats' } }
    );
    checkStatus(statsRes, 'GET /jobs/stats');
  });
}

// ------------------------------------------------------------------
// Job group — Caregiver (feed)
// ------------------------------------------------------------------
export function runCGJobGroup(token) {
  group('Jobs-CG', () => {
    const feedRes = http.get(
      `${BASE_URL}/api/jobs/feed?page=1&limit=10`,
      { ...authHeaders(token), tags: { name: 'GET /api/jobs/feed' } }
    );
    checkStatus(feedRes, 'GET /jobs/feed');
  });
}

// ------------------------------------------------------------------
// Wallet group
// ------------------------------------------------------------------
export function runWalletGroup(token) {
  group('Wallet', () => {
    const balRes = http.get(
      `${BASE_URL}/api/wallet/balance`,
      { ...authHeaders(token), tags: { name: 'GET /api/wallet/balance' } }
    );
    checkStatus(balRes, 'GET /wallet/balance');

    const txRes = http.get(
      `${BASE_URL}/api/wallet/transactions?page=1&limit=10`,
      { ...authHeaders(token), tags: { name: 'GET /api/wallet/transactions' } }
    );
    checkStatus(txRes, 'GET /wallet/transactions');
  });
}
