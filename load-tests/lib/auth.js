import http from 'k6/http';
import { check } from 'k6';

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const HIRER_EMAIL    = 'demo.somsri@careconnect.local';
export const CAREGIVER_EMAIL = 'demo.pim@careconnect.local';
export const TEST_PASSWORD  = 'DemoSeed123!';

export function login(email, password) {
  const res = http.post(
    `${BASE_URL}/api/auth/login/email`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'POST /api/auth/login/email' },
    }
  );

  const ok = check(res, {
    'login: status 200': (r) => r.status === 200,
  });

  if (!ok) {
    console.error(`Login failed [${email}]: ${res.status} — ${res.body}`);
    return null;
  }

  const body = JSON.parse(res.body);
  return body.data?.accessToken || null;
}

export function authHeaders(token) {
  return {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  };
}
