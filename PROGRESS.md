# CareConnect — Progress Log
> อัพเดทล่าสุด: 2026-02-22 (session 3)
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
- [ ] ทดสอบ Google OAuth แบบ end-to-end บน browser จริง (ยังเป็น manual step)
- [ ] Forgot password backend (route + service + email reset)
- [ ] E2E tests (Playwright หรือ Cypress)

### Medium Priority
- [ ] Email notification (ส่ง email จริงเมื่อมี notification)
- [ ] Push notification (PWA)
- [ ] Caregiver availability calendar

### Low Priority
- [ ] Dark mode
- [ ] Tabular numerals สำหรับตัวเลขเงิน
- [ ] Badge color sole indicator → เพิ่ม icon/pattern
- [ ] แยก mock data ออกจาก server.js → seeds/mockData.js (780 บรรทัด)
- [ ] ลบ ensureReviewsAndFavoritesTables() ซ้ำซ้อนกับ migration

---

## ไฟล์สำคัญที่ต้องรู้จัก

| ไฟล์ | หน้าที่ |
|------|---------|
| `frontend/src/router.tsx` | Route definitions + guards |
| `frontend/src/routerGuards.tsx` | RequireAuth, RequireRole, RequireProfile |
| `frontend/src/contexts/AuthContext.tsx` | Global auth state |
| `frontend/src/services/api.ts` | Axios instance + API methods |
| `frontend/src/services/appApi.ts` | App-specific API (favorites, etc.) |
| `frontend/src/components/ui/` | Button, Input, Modal, Badge, Avatar, Card, etc. |
| `frontend/src/layouts/MainLayout.tsx` | Layout หลัก (TopBar + BottomBar) |
| `frontend/src/layouts/AdminLayout.tsx` | Layout admin (sidebar) |
| `backend/src/middleware/auth.js` | JWT verify + policy gates |
| `backend/src/services/authService.js` | Register, login, token logic |
| `backend/src/services/jobService.js` | Job business logic |
| `backend/src/models/Notification.js` | Notification model |
| `database/schema.sql` | Master DB schema (25+ tables) |
| `backend/database/migrations/` | Migration files |
| `backend/src/workers/trustLevelWorker.js` | Trust score calculation + level determination |
| `backend/src/utils/risk.js` | Risk level auto-compute |
| `backend/src/utils/errors.js` | Custom error classes (7 types) + error handler |
| `backend/src/sockets/chatSocket.js` | Socket.IO chat events (12 events) |
| `backend/src/sockets/realtimeHub.js` | Realtime push to user rooms |

---

## Git Log (งานล่าสุด)

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
- ไฟล์ที่แก้: .windsurf/workflows/*.md, .windsurfrules, PROGRESS.md

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
