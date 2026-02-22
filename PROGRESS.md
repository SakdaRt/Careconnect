# CareConnect — Progress Log
> อัพเดทล่าสุด: 2026-02-22
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
│   │   └── utils/
│   └── database/
│       ├── schema.sql
│       └── migrations/
├── docker-compose.yml         (dev — รัน postgres + backend + frontend + pgadmin)
├── docker-compose.override.yml (auto-merge กับ dev สำหรับ hot-reload)
├── docker-compose.test.yml    (test environment — port 5433)
├── docker-compose.prod.yml    (production — ไม่มี dev tools)
├── PROGRESS.md        (ไฟล์นี้)
├── ARCHITECTURE.md    (รายละเอียด architecture)
└── UI_AUDIT_REPORT.md (รายงาน UI/UX audit)
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
- [x] Bank account management (L1+)
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
- [ ] E2E tests (Playwright หรือ Cypress)

### Medium Priority
- [ ] Email notification (ส่ง email จริงเมื่อมี notification)
- [ ] Push notification (PWA)
- [ ] Caregiver availability calendar

### Low Priority
- [ ] Dark mode
- [ ] Tabular numerals สำหรับตัวเลขเงิน
- [ ] Badge color sole indicator → เพิ่ม icon/pattern

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
| `backend/database/schema.sql` | Database schema |

---

## Git Log (งานล่าสุด)

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
