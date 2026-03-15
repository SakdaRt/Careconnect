# CareConnect — Demo Limitations & Known Issues

> อัพเดทล่าสุด: 2026-03-15
> ใช้สำหรับประกอบการนำเสนอและรายงาน

---

## 1. Dev-Only Behaviors ที่ทำงานอยู่ตอนเดโม

| Behavior | ตำแหน่งโค้ด | ผลกระทบ | Production ต้องทำอะไร |
|----------|------------|---------|---------------------|
| **Auto top-up เงินเมื่อยอดไม่พอ** | `jobService.js:315-333` | Hirer สามารถเผยแพร่งานได้แม้เงินไม่พอ — ระบบเติมให้อัตโนมัติ | ปิดโดย `NODE_ENV=production` |
| **OTP code แสดงใน response** | `otpService.js:165,245` | OTP code ถูกส่งกลับใน `_dev_code` field + log ใน console | ปิดโดย `NODE_ENV=production` |
| **Mock Payment Provider** | `docker-compose.yml:157` | การชำระเงิน/KYC/SMS ผ่าน mock service port 4000 | เปลี่ยนเป็น Stripe/SMSOK จริง |
| **Demo Seed Data** | `backend/src/seeds/demoSeed.js` | มี demo accounts 20+ พร้อม jobs, reviews, chat | ปิด `SEED_MOCK_*` env vars |
| **Rate limit สูง** | `docker-compose.yml` | Auth rate limit 1000 req/min (dev) vs 10 req/min (prod) | ตั้งค่าใหม่ใน production |

---

## 2. Known Limitations — ฟีเจอร์ที่ยังไม่สมบูรณ์

### 2.1 Caregiver Matching (Step 4)

| Limitation | รายละเอียด |
|-----------|-----------|
| **ไม่มี location proximity matching** | Backend search API ไม่มี lat/lng filter — แนะนำ caregiver โดยไม่คำนึงถึงระยะทาง |
| **Match score เป็น frontend-only** | คำนวณ skill match + rating + trust ที่ frontend ไม่ได้ persist ใน backend |
| **Available day เป็น declared** | ใช้ข้อมูล available_days จาก profile ไม่ใช่ real-time availability |

### 2.2 Payment & Financial

| Limitation | รายละเอียด |
|-----------|-----------|
| **Stripe เป็น Sandbox** | ใช้ test keys — ไม่มีการหักเงินจริง |
| **Withdrawal เป็น mock** | ถอนเงินผ่าน mock provider ไม่มีการโอนจริง |
| **Platform fee คงที่ 10%** | ยังไม่รองรับ dynamic fee หรือ promotion |

### 2.3 Communication

| Limitation | รายละเอียด |
|-----------|-----------|
| **SMS ผ่าน SMSOK** | ค่าใช้จ่ายจริง ~0.22 THB/ข้อความ, balance 109 THB |
| **Push notifications** | Schema + API พร้อม แต่ frontend Web Push ยังไม่ integrate |
| **Notification polling 15s** | ใช้ HTTP polling ไม่ใช่ WebSocket สำหรับ notification count |

### 2.4 Security & Identity

| Limitation | รายละเอียด |
|-----------|-----------|
| **KYC ผ่าน mock provider** | ไม่มีการตรวจสอบบัตรประชาชนจริง |
| **Google OAuth** | ต้องมี Google Client ID/Secret — ถ้าไม่ตั้งจะ disable |
| **Avatar ยังไม่มี CDN** | Upload ไปที่ local filesystem ไม่ใช่ cloud storage |

---

## 3. หน้าที่ทำงานสมบูรณ์

### Hirer Flow ✅
- สมัครสมาชิก / Login (Email, Phone, Google)
- Service-first home page
- 5-step guided booking wizard
- Caregiver search + contextual matching
- Job management (create, publish, cancel)
- Chat กับ caregiver
- Wallet (top-up, balance, history)
- Care recipient management
- Dispute system
- Complaint system

### Caregiver Flow ✅
- สมัครสมาชิก / Login
- Profile management + document upload
- Job feed + search + filter
- Accept/reject job
- Check-in / Check-out (GPS + photo evidence)
- Chat กับ hirer
- Wallet (balance, withdraw, history)
- Availability calendar
- Early checkout request

### Admin Flow ✅
- Dashboard + statistics
- User management (search, edit, ban, KYC review)
- Job management (view, cancel)
- Dispute management (assign, settle, refund/payout)
- Complaint management
- Financial reports
- Ledger transactions
- System settings (health check, trust recalculate)

---

## 4. หน้า/ฟีเจอร์ที่มี Placeholder Content

| หน้า | สถานะ | หมายเหตุ |
|------|-------|---------|
| Admin Reports | **Functional** | แสดงข้อมูลจริง แต่ charts ยังเป็น text-based |
| Settings Page | **Functional** | มี password change, notification prefs — ไม่มี account deletion |
| Bank Accounts | **Functional** | มี placeholder "ธนาคารไทย" ใน bank list |

---

## 5. ข้อมูลสำหรับใส่ในรายงาน

### Technology Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js (ESM) + Express + PostgreSQL 15
- **Real-time**: Socket.IO
- **Auth**: JWT + Refresh Token + Google OAuth + OTP (Email/SMS)
- **Payment**: Stripe (Sandbox) + Double-entry Ledger
- **Deployment**: Docker Compose + Cloudflare Tunnel

### Scale
- **Database**: 34 tables, 1228 lines schema
- **Backend**: 18 API route files, 63 automated tests
- **Frontend**: 50+ pages, TypeScript strict mode
- **Features**: 11 core modules (Auth, Trust, Job, Chat, Wallet, KYC, Dispute, Complaint, Notification, Review, Admin)
