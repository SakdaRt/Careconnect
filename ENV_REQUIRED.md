# CareConnect — Environment Variables Reference

> อัพเดทล่าสุด: 2026-03-15

---

## Backend (Node.js / Express)

### Required — ระบบจะไม่ทำงานถ้าขาด

| Variable | ตัวอย่าง | คำอธิบาย |
|----------|---------|---------|
| `DATABASE_HOST` | `postgres` | PostgreSQL host |
| `DATABASE_PORT` | `5432` | PostgreSQL port |
| `DATABASE_NAME` | `careconnect` | Database name |
| `DATABASE_USER` | `careconnect` | Database user |
| `DATABASE_PASSWORD` | `(secret)` | Database password |
| `JWT_SECRET` | `(secret, min 32 chars)` | JWT signing secret |
| `PORT` | `3000` | Backend port |
| `NODE_ENV` | `development` / `production` | Environment mode |

### Auth & Security

| Variable | ตัวอย่าง | คำอธิบาย |
|----------|---------|---------|
| `JWT_EXPIRES_IN` | `15m` | Access token expiry (default: 15m) |
| `JWT_REFRESH_EXPIRES_IN` | `7d` | Refresh token expiry (default: 7d) |
| `CORS_ORIGIN` | `http://localhost:5173` | Allowed CORS origin |
| `FRONTEND_URL` | `http://localhost:5173` | Frontend URL for redirects |
| `BACKEND_URL` | `http://localhost:3000` | Backend self URL |

### Google OAuth (optional — ถ้าไม่ตั้ง จะ disable Google login)

| Variable | คำอธิบาย |
|----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL |

### SMS Provider — SMSOK (optional — ถ้าไม่ตั้ง จะ fallback เป็น console log)

| Variable | คำอธิบาย |
|----------|---------|
| `SMSOK_API_KEY` | SMSOK API key |
| `SMSOK_API_SECRET` | SMSOK API secret |
| `SMSOK_API_URL` | `https://api.smsok.co/s` |
| `SMSOK_SENDER` | Sender name |
| `SMS_PROVIDER` | `smsok` / `mock` |

### Email / SMTP (optional — ถ้าไม่ตั้ง จะ fallback เป็น console log)

| Variable | คำอธิบาย |
|----------|---------|
| `SMTP_HOST` | SMTP server host |
| `SMTP_PORT` | SMTP port (587) |
| `SMTP_USER` | SMTP username |
| `SMTP_PASS` | SMTP password |
| `SMTP_SECURE` | `true` / `false` |
| `EMAIL_FROM` | Sender email address |
| `EMAIL_PROVIDER` | `smtp` / `mock` |

### Payment — Stripe (optional — ถ้าไม่ตั้ง จะใช้ mock provider)

| Variable | คำอธิบาย |
|----------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `PAYMENT_PROVIDER` | `stripe` / `mock` |

### Mock Provider (dev only)

| Variable | คำอธิบาย |
|----------|---------|
| `MOCK_PROVIDER_BASE_URL` | `http://mock-provider:4000` |
| `MOCK_PROVIDER_URL` | (alias) |

### Rate Limiting (optional — มี defaults)

| Variable | Default | คำอธิบาย |
|----------|---------|---------|
| `RATE_LIMIT_AUTH_MAX` | `10` | Auth endpoint max requests |
| `RATE_LIMIT_AUTH_WINDOW_MS` | `60000` | Auth window (ms) |
| `RATE_LIMIT_OTP_MAX` | `5` | OTP endpoint max requests |
| `RATE_LIMIT_OTP_WINDOW_MS` | `60000` | OTP window (ms) |
| `RATE_LIMIT_DEFAULT_MAX` | `100` | Default max requests |
| `RATE_LIMIT_DEFAULT_WINDOW_MS` | `60000` | Default window (ms) |

### Seed Data (dev only)

| Variable | คำอธิบาย |
|----------|---------|
| `SEED_MOCK_CAREGIVERS` | `true` — seed mock caregivers on bootstrap |
| `SEED_MOCK_JOBS` | `true` — seed mock jobs on bootstrap |
| `ADMIN_EMAIL` | Admin account email |
| `ADMIN_PASSWORD` | Admin account password |
| `MOCK_HIRER_PASSWORD` | Demo hirer password |
| `MOCK_CAREGIVER_PASSWORD` | Demo caregiver password |

### Other

| Variable | คำอธิบาย |
|----------|---------|
| `UPLOAD_DIR` | Upload directory path |
| `WEBHOOK_BASE_URL` | Webhook callback base URL |
| `WEBHOOK_SECRET` | Webhook signature secret |
| `WEBHOOK_ALLOWED_IPS` | Comma-separated allowed IPs |

---

## Frontend (Vite / React)

| Variable | ตัวอย่าง | คำอธิบาย |
|----------|---------|---------|
| `VITE_API_URL` | `http://localhost:3000` | Backend API URL |
| `VITE_API_BASE_URL` | `/api` | API base path |
| `VITE_SOCKET_URL` | `http://localhost:3000` | Socket.IO server URL |
| `VITE_GOOGLE_MAPS_API_KEY` | `AIza...` | Google Maps API key (for location picker) |
| `VITE_VAPID_PUBLIC_KEY` | `(VAPID key)` | Web Push VAPID public key (optional) |

---

## Docker Compose (dev)

ดู `docker-compose.yml` และ `docker-compose.override.yml` สำหรับ default values ทั้งหมด

**สำคัญ**: ไม่ควร commit `.env` files ที่มี secrets จริง
