# CareConnect — Release Readiness Checklist

> อัพเดทล่าสุด: 2026-03-15

---

## 1. Development Environment (Current)

### Infrastructure ✅
- [x] Docker Compose ทำงานครบ (postgres, backend, frontend, mock-provider, pgadmin)
- [x] Hot reload ทำงานทั้ง frontend + backend
- [x] Database migrations sync แล้ว (19/19 applied)
- [x] Mock provider (payment/KYC/SMS) ทำงาน port 4000
- [x] Demo seed data พร้อม (20+ accounts, jobs, reviews, chat)

### Code Quality ✅
- [x] TypeScript strict mode — 0 errors
- [x] Vite build สำเร็จ (4.75s)
- [x] Backend tests: 63 passed, 0 failed
- [x] Technical debt cleanup เสร็จ (ลบ dead code 1,991 lines)
- [x] Documentation sync กับ implementation (SYSTEM.md, PROGRESS.md)

### Dev-Only Behaviors ⚠️ (ต้องปิดก่อน production)
- [ ] `auto-topup` — เติมเงินอัตโนมัติเมื่อยอดไม่พอ (`NODE_ENV !== 'production'`)
- [ ] `_dev_code` — OTP code ใน API response (`IS_DEV` flag)
- [ ] `mock-provider` — Payment/KYC/SMS simulation
- [ ] `SEED_MOCK_*` — Demo data seeding
- [ ] Rate limit สูง (1000 req/min แทน 10)

---

## 2. Testing / Staging Checklist

### Before Demo
- [x] ตรวจว่า seed data พร้อม (`npm run seed:demo`)
- [x] ตรวจว่า services ทั้ง 5 ตัวรัน (`docker compose up`)
- [x] ตรวจว่า frontend เข้าถึงได้ (http://localhost:5173)
- [x] ตรวจว่า admin login ได้ (admin account from seed)
- [ ] ตรวจ flow หลัก manual test:
  - [ ] Hirer: register → create job → publish → assign caregiver
  - [ ] Caregiver: register → accept job → checkin → checkout
  - [ ] Admin: login → view users → view disputes → settle
  - [ ] Chat: send message ระหว่าง hirer และ caregiver
  - [ ] Wallet: top-up → publish → checkout → verify balance

### Test Coverage
- [x] Auth integration: 14/14
- [x] Jobs integration: 14/14
- [x] Wallet integration: pass
- [x] Disputes integration: pass
- [x] E2E smoke: pass
- [x] Unit tests (policy, job service, trust worker, etc.): all pass
- [ ] Frontend component tests (skipped tests จาก socket.io mocking)
- [ ] E2E Playwright tests (planned, not implemented)

---

## 3. Production Checklist

### Environment Setup
- [ ] Set `NODE_ENV=production`
- [ ] ตั้ง `JWT_SECRET` แบบ random 64+ chars
- [ ] ตั้ง database credentials แบบ strong password
- [ ] ตั้ง `CORS_ORIGIN` เป็น production domain
- [ ] ตั้ง `FRONTEND_URL` + `BACKEND_URL` เป็น production URLs

### Payment Provider
- [ ] Stripe production keys (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`)
- [ ] ตั้ง `PAYMENT_PROVIDER=stripe`
- [ ] ทดสอบ Stripe webhook endpoint
- [ ] ลบ mock-provider service จาก docker-compose.prod.yml

### SMS Provider
- [ ] ตั้ง `SMS_PROVIDER=smsok`
- [ ] ตรวจ SMSOK balance เพียงพอ
- [ ] ตรวจ `SMSOK_API_KEY` + `SMSOK_API_SECRET` ถูกต้อง

### Email Provider
- [ ] ตั้ง `EMAIL_PROVIDER=smtp`
- [ ] ตรวจ SMTP credentials ถูกต้อง
- [ ] ทดสอบส่ง email จริง

### Security
- [ ] ปิด `SEED_MOCK_*` env vars ทั้งหมด
- [ ] ตั้ง rate limit ให้เหมาะกับ production
- [ ] ตั้ง `WEBHOOK_ALLOWED_IPS` สำหรับ Stripe IPs
- [ ] ตรวจว่า `.env` files ไม่ถูก commit
- [ ] ตั้ง HTTPS (via Cloudflare / reverse proxy)
- [ ] ตั้ง `UPLOAD_DIR` ที่ persistent storage

### Database
- [ ] รัน `npm run migrate` ใน production DB
- [ ] ตรวจว่า schema_migrations ครบ
- [ ] ตั้ง database backup schedule
- [ ] ตรวจ connection pool settings

### Monitoring
- [ ] ตั้ง health check endpoint monitoring
- [ ] ตั้ง log aggregation
- [ ] ตั้ง error alerting

---

## 4. Demo-Specific Preparation

### Demo Accounts (จาก seed data)

| Role | Email | Password | Trust |
|------|-------|----------|-------|
| Admin | `admin@careconnect.local` | (from ADMIN_PASSWORD env) | — |
| Hirer (demo) | ดูจาก seed output | (from MOCK_HIRER_PASSWORD env) | L2 |
| Caregiver (demo) | ดูจาก seed output | (from MOCK_CAREGIVER_PASSWORD env) | L2 |

### Demo Flow แนะนำ

1. **แสดง Hirer Journey**: Home → เลือกบริการ → เลือกผู้รับการดูแล → กรอกรายละเอียด → เลือกผู้ดูแล → submit
2. **แสดง Caregiver Journey**: Job feed → ดูรายละเอียด → accept → check-in → check-out
3. **แสดง Chat**: ส่งข้อความระหว่าง hirer กับ caregiver
4. **แสดง Admin**: Dashboard → user management → dispute management
5. **แสดง Trust System**: L0 → OTP verify → L1 → KYC → L2

### สิ่งที่ควรหลีกเลี่ยงตอนเดโม
- อย่าแสดง auto-topup (ถ้าไม่ได้เติมเงินก่อน ระบบเติมให้อัตโนมัติ)
- อย่าแสดง `_dev_code` ใน OTP response (ดูเหมือน security hole)
- อย่าแสดง mock-provider admin panel (port 4000)
- อย่าลบ demo seed data ก่อนเดโม

---

## 5. Post-Demo / Post-Submission

- [ ] Archive demo environment state
- [ ] Export database dump
- [ ] Document any manual configuration done
- [ ] Tag git release (`git tag v1.0.0-demo`)
