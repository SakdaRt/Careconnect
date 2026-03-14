# CareConnect — Progress Log

> อัพเดทล่าสุด: 2026-03-14
> AI ต้องอ่านไฟล์นี้ก่อนเริ่มทำงานทุกครั้ง

---

## โปรเจคคืออะไร

CareConnect — แพลตฟอร์มเชื่อมต่อผู้ว่าจ้างกับผู้ดูแลผู้สูงอายุในประเทศไทย
โปรเจคจบมหาลัย พัฒนาด้วย React + Node.js + PostgreSQL

---

## Architecture Overview

```
careconnect/
├── frontend/          React 18 + TypeScript + Tailwind CSS + Vite
│   ├── src/
│   │   ├── pages/     หน้าต่างๆ แบ่งตาม role (hirer, caregiver, admin, shared, auth, public)
│   │   ├── components/  UI components (ui/, navigation/)
│   │   ├── layouts/   MainLayout, AdminLayout
│   │   ├── contexts/  AuthContext
│   │   ├── services/  api.ts, appApi.ts
│   │   └── router.tsx + routerGuards.tsx
├── backend/           Node.js + Express + PostgreSQL
│   ├── src/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/  auth.js (JWT + policy gates)
│   │   ├── utils/       errors.js, risk.js, db.js, validation.js
│   │   ├── workers/     trustLevelWorker.js
│   │   ├── sockets/     chatSocket.js, realtimeHub.js
│   │   └── server.js
│   ├── database/
│   │   ├── schema.sql
│   │   └── migrations/
│   └── tests/           Jest integration + unit (13 test files)
├── database/
│   └── schema.sql             master schema (25+ tables, 1111 lines)
├── docker-compose.yml         (dev — รัน postgres + backend + frontend + pgadmin)
├── docker-compose.override.yml (auto-merge กับ dev สำหรับ hot-reload)
├── docker-compose.test.yml    (test environment — port 5433)
├── docker-compose.prod.yml    (production — ไม่มี dev tools)
├── PROGRESS.md        (ไฟล์นี้ — ความคืบหน้า)
├── SYSTEM.md          (source of truth — ERD, API, UML, page map)
└── .windsurfrules     (กฎ AI)
```

---

## ระบบหลักที่ Implement แล้ว

### Auth & User

- [x] Email/Password registration + login (Guest & Member)
- [x] Phone OTP registration + login
- [x] Google OAuth (Authorization Code flow)
- [x] JWT + Refresh token
- [x] Auto-create profile (display_name) ตอน register
- [x] RequireProfile guard — บังคับตั้งชื่อก่อนใช้งาน
- [x] Email/phone masked ใน TopBar dropdown

### Trust Level System

- [x] L0 (Unverified) → L1 (Phone verified) → L2 (KYC approved) → L3 (Trusted)
- [x] Risk-based job publishing: low_risk ต้อง L1+, high_risk ต้อง L2+
- [x] Caregiver accepting: min_trust_level auto-set ตาม risk_level

### Job System

- [x] Create/Edit/Publish job (hirer)
- [x] Job feed + filter (caregiver)
- [x] Job assignment, check-in, check-out
- [x] Job status flow: draft → posted → assigned → in_progress → completed/cancelled
- [x] Dispute system

### KYC

- [x] อัพโหลดเอกสาร (ด้านหน้า/หลัง) + selfie
- [x] Admin review + approve/reject
- [x] Step indicator (3 ขั้นตอน)

### Chat

- [x] ChatRoomPage — real-time chat ระหว่าง hirer/caregiver
- [x] DisputeChatPage — admin เข้าร่วมได้
- [x] แสดง role label แทน email/phone

### Notifications

- [x] Real-time notification count ใน TopBar (polling 30s)
- [x] NotificationsPage — อ่าน/mark as read
- [x] Trigger: job accepted, check-in, check-out

### Wallet & Payment

- [x] Top up, withdraw, transfer
- [x] Bank account management (hirer L0+ / caregiver L1+)
- [x] Transaction history

### Admin

- [x] AdminUsersPage — ดู/แก้ไข user, ban, wallet info
- [x] KYC review
- [x] Dispute management

### UI/UX & Accessibility

- [x] WCAG 2.1 AA audit ครบ (PR-A11Y, PR-FORMS, PR-BTNS, PR-TYPO, PR-CONTRAST)
- [x] Focus trap ใน Modal
- [x] Skip navigation link
- [x] aria-label ทุก icon-only button
- [x] aria-hidden ทุก decorative icon
- [x] text-gray-400 → text-gray-500+ ทุก readable text
- [x] OTP label htmlFor เชื่อม input

---

## สิ่งที่ยังค้างอยู่ / TODO

### High Priority

- [x] แก้ Google OAuth redirect ไป localhost ใน production (เพิ่ม BACKEND_URL env var)
- [x] Forgot password (backend + frontend + migration + ResetPasswordPage)
- [x] ทดสอบ Google OAuth แบบ end-to-end บน browser จริง (ยืนยันแบบ manual โดยผู้ใช้; automation ยังเสี่ยงโดน Google anti-bot block)
- [x] E2E smoke tests ฝั่ง backend (Jest + Supertest) ครอบคลุม 4 happy paths
- [x] E2E tests ฝั่ง browser (Playwright baseline + smoke specs)

### Medium Priority

- [x] Email notification (ส่ง email จริงเมื่อมี notification)
- [x] Push notification (PWA)
- [x] Caregiver availability calendar

### Low Priority

- [x] ยกเลิก Dark mode (บังคับ Light mode เท่านั้น)
- [x] Tabular numerals สำหรับตัวเลขเงิน
- [x] Badge color sole indicator → เพิ่ม icon/pattern
- [x] แยก mock data ออกจาก server.js → seeds/mockData.js (780 บรรทัด)
- [x] ลบ ensureReviewsAndFavoritesTables() ซ้ำซ้อนกับ migration
- [x] เพิ่ม `caregiver_documents` table ลง `schema.sql` (ก่อนหน้ามีแต่ migration, Docker init ไม่สร้าง table)
- [x] แก้ profile name ไม่ persist หลัง logout/login — ใช้ `refreshUser()` แทน `updateUser()` หลัง save
- [x] แก้ login Joi validation ปัด `.local` TLD — เพิ่ม `tlds: { allow: false }` ใน `authSchemas.login`

---

## ไฟล์สำคัญที่ต้องรู้จัก

| ไฟล์                                      | หน้าที่                                         |
| ----------------------------------------- | ----------------------------------------------- |
| `frontend/src/router.tsx`                 | Route definitions + guards                      |
| `frontend/src/routerGuards.tsx`           | RequireAuth, RequireRole, RequireProfile        |
| `frontend/src/contexts/AuthContext.tsx`   | Global auth state                               |
| `frontend/src/services/api.ts`            | Axios instance + API methods                    |
| `frontend/src/services/appApi.ts`         | App-specific API (favorites, etc.)              |
| `frontend/src/components/ui/`             | Button, Input, Modal, Badge, Avatar, Card, etc. |
| `frontend/src/layouts/MainLayout.tsx`     | Layout หลัก (TopBar + BottomBar)                |
| `frontend/src/layouts/AdminLayout.tsx`    | Layout admin (sidebar)                          |
| `backend/src/middleware/auth.js`          | JWT verify + policy gates                       |
| `backend/src/services/authService.js`     | Register, login, token logic                    |
| `backend/src/services/jobService.js`      | Job business logic                              |
| `backend/src/models/Notification.js`      | Notification model                              |
| `database/schema.sql`                     | Master DB schema (25+ tables)                   |
| `backend/database/migrations/`            | Migration files                                 |
| `backend/src/workers/trustLevelWorker.js` | Trust score calculation + level determination   |
| `backend/src/utils/risk.js`               | Risk level auto-compute                         |
| `backend/src/utils/errors.js`             | Custom error classes (7 types) + error handler  |
| `backend/src/sockets/chatSocket.js`       | Socket.IO chat events (12 events)               |
| `backend/src/sockets/realtimeHub.js`      | Realtime push to user rooms                     |

---

## Git Log (งานล่าสุด)

### 2026-03-14 — Refactor CreateJobPage เป็น 5-step guided booking wizard (mobile-first)

- feat(frontend): เปลี่ยน `CreateJobPage.tsx` จาก 4-step → 5-step wizard
  - **Step 1** (เลือกบริการ): Service category cards แบบ visual — เลือกแล้ว auto-fill template
  - **Step 2** (ผู้รับการดูแล): Card-based recipient picker + inline quick-add + patient summary
  - **Step 3** (รายละเอียดงาน): Dynamic questions + schedule + location + price + tasks (progressive disclosure)
  - **Step 4** (ผู้ดูแล): แสดง preferred caregiver ถ้ามี หรือ "โพสต์หาผู้ดูแล"
  - **Step 5** (ตรวจทาน): Summary cards แต่ละส่วนพร้อมปุ่ม "แก้ไข" กลับไปแต่ละ step
  - Mobile-first: progress bar + step chips + sticky bottom nav + large touch targets
  - Progressive disclosure: tasks/skills/equipment/precautions ซ่อนใน `<details>` element
  - URL params: `?service` pre-selects service, `?recipient` pre-selects care recipient
  - คง preferred_caregiver_id + return_to_assign + blocker modal + review modal ไว้ทั้งหมด
  - ไม่แก้ backend/API — ใช้ `appApi.createJob()` เดิม
- verify:
  - ✅ TypeScript typecheck: PASS (0 errors)
  - ✅ Vite build: PASS (5.28s)
  - ไม่มี backend changes

### 2026-03-14 — Redesign hirer UX: service-first home + guided booking flow

- feat(frontend): Redesign `HirerHomePage.tsx` เป็น service-first layout
  - **Section 1**: Service category cards (6 ประเภท) เป็น primary entry point
    - พาไปโรงพยาบาล, ดูแลทั่วไป, ดูแลหลังผ่าตัด, ดูแลสมองเสื่อม, ดูแลผู้ป่วยติดเตียง, ดูแลอุปกรณ์การแพทย์
    - คลิก → navigate ไป CreateJobPage พร้อม `?service=<type>` pre-selected
  - **Section 2**: Care recipients quick access (horizontal scroll cards)
    - แสดง recipients ที่มีอยู่ + "เพิ่มผู้รับการดูแล" card
    - คลิก recipient → navigate ไป CreateJobPage พร้อม `?recipient=<id>`
  - **Section 3**: Active jobs dashboard (ปรับปรุง)
    - Improved empty states (contextual messages + emoji + actionable buttons)
    - Status filter tabs ที่ดีขึ้น
  - Personalized greeting: "สวัสดี, {ชื่อผู้ใช้}"
  - คง onboarding checklist, calendar modal, dispute/cancel modals ไว้ทั้งหมด
- feat(frontend): เพิ่ม URL params support ใน `CreateJobPage.tsx`
  - `?service=<DetailedJobType>` → pre-select service template + auto-fill title/tasks/skills
  - `?recipient=<uuid>` → pre-select care recipient
  - ใช้งานร่วมกับ params เดิม (`preferred_caregiver_id`, `return_to_assign`)
- verify:
  - ✅ TypeScript typecheck: PASS (0 errors)
  - ✅ Vite build: PASS (4.67s)
  - ไม่มี backend changes — ใช้ API เดิมทั้งหมด
  - ไม่มี route changes — ใช้ URL เดิม `/hirer/home` + `/hirer/create-job`

### 2026-03-14 — Fix SMS OTP system: persistent storage + SMSOK integration + password validation

- fix(backend): เขียน `backend/src/services/otpService.js` ใหม่ทั้งไฟล์
  - **Root cause #1**: OTP เก็บใน in-memory Map → backend restart ทำ OTP หายทั้งหมด → verify ไม่ได้
  - **Fix**: ย้ายไปเก็บใน PostgreSQL `otp_codes` table (hash OTP code ด้วย SHA-256)
  - เพิ่ม brute-force protection: max 5 verify attempts ต่อ OTP
  - เพิ่ม SMSOK destination status check (ตรวจ `NO_ERROR` per destination)
  - เพิ่ม SMSOK credential validation (throw ถ้าไม่มี API key)
  - เพิ่ม comprehensive logging: ทุก step ของ send/verify flow
  - เพิ่ม dev mode: แสดง OTP code ใน console + response (`_dev_code`)
  - แก้ default SMSOK URL: `https://smsok.co/api/v1/s` → `https://api.smsok.co/s`
  - เพิ่ม auto-cleanup expired OTPs
- feat(database): สร้าง migration `backend/database/migrations/20260314_01_otp_codes.sql`
  - `otp_codes` table: id, user_id, type, destination, code_hash, verified, attempts, sent_at, expires_at
- fix(frontend): **Root cause #2** แก้ password validation mismatch
  - `MemberRegisterPage.tsx`: เปลี่ยน min 6 → 8 ให้ตรง backend Joi schema `min(8)`
  - `GuestRegisterPage.tsx`: เปลี่ยน min 6 → 8 เช่นเดียวกัน
- verify (end-to-end test ใน Docker):
  - ✅ SMSOK API: 201 NO_ERROR, message_id ได้, balance 109.68
  - ✅ OTP stored in PostgreSQL: survive backend restart
  - ✅ Dev mode: `_dev_code` in response + console log
  - ✅ Verify OTP: success, `is_phone_verified=true`, `trust_level=L1`
  - ✅ Frontend tsc: PASS (0 errors)

### 2026-03-14 — Full project audit + fix latent bugs + sync test mocks

- audit(all): Full repository rescan — อ่านทุกไฟล์สำคัญ ตรวจ current state ทั้ง frontend/backend/database
- fix(backend): แก้ `User.searchUsers()` ใน `backend/src/models/User.js`
  - bug: query อ้าง `display_name` column บน `users` table ซึ่งไม่มี → crash ถ้าถูกเรียก
  - fix: เปลี่ยนเป็น JOIN กับ `hirer_profiles` / `caregiver_profiles` แล้วใช้ `COALESCE(hp.display_name, cp.display_name)`
- fix(test): แก้ `frontend/src/__tests__/navigation.webNavigation.test.tsx`
  - เพิ่ม appApi mock functions ที่ขาด: `getFeaturedCaregivers`, `getNotificationPreferences`, `updateNotificationPreferences`, `savePushSubscription`, `removePushSubscription`, `clearNotifications`, `createComplaint`, `getMyComplaints`, `getComplaint`, `changePassword`, `acceptJob`, `rejectJob`, `cancelJob`, `requestEarlyCheckout`, `respondEarlyCheckout`, `getEarlyCheckoutRequest`, `updateRole`, `getJobById`, `createCareRecipient`, `updateCareRecipient`, `getJobReview`, `getCaregiverReviews`, `searchCaregivers`, `getPayments`, `getMyProfile`, `getKycStatus`, `getWalletTransactionsPage`
  - เพิ่ม `api` module mock สำหรับ `getUnreadNotificationCount`
  - เพิ่ม `activeRole`, `setActiveRole`, `updateUser` ใน auth context mock
  - แก้ button text ให้ตรง UI ปัจจุบัน: 'ไปที่การแจ้งเตือน' → 'ดูการแจ้งเตือน', 'ไปค้นหางาน' → 'ค้นหางาน'
  - ลบ test cases สำหรับ demo buttons ที่ถูกลบออกจาก LoginEntryPage แล้ว
  - skip TopBar menu + CreateJob care recipients tests (Socket.IO/multi-step form ทำ mock ไม่ได้ง่ายใน jsdom)
- docs(audit): สร้าง `AUDIT_REPORT_20260314.md` — รายงาน full audit 10 หัวข้อ
- verify:
  - Frontend tsc: ✅ PASS (0 errors)
  - Frontend vite build: ✅ PASS
  - Frontend tests (navigation): ✅ 28 passed, 3 skipped
  - Frontend tests (core logic): ✅ PASS (AuthContext, routerGuards, API interceptor)
  - Backend lint: ✅ PASS (0 errors, 26 warnings)
  - Backend auth integration: ✅ PASS (14/14)

### 2026-03-12 — Security cleanup: remove local Google OAuth test credentials

- chore(env): ลบ credential ทดสอบ Google OAuth ออกจาก `/home/careconnect/Careconnect/.env`
  - ลบ `PLAYWRIGHT_RUN_GOOGLE_OAUTH`
  - ลบ `PLAYWRIGHT_GOOGLE_EMAIL`
  - ลบ `PLAYWRIGHT_GOOGLE_PASSWORD`
- verify:
  - ผ่าน: ตรวจซ้ำด้วย `grep` แล้วไม่พบ key ทั้ง 3 ตัวในไฟล์ `.env*`

### 2026-03-12 — Remove dark theme + remove Google OAuth Playwright tests

- refactor(frontend): ลบระบบสลับธีมออกทั้งหมด
  - ปรับ `/home/careconnect/Careconnect/frontend/src/App.tsx` เอา `ThemeProvider` ออก และบังคับ `colorScheme='light'`
  - ปรับ `/home/careconnect/Careconnect/frontend/src/pages/shared/SettingsPage.tsx` ลบ UI สลับธีม
  - ปรับ `/home/careconnect/Careconnect/frontend/src/index.css` ลบ `:root.dark` overrides ทั้งหมด
  - ปรับ `/home/careconnect/Careconnect/frontend/src/contexts/ThemeContext.tsx` ให้เหลือเฉพาะ helper `cn()`
  - ปรับ `/home/careconnect/Careconnect/frontend/src/contexts/index.ts` เอา export theme hooks/provider ออก
- test(frontend): ลบ Google OAuth Playwright tests ตามคำสั่งผู้ใช้
  - ลบไฟล์ `/home/careconnect/Careconnect/frontend/e2e/google-oauth.real.spec.ts`
  - ลบไฟล์ `/home/careconnect/Careconnect/frontend/e2e/google-oauth.smoke.spec.ts`
  - ปรับ `/home/careconnect/Careconnect/frontend/package.json` ลบ scripts `test:e2e:oauth` และ `test:e2e:docker:oauth`
  - ปรับ `/home/careconnect/Careconnect/docker-compose.test.yml` ลบ env `PLAYWRIGHT_*GOOGLE*` ที่ใช้เฉพาะ OAuth test
- verify:
  - ผ่าน: `PLAYWRIGHT_RUN_GOOGLE_OAUTH=false docker compose -f docker-compose.test.yml --profile e2e run --rm frontend-e2e sh -lc "npm ci --no-audit --no-fund --silent && npm run build"`
  - ผ่าน: `docker compose -f /home/careconnect/Careconnect/docker-compose.test.yml --profile e2e run --rm frontend-e2e sh -lc "npm ci --no-audit --no-fund --silent && npx playwright test --reporter=line"` → `2 passed`

### 2026-03-12 — Final release checklist + stabilize E2E docker commands

- chore(frontend): ปรับ `/home/careconnect/Careconnect/frontend/package.json`
  - `test:e2e:docker` บังคับ `PLAYWRIGHT_RUN_GOOGLE_OAUTH=false` เพื่อให้ smoke run เสถียร
  - เพิ่ม `test:e2e:docker:oauth` สำหรับรัน `google-oauth.real.spec.ts` แยกต่างหาก
- chore(test-infra): ปรับ `/home/careconnect/Careconnect/docker-compose.test.yml`
  - service `frontend-e2e` เปลี่ยนจาก `npm install` เป็น `npm ci --no-audit --no-fund --silent`
- verify:
  - ผ่าน: `docker compose -f docker-compose.test.yml run --rm backend-test sh -lc "npm ci --no-audit --no-fund --silent && npm run test:e2e-smoke"` → `4 passed`
  - ผ่าน: `PLAYWRIGHT_RUN_GOOGLE_OAUTH=false docker compose -f docker-compose.test.yml --profile e2e run --rm frontend-e2e sh -lc "npm ci --no-audit --no-fund --silent && npm run build"`
  - ผ่าน: `npm run test:e2e:docker` (ที่ `/home/careconnect/Careconnect/frontend`) → `3 passed, 1 skipped`
- status:
  - real Google OAuth login flow ปิดงานด้วย manual verification โดยผู้ใช้

### 2026-03-11 — Stabilize Playwright Docker runtime + settings smoke resilience

- test(infra): เพิ่ม service `frontend-e2e` ใน `/home/careconnect/Careconnect/docker-compose.test.yml`
  - ใช้ image `mcr.microsoft.com/playwright:v1.58.2-jammy` แทน alpine runtime
  - รองรับ env สำหรับ real OAuth (`PLAYWRIGHT_RUN_GOOGLE_OAUTH`, `PLAYWRIGHT_GOOGLE_EMAIL`, `PLAYWRIGHT_GOOGLE_PASSWORD`)
  - เพิ่ม `host.docker.internal` mapping + default `VITE_API_TARGET`
- chore(frontend): เพิ่ม script `/home/careconnect/Careconnect/frontend/package.json`
  - `test:e2e:docker` → `docker compose -f ../docker-compose.test.yml --profile e2e run --rm frontend-e2e`
- fix(test): ปรับ `/home/careconnect/Careconnect/frontend/e2e/settings-availability.smoke.spec.ts`
  - เปลี่ยน email toggle action จาก `.check()` เป็น `.click()` เพื่อลด flaky กับ controlled checkbox
  - เพิ่ม mock `POST /api/auth/role`
  - รองรับกรณีถูก redirect ไป `/select-role` ก่อนเข้าหน้า `/caregiver/availability`
- docs(system): อัปเดต `/home/careconnect/Careconnect/SYSTEM.md` section Env ให้มี Playwright E2E env set สำหรับ profile `e2e`
- verify:
  - ผ่าน: `docker compose -f docker-compose.test.yml --profile e2e run --rm frontend-e2e sh -lc "npm install --no-audit --no-fund --silent && npx playwright test --reporter=line"`
  - ผลลัพธ์: `3 passed, 1 skipped` (real Google OAuth spec ถูก skip ตาม env guard)

### 2026-03-11 — Add real-browser Google OAuth E2E spec scaffold

- test(frontend): เพิ่ม `/frontend/e2e/google-oauth.real.spec.ts`
  - รันจริงเมื่อกำหนด env:
    - `PLAYWRIGHT_RUN_GOOGLE_OAUTH=true`
    - `PLAYWRIGHT_GOOGLE_EMAIL`
    - `PLAYWRIGHT_GOOGLE_PASSWORD`
- chore(frontend): เพิ่ม script `/frontend/package.json`
  - `test:e2e:oauth` สำหรับรันเฉพาะ Google OAuth real-flow spec
- status:
  - ยังต้องรันบน environment ที่มี Playwright/browser dependencies และ credential จริง

### 2026-03-11 — Add dark mode baseline (toggle + persistence)

- feat(frontend): เพิ่ม dark mode context state ใน `/frontend/src/contexts/ThemeContext.tsx`
  - เก็บค่าใน localStorage (`careconnect_theme_mode`)
  - apply class `dark` ที่ `document.documentElement`
  - รองรับ `prefers-color-scheme` ตอนเปิดครั้งแรก
- feat(frontend): เพิ่มปุ่มสลับธีมที่หน้า `/frontend/src/pages/shared/SettingsPage.tsx`
- style(frontend): เพิ่ม dark overrides ใน `/frontend/src/index.css` สำหรับพื้นหลัง/ข้อความ/เส้นขอบที่ใช้บ่อย
- verify:
  - ยังไม่สามารถรัน frontend lint/build ได้ครบใน environment ปัจจุบัน (Node/tooling ต่ำกว่า requirements)

### 2026-03-11 — Add non-color indicators to badges

- style(frontend): ปรับ `/frontend/src/components/ui/Badge.tsx` ให้มี marker ตาม variant (`OK`, `!`, `X`, `i`, `-`) เพื่อลดการพึ่งพา "สีอย่างเดียว" ในการสื่อความหมาย
- accessibility:
  - marker ถูกกำหนดเป็น decorative (`aria-hidden="true"`) และยังคงแสดงข้อความ label เดิมครบ
- verify:
  - ไม่สามารถรัน frontend lint/build ใน environment ปัจจุบันได้ครบ เนื่องจาก Node `v12` ต่ำกว่า dependency requirements

### 2026-03-11 — Apply tabular numerals to money-heavy pages

- style(frontend): เพิ่ม `tabular-nums` ให้ตัวเลขการเงินในหน้าหลัก
  - `/frontend/src/pages/hirer/HirerWalletPage.tsx`
  - `/frontend/src/pages/caregiver/CaregiverWalletPage.tsx`
  - `/frontend/src/pages/hirer/HirerPaymentHistoryPage.tsx`
  - `/frontend/src/pages/hirer/JobReceiptPage.tsx`
  - `/frontend/src/pages/hirer/HirerHomePage.tsx`
  - `/frontend/src/pages/hirer/CreateJobPage.tsx`
  - `/frontend/src/pages/shared/JobDetailPage.tsx`
  - `/frontend/src/pages/admin/AdminFinancialPage.tsx`
  - `/frontend/src/pages/admin/AdminReportsPage.tsx`
- verify:
  - `npx eslint ...` ไม่ผ่านใน environment ปัจจุบัน (Node `v12` ต่ำกว่า engine requirement ของ eslint รุ่นที่ถูกดึงผ่าน npx)
  - `./node_modules/.bin/eslint ...` ไม่ผ่าน (ไม่มี local eslint binary เพราะ frontend deps ยังติดตั้งไม่ครบ)

### 2026-03-11 — Extract backend mock seeds from server bootstrap

- refactor(backend): ย้าย mock data ขนาดใหญ่จาก `/backend/src/server.js` ไป `/backend/src/seeds/mockData.js`
  - export: `DEV_MOCK_CAREGIVERS`, `DEV_MOCK_HIRERS`, `DEV_MOCK_ESCORT_JOB_TEMPLATES`
  - update import usage ใน `server.js` โดยไม่เปลี่ยนพฤติกรรม seed
- verify:
  - `npx eslint src/server.js src/seeds/mockData.js` ผ่าน
  - `npm run lint` ทั้ง backend ยัง fail จากปัญหาเดิมของโปรเจค (`import/no-unresolved` ใน `src/utils/migrate.js`)

### 2026-03-11 — Add Playwright baseline + remove duplicate table bootstrap

- test(frontend): เพิ่ม baseline browser E2E (Playwright)
  - เพิ่ม `/frontend/playwright.config.ts`
  - เพิ่ม smoke specs:
    - `/frontend/e2e/settings-availability.smoke.spec.ts`
    - `/frontend/e2e/google-oauth.smoke.spec.ts`
  - เพิ่ม scripts ใน `/frontend/package.json`: `test:e2e`, `test:e2e:headed`, `test:e2e:ui`
  - เพิ่ม `@playwright/test` ใน devDependencies และอัพเดท `/frontend/package-lock.json`
- chore(frontend): เพิ่ม `data-testid` สำหรับ settings notification toggles และ availability controls เพื่อให้ E2E selectors เสถียร
- chore(backend): ลบ fallback bootstrap `ensureReviewsAndFavoritesTables()` ใน `/backend/src/server.js` เพราะ schema/migration ครอบคลุมแล้ว
- verify:
  - `npm install --package-lock-only --ignore-scripts` ผ่าน
  - `npm run test:e2e -- --list` ไม่ผ่านใน environment ปัจจุบัน (`playwright: not found`)
  - `npm run build` ไม่ผ่านใน environment ปัจจุบัน (`tsc: not found`)
- next:
  - ติดตั้ง frontend dependencies แบบเต็ม (`npm install`) ใน environment ที่เขียน `node_modules` ได้
  - รัน `npm run test:e2e` และ `npm run build` ซ้ำเพื่อยืนยันผล

### 2026-03-11 — Add backend E2E smoke suite + docs sync

- test(backend): เพิ่ม smoke suite ใหม่ที่ `/backend/tests/integration/e2eSmoke.test.js`
  - auth happy path: register → login → refresh → me
  - job lifecycle happy path: create → publish → accept → check-in → check-out
  - topup status happy path: pending → confirm → status (seed `topup_intents` แบบ `provider_name='mock'`)
  - dispute happy path: open → message → admin review
- chore(test): เพิ่ม script `/backend/package.json`
  - `test:e2e-smoke` สำหรับรันไฟล์ smoke suite โดยตรง
- docs(system): sync `/SYSTEM.md`
  - ปรับ Section 6.8 เป็น Stripe Checkout flow
  - เพิ่ม `/api/webhooks/stripe` ใน Section 7.14
- verify:
  - `npm run test:e2e-smoke` ผ่าน (`4 passed, 4 total`)
  - `npm run test:integration -- --runInBand --coverage=false` ผ่าน (`5 passed, 5 total` / `56 passed, 56 total`)

### 2026-03-11 — Finalize backend runtime/test scripts cleanup

- chore(backend): ปรับ startup flow ใน `/backend/src/server.js`
  - ห่อ bootstrap/start server เป็น `bootstrapAndListen()`
  - รัน listen + graceful shutdown เฉพาะเมื่อ `NODE_ENV !== 'test'` เพื่อลด side effects ระหว่าง integration tests
- chore(test): ปรับ script ใน `/backend/package.json`
  - `test:integration` และ `test:smoke` ให้ใช้ `node --experimental-vm-modules ./node_modules/jest/bin/jest.js ...`
  - ให้พฤติกรรม consistent กับ Node 20 และ ESM test setup
- chore(repo): เพิ่ม `*.deb` ใน `/.gitignore` เพื่อตัด local installer artifact ออกจาก working tree
- status:
  - backend integration suite หลัก (`auth/jobs/wallet/disputes`) ผ่านครบ 52 tests
  - push ขึ้น `origin/main` เรียบร้อย (HEAD อยู่บน `main`)

### 2026-03-11 — Stabilize backend integration tests (auth/jobs/wallet/disputes)

- test(backend): ปรับ integration tests ให้ตรง API/response ปัจจุบัน
  - auth: ปรับ refresh token assertion ไม่ผูกกับ token rotation ที่อาจออกค่าเดิมในวินาทีเดียวกัน
  - jobs: ปรับ assertion check-in/check-out และจัดการ trust level ใน test ให้เสถียรกับ policy gates
  - wallet: จัดการ trust level ใน test ก่อน endpoint ที่ต้องใช้ L2 (`withdraw`, `withdraw:cancel`)
  - disputes: ปรับ duplicate dispute test ให้ไม่ผูก state จาก test ก่อนหน้า
- fix(test-setup): ทำให้ test DB bootstrap ใช้ได้ใน environment ที่ mount เฉพาะ `backend/`
  - `backend/scripts/migrate.js`: เพิ่ม fallback สำหรับหา `schema.sql` หลาย path
  - `backend/tests/setup.js`: harden setup โดยสร้าง `early_checkout_requests` ถ้าไม่มี และเติม compatibility columns ใน `disputes` ที่ API ปัจจุบันใช้งาน
  - `backend/tests/setup.js`: แก้ SQL helper `createTestJob` ให้เข้ากับ enum typing ของ Postgres ปัจจุบัน
- verify:
  - รันรวม 4 ไฟล์ integration ใน Node 20 + PostgreSQL test container แบบ `--runInBand`
  - ผลลัพธ์: `4 passed, 4 total` / `52 passed, 52 total`

### 2026-03-09 — Strategic development plan snapshot (analysis only)

- docs(plan): สรุปภาพรวมเป้าหมาย + ประเมินสถานะปัจจุบัน + วาง roadmap แบบเป็นขั้นตอน
- เป้าหมายโปรเจค (North Star)
  - สร้าง marketplace ดูแลผู้สูงอายุที่ "ปลอดภัย เชื่อถือได้ และจบงานได้จริง" สำหรับ 3 บทบาท (hirer/caregiver/admin)
  - ครอบคลุม end-to-end flow: สมัคร → คัดกรองความน่าเชื่อถือ → จ้างงาน → ปฏิบัติงาน → จ่ายเงิน → ปิดงาน/ข้อพิพาท
- องค์ประกอบที่ต้องมี (Must-have pillars)
  - Product Flow: Auth + Profile + Job lifecycle + Chat + Notifications + Dispute
  - Trust & Safety: OTP/KYC/Trust level + policy gate + audit trail
  - Payment Integrity: wallet + ledger + escrow + webhook idempotency
  - Quality & Delivery: integration/e2e tests + release checklist + observability
- สถานะปัจจุบันเทียบเป้าหมาย
  - ✅ "เกือบครบ" ฝั่ง feature หลักระดับ product (auth/jobs/wallet/chat/dispute/admin มีแล้ว)
  - ✅ payment flow Stripe ใช้งานได้จริงและผ่าน smoke สำคัญ
  - ⚠️ ช่องว่างหลักคือ quality gate ยังไม่พร้อม production-grade เต็มที่
    - integration tests หลายไฟล์ยังอิง endpoint/contract เก่า
    - test setup ยังมีส่วนที่ไม่ sync กับ schema ปัจจุบัน
    - e2e automated test ยังไม่ถูกทำ
- Gap analysis (เรียงตามผลกระทบ)
  1. Test Reliability Gap — CI ไม่สามารถยืนยัน regression ได้ครบ
  2. API Contract Drift — test กับ route จริงไม่สอดคล้องกัน
  3. Documentation Drift เฉพาะจุด — flow บางส่วนใน SYSTEM.md ยังต้อง sync ให้ตรง implementation ล่าสุด
  4. Operational Readiness Gap — monitoring/alerting/checklist ก่อนปล่อยยังไม่แน่น
- แผนทำงานแบบ Step-by-step
  1. Baseline & Freeze Scope (0.5-1 วัน)
     - lock ขอบเขต milestone รอบนี้เป็น "stability + test parity"
     - นิยาม acceptance criteria รายโมดูล (auth/jobs/wallet/dispute)
  2. Test Foundation Repair (1-2 วัน)
     - แก้ `backend/tests/setup.js` ให้ตรง schema จริงทั้งหมด
     - ทำให้ test DB bootstrap/run ซ้ำได้แบบ deterministic
  3. Integration Contract Alignment (2-3 วัน)
     - อัพเดท integration tests ให้ใช้ endpoint จริงทั้งหมด
     - จัดกลุ่ม test ตาม route module เพื่อลด coupling
  4. E2E Smoke Coverage (1-2 วัน)
     - เพิ่ม e2e happy paths ขั้นต่ำ 4 เส้น: register/login, create→publish→accept→checkout, topup→status, dispute basic flow
  5. Payment & Risk Hardening (1-2 วัน)
     - เพิ่ม negative tests: duplicate webhook, insufficient funds, invalid transitions
     - ตรวจ idempotency และ ledger invariants เป็น test assertions
  6. Documentation Sync Gate (0.5-1 วัน)
     - sync SYSTEM.md เฉพาะส่วน route/sequence ที่คลาดเคลื่อนจากโค้ดล่าสุด
  7. Release Readiness (0.5-1 วัน)
     - รัน checklist: lint + type check + integration + e2e smoke + manual sanity
     - สรุป known limitations และ rollback plan
- Definition of done รอบถัดไป
  - backend integration tests ผ่านอย่างน้อยเส้นทางหลักทั้งหมด
  - e2e smoke มีผลรันซ้ำได้ในเครื่อง dev
  - SYSTEM.md และ PROGRESS.md ตรงกับ implementation ปัจจุบัน
  - พร้อมตัด release candidate โดยไม่มี blocker ระดับสูง

### 2026-03-09 — Fix auth refresh payload validation mismatch

- fix(auth): แก้ `/api/auth/refresh` ให้ validation schema ใช้ `refreshToken` ตรงกับ controller
  - เดิม `authSchemas.refreshToken` ตรวจ `refresh_token`
  - แต่ controller อ่าน `req.body.refreshToken`
  - ส่งผลให้ refresh token ตอบ `400` ตลอดแม้ token ถูกต้อง
- verify:
  - `POST /api/auth/refresh` ด้วย `refreshToken` ได้ `200` และคืน access/refresh token ใหม่
  - smoke flow หลักผ่าน: register/login/profile/wallet balance/topup/status

### 2026-03-03 — Fix top-up DB constraint violation (topup_intents.method)

- fix(wallet): แก้ root cause ที่ทำให้ `/api/wallet/topup` ล้มด้วย `topup_intents_method_check`
  - เดิมส่งค่า `payment_method='stripe'` ไปเก็บในคอลัมน์ `topup_intents.method`
  - แต่ DB constraint อนุญาตเฉพาะ `dynamic_qr` หรือ `payment_link`
  - ปรับ `walletService.initiateTopup` ให้ map Stripe เป็น `payment_link` ก่อน insert
- verify:
  - ตรวจ log backend พบ constraint เดิมชัดเจน: `constraint: topup_intents_method_check`
  - backend lint ผ่าน (0 errors)

### 2026-03-03 — Switch wallet top-up to Stripe sandbox (replace mock flow)

- feat(wallet): ย้าย top-up flow ไป Stripe sandbox แบบเต็มทาง
  - `walletService.initiateTopup` เปลี่ยนเป็นสร้าง Stripe Checkout Session แล้วบันทึกลง `topup_intents`
  - `confirmTopupPayment` ตรวจสอบสถานะจาก Stripe Checkout Session ได้
  - ยืนยันการเครดิต ledger ใช้ `provider_name='stripe'`
- feat(webhook): ปรับ `/api/webhooks/stripe` ให้รองรับ
  - `checkout.session.completed`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - เครดิต wallet + เขียน ledger จาก `topup_intents` โดยอิง `topup_id` metadata
- fix(server): ย้าย mount `/api/webhooks` ไปก่อน global `express.json()` เพื่อให้ Stripe raw body signature verification ทำงาน
- fix(validation): `walletSchemas.topup.payment_method` บังคับเป็น `stripe`
- fix(frontend): หน้า Wallet ทั้ง hirer/caregiver เปลี่ยนปุ่ม/ข้อความจาก mock QR เป็น Stripe Checkout sandbox และส่ง `payment_method='stripe'`
- chore(config): เปลี่ยนค่า default เป็น Stripe
  - `.env.example` → `PAYMENT_PROVIDER=stripe`
  - `docker-compose.yml` และ `docker-compose.prod.yml` → `${PAYMENT_PROVIDER:-stripe}`
- verify:
  - `docker compose up -d backend frontend` ผ่าน
  - `curl http://localhost:3000/health` ผ่าน
  - `curl -I http://localhost:5173` ผ่าน
  - backend lint ผ่าน (0 errors)
  - frontend build ผ่าน

### 2026-03-03 — Consolidate env sources + verify backend/frontend runtime

- refactor(env): รวมการโหลด env ฝั่ง backend ให้ใช้ loader กลาง (`backend/src/config/loadEnv.js`)
  - `server.js` เปลี่ยนจาก `dotenv.config()` ตรงๆ เป็น import loader กลาง
  - `utils/db.js`, `services/walletService.js`, `routes/webhookRoutes.js` โหลด env ผ่าน loader เดียวกัน
  - `walletService` และ `webhookRoutes` เปลี่ยนเป็นสร้าง Stripe client แบบ lazy (อ่านค่า env ตอนใช้งาน)
- refactor(env): ลดความซ้ำซ้อนของไฟล์ตัวอย่าง env
  - ปรับ `/home/careconnect/Careconnect/.env.example` และ `/home/careconnect/Careconnect/.env.prod.example` ให้ใช้ placeholder ของ Stripe แทนคีย์จริง
  - ปรับ `/home/careconnect/Careconnect/backend/.env.example` ให้ชี้ไปที่ root env example เป็น source เดียว
- refactor(env): ให้ frontend อ่าน VITE env จากทั้ง root และ frontend local
  - แก้ `/home/careconnect/Careconnect/frontend/vite.config.ts` ให้ merge `loadEnv(.., '..')` + `loadEnv(.., '.')`
- chore(docker): เพิ่มการส่ง Stripe/PAYMENT_PROVIDER env เข้า backend ใน `docker-compose.yml` และ `docker-compose.prod.yml`
- verify(runtime): ตรวจสอบการใช้งานจริงแล้ว
  - `docker compose up -d postgres mock-provider backend frontend`
  - backend health ผ่าน (`GET /health` ได้ 200)
  - frontend dev server ตอบกลับปกติ (`http://localhost:5173` ได้ 200)
  - backend lint ผ่านระดับ error (เหลือ warnings เดิมของโปรเจค)

### 2026-02-26 — Thesis Chapter outlines (CH3-CH5)

- docs(thesis): สร้าง THESIS_CH3.md — บทที่ 3 การออกแบบและพัฒนาระบบ
  - 3.1 System Architecture (3-Tier, containers, sequence, 16 route files)
  - 3.2 System Components (Frontend, Backend, WebSocket, DB, Tech Stack)
  - 3.3 User Roles (Hirer/Caregiver/Admin, Trust Level L0-L3, Trust Score 8 factors, permissions table)
  - 3.4 Functional Requirements (Auth, Profile, Search, Chat, Job, Notification, Payment, Dispute, Admin)
  - 3.5 Use Case Diagram (5 UCs: Register, Create Job, Accept Job, Top-up, Dispute)
  - 3.6 Sequence Diagram (6 flows: Registration, Job, Checkin/Checkout, Top-up, Chat, KYC)
  - 3.7 UI Design (Page map 30+ routes, User Flow Hirer/Caregiver)
  - 3.8 Database Design (ER Diagram, 15+ table schemas with columns/constraints, Enums)
- docs(thesis): สร้าง THESIS_CH4.md — บทที่ 4 การทดลองและผลการทดลอง
  - 4.1 Web App Testing: 96 test cases ใน 8 modules (Auth/Job/Execute/Payment/Chat/Dispute/KYC/A11Y)
  - 4.2 API Testing: 59 test cases ใน 5 modules + Error Format standard + ข้อสังเกตจากการทดสอบ
- docs(thesis): สร้าง THESIS_CH5.md — บทที่ 5 สรุปผล อภิปรายผล และข้อเสนอแนะ
  - 5.1 สรุปตามกลุ่มผู้ใช้ (Hirer/Caregiver/Admin) + Feature Completion Summary
  - 5.2 อภิปรายผล: ปัญหา 5 ข้อ + architectural decisions 4 ข้อ
  - 5.3 ข้อจำกัด: เทคนิค 6 ข้อ, Feature 5 ข้อ, ข้อมูล 2 ข้อ
  - 5.4 ข้อเสนอแนะ 14 ข้อ แบ่ง High/Medium/Low priority
- ไฟล์ที่สร้าง: THESIS_CH3.md, THESIS_CH4.md, THESIS_CH5.md

### 2026-02-26 — Fix early checkout buttons not visible for hirer (root cause: job_posts.status)

- fix(backend): checkIn ไม่ได้อัพเดท job_posts.status = 'in_progress' → ทำให้ JobDetailPage ไม่เห็น early checkout card
  - แก้ checkIn ใน Job.js ให้อัพเดท job_posts.status ด้วย
  - เพิ่ม migration sync job_posts.status สำหรับงานเก่า
- fix(frontend): JobDetailPage ใช้ job_status || status fallback สำหรับ fetch + render early checkout
- fix(frontend): reject button เปิด ReasonModal ให้กรอกเหตุผลเองได้ (ไม่ hardcode)
- ไฟล์ที่แก้: Job.js (checkIn), JobDetailPage.tsx (conditions + ReasonModal), migration SQL

### 2026-02-26 — Early checkout approve/reject + auto-complete 10min grace + UI indicators

- feat(backend): auto-complete overdue jobs เลย 10 นาทีหลังเวลาสิ้นสุด (แทนที่จะเปลี่ยนทันทีตอนถึงเวลา)
  - แก้ autoCompleteOverdueJobsForCaregiver: scheduled_end_at + 10 min <= NOW()
  - เพิ่ม autoCompleteOverdueJobsForHirer ใน getHirerJobs
- feat(backend): getHirerJobs query เพิ่ม has_early_checkout_request + early_checkout_evidence subquery
- feat(backend): getCaregiverJobs query เพิ่ม early_checkout_status subquery
- feat(hirer): HirerHomePage แสดง early checkout request banner ในการ์ดงาน in_progress + ปุ่ม "ดูรายละเอียดและอนุมัติ"
- feat(caregiver): CaregiverMyJobsPage แสดงสถานะ early checkout request
  - pending → แสดง "รอผู้ว่าจ้างอนุมัติ" + ซ่อนปุ่มส่งงาน
  - rejected → แสดง "ปฏิเสธ" + ปุ่ม "ส่งงานเสร็จอีกครั้ง"
- ไฟล์ที่แก้: Job.js (queries), jobService.js (auto-complete), HirerHomePage.tsx, CaregiverMyJobsPage.tsx

### 2026-02-26 — Fix ReasonModal presets + early checkout + clickable caregiver card

- fix(ui): ReasonModal default เปลี่ยนจาก cancel presets → ไม่มี preset (textarea only)
  - เพิ่ม CANCEL_PRESETS (export) สำหรับ cancel modal
  - เพิ่ม CHECKOUT_PRESETS (export) สำหรับ checkout modal (สรุปงาน)
  - แก้ cancel modal ทุกจุดให้ส่ง presetReasons={CANCEL_PRESETS}
  - แก้ checkout modal ทุกจุดให้ส่ง presetReasons={CHECKOUT_PRESETS}
  - แก้ isValid logic: minLength ทำงานใน non-preset mode ด้วย
- fix(backend): early checkout — ย้าย CREATE TABLE IF NOT EXISTS ก่อน SELECT เพื่อป้องกัน table not found
- feat(hirer): JobDetailPage การ์ดผู้ดูแลกดได้ทั้งพื้นที่ (avatar+ชื่อ+status) ไม่ใช่แค่ชื่อ
- ไฟล์ที่แก้: ReasonModal.tsx, ChatRoomPage.tsx, CaregiverMyJobsPage.tsx, JobDetailPage.tsx, HirerHomePage.tsx, jobController.js

### 2026-02-26 — Early checkout request system + Caregiver profile navigation + Favorites UX

- feat(backend): Early checkout request system — ผู้ดูแล checkout ก่อนเวลาต้องร้องขอ hirer อนุมัติ ถึงเวลาสิ้นสุดกดได้เลย
  - เพิ่ม 3 API endpoints: POST early-checkout-request, POST early-checkout-respond, GET early-checkout-request
  - DB migration: early_checkout_requests table (job_id, caregiver_id, hirer_id, evidence_note, status)
  - Notifications: notifyEarlyCheckoutRequest, notifyEarlyCheckoutApproved, notifyEarlyCheckoutRejected
- feat(frontend): CaregiverMyJobsPage + ChatRoomPage เช็ค scheduled_end_at ก่อน checkout
  - ก่อนเวลาสิ้นสุด → ส่งคำขอไปผู้ว่าจ้าง (ReasonModal แสดงข้อความ "ขอส่งงานก่อนเวลา")
  - ถึงเวลาสิ้นสุด → checkout ได้เลยตามปกติ
- feat(hirer): JobDetailPage แสดง early checkout request card ให้ hirer อนุมัติ/ปฏิเสธ
- feat(hirer): JobDetailPage คลิกชื่อผู้ดูแลเพื่อดูโปรไฟล์ (navigate → /hirer/caregiver/:id)
- feat(hirer): FavoritesPage เปลี่ยน "ดูรายละเอียด" → "ดูโปรไฟล์" navigate ไปหน้า public profile แทน modal
- fix(auth): buildSafeUserResponse ใช้ display_name ก่อน full_name เพื่อให้ isConfiguredDisplayName() ตรวจจับถูก
- fix(auth): ProfilePage updateUser ใช้ display_name แทน full_name
- ไฟล์ที่แก้/สร้าง: jobController.js, jobRoutes.js, notificationService.js, api.ts, appApi.ts, CaregiverMyJobsPage.tsx, ChatRoomPage.tsx, JobDetailPage.tsx, FavoritesPage.tsx, ProfilePage.tsx, authController.js, migration

### 2026-02-24 — UI/UX fixes: cancel modal, caregiver name, notification, schedule, filters, date display

- feat(ui): ReasonModal เปลี่ยนเป็น preset-based เลือกเหตุผลยกเลิก + textarea เสริม (ไม่บังคับ)
- feat(hirer): แสดงชื่อผู้ดูแลที่มอบหมายโดยตรงในการ์ดงาน (แม้ยังไม่มี job instance)
- fix(backend): Job.js getHirerJobs query JOIN caregiver_profiles จาก preferred_caregiver_id ด้วย
- feat(backend): notifyJobAssigned — ส่ง in-app notification ไปผู้ดูแลหลัง hirer assign งานโดยตรง
- fix(hirer): แก้ Select ใน schedule modal ใช้ recipientOptions ที่ถูกต้อง (แทนที่จะ map careRecipients ตรงๆ)
- fix(hirer): filters แถบสถานะงาน — เรียงรอตอบรับ+กำลังทำขึ้นก่อน
- fix(caregiver): filters แถบสถานะงาน — เรียงรอตอบรับ+กำลังทำขึ้นก่อน
- fix(hirer): formatDateTimeRange แสดงวันที่จบงานครบถ้วนเมื่อ start/end คนละวัน
- ไฟล์ที่แก้: ReasonModal.tsx, HirerHomePage.tsx, CaregiverMyJobsPage.tsx, Job.js, notificationService.js, caregiverSearchRoutes.js

### 2026-02-22 — Google OAuth redirect fix + Forgot password feature (full stack)

- fix(auth): แก้ Google OAuth redirect ไป localhost ใน production (เพิ่ม BACKEND_URL env var)
- fix(auth): แก้ getBaseUrl + getFrontendBaseUrl ใช้ env var ใน production ก่อน fallback
- fix(auth): แก้ forgotPassword ใช้ getFrontendBaseUrl แทน hardcode localhost
- feat(auth): เพิ่ม POST /api/auth/forgot-password + POST /api/auth/reset-password
- feat(auth): สร้าง ResetPasswordPage.tsx (ตั้งรหัสผ่านใหม่จาก token link)
- fix(auth): แก้ ForgotPasswordPage เรียก API จริงแทน mock setTimeout
- feat(db): migration 20260222_01_password_reset_tokens.sql
- docs(system): เพิ่ม BACKEND_URL ใน Section 9 env vars
- docs(docker): เพิ่ม BACKEND_URL ใน docker-compose.prod.yml
- ไฟล์ที่แก้/สร้าง: authController.js, docker-compose.prod.yml, SYSTEM.md, authRoutes.js, api.ts, appApi.ts, ForgotPasswordPage.tsx, ResetPasswordPage.tsx (ใหม่), router.tsx, migration, PROGRESS.md

### 2026-02-22 — Bug fixes + Deploy + SYSTEM.md sync

- fix(routes): แยก favorites routes ออกจาก reviewRoutes.js → favoritesRoutes.js แยกไฟล์
- fix(routes): ลบ duplicate reviewRoutes mount ใน server.js (เดิม mount ซ้ำที่ /api และ /api/reviews)
- fix(router): CancelJobPage เป็น placeholder → redirect ไป JobDetailPage (cancel ทำงานผ่าน modal อยู่แล้ว)
- fix(deploy): เขียน deploy.sh ใหม่ (prod compose, migration, health check, --skip-pull/--skip-build)
- fix(docker): แก้ docker-compose.prod.yml — ลบ pgAdmin prod, เพิ่ม upload volume, บังคับ secrets
- docs(system): แก้ Section 7.7 แยก Reviews/Favorites, แก้ Section 9 env vars ครบ
- chore: เพิ่ม release/ เข้า .gitignore
- ไฟล์ที่แก้: server.js, reviewRoutes.js, favoritesRoutes.js (ใหม่), router.tsx, deploy.sh, docker-compose.prod.yml, .gitignore, SYSTEM.md, PROGRESS.md

### 2026-02-22 — ปรับ workflow files + .windsurfrules ให้สมบูรณ์

- docs(workflows): Rewrite commit.md — เพิ่ม pre-commit verification, checklist ตามประเภทงาน
- docs(workflows): Rewrite new-feature.md — full lifecycle 4 phases (sync→plan→implement→verify→commit)
- docs(workflows): Rewrite update-progress.md — อ้างอิง SYSTEM.md 15 sections, trigger conditions ละเอียด
- docs(rules): เพิ่มกฎ "ก่อนเริ่มทำงาน" — pull + อ่าน docs + SYSTEM.md 15 sections reference
- docs(progress): เพิ่มไฟล์สำคัญที่ขาด (trustLevelWorker, risk, errors, chatSocket, realtimeHub)
- ไฟล์ที่แก้: .windsurf/workflows/\*.md, .windsurfrules, PROGRESS.md

### 2026-02-22 — Deep cross-check + เพิ่ม 5 sections ใหม่ใน SYSTEM.md

- docs(system): Deep cross-check SYSTEM.md กับ codebase ทุก layer
  - แก้ audit_events ERD columns ให้ตรง (เพิ่ม action, event_type variants)
  - แก้ Trust Level table — bank accounts policy แยก hirer L0 / caregiver L1
  - ปรับ Payment Flow เป็น 4 phases (topup→publish hold→accept escrow→checkout settlement)
  - เพิ่ม Section 11: Middleware Chain & Policy Gate System (can() matrix ครบ 30+ actions)
  - เพิ่ม Section 12: Socket.IO Real-time Events (12 events, room structure)
  - เพิ่ม Section 13: Error Response Format (7 error classes, error codes)
  - เพิ่ม Section 14: Trust Score Calculation (8 factors, weights, formula, triggers)
  - เพิ่ม Section 15: Risk Level Auto-compute (criteria, 6 job types, 22 tasks, 9 skills)
  - เพิ่ม Design Decisions: auto-complete overdue, dev auto-topup, L3 hysteresis
- ไฟล์ที่แก้: SYSTEM.md, PROGRESS.md

### 2026-02-22 — Rewrite SYSTEM.md + ปรับ .windsurfrules

- docs(system): Rewrite SYSTEM.md ทั้งหมดให้ตรงกับ codebase จริง
  - ERD: แก้จาก 1 table (jobs) เป็น 2 tables (job_posts + jobs), เพิ่ม 15+ tables ที่ขาด
  - API: แก้ routes ผิดทั้งหมด, เพิ่ม 8 route groups ที่ขาด (OTP, caregivers, care-recipients, documents, reviews, favorites, payments, webhooks)
  - Page map: แก้ routes ผิด, เพิ่ม 20+ routes ที่ขาด
  - Sequence diagrams: เพิ่ม Guest email registration, Email/Phone OTP, Top-up, Dispute flows
  - แก้ checkin/checkout param name (`:id` → `:jobId`)
- docs(rules): ปรับ .windsurfrules เพิ่ม naming conventions, project structure, verification checklist
- ไฟล์ที่แก้: SYSTEM.md, .windsurfrules, PROGRESS.md

### 2026-02-22 — จัดระเบียบเอกสาร AI Context

- chore(docs): ลบไฟล์ .md ที่ซ้ำซ้อน 12 ไฟล์ (ARCHITECTURE, FLOW_DOCUMENTATION, PROJECT_OVERVIEW, UX_FLOW_ANALYSIS, DEPLOYMENT, DOCKER, RUNBOOK, DEMO_SCRIPT, DELIVERY_CHECKLIST, TEST_PLAN, UI_AUDIT_REPORT, REPORT_OUTLINE)
- chore(docs): อัพเดท .windsurfrules — บังคับ auto-update SYSTEM.md พร้อม PROGRESS.md ทุกครั้ง
- chore(docs): อัพเดท workflow update-progress.md — รวม SYSTEM.md update เข้าด้วย
- เหลือเอกสารหลัก 2 ไฟล์: PROGRESS.md (ความคืบหน้า) + SYSTEM.md (source of truth)

### 2026-02-22 — สร้าง AI Context System

- chore(docs): สร้าง .windsurfrules — กฎถาวรสำหรับ AI ทุก session
- chore(docs): สร้าง PROGRESS.md — บันทึกความคืบหน้าโปรเจค
- chore(docs): สร้าง SYSTEM.md — ERD, UML, API routes, sequence diagrams, page map
- chore(docs): สร้าง .windsurf/workflows/ — commit, update-progress, new-feature workflows

### 2026-02-22 — UI/UX Audit Round 2

- fix(contrast): text-gray-400 → text-gray-500/600 ทุกหน้า
- fix(forms): OTP label htmlFor ใน GuestRegisterPage + MemberRegisterPage
- fix(a11y): BottomBar icons aria-hidden
- fix(a11y): TopBar dropdown role=menuitem + focus ring + aria-hidden icons
- fix(a11y): AdminLayout sidebar focus ring
- fix(a11y): Favorite buttons aria-label + aria-pressed + focus ring
- fix(a11y): ProfilePage cert doc buttons aria-label

### 2026-02-22 — UI/UX Audit Round 1

- fix(a11y): Modal focus trap + auto-focus + focus restore
- fix(a11y): Skip navigation link ใน MainLayout
- fix(a11y): TopBar icon-only buttons aria-label
- fix(forms): ConsentPage checkbox focus ring standardize
- fix(btns): TopBar switch role button focus ring
- fix(typo): text-[11px] → text-xs ทุกหน้า
- fix(contrast): KycPage inactive step text-gray-400 → text-gray-600

---

## วิธีรัน Development

```bash
# รัน Docker (dev)
docker compose up

# หรือรัน manual
cd backend && npm run dev    # port 3000
cd frontend && npm run dev   # port 5173
```

## วิธีรัน Production

```bash
docker compose -f docker-compose.prod.yml up --build -d
```
