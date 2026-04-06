# CareConnect — คู่มือนักพัฒนาโปรแกรม (Developer Guide)

> เอกสารอ้างอิงสำหรับนักพัฒนา — อธิบายโครงสร้างโปรแกรม, โมดูล, โปรแกรมย่อย, Input/Output, และ Flowchart
> อัพเดทล่าสุด: 2026-04-06

---

## สารบัญ

1. [ภาพรวมระบบ (System Overview)](#1-ภาพรวมระบบ-system-overview)
2. [สถาปัตยกรรมระบบ (Architecture Diagram)](#2-สถาปัตยกรรมระบบ-architecture-diagram)
3. [โครงสร้างไฟล์ทั้งหมด (Project File Structure)](#3-โครงสร้างไฟล์ทั้งหมด-project-file-structure)
4. [Backend — โครงสร้างและโมดูล](#4-backend--โครงสร้างและโมดูล)
5. [Frontend — โครงสร้างและโมดูล](#5-frontend--โครงสร้างและโมดูล)
6. [Database — โครงสร้างฐานข้อมูล](#6-database--โครงสร้างฐานข้อมูล)
7. [Mock Provider — ระบบจำลองภายนอก](#7-mock-provider--ระบบจำลองภายนอก)
8. [Flowchart การทำงานหลัก](#8-flowchart-การทำงานหลัก)
9. [ความสัมพันธ์ระหว่างโมดูล (Module Relationship Diagram)](#9-ความสัมพันธ์ระหว่างโมดูล-module-relationship-diagram)
10. [รายละเอียดพารามิเตอร์ระหว่างโปรแกรมย่อย](#10-รายละเอียดพารามิเตอร์ระหว่างโปรแกรมย่อย)

---

## 1. ภาพรวมระบบ (System Overview)

**CareConnect** เป็น Two-sided Marketplace สำหรับบริการดูแลผู้สูงอายุในประเทศไทย เชื่อมต่อ **ผู้ว่าจ้าง (Hirer)** กับ **ผู้ดูแล (Caregiver)** โดยมี **ผู้ดูแลระบบ (Admin)** ควบคุม

### Runtime baseline ที่ยืนยันแล้วกับเครื่องใช้งานจริง

| รายการ | ค่า |
|-------|-----|
| **OS** | Ubuntu 22.04.5 LTS |
| **Docker** | 28.4.0 |
| **Docker Compose** | v2.39.1 |
| **Host Node/npm** | v12.22.9 / 8.5.1 |
| **Current live stack** | `docker-compose.yml` (development profile) |
| **Public access path** | Cloudflare Tunnel → `http://localhost:5173` |

### เทคโนโลยีที่ใช้ (Tech Stack)

| Layer | เทคโนโลยี |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Vite, react-hot-toast, Lucide Icons |
| **Backend** | Node.js (ESM), Express.js, Socket.IO, Joi Validation, JWT Auth |
| **Database** | PostgreSQL 15 (41 tables, Double-entry Ledger) |
| **DevOps** | Docker, Docker Compose, cloudflared (optional public access), node-cron |
| **Testing** | Jest (backend), Vitest (frontend), Playwright (E2E), k6 (load test) |
| **External** | Stripe (payment), Google OAuth, SMSOK (SMS), Nodemailer (email) |

### จำนวนไฟล์ในโปรเจค

| ส่วน | จำนวนไฟล์ | คำอธิบาย |
|------|-----------|----------|
| **Backend** (`backend/src/`) | 85+ ไฟล์ | Controllers 17, Services 12, Models 9, Routes 17, Middleware 1, Utils 9, Workers 2, Sockets 2, Seeds 5, Config 1 |
| **Frontend** (`frontend/src/`) | 80+ ไฟล์ | Pages 49, Components 21, Layouts 5, Contexts 2, Services 2, Utils 9, Router + Guards 2 |
| **Database** (`database/`) | 16 ไฟล์ | Schema 1, Migrations 15 |
| **Mock Provider** (`mock-provider/src/`) | 1 ไฟล์หลัก + subdirs | server.js + config/payment/kyc/sms/withdrawal modules |
| **Docker** | 10 ไฟล์ | docker-compose (4), Dockerfile (6: 3 prod + 3 dev) |
| **Tests** | 17+ ไฟล์ | Jest integration/unit, Playwright E2E, k6 load |

---

## 2. สถาปัตยกรรมระบบ (Architecture Diagram)

```
Browser / Public URL
        │
        ├── direct local access      → http://localhost:5173
        └── optional public access   → Cloudflare Tunnel → http://localhost:5173
                                         (current live path)
                                                │
                                                ▼
┌─────────────────────────┐      ┌────────────────────────────────────┐
│   Frontend Container    │      │       Backend Container            │
│   React 18 + Vite       │─────▶│       Express.js + Socket.IO       │
│   Port 5173 (current)   │proxy │       Port 3000                    │
│   Port 80 (prod build)  │/api  │       JWT + Joi validation         │
└─────────────────────────┘      └───────┬──────────────┬─────────────┘
                                         │              │
                           ┌─────────────┘              └──────────────┐
                           ▼                                           ▼
               ┌───────────────────┐                  ┌────────────────────────┐
               │  PostgreSQL 15    │                  │  Mock Provider         │
               │  41 tables        │                  │  (Payment/SMS/KYC)     │
               │  Port 5432        │                  │  Port 4000             │
               └───────────────────┘                  └────────────────────────┘
                                                               │
                                                      ┌────────┴─────────┐
                                                      ▼                  ▼
                                              ┌──────────────┐  ┌──────────────┐
                                              │ Stripe API   │  │ Google OAuth  │
                                              │ (Payment)    │  │ (Auth)        │
                                              └──────────────┘  └──────────────┘
```

### Data Flow (การไหลของข้อมูล)

```
User Browser ──HTTP/HTTPS──▶ Frontend (Vite/Nginx)
                                 │
                                 └── /api, /socket.io, /uploads proxy ──▶ Backend (Express)
                                                                                 │
                                                                       ┌─────────┼──────────┐
                                                                       ▼         ▼          ▼
                                                                  PostgreSQL  File System  External APIs
                                                                  (pg pool)  (/uploads)  (Stripe/SMS/KYC)
```

### Runtime components ที่สำคัญ

| ส่วน | Port | หน้าที่ |
|------|------|---------|
| **Frontend** | 5173 | แสดงผล UI, routing, state management, เรียก API |
| **Backend** | 3000 | Business logic, REST API, WebSocket, JWT auth, cron jobs |
| **PostgreSQL** | 5432 | เก็บข้อมูลทั้งหมด (41 tables), constraints, triggers |
| **Mock Provider** | 4000 | จำลอง external services (Payment, SMS, KYC) สำหรับ dev |
| **pgAdmin** | 5050 | เครื่องมือช่วยจัดการฐานข้อมูลใน dev stack |
| **Cloudflare Tunnel** | 443/HTTPS ภายนอก | public ingress ที่ชี้เข้า `localhost:5173` ในเครื่องจริง |

---

## 3. โครงสร้างไฟล์ทั้งหมด (Project File Structure)

```
careconnect/
├── backend/                          # ── Backend Application ──
│   ├── src/
│   │   ├── config/
│   │   │   └── loadEnv.js            # โหลด .env และ optional .env.<mode>
│   │   ├── controllers/              # ── Request Handlers (17 ไฟล์) ──
│   │   │   ├── authController.js     # Authentication & profile management
│   │   │   ├── jobController.js      # Job CRUD, checkin/checkout, early-checkout
│   │   │   ├── walletController.js   # Wallet, topup, withdraw, bank accounts
│   │   │   ├── chatController.js     # Chat messages & image upload
│   │   │   ├── disputeController.js  # Dispute management & messages
│   │   │   ├── notificationController.js  # Notification CRUD
│   │   │   ├── otpController.js      # OTP send/verify/resend
│   │   │   ├── kycController.js      # KYC submission
│   │   │   ├── careRecipientController.js # Patient profile CRUD
│   │   │   ├── caregiverDocumentController.js # Caregiver cert documents
│   │   │   ├── complaintController.js     # Complaint/report system
│   │   │   ├── webhookController.js  # External webhook handlers
│   │   │   ├── adminUserController.js     # Admin: user management
│   │   │   ├── adminJobController.js      # Admin: job management & settlement
│   │   │   ├── adminDisputeController.js  # Admin: dispute resolution
│   │   │   ├── adminLedgerController.js   # Admin: ledger transactions
│   │   │   └── adminHealthController.js   # Admin: health check
│   │   ├── services/                 # ── Business Logic (12 ไฟล์) ──
│   │   │   ├── authService.js        # Register, login, token, password reset
│   │   │   ├── jobService.js         # Job lifecycle, escrow, settlement (81KB)
│   │   │   ├── walletService.js      # Wallet operations, topup, withdraw (50KB)
│   │   │   ├── chatService.js        # Chat thread & message logic
│   │   │   ├── disputeService.js     # Dispute business logic
│   │   │   ├── notificationService.js # Notification creation & push (23KB)
│   │   │   ├── otpService.js         # OTP generation, hashing, verification
│   │   │   ├── paymentService.js     # Stripe integration
│   │   │   ├── kycService.js         # KYC processing
│   │   │   ├── imageService.js       # Image crop/resize (sharp)
│   │   │   ├── caregiverDocumentService.js # Document management
│   │   │   └── policyService.js      # Policy acceptance
│   │   ├── models/                   # ── Data Access Layer (9 ไฟล์) ──
│   │   │   ├── BaseModel.js          # Base class: query helpers, pagination
│   │   │   ├── User.js               # User CRUD, profile queries
│   │   │   ├── Job.js                # Job queries, feed, assignments (36KB)
│   │   │   ├── Wallet.js             # Wallet CRUD, balance queries
│   │   │   ├── LedgerTransaction.js  # Immutable ledger operations
│   │   │   ├── Chat.js               # Chat threads & messages
│   │   │   ├── Notification.js       # Notification queries
│   │   │   ├── Payment.js            # Payment records
│   │   │   └── PatientProfile.js     # Patient profile queries
│   │   ├── routes/                   # ── Route Definitions (17 ไฟล์) ──
│   │   │   ├── authRoutes.js         # /api/auth/* (21 endpoints)
│   │   │   ├── jobRoutes.js          # /api/jobs/* (16 endpoints)
│   │   │   ├── walletRoutes.js       # /api/wallet/* (21 endpoints)
│   │   │   ├── chatRoutes.js         # /api/chat/* (10 endpoints)
│   │   │   ├── disputeRoutes.js      # /api/disputes/* (6 endpoints)
│   │   │   ├── notificationRoutes.js # /api/notifications/* (9 endpoints)
│   │   │   ├── otpRoutes.js          # /api/otp/* (4 endpoints)
│   │   │   ├── kycRoutes.js          # /api/kyc/* (3 endpoints)
│   │   │   ├── careRecipientRoutes.js     # /api/care-recipients/* (5 endpoints)
│   │   │   ├── caregiverDocumentRoutes.js # /api/caregiver-documents/* (5 endpoints)
│   │   │   ├── caregiverSearchRoutes.js   # /api/caregivers/* (4 endpoints)
│   │   │   ├── reviewRoutes.js       # /api/reviews/* (3 endpoints)
│   │   │   ├── favoritesRoutes.js    # /api/favorites/* (3 endpoints)
│   │   │   ├── paymentRoutes.js      # /api/payments/* (3 endpoints)
│   │   │   ├── complaintRoutes.js    # /api/complaints/* (5 endpoints)
│   │   │   ├── webhookRoutes.js      # /api/webhooks/* (4 endpoints)
│   │   │   └── adminRoutes.js        # /api/admin/* (23 endpoints)
│   │   ├── middleware/               # ── Middleware (1 ไฟล์) ──
│   │   │   └── auth.js              # JWT verify, role check, policy gates, rate limiting
│   │   ├── utils/                    # ── Utilities (9 ไฟล์) ──
│   │   │   ├── db.js                # PostgreSQL connection pool (pg)
│   │   │   ├── errors.js            # Custom error classes (7 types) + error handler
│   │   │   ├── validation.js        # Joi schemas (auth, job, wallet, chat, etc.)
│   │   │   ├── risk.js              # Risk level auto-compute
│   │   │   ├── depositTier.js       # Hirer deposit tier calculation
│   │   │   ├── query.js             # SQL query builder helpers
│   │   │   ├── phone.js             # Phone number formatting
│   │   │   ├── rateLimiter.js       # Rate limiting middleware
│   │   │   └── migrate.js           # Database migration runner
│   │   ├── workers/                  # ── Background Workers (2 ไฟล์) ──
│   │   │   ├── trustLevelWorker.js  # Trust score calculation + level determination
│   │   │   └── noShowWorker.js      # No-show detection + auto-cancel
│   │   ├── sockets/                  # ── WebSocket Handlers (2 ไฟล์) ──
│   │   │   ├── chatSocket.js        # Socket.IO chat events (13 events)
│   │   │   └── realtimeHub.js       # Push events to user rooms
│   │   ├── seeds/                    # ── Seed Data (5 ไฟล์) ──
│   │   │   ├── mockData.js          # Dev mock caregivers/hirers/jobs
│   │   │   ├── demoSeed.js          # Demo seed logic
│   │   │   ├── demoSeedData.js      # Demo data definitions
│   │   │   ├── runDemoSeed.js       # Demo seed runner
│   │   │   └── generateDemoAvatars.js # Avatar generation
│   │   └── server.js                # ── Entry Point ── Express app, route mounting, cron
│   ├── database/migrations/          # Backend-specific migrations
│   ├── tests/                        # Jest integration + unit tests
│   ├── Dockerfile / Dockerfile.dev
│   └── package.json
│
├── frontend/                         # ── Frontend Application ──
│   ├── src/
│   │   ├── pages/                    # ── Page Components (49 ไฟล์) ──
│   │   │   ├── public/    (4)       # LandingPage, AboutPage, FAQPage, ContactPage
│   │   │   ├── auth/      (11)      # Login, Register, OAuth, Consent, ForgotPassword
│   │   │   ├── hirer/     (10)      # HirerHome, CreateJob, SearchCaregivers, Wallet
│   │   │   ├── caregiver/ (7)       # JobFeed, MyJobs, Wallet, Availability
│   │   │   ├── shared/    (9)       # JobDetail, ChatRoom, Profile, KYC, Settings
│   │   │   └── admin/     (8)       # Dashboard, Users, Jobs, Financial, Disputes
│   │   ├── components/               # ── Reusable Components (21 ไฟล์) ──
│   │   │   ├── ui/        (16)      # Button, Input, Modal, Badge, Avatar, Card, etc.
│   │   │   ├── navigation/ (3)      # TopBar, BottomBar, index
│   │   │   ├── location/  (1)       # Location picker
│   │   │   └── ErrorBoundary.tsx     # Global error boundary
│   │   ├── layouts/       (5)       # MainLayout, AdminLayout, AuthLayout, ChatLayout
│   │   ├── contexts/      (2)       # AuthContext (global auth state)
│   │   ├── services/      (2)       # api.ts (67KB), appApi.ts (12KB)
│   │   ├── utils/         (9)       # cn, authStorage, trustLevel, risk, phone, etc.
│   │   ├── router.tsx               # Route definitions + lazy loading
│   │   ├── routerGuards.tsx         # RequireAuth, RequireRole, RequirePolicy, etc.
│   │   ├── App.tsx                  # Root component
│   │   └── main.tsx                 # Entry point (ReactDOM)
│   ├── Dockerfile / Dockerfile.dev
│   └── package.json
│
├── database/                         # ── Database Schema ──
│   ├── schema.sql                   # Master schema (41 tables, 1474 lines)
│   └── migrations/ (15 ไฟล์)        # Incremental migrations
│
├── mock-provider/                    # ── Mock External Services ──
│   └── src/server.js                # Payment/SMS/KYC simulation (Port 4000)
│
├── docker-compose.yml               # Dev environment
├── docker-compose.override.yml      # Dev hot-reload
├── docker-compose.test.yml          # Test environment
├── docker-compose.prod.yml          # Production
├── SYSTEM.md                        # Architecture reference (source of truth)
├── PROGRESS.md                      # Progress log
└── INSTALLATION.md                  # Installation guide
```

---

## 4. Backend — โครงสร้างและโมดูล

Backend ใช้สถาปัตยกรรม **Layered Architecture** แบ่งเป็น 8 โมดูลหลัก โดยมี `server.js` เป็น Entry Point

```
Request Flow (Top-Down):

  HTTP Request
       │
       ▼
  ┌─────────────┐
  │  server.js   │  ← Entry Point: Express app, mount routes, cron jobs
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │   Routes     │  ← URL mapping + Joi validation + middleware chain
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │ Middleware   │  ← JWT auth, role check, policy gates, rate limiting
  └──────┬──────┘
         │
         ▼
  ┌──────────────┐
  │ Controllers  │  ← Request parsing, response formatting
  └──────┬───────┘
         │
         ▼
  ┌─────────────┐
  │  Services   │  ← Business logic, transaction management
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │   Models    │  ← SQL queries, data access
  └──────┬──────┘
         │
         ▼
  ┌─────────────┐
  │  Database   │  ← PostgreSQL (pg pool)
  └─────────────┘
```

### 4.1 Entry Point — `server.js`

**หน้าที่**: จุดเริ่มต้นของ backend ทั้งหมด — สร้าง Express app, mount routes, เริ่ม Socket.IO, ตั้ง cron jobs

**โมดูลภายใน**:

| โมดูลย่อย | หน้าที่ |
|-----------|---------|
| Environment Validation | dev/test เติม default + warn/fallback mock ให้ optional integrations, production ตรวจ env แบบ fail-fast ด้วย Joi |
| Express Setup | cors, helmet, morgan, JSON parser, static files |
| Route Mounting | mount 17 route files ไปที่ `/api/*` paths |
| Socket.IO Setup | สร้าง HTTP server + Socket.IO, init chat socket |
| Database Bootstrap | สร้าง admin user, seed mock data (dev only) |
| Cron Jobs | `*/5 * * * *` — no-show scan + auto-approve checkouts |
| Graceful Shutdown | จัดการ SIGTERM/SIGINT — ปิด server + DB pool |

**Input**:
- runtime env จาก shell หรือ compose `environment:`
- root `.env` และ `backend/.env`
- optional overlays `.env.<mode>` และ `backend/.env.<mode>`
- frontend dev โหลด `VITE_*` จาก root/`frontend/`
- frontend prod รับ `VITE_*` ผ่าน compose build args
**Output**: HTTP server listening on `PORT` (default 3000)

---

### 4.2 Routes — 17 ไฟล์ (145 endpoints)

**หน้าที่**: กำหนด URL path, HTTP method, Joi validation schema, middleware chain, และเรียก controller

**สถาปัตยกรรม Route**:
```
router.METHOD(path, ...middlewares, validation, controller.handler)
```

#### รายละเอียดแต่ละ Route File

| ไฟล์ | Mount Path | Endpoints | คำอธิบาย |
|------|-----------|-----------|----------|
| `authRoutes.js` | `/api/auth` | 21 | สมัคร, login, logout, profile, avatar, password, OAuth, phone, email |
| `jobRoutes.js` | `/api/jobs` | 16 | CRUD งาน, publish, accept, checkin, checkout, cancel, stats, early-checkout |
| `walletRoutes.js` | `/api/wallet` | 21 | balance, topup, withdraw, bank accounts, admin wallet/withdrawals/dashboard |
| `chatRoutes.js` | `/api/chat` | 10 | threads, messages, upload, read status |
| `adminRoutes.js` | `/api/admin` | 23 | user/job/dispute management, stats, trust recalculate, no-show, reports |
| `disputeRoutes.js` | `/api/disputes` | 6 | เปิด/ดู dispute, ส่งข้อความ, upload รูป |
| `notificationRoutes.js` | `/api/notifications` | 9 | list, unread count, mark read, clear, preferences, push |
| `careRecipientRoutes.js` | `/api/care-recipients` | 5 | CRUD ผู้รับดูแล |
| `caregiverSearchRoutes.js` | `/api/caregivers` | 4 | search, public profile, featured, assign |
| `caregiverDocumentRoutes.js` | `/api/caregiver-documents` | 5 | list/upload/delete/update เอกสาร, list by caregiver |
| `reviewRoutes.js` | `/api/reviews` | 3 | สร้าง/ดูรีวิว |
| `favoritesRoutes.js` | `/api/favorites` | 3 | toggle/list/check favorites |
| `complaintRoutes.js` | `/api/complaints` | 5 | สร้าง/ดู/admin จัดการ complaint |
| `otpRoutes.js` | `/api/otp` | 4 | send email/phone OTP, verify, resend |
| `kycRoutes.js` | `/api/kyc` | 3 | status, submit, mock submit |
| `paymentRoutes.js` | `/api/payments` | 3 | list, detail, simulate |
| `webhookRoutes.js` | `/api/webhooks` | 4 | payment, kyc, sms, stripe webhooks |

**Middleware Chain ทั่วไป**:
```
Public:     handler
Auth:       requireAuth → handler
Protected:  requireAuth → requirePolicy(action) → handler
Role:       requireAuth → requireRole('admin') → handler
Trust:      requireAuth → requirePolicy(action) → requireTrustLevel('L2') → handler
```

---

### 4.3 Middleware — `auth.js`

**หน้าที่**: ตรวจสอบ authentication, authorization, trust level, policy gates

**โปรแกรมย่อย 9 ฟังก์ชัน**:

| ฟังก์ชัน | Input | Output | คำอธิบาย |
|----------|-------|--------|----------|
| `requireAuth` | `req.headers.authorization` (Bearer token) | `req.user` = { userId, role, accountType, trustLevel } | ถอดรหัส JWT, attach user data; ban_login → 403 |
| `optionalAuth` | Bearer token (optional) | `req.user` หรือ `null` | เหมือน requireAuth แต่ไม่บังคับ |
| `requireRole(roles)` | `req.user.role` + `roles: string\|string[]` | pass หรือ 403 | ตรวจว่า user มี role ที่กำหนด |
| `requireTrustLevel(min)` | `req.user.trustLevel` + `min: 'L0'\|'L1'\|'L2'\|'L3'` | pass หรือ 403 | ตรวจ trust level ขั้นต่ำ |
| `requirePolicy(action)` | `req.user` + `action: string` | pass หรือ 403 + audit log | ตรวจ permission ผ่าน `can()` function |
| `requireAccountType(types)` | `req.user.accountType` + `types: string[]` | pass หรือ 403 | ตรวจ account type (guest/member) |
| `requireVerified` | `req.user` | pass หรือ 403 | ตรวจว่า email หรือ phone verified |
| `requireOwnership(param)` | `req.params[param]` + `req.user.userId` | pass หรือ 403 | ตรวจว่า user เป็นเจ้าของ resource (admin bypass) |
| `can(user, action)` | user object + action string | `{ allowed, reason? }` | Policy Gate Engine — ตรวจ ban/role/trust แล้วคืน allowed/denied |

**`can(user, action)` — Policy Gate Engine (รายละเอียด)**:

```
Input:  user object (role, trustLevel, accountType, bans)
        action string (e.g., 'job:publish', 'wallet:withdraw')
Output: { allowed, reason?: string }

Logic:
  1. admin → always allowed
  2. ตรวจ ban flags (ban_job_create, ban_job_accept, ban_withdraw)
  3. ตรวจ role restriction
  4. ตรวจ trust level minimum
  5. ถ้า denied → INSERT audit_events
```

---

### 4.4 Controllers — 17 ไฟล์

**หน้าที่**: รับ request จาก route, แปลง input, เรียก service, จัด response format

**สถาปัตยกรรม Controller**:
```
async function handler(req, res, next) {
  try {
    const input = extractInput(req);      // จาก req.body, req.params, req.query
    const result = await service.method(input);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);  // ส่งไป error handler middleware
  }
}
```

#### 4.4.1 `authController.js` — Authentication & Profile (53KB, 20 โปรแกรมย่อย)

| โปรแกรมย่อย | Input | Output | คำอธิบาย |
|-------------|-------|--------|----------|
| `registerGuest` | `{ email, password, role }` | `{ otp_id, expires_in, _dev_code? }` | สมัคร guest และส่ง email OTP โดย `_dev_code` มีเฉพาะ development |
| `registerMember` | `{ phone_number, password, role }` | `{ otp_id, expires_in, _dev_code? }` | สมัคร member และส่ง phone OTP โดย `_dev_code` มีเฉพาะ development |
| `loginWithEmail` | `{ email, password }` | `{ user, accessToken, refreshToken }` | login ด้วย email |
| `loginWithPhone` | `{ phone_number, password }` | `{ user, accessToken, refreshToken }` | login ด้วย phone |
| `refreshToken` | `{ refreshToken }` | `{ accessToken, refreshToken }` | ต่ออายุ JWT |
| `logout` | `req.user` | `{ success: true }` | ลบ session |
| `getCurrentUser` | `req.user.userId` | `{ user }` | ดึงข้อมูล user ปัจจุบัน |
| `getMyProfile` | `req.user.userId` | `{ role, profile }` | ดึงโปรไฟล์ |
| `updateMyProfile` | `req.user.userId` + `{ display_name, bio, ... }` | `{ profile }` | แก้ไขโปรไฟล์ |
| `updateAvatar` | `req.file` (multipart, max 10MB) | `{ avatar_version }` | อัพโหลด avatar + crop/resize |
| `changePassword` | `{ current_password, new_password }` | `{ success, message }` | เปลี่ยนรหัสผ่าน |
| `updatePhoneNumber` | `{ phone_number }` | `{ phone_number, is_phone_verified }` | เปลี่ยนเบอร์โทร |
| `updateEmailAddress` | `{ email }` | `{ email, is_email_verified }` | เปลี่ยนอีเมล |
| `forgotPassword` | `{ email }` | `{ success, message }` | ส่ง reset link ทาง email |
| `resetPassword` | `{ token, email, new_password }` | `{ success, message }` | รีเซ็ตรหัสผ่านด้วย token |
| `googleLogin` | — | redirect to Google | เริ่ม Google OAuth flow |
| `googleCallback` | `?code=xxx` | redirect + JWT | รับ callback จาก Google |
| `acceptPolicyConsent` | `{ role, version_policy_accepted }` | `{ policy_acceptances }` | ยอมรับ policy |
| `updateRole` | `{ role }` | `{ user }` | เปลี่ยน role |
| `cancelUnverifiedAccount` | `req.user.userId` | `{ success }` | ยกเลิก account ที่ยังไม่ verify |

#### 4.4.2 `jobController.js` — Job Management (22KB, 16 โปรแกรมย่อย)

| โปรแกรมย่อย | Input | Output | คำอธิบาย |
|-------------|-------|--------|----------|
| `createJob` | `{ title, description, job_type, ... }` | `{ job_post }` | สร้าง job draft |
| `publishJob` | `req.params.id` | `{ job_post }` | เปลี่ยน draft → posted (hold เงิน) |
| `getJobFeed` | `?job_type, risk_level, is_urgent, page, limit` | `{ jobs[], pagination }` | Feed สำหรับ caregiver |
| `getHirerJobs` | `?status, page, limit` | `{ jobs[], pagination }` | งานของ hirer |
| `getCaregiverJobs` | `?status, page, limit` | `{ jobs[], pagination }` | งานที่ caregiver ได้รับ |
| `getJobById` | `req.params.id` | `{ job }` | รายละเอียดงาน |
| `acceptJob` | `req.params.id` | `{ job, assignment }` | caregiver รับงาน |
| `rejectAssignedJob` | `req.params.id` | `{ success }` | ปฏิเสธงาน direct-assigned |
| `checkIn` | `req.params.jobId` + `{ lat, lng, accuracy_m }` | `{ job }` | Check-in (GPS) |
| `checkOut` | `req.params.jobId` + `{ lat, lng, evidence_note, evidence_photo_url }` | `{ job }` | Check-out (GPS + หลักฐาน) |
| `uploadCheckoutPhoto` | `req.params.jobId` + `req.file` (multipart) | `{ photo_url }` | อัพโหลดรูปหลักฐาน checkout |
| `requestEarlyCheckout` | `req.params.jobId` + `{ evidence_note, evidence_photo_url }` | `{ request }` | ขอจบงานกรณีพิเศษ |
| `respondEarlyCheckout` | `req.params.jobId` + `{ action, reason? }` | `{ request }` | hirer อนุมัติ/ปฏิเสธ |
| `getEarlyCheckoutRequest` | `req.params.jobId` | `{ request }` | ดูสถานะคำขอจบงานพิเศษ |
| `getJobStats` | — | `{ stats }` | สถิติงาน (admin) |
| `cancelJob` | `req.params.id` + `{ reason }` | `{ job }` | ยกเลิกงาน |

#### 4.4.3 `walletController.js` — Wallet & Financial (17KB, 19 โปรแกรมย่อย)

**User-facing methods:**

| โปรแกรมย่อย | Input | Output | คำอธิบาย |
|-------------|-------|--------|----------|
| `getBalance` | `req.user.id` + role | `{ available_balance, held_balance }` | ดูยอดเงิน |
| `getTransactions` | `?page, limit` | `{ transactions[], pagination }` | ประวัติธุรกรรม |
| `getBankAccounts` | `req.user.id` | `{ bank_accounts[] }` | ดูบัญชีธนาคาร |
| `addBankAccount` | `{ bank_code, bank_name, account_number, account_name }` | `{ bank_account }` | เพิ่มบัญชี |
| `initiateTopup` | `{ amount, payment_method }` | `{ topup_intent, payment_url }` | เติมเงิน |
| `getTopupStatus` | `req.params.topupId` | `{ topup }` | ดูสถานะ topup |
| `confirmTopup` | `req.params.topupId` | `{ topup, wallet }` | ยืนยัน topup (manual trigger) |
| `getPendingTopups` | `req.user.id` | `{ topups[] }` | ดู topup ที่รอดำเนินการ |
| `initiateWithdrawal` | `{ amount, bank_account_id }` | `{ withdrawal }` | ถอนเงิน |
| `getWithdrawals` | `?page, limit, status` | `{ withdrawals[], pagination }` | ดูรายการถอนเงิน |
| `cancelWithdrawal` | `req.params.withdrawalId` | `{ withdrawal }` | ยกเลิกการถอน |

**Admin methods:**

| โปรแกรมย่อย | Input | Output | คำอธิบาย |
|-------------|-------|--------|----------|
| `getPlatformStats` | — | `{ stats }` | สถิติแพลตฟอร์ม |
| `addFunds` | `{ user_id, role, amount, reason }` | `{ wallet }` | เพิ่มเงินให้ user |
| `adminGetWithdrawals` | `?page, limit, status, search, date_from, date_to` | `{ withdrawals[], pagination }` | ดูรายการถอนทั้งหมด |
| `adminGetWithdrawalDetail` | `req.params.withdrawalId` | `{ detail }` | รายละเอียดถอนเงิน |
| `adminReviewWithdrawal` | `req.params.withdrawalId` | `{ withdrawal }` | review การถอน |
| `adminApproveWithdrawal` | `req.params.withdrawalId` | `{ withdrawal }` | อนุมัติถอน |
| `adminRejectWithdrawal` | `req.params.withdrawalId` + `{ reason }` | `{ withdrawal }` | ปฏิเสธถอน |
| `adminMarkWithdrawalPaid` | `req.params.withdrawalId` + `{ payout_reference }` | `{ withdrawal }` | mark เป็นจ่ายแล้ว |
| `adminGetDashboardStats` | — | `{ stats }` | dashboard สรุปการเงิน |
| `adminGetTransactions` | `?page, limit, type, reference_type, date_from, date_to` | `{ transactions[], pagination }` | ดู ledger transactions |

#### 4.4.4 `chatController.js` — Chat System (10KB, 10 โปรแกรมย่อย)

| โปรแกรมย่อย | Input | Output | คำอธิบาย |
|-------------|-------|--------|----------|
| `getThreads` | `req.user.id` + `?page, limit, status` | `{ threads[] }` | ดู chat threads ทั้งหมด |
| `getThread` | `req.params.threadId` | `{ thread }` | ดู thread detail |
| `getOrCreateJobThread` | `req.params.jobId` | `{ thread }` | สร้างหรือดึง thread ของงาน |
| `getJobThread` | `req.params.jobId` | `{ thread }` | ดึง thread ของงาน (GET) |
| `getMessages` | `req.params.threadId` + `?page, limit, before, after` | `{ messages[], pagination }` | ดูข้อความ |
| `sendMessage` | `req.params.threadId` + `{ type, content, attachment_key?, metadata? }` | `{ message }` | ส่งข้อความ |
| `uploadImage` | `req.params.threadId` + `req.file` | `{ attachment_key, url }` | อัพโหลดรูป |
| `markAsRead` | `req.params.threadId` + `{ message_id }` | `{ success }` | mark as read |
| `getUnreadCount` | `req.params.threadId` + `?since` | `{ unread_count }` | นับ unread |
| `closeThread` | `req.params.threadId` | `{ thread }` | ปิด thread |

#### 4.4.5 `notificationController.js` — Notifications (5KB, 9 โปรแกรมย่อย)

| โปรแกรมย่อย | Input | Output | คำอธิบาย |
|-------------|-------|--------|----------|
| `getNotifications` | `?page, limit, unread_only` | `{ notifications[], pagination }` | ดู notifications |
| `getUnreadCount` | `req.user.userId` | `{ count }` | นับ unread |
| `markAsRead` | `req.params.id` | `{ notification }` | mark one as read |
| `markAllAsRead` | `req.user.userId` | `{ success }` | mark all as read |
| `clearNotifications` | `req.user.userId` + `?unread_only` | `{ success }` | ลบ notifications |
| `getNotificationPreferences` | `req.user.userId` | `{ preferences }` | ดู notification settings |
| `updateNotificationPreferences` | `{ email_enabled, push_enabled }` | `{ preferences }` | แก้ settings |
| `savePushSubscription` | `{ endpoint, keys }` | `{ subscription }` | บันทึก push subscription |
| `removePushSubscription` | `{ endpoint }` | `{ success }` | ลบ push subscription |

#### 4.4.6 Controllers อื่นๆ (สรุป)

| ไฟล์ | หน้าที่ | โปรแกรมย่อยสำคัญ |
|------|---------|-----------------|
| `otpController.js` | OTP management | `sendEmailOtp`, `sendPhoneOtp`, `verifyOtp`, `resendOtp` |
| `kycController.js` | KYC submission | `getStatus`, `submitKyc`, `mockSubmitKyc` |
| `careRecipientController.js` | ผู้รับดูแล CRUD | `list`, `create`, `getById`, `update`, `deactivate` |
| `caregiverDocumentController.js` | เอกสาร caregiver | `list`, `upload`, `delete`, `getByCaregiver` |
| `disputeController.js` | ข้อพิพาท | `create`, `getByJob`, `getDetail`, `postMessage`, `uploadImage`, `requestClose` |
| `complaintController.js` | ร้องเรียน | `create`, `listMine`, `getDetail`, `adminList`, `adminUpdate` |
| `webhookController.js` | Webhook handlers | `handlePayment`, `handleKyc`, `handleSms`, `handleStripe` |
| `adminUserController.js` | Admin: จัดการ user | `listUsers`, `getUserDetail`, `updateStatus`, `editUser`, `getWallet`, `setBan` |
| `adminJobController.js` | Admin: จัดการ job | `listJobs`, `getJobDetail`, `cancelJob`, `settleJob`, `getNoShowJobs`, `getNoShowStats` |
| `adminDisputeController.js` | Admin: ข้อพิพาท | `listDisputes`, `getDetail`, `updateDispute`, `settleDispute` |
| `adminLedgerController.js` | Admin: ledger | `getTransactions` |
| `adminHealthController.js` | Health check | `healthCheck` |

---

### 4.5 Services — 12 ไฟล์ (Business Logic Layer)

**หน้าที่**: Business logic ทั้งหมด, transaction management, เรียก models + external APIs

#### 4.5.1 `jobService.js` — Job Lifecycle Engine (81KB, ใหญ่ที่สุด)

```
Job Lifecycle Flow:

  createJob() ──▶ publishJob() ──▶ acceptJob() ──▶ checkIn() ──▶ checkOut()
     │                │                │               │              │
     ▼                ▼                ▼               ▼              ▼
  INSERT           hold wallet      create escrow   GPS event     settlement
  job_posts        update status    create job      update status  release escrow
  (draft)          (posted)         (assigned)      (in_progress)  (completed)
                                    + assignment                   + trust update
                                    + chat thread                  + notifications
```

| โปรแกรมย่อย | Input | Output | Side Effects |
|-------------|-------|--------|-------------|
| `createJob(userId, jobData)` | hirer ID + job fields | `{ job_post }` | INSERT job_posts, auto-compute risk_level |
| `publishJob(jobPostId, userId)` | job_post ID + hirer ID | `{ job_post }` | hold wallet (amount + deposit), UPDATE status=posted |
| `acceptJob(jobPostId, caregiverId)` | job_post ID + caregiver ID | `{ job, assignment }` | create escrow, INSERT jobs/job_assignments/chat_thread, notify hirer |
| `checkIn(jobId, caregiverId, gps)` | job ID + GPS data | `{ job }` | INSERT gps_event, UPDATE status=in_progress, notify |
| `checkOut(jobId, caregiverId, gps, evidence)` | job ID + GPS + evidence | `{ job }` | settlement (escrow→CG+platform+hirer deposit), trust update |
| `cancelJob(jobPostId, userId, reason)` | job_post ID + reason | `{ job_post }` | 5 sub-cases (B/C/D/E/F), refund/forfeit logic |
| `autoHandleNoShowJobs(userId)` | user ID | void | scan assigned jobs past grace period, auto-cancel |
| `processNoShowBatch(limit)` | batch limit | `{ processed, total }` | global scan for no-show jobs |
| `autoApproveExpiredCheckouts()` | — | `{ processed }` | auto-approve pending checkout requests > 1 hour |

#### 4.5.2 `walletService.js` — Financial Operations (50KB)

| โปรแกรมย่อย | Input | Output | Side Effects |
|-------------|-------|--------|-------------|
| `getBalance(userId, role)` | user ID + role | `{ available, held }` | — |
| `createTopupIntent(userId, amount, method)` | user + amount + method | `{ intent, payment_url }` | INSERT topup_intents, create Stripe session |
| `processTopupSuccess(intentId)` | intent ID | `{ wallet }` | credit wallet, INSERT ledger, notify |
| `createWithdrawal(userId, amount, bankAccountId)` | user + amount + bank | `{ withdrawal }` | INSERT withdrawal_requests, debit wallet |
| `holdJobPayment(userId, amount, deposit, jobPostId)` | hirer + amounts | void | available→held, INSERT ledger (hold) |
| `releaseEscrowToCaregiver(escrowId, cgId, amount, fee)` | escrow + amounts | void | escrow→CG wallet, escrow→platform, INSERT ledger |
| `adminAddFunds(adminId, userId, amount, reason)` | admin + target + amount | void | credit target wallet, INSERT ledger |

#### 4.5.3 `authService.js` — Authentication (14KB)

| โปรแกรมย่อย | Input | Output | Side Effects |
|-------------|-------|--------|-------------|
| `registerGuest(data)` | `{ email, password, role }` | `{ user, accessToken, refreshToken }` | INSERT users + profile + wallet, generate JWT |
| `registerMember(data)` | `{ phone_number, password, role, email? }` | `{ user, accessToken, refreshToken }` | INSERT users + profile + wallet, generate JWT |
| `loginWithEmail(email, password)` | credentials | `{ user, accessToken, refreshToken }` | verify bcrypt, INSERT auth_sessions |
| `loginWithPhone(phone, password)` | credentials | `{ user, accessToken, refreshToken }` | verify bcrypt, INSERT auth_sessions |
| `generateAccessToken(user)` | user object | `string` | sign access JWT (default 7d) |
| `generateRefreshToken(user)` | user object | `string` | sign refresh JWT (default 30d) |
| `verifyToken(token)` | JWT string | `decoded payload` | verify issuer + expiry |
| `refreshAccessToken(refreshToken)` | refresh token | `{ accessToken, refreshToken }` | verify + rotate tokens |

#### 4.5.4 `notificationService.js` — Notification Engine (23KB)

| โปรแกรมย่อย | Input | Output | Side Effects |
|-------------|-------|--------|-------------|
| `createNotification(userId, templateKey, data)` | target user + template + data | `{ notification }` | INSERT notifications, emit Socket.IO event, send push/email |
| `notifyJobAccepted(hirerId, jobTitle, cgName)` | — | void | create notification for hirer |
| `notifyCheckIn(hirerId, jobTitle)` | — | void | create notification for hirer |
| `notifyCheckOut(hirerId, jobTitle)` | — | void | create notification for hirer |
| `notifyTopupSuccess(userId, amount)` | — | void | create notification |
| `notifyDisputeSettled(hirerId, cgId, jobTitle)` | — | void | create notifications for both parties |
| `notifyAccountBanned(userId, banType)` | — | void | create notification |
| `notifyReviewReceived(cgId, rating)` | — | void | create notification for caregiver |

#### 4.5.5 Services อื่นๆ (สรุป)

| ไฟล์ | หน้าที่ | โปรแกรมย่อยสำคัญ |
|------|---------|-----------------|
| `otpService.js` (20KB) | OTP generation & verification | `sendEmailOtp`, `sendPhoneOtp`, `verifyOtp` — SHA-256 hash, 5 min TTL, max 5 attempts |
| `chatService.js` (10KB) | Chat business logic | `getOrCreateThread`, `sendMessage`, `markAsRead` |
| `disputeService.js` (10KB) | Dispute resolution | `createDispute`, `settleDispute` (refund/payout) |
| `paymentService.js` (8KB) | Stripe integration | `createCheckoutSession`, `handleWebhook` |
| `kycService.js` (2KB) | KYC processing | `submitKyc`, `processWebhook` |
| `imageService.js` (2KB) | Image processing | `cropAndResize(file, options)` — sharp library |
| `caregiverDocumentService.js` (3KB) | Document management | `upload`, `delete`, `getByUser` |
| `policyService.js` (1KB) | Policy acceptance | `acceptPolicy`, `checkAcceptance` |

---

### 4.6 Models — 9 ไฟล์ (Data Access Layer)

**หน้าที่**: SQL query layer — ทุก database operation ผ่าน models

#### `BaseModel.js` — Base Class

```
Methods:
  - query(sql, params)      → execute SQL with pg pool
  - findById(table, id)     → SELECT * WHERE id = $1
  - findOne(table, where)   → SELECT * WHERE ... LIMIT 1
  - findMany(table, where, options) → SELECT with pagination
  - create(table, data)     → INSERT ... RETURNING *
  - update(table, id, data) → UPDATE ... RETURNING *
  - delete(table, id)       → DELETE ... RETURNING *
  - paginate(query, page, limit) → add LIMIT/OFFSET
```

#### รายละเอียดแต่ละ Model

| Model | Table(s) | โปรแกรมย่อยสำคัญ |
|-------|----------|-----------------|
| `User.js` (8KB) | `users`, `hirer_profiles`, `caregiver_profiles` | `findByEmail`, `findByPhone`, `getProfile`, `updateProfile`, `ensureProfileExists` |
| `Job.js` (36KB) | `job_posts`, `jobs`, `job_assignments` | `create`, `publish`, `getHirerJobs`, `getCaregiverJobs`, `getFeed`, `acceptJob`, `getDetail` |
| `Wallet.js` (8KB) | `wallets`, `bank_accounts` | `getByUserId`, `getEscrow`, `updateBalance`, `getBankAccounts`, `addBankAccount` |
| `LedgerTransaction.js` (9KB) | `ledger_transactions` | `create` (immutable), `getByWallet`, `getByReference`, idempotency check |
| `Chat.js` (9KB) | `chat_threads`, `chat_messages` | `getOrCreateThread`, `getMessages`, `sendMessage`, `canAccessThread`, `markAsRead` |
| `Notification.js` (3KB) | `notifications` | `create`, `getByUser`, `getUnreadCount`, `markAsRead`, `markAllAsRead` |
| `Payment.js` (5KB) | `payments`, `topup_intents` | `create`, `getByUser`, `updateStatus` |
| `PatientProfile.js` | `patient_profiles` | basic CRUD |

---

### 4.7 Utils — 9 ไฟล์ (Utility Layer)

| ไฟล์ | หน้าที่ | ฟังก์ชันสำคัญ |
|------|---------|-------------|
| `db.js` (3KB) | PostgreSQL connection pool | `query(sql, params)`, `testConnection()`, `closePool()` |
| `errors.js` (5KB) | Custom error classes + handler | `ApiError`, `ValidationError`, `NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `ConflictError`, `TooManyRequestsError`, `errorHandler` middleware |
| `validation.js` (13KB) | Joi schemas ทั้งหมด | `authSchemas`, `jobSchemas`, `walletSchemas`, `chatSchemas`, `commonSchemas.paginationKeys` |
| `risk.js` (4KB) | Risk level auto-compute | `computeRiskLevel(jobType, patient, tasks)` → `{ risk_level, min_trust_level, risk_reason_codes[], risk_reason_detail }` |
| `depositTier.js` (672B) | Hirer deposit calculation | `getDepositAmount(totalAmount)` → deposit (100-2000 บาท) |
| `query.js` (4KB) | SQL query builder helpers | `buildWhereClause`, `buildOrderBy`, `buildPagination` |
| `phone.js` (1KB) | Phone formatting | `formatPhoneNumber`, `normalizePhone` |
| `rateLimiter.js` (6KB) | Rate limiting | `createRateLimiter(options)` — sliding window |
| `migrate.js` (3KB) | Migration runner | `runMigrations(dir)` — execute `.sql` files in order |

---

### 4.8 Workers — 2 ไฟล์ (Background Jobs)

#### `trustLevelWorker.js` — Trust Score Engine (15KB)

```
Flow:
  triggerUserTrustUpdate(userId, reason)
    │
    ├─ query completed jobs count
    ├─ query reviews (good/average/bad)
    ├─ query cancellations (exclude no-show)
    ├─ query no-shows
    ├─ query GPS violations
    ├─ query on-time check-ins
    ├─ check profile completeness
    │
    ▼
  score = clamp(0, 100, 50 + all_factors)
    │
    ├─ determine trust level (L0→L3)
    ├─ hysteresis: L3→L2 when score < 75
    │
    ▼
  UPDATE users SET trust_score, trust_level
    │
    ├─ INSERT trust_score_history
    ├─ IF score = 0 → ban_login + cancel all assigned jobs
    └─ IF score < 40 (crossed) → cancel high_risk assigned jobs
```

| โปรแกรมย่อย | Input | Output |
|-------------|-------|--------|
| `triggerUserTrustUpdate(userId, reason)` | user ID + trigger reason | `{ score, level, changed }` |
| `recalculateAllCaregivers()` | — | `{ processed, errors }` |
| `determineTrustLevel(user, score)` | user data + score | `'L0'\|'L1'\|'L2'\|'L3'` |

#### `noShowWorker.js` — No-Show Detection (3KB)

```
Flow:
  cron */5 * * * *
    │
    ▼
  triggerNoShowScan()
    │
    ▼
  jobService.processNoShowBatch(100)
    │
    ├─ query assigned jobs WHERE scheduled_start < now() - 30 min
    ├─ FOR EACH: atomic cancel + full refund + trust penalty
    └─ INSERT audit_events
```

| โปรแกรมย่อย | Input | Output |
|-------------|-------|--------|
| `triggerNoShowScan()` | — | `{ processed, batchLimitHit }` |
| `runNoShowWorker()` | — | void (standalone mode) |

---

### 4.9 Sockets — 2 ไฟล์ (Real-time Communication)

#### `chatSocket.js` — Chat WebSocket (6KB)

```
Connection Flow:
  Client ──connect──▶ authenticate JWT ──▶ join user:{userId} room
    │
    ├── thread:join  → join thread:{threadId} room (access check)
    ├── thread:leave → leave room
    ├── message:send → save to DB + broadcast to room
    ├── typing:start → broadcast typing indicator
    ├── typing:stop  → broadcast stop typing
    └── message:read → mark as read + broadcast
```

| Event (Client→Server) | Payload | Response Event |
|----------------------|---------|---------------|
| `thread:join` | `threadId` | `thread:joined` |
| `thread:leave` | `threadId` | `thread:left` |
| `message:send` | `{ threadId, type, content, attachment_key }` | `message:new` (broadcast) |
| `typing:start` | `threadId` | `typing:started` (broadcast) |
| `typing:stop` | `threadId` | `typing:stopped` (broadcast) |
| `message:read` | `{ threadId, messageId }` | `message:read` (broadcast) |

#### `realtimeHub.js` — Push to User Rooms (257B)

| ฟังก์ชัน | Input | Output | คำอธิบาย |
|---------|-------|--------|----------|
| `setSocketServer(io)` | Socket.IO server instance | void | ตั้ง reference |
| `emitToUserRoom(userId, event, payload)` | target user + event + data | void | ส่ง event ไปยัง `user:{userId}` room |

---

## 5. Frontend — โครงสร้างและโมดูล

Frontend ใช้สถาปัตยกรรม **Component-based** ด้วย React 18 + TypeScript แบ่งเป็น 7 โมดูลหลัก

```
Frontend Architecture (Top-Down):

  main.tsx (Entry Point)
       │
       ▼
  App.tsx (Root Component)
       │
       ├── AuthProvider (Context)     ← Global auth state
       ├── BrowserRouter              ← Routing
       │       │
       │       ▼
       │   router.tsx                 ← Route definitions + lazy loading
       │       │
       │       ├── routerGuards.tsx   ← RequireAuth, RequireRole, RequirePolicy, RequireProfile, RequireAdmin
       │       │
       │       ▼
       │   Layouts                    ← MainLayout, AdminLayout, AuthLayout, ChatLayout
       │       │
       │       ▼
       │   Pages (49 ไฟล์)            ← UI + business logic per page
       │       │
       │       ├── components/ui/     ← Reusable UI components
       │       └── services/          ← API calls
       │
       └── Toaster (react-hot-toast)
```

### 5.1 Entry Point — `main.tsx` + `App.tsx`

| ไฟล์ | หน้าที่ |
|------|---------|
| `main.tsx` | ReactDOM.createRoot, render `<App />` |
| `App.tsx` | Wrap `<AuthProvider>` + `<RouterProvider>` + `<Toaster>` |

### 5.2 Routing — `router.tsx` + `routerGuards.tsx`

**`router.tsx`** — กำหนดเส้นทาง 53 routes (52 app routes + 1 fallback, 49 page files, บาง page ใช้ซ้ำ) ด้วย React Router v6 + lazy loading

```
Route Structure:

  / ─────────────────── Public Pages (ไม่ต้อง login) [4 routes]
  │   ├── /                LandingPage
  │   ├── /about           AboutPage
  │   ├── /faq             FAQPage
  │   └── /contact         ContactPage
  │
  /auth ─────────────── Auth Pages (ไม่ต้อง login) [11 routes]
  │   ├── /login           LoginEntryPage
  │   ├── /login/email     LoginEmailPage
  │   ├── /login/phone     LoginPhonePage
  │   ├── /auth/callback   AuthCallbackPage (Google OAuth)
  │   ├── /forgot-password ForgotPasswordPage
  │   ├── /reset-password  ResetPasswordPage
  │   ├── /register        RegisterTypePage
  │   ├── /register/guest  GuestRegisterPage
  │   ├── /register/member MemberRegisterPage
  │   ├── /select-role     RoleSelectionPage
  │   └── /register/consent ConsentPage
  │
  /hirer ────────────── Hirer Pages (RequireAuth + RequireRole + RequirePolicy) [11 routes]
  │   ├── /hirer/home                    HirerHomePage
  │   ├── /hirer/create-job              CreateJobPage (+RequireProfile)
  │   ├── /hirer/search-caregivers       SearchCaregiversPage (+RequireProfile)
  │   ├── /hirer/caregiver/:id           CaregiverPublicProfilePage
  │   ├── /hirer/care-recipients         CareRecipientsPage
  │   ├── /hirer/care-recipients/new     CareRecipientFormPage
  │   ├── /hirer/care-recipients/:id/edit CareRecipientFormPage (reuse)
  │   ├── /hirer/favorites               FavoritesPage
  │   ├── /hirer/wallet                  HirerWalletPage
  │   ├── /hirer/wallet/receipt/:jobId   JobReceiptPage
  │   └── /hirer/wallet/history          HirerPaymentHistoryPage
  │
  /caregiver ────────── Caregiver Pages (RequireAuth + RequireRole + RequirePolicy) [8 routes]
  │   ├── /caregiver/jobs/feed           CaregiverJobFeedPage
  │   ├── /caregiver/jobs/my-jobs        CaregiverMyJobsPage
  │   ├── /caregiver/jobs/:id/preview    JobPreviewPage
  │   ├── /caregiver/profile             ProfilePage (reuse)
  │   ├── /caregiver/availability        AvailabilityCalendarPage
  │   ├── /caregiver/wallet              CaregiverWalletPage
  │   ├── /caregiver/wallet/earning/:jobId JobEarningDetailPage
  │   └── /caregiver/wallet/history      EarningsHistoryPage
  │
  /shared ───────────── Shared Pages (RequireAuth) [10 routes]
  │   ├── /jobs/:id                JobDetailPage
  │   ├── /jobs/:id/cancel         → redirect to /jobs/:id
  │   ├── /chat/:jobId             ChatRoomPage
  │   ├── /dispute/:disputeId      DisputeChatPage
  │   ├── /notifications           NotificationsPage
  │   ├── /profile                 ProfilePage
  │   ├── /settings                SettingsPage
  │   ├── /kyc                     KycPage
  │   ├── /complaint               ComplaintFormPage
  │   └── /wallet/bank-accounts    BankAccountsPage (+RequireRole+RequirePolicy)
  │
  /admin ────────────── Admin Pages (RequireAdmin) [8 routes]
      ├── /admin/login      AdminLoginPage
      ├── /admin/dashboard  AdminDashboardPage
      ├── /admin/users      AdminUsersPage
      ├── /admin/jobs       AdminJobsPage
      ├── /admin/financial  AdminFinancialPage
      ├── /admin/disputes   AdminDisputesPage
      ├── /admin/reports    AdminReportsPage
      └── /admin/settings   AdminSettingsPage
```

**`routerGuards.tsx`** — Route Guards 5 ตัว

| Guard | Input | Output | คำอธิบาย |
|-------|-------|--------|----------|
| `RequireAuth` | `useAuth()` → user, isLoading | children หรือ redirect `/login` | ตรวจว่า login แล้ว |
| `RequireRole` | `roles: UserRole[]` + `useAuth()` | children หรือ redirect ตาม role | ตรวจว่ามี role ที่ต้องการ |
| `RequirePolicy` | `useAuth()` → policy_acceptances | children หรือ redirect `/register/consent` | ตรวจว่ายอมรับ policy version ล่าสุด |
| `RequireProfile` | `useAuth()` → user.name | children หรือ redirect `/profile` | ตรวจว่าตั้งชื่อแล้ว |
| `RequireAdmin` | `useAuth()` → user.role | children หรือ redirect `/admin/login` | ตรวจว่าเป็น admin |

### 5.3 Contexts — `AuthContext.tsx`

**หน้าที่**: จัดการ global authentication state ทั้ง app

```
AuthContext provides:
  ├── user: User | null          ← ข้อมูล user ปัจจุบัน
  ├── isAuthenticated: boolean   ← login อยู่หรือไม่
  ├── isLoading: boolean         ← กำลังโหลด user data
  ├── activeRole: UserRole | null ← role ที่เลือกใช้งาน
  ├── login(email, password)     ← login ด้วย email
  ├── loginWithTokens(...)       ← login จาก token ที่ได้มาแล้ว (OAuth)
  ├── loginWithPhone(...)        ← login ด้วย phone
  ├── registerGuest(...)         ← สมัคร guest และคืน OTP metadata
  ├── registerMember(...)        ← สมัคร member และคืน OTP metadata
  ├── logout()                   ← clear session ฝั่ง client
  ├── refreshUser()              ← re-fetch user data จาก /api/auth/me
  ├── updateUser(partial)        ← update user state locally
  └── setActiveRole(role)        ← เปลี่ยน active role
```

| ฟังก์ชัน | Input | Output | Side Effects |
|---------|-------|--------|-------------|
| `login` | `email, password` | `User` | persist session tokens ผ่าน `api.ts`, update `user/activeRole` |
| `loginWithPhone` | `phone, password` | `User` | persist session tokens ผ่าน `api.ts`, update `user/activeRole` |
| `loginWithTokens` | `accessToken, refreshToken?` | `User` | set token ที่รับมา แล้วเรียก `/api/auth/me` |
| `registerGuest` / `registerMember` | `email/phone, password, role` | `{ otp_id, expires_in, _dev_code? }` | ยังไม่ set session ใน context และ frontend จะแสดง `_dev_code` เฉพาะ dev build |
| `logout` | — | void | เรียก `/api/auth/logout`, clear tokens และ clear state |
| `refreshUser` | — | `void` | GET `/api/auth/me`, update state |
| `updateUser` | `Partial<User>` | void | merge กับ state ปัจจุบัน |
| `setActiveRole` | `role` | void | update `activeRole` |

### 5.4 Services — `api.ts` + `appApi.ts`

#### `api.ts` — Core API Client (67KB)

**หน้าที่**: fetch-based HTTP client + ทุก API method definitions

```
ApiClient Class:
  ├── baseUrl: string                    ← /api (proxied)
  ├── refreshPromise: Promise<boolean> | null ← กัน refresh ซ้ำซ้อน
  │
  ├── request(endpoint, options?)        ← core HTTP request
  │     ├── auto-attach Authorization header
  │     ├── auto-refresh token if 401
  │     └── parse JSON response
  │
  ├── requestFormData(endpoint, formData) ← multipart upload (POST)
  ├── setSessionTokens(accessToken, refreshToken?) ← persist tokens
  ├── clearTokens()                      ← clear scoped storage
  └── attemptRefresh()                   ← refresh JWT once per burst
```

**API Methods กลุ่มหลัก** (80+ methods):

| กลุ่ม | Methods | คำอธิบาย |
|-------|---------|----------|
| Auth | `registerGuest`, `registerMember`, `loginWithEmail`, `loginWithPhone`, `refreshToken`, `logout`, `getCurrentUser`, `getMyProfile`, `updateMyProfile`, `uploadProfileAvatar`, `updatePhoneNumber`, `updateEmailAddress`, `changePassword`, `forgotPassword`, `resetPassword` | Authentication & profile |
| Jobs | `createJob`, `publishJob`, `getJobFeed`, `getMyJobs`, `getAssignedJobs`, `getJobById`, `acceptJob`, `rejectJob`, `checkIn`, `checkOut`, `cancelJob`, `uploadCheckoutPhoto`, `requestEarlyCheckout`, `respondEarlyCheckout`, `getEarlyCheckoutRequest` | Job lifecycle |
| Wallet | `getWallet`, `getWalletTransactions`, `topUpWallet`, `getPendingTopups`, `getTopupStatus`, `confirmTopupPayment`, `getBankAccounts`, `addBankAccount`, `initiateWithdrawal`, `getWithdrawals`, `cancelWithdrawal` | Financial |
| Chat | `getChatThread`, `getOrCreateChatThread`, `getChatMessages`, `sendMessage`, `uploadChatImage` | Messaging |
| Notifications | `getNotifications`, `getUnreadNotificationCount`, `markNotificationAsRead`, `markAllNotificationsAsRead` | Notifications |
| OTP | `sendEmailOtp`, `sendPhoneOtp`, `verifyOtp`, `resendOtp` | OTP verification |
| KYC | `getKycStatus`, `submitKyc` | Identity verification |
| Disputes | `createDispute`, `getDispute`, `getDisputeByJob`, `postDisputeMessage`, `uploadDisputeImage`, `requestDisputeClose` | Dispute system |

#### `appApi.ts` — App-specific API wrapper (12KB)

**หน้าที่**: Higher-level wrapper รวม api.ts methods + เพิ่ม convenience functions

| ฟังก์ชัน | Wraps | คำอธิบาย |
|---------|-------|----------|
| `searchCaregivers(params)` | `api.searchCaregivers` | ค้นหา caregiver |
| `getFavorites(page, limit)` | `api.getFavorites` | ดูรายการโปรด |
| `toggleFavorite(caregiverId)` | `api.toggleFavorite` | toggle favorite |
| `publishJob(jobPostId)` | `api.publishJob` | publish job |
| `checkOut(jobId, caregiverId, gpsData?, evidenceNote?, evidencePhotoUrl?)` | `api.checkOut` | checkout with evidence |
| `uploadCheckoutPhoto(jobId, formData)` | `api.uploadCheckoutPhoto` | upload evidence photo |

### 5.5 Layouts — 4 Layouts

| Layout | หน้าที่ | ใช้กับ Pages |
|--------|---------|-------------|
| `MainLayout.tsx` | TopBar + BottomBar + children | Hirer, Caregiver, Shared pages |
| `AdminLayout.tsx` | Sidebar navigation + children | Admin pages |
| `AuthLayout.tsx` | Minimal layout สำหรับ auth pages | Login, Register pages |
| `ChatLayout.tsx` | Full-height layout สำหรับ chat | ChatRoomPage, DisputeChatPage |

### 5.6 Components — 21 ไฟล์

#### UI Components (`components/ui/` — 16 ไฟล์)

| Component | Props (Input) | Output | คำอธิบาย |
|-----------|--------------|--------|----------|
| `Button.tsx` | `variant, size, loading, disabled, onClick` | `<button>` | ปุ่มทั่วไป (primary, secondary, danger, ghost) |
| `Input.tsx` | `label, type, error, hint, icon` | `<input>` | Input field + label + error message |
| `Modal.tsx` | `isOpen, onClose, title, children, actions` | Portal overlay | Dialog/modal |
| `ReasonModal.tsx` | `isOpen, onConfirm, presetReasons[], freeText` | Modal + reason selection | Modal เลือกเหตุผล + text |
| `Badge.tsx` | `variant, size, icon, children` | `<span>` | Status badge (success, warning, danger, info) |
| `Avatar.tsx` | `src, name, size, onClick` | `<img>` / fallback initials | รูปโปรไฟล์ + fallback |
| `AvatarUpload.tsx` | `currentUrl, onUpload` | Avatar + upload button | อัพโหลด + crop avatar |
| `CropModal.tsx` | `image, onCrop, onCancel, aspect` | Modal + crop area | Crop รูปภาพ (react-easy-crop) |
| `Card.tsx` | `children, className, onClick` | `<div>` | Card container |
| `Select.tsx` | `options, value, onChange, label` | `<select>` | Dropdown select |
| `Textarea.tsx` | `label, rows, error` | `<textarea>` | Multi-line text input |
| `Tabs.tsx` | `tabs[], activeTab, onChange` | Tab bar + content | Tab navigation |
| `Loading.tsx` | `message` | Spinner + message | Loading indicator |
| `ChoiceGroup.tsx` | `options[], value, onChange, multiple` | Selectable chips | Multi/single choice selector |
| `TrustLevelCard.tsx` | `trustLevel, trustScore, checklist` | Card | แสดง trust level + progress |
| `index.ts` | — | — | Re-export ทุก components |

#### Navigation Components (`components/navigation/` — 3 ไฟล์)

| Component | Props | คำอธิบาย |
|-----------|-------|----------|
| `TopBar.tsx` (20KB) | `user, onLogout` | แถบบน: logo, notification bell (polling 15s), user dropdown, masked email/phone |
| `BottomBar.tsx` (3KB) | `role` | แถบล่าง: navigation tabs ตาม role (hirer: home/search/wallet, caregiver: feed/jobs/wallet) |

#### Other Components

| Component | คำอธิบาย |
|-----------|----------|
| `ErrorBoundary.tsx` | Global error boundary — catch React errors, แสดง fallback UI |
| `location/` | Location picker component (Google Maps) |

### 5.7 Pages — 49 ไฟล์ (แบ่ง 6 กลุ่ม)

#### Public Pages (4 ไฟล์)

| Page | Path | ขนาด | คำอธิบาย |
|------|------|------|----------|
| `LandingPage.tsx` | `/` | 21KB | หน้าแรก, แนะนำบริการ, featured caregivers |
| `AboutPage.tsx` | `/about` | 11KB | เกี่ยวกับเรา |
| `FAQPage.tsx` | `/faq` | 14KB | คำถามที่พบบ่อย |
| `ContactPage.tsx` | `/contact` | 10KB | ติดต่อเรา |

#### Auth Pages (11 ไฟล์)

| Page | Path | ขนาด | คำอธิบาย |
|------|------|------|----------|
| `LoginEntryPage.tsx` | `/login` | 2KB | เลือกวิธี login (email/phone/Google) |
| `LoginEmailPage.tsx` | `/login/email` | 5KB | Login form (email + password) |
| `LoginPhonePage.tsx` | `/login/phone` | 5KB | Login form (phone + password) |
| `AuthCallbackPage.tsx` | `/auth/callback` | 1KB | Google OAuth callback handler |
| `ForgotPasswordPage.tsx` | `/forgot-password` | 5KB | ส่ง reset link |
| `ResetPasswordPage.tsx` | `/reset-password` | 6KB | ตั้งรหัสผ่านใหม่ |
| `RegisterTypePage.tsx` | `/register` | 7KB | เลือก guest/member |
| `GuestRegisterPage.tsx` | `/register/guest` | 14KB | สมัคร guest (email) |
| `MemberRegisterPage.tsx` | `/register/member` | 17KB | สมัคร member (phone + OTP) |
| `RoleSelectionPage.tsx` | `/select-role` | 10KB | เลือก hirer/caregiver |
| `ConsentPage.tsx` | `/register/consent` | 13KB | ยอมรับข้อตกลง |

#### Hirer Pages (10 ไฟล์)

| Page | Path | ขนาด | คำอธิบาย |
|------|------|------|----------|
| `HirerHomePage.tsx` | `/hirer/home` | 49KB | Dashboard: แสดงงานทั้งหมด, สถานะ, action buttons |
| `CreateJobPage.tsx` | `/hirer/create-job` | 148KB | สร้างงาน 5 ขั้นตอน (ใหญ่ที่สุดในโปรเจค) |
| `SearchCaregiversPage.tsx` | `/hirer/search-caregivers` | 41KB | ค้นหา+กรองผู้ดูแล |
| `CaregiverPublicProfilePage.tsx` | `/hirer/caregiver/:id` | 15KB | ดูโปรไฟล์ผู้ดูแล |
| `CareRecipientsPage.tsx` | `/hirer/care-recipients` | 8KB | รายชื่อผู้รับดูแล |
| `CareRecipientFormPage.tsx` | `/hirer/care-recipients/new` | 29KB | สร้าง/แก้ไขผู้รับดูแล |
| `FavoritesPage.tsx` | `/hirer/favorites` | 17KB | ผู้ดูแลที่ชื่นชอบ |
| `HirerWalletPage.tsx` | `/hirer/wallet` | 29KB | กระเป๋าเงิน hirer |
| `HirerPaymentHistoryPage.tsx` | `/hirer/wallet/history` | 6KB | ประวัติการชำระเงิน |
| `JobReceiptPage.tsx` | `/hirer/wallet/receipt/:jobId` | 9KB | ใบเสร็จ/ใบสรุปงาน |

#### Caregiver Pages (7 ไฟล์)

| Page | Path | ขนาด | คำอธิบาย |
|------|------|------|----------|
| `CaregiverJobFeedPage.tsx` | `/caregiver/jobs/feed` | 20KB | Feed งานที่เปิดรับ + filter |
| `CaregiverMyJobsPage.tsx` | `/caregiver/jobs/my-jobs` | 42KB | งานที่รับ: checkin/checkout/cancel |
| `JobPreviewPage.tsx` | `/caregiver/jobs/:id/preview` | 6KB | ดูรายละเอียดงานก่อนรับ |
| `CaregiverWalletPage.tsx` | `/caregiver/wallet` | 31KB | กระเป๋าเงิน caregiver |
| `EarningsHistoryPage.tsx` | `/caregiver/wallet/history` | 6KB | ประวัติรายได้ |
| `JobEarningDetailPage.tsx` | `/caregiver/wallet/earning/:jobId` | 7KB | รายละเอียดรายได้แต่ละงาน |
| `AvailabilityCalendarPage.tsx` | `/caregiver/availability` | 7KB | ตารางเวลาว่าง |

#### Shared Pages (9 ไฟล์)

| Page | Path | ขนาด | คำอธิบาย |
|------|------|------|----------|
| `JobDetailPage.tsx` | `/jobs/:id` | 41KB | รายละเอียดงาน (ทั้ง hirer+caregiver) |
| `ChatRoomPage.tsx` | `/chat/:jobId` | 37KB | แชทระหว่าง hirer-caregiver |
| `DisputeChatPage.tsx` | `/dispute/:disputeId` | 13KB | แชทข้อพิพาท (admin เข้าร่วมได้) |
| `ProfilePage.tsx` | `/profile` | 67KB | แก้ไขโปรไฟล์ (ทั้ง hirer+caregiver) |
| `KycPage.tsx` | `/kyc` | 29KB | ยืนยันตัวตน (upload เอกสาร + selfie) |
| `NotificationsPage.tsx` | `/notifications` | 9KB | รายการแจ้งเตือน |
| `SettingsPage.tsx` | `/settings` | 19KB | ตั้งค่า (password, notification, etc.) |
| `BankAccountsPage.tsx` | `/wallet/bank-accounts` | 14KB | จัดการบัญชีธนาคาร |
| `ComplaintFormPage.tsx` | `/complaint` | 8KB | แบบฟอร์มร้องเรียน |

#### Admin Pages (8 ไฟล์)

| Page | Path | ขนาด | คำอธิบาย |
|------|------|------|----------|
| `AdminDashboardPage.tsx` | `/admin/dashboard` | 1KB | Dashboard สรุปภาพรวม |
| `AdminUsersPage.tsx` | `/admin/users` | 42KB | จัดการ users: ดู/แก้ไข/ban/wallet |
| `AdminJobsPage.tsx` | `/admin/jobs` | 15KB | จัดการงาน: ดู/ยกเลิก |
| `AdminFinancialPage.tsx` | `/admin/financial` | 46KB | การเงิน: dashboard/transactions/withdrawals/settlement |
| `AdminDisputesPage.tsx` | `/admin/disputes` | 36KB | จัดการข้อพิพาท: ดู/settle |
| `AdminReportsPage.tsx` | `/admin/reports` | 19KB | รายงาน: summary/charts |
| `AdminSettingsPage.tsx` | `/admin/settings` | 2KB | ตั้งค่าระบบ |
| `AdminLoginPage.tsx` | `/admin/login` | 3KB | Login สำหรับ admin |

### 5.8 Utils — 9 ไฟล์

| ไฟล์ | หน้าที่ | ฟังก์ชันสำคัญ |
|------|---------|-------------|
| `cn.ts` | Conditional classNames | `cn(...classes)` — merge Tailwind classes |
| `authStorage.ts` | Token storage | `getToken`, `setToken`, `removeToken`, `getRefreshToken` |
| `trustLevel.ts` | Trust level utilities | `getTrustLevelLabel`, `getTrustLevelConfig`, `getTrustChecklist` |
| `risk.ts` | Risk level utilities | `getRiskLabel`, `getRiskColor`, `getTaskLabel`, `getSkillLabel` |
| `phone.ts` | Phone formatting | `formatPhoneDisplay`, `maskPhone` |
| `profileName.ts` | Profile name helpers | `isConfiguredDisplayName`, `toDisplayNameFromFullName` |
| `avatar.ts` | Avatar URL helpers | `getAvatarUrl`, `getInitials` |
| `thaiBanks.ts` | Thai bank data | bank list with codes, names, colors |
| `errorMessage.ts` | Error message parsing | `extractErrorMessage(error)` — ดึง error message จาก API response |

---

## 6. Database — โครงสร้างฐานข้อมูล

### 6.1 ภาพรวม

- **Database**: PostgreSQL 15
- **Schema**: `database/schema.sql` (1,474 บรรทัด, 41 tables)
- **Migrations (schema)**: `database/migrations/` (15 ไฟล์ incremental)
- **Migrations (backend)**: `backend/database/migrations/` (23 ไฟล์ — รันอัตโนมัติตอน backend start)
- **Pattern**: Double-entry Ledger สำหรับระบบการเงิน

### 6.2 Entity Relationship Diagram (ERD)

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          CORE ENTITIES                                   │
│                                                                          │
│  ┌─────────┐    1:1    ┌──────────────┐    1:1    ┌───────────────────┐ │
│  │  users   │──────────│hirer_profiles │          │caregiver_profiles │ │
│  │ (PK: id) │──────────│              │          │                   │ │
│  └────┬─────┘          └──────────────┘          └───────────────────┘ │
│       │                                                                  │
│       │ 1:N                                                              │
│       ├────────────────────┐                                             │
│       │                    │                                             │
│  ┌────▼──────┐      ┌─────▼──────────┐                                  │
│  │ job_posts │ 1:N  │   wallets      │                                  │
│  │ (hirer)   │──────│(hirer/cg/escrow)│                                  │
│  └────┬──────┘      └─────┬──────────┘                                  │
│       │ 1:N               │ 1:N                                          │
│  ┌────▼──────┐      ┌─────▼──────────┐                                  │
│  │   jobs    │      │ledger_         │                                  │
│  │(instance) │      │transactions    │                                  │
│  └────┬──────┘      │(immutable)     │                                  │
│       │ 1:N         └────────────────┘                                  │
│  ┌────▼──────────┐                                                      │
│  │job_assignments│                                                      │
│  │(caregiver)    │                                                      │
│  └───────────────┘                                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### 6.3 ตาราง 41 ตาราง (จัดกลุ่ม)

#### กลุ่ม Users & Profiles (5 ตาราง)

| ตาราง | คอลัมน์สำคัญ | ความสัมพันธ์ | คำอธิบาย |
|-------|-------------|-------------|----------|
| `users` | id, email, phone, role, trust_level, trust_score, ban_* | PK | ข้อมูล account หลัก |
| `hirer_profiles` | user_id, display_name, full_name, address, lat/lng | FK→users | โปรไฟล์ผู้ว่าจ้าง |
| `caregiver_profiles` | user_id, display_name, bio, specializations[], certifications[] | FK→users | โปรไฟล์ผู้ดูแล |
| `user_policy_acceptances` | user_id+role (PK), version, accepted_at | FK→users | ยอมรับข้อตกลง |
| `auth_sessions` | user_id, token_hash, refresh_token_hash, status | FK→users | JWT sessions |

#### กลุ่ม Job System (8 ตาราง)

| ตาราง | คอลัมน์สำคัญ | ความสัมพันธ์ | คำอธิบาย |
|-------|-------------|-------------|----------|
| `job_posts` | hirer_id, title, job_type, risk_level, status, scheduled_* | FK→users | ประกาศงาน/draft |
| `jobs` | job_post_id, hirer_id, status, evidence_note, evidence_photo_url | FK→job_posts | instance งานจริง |
| `job_assignments` | job_id, caregiver_id, status | FK→jobs, users | มอบหมายงาน |
| `job_gps_events` | job_id, caregiver_id, event_type, lat/lng | FK→jobs | GPS check-in/out |
| `job_photo_evidence` | job_id, phase, storage_key | FK→jobs | หลักฐานรูปภาพ |
| `job_patient_requirements` | job_id, patient_id, care tasks | FK→jobs | ข้อกำหนดผู้ป่วย |
| `job_patient_sensitive_data` | job_id, diagnosis, medication | FK→jobs | ข้อมูลอ่อนไหว |
| `early_checkout_requests` | job_id, caregiver_id, hirer_id, status | FK→jobs | คำขอจบงานพิเศษ |

#### กลุ่ม Patient (1 ตาราง)

| ตาราง | คำอธิบาย |
|-------|----------|
| `patient_profiles` | ข้อมูลผู้รับดูแล: ชื่อ, ที่อยู่, สุขภาพ, โรคประจำตัว, อุปกรณ์การแพทย์ |

#### กลุ่ม Financial (8 ตาราง)

| ตาราง | คอลัมน์สำคัญ | คำอธิบาย |
|-------|-------------|----------|
| `wallets` | user_id, job_id, wallet_type, available_balance, held_balance | กระเป๋าเงิน (5 types) |
| `ledger_transactions` | from_wallet_id, to_wallet_id, amount, type, reference_type, idempotency_key | บัญชีรายการ (immutable) |
| `topup_intents` | user_id, amount, method, status, qr_payload | คำสั่งเติมเงิน |
| `withdrawal_requests` | user_id, bank_account_id, amount, status | คำขอถอนเงิน |
| `bank_accounts` | user_id, bank_code, account_number_encrypted | บัญชีธนาคาร |
| `banks` | code, full_name_th, full_name_en | รายชื่อธนาคาร |
| `job_deposits` | job_post_id, party, amount, status | เงินประกันงาน |
| `payments` | payer_id, payee_id, job_id, amount, status | payment records |

#### กลุ่ม Chat & Disputes (5 ตาราง)

| ตาราง | คำอธิบาย |
|-------|----------|
| `chat_threads` | thread per job (1:1 job↔thread), status |
| `chat_messages` | sender_id, type (text/image/file/system), content, attachment_key |
| `disputes` | job_post_id, opened_by, status, reason, assigned_admin_id |
| `dispute_messages` | sender_id, type, content, attachment_key |
| `dispute_events` | timeline: status changes, notes |

#### กลุ่ม Notifications & Trust (4 ตาราง)

| ตาราง | คำอธิบาย |
|-------|----------|
| `notifications` | user_id, template_key, title, body, status, reference_type/id |
| `notification_preferences` | email_enabled, push_enabled |
| `push_subscriptions` | endpoint, p256dh_key, auth_key (Web Push) |
| `trust_score_history` | user_id, delta, score_before/after, trust_level_before/after, reason_code |

#### กลุ่ม Verification & Documents (4 ตาราง)

| ตาราง | คำอธิบาย |
|-------|----------|
| `user_kyc_info` | KYC status (pending/approved/rejected), national_id_hash |
| `caregiver_documents` | เอกสาร/ใบรับรอง caregiver |
| `otp_codes` | OTP hash, destination, type, attempts, expires_at |
| `password_reset_tokens` | token_hash, expires_at, used_at |

#### กลุ่ม Reviews & Favorites (2 ตาราง)

| ตาราง | คำอธิบาย |
|-------|----------|
| `caregiver_reviews` | reviewer_id, caregiver_id, job_id, rating (1-5), comment |
| `caregiver_favorites` | hirer_id, caregiver_id (UNIQUE pair) |

#### กลุ่ม Complaints (2 ตาราง)

| ตาราง | คำอธิบาย |
|-------|----------|
| `complaints` | reporter_id, category, target_user_id, status, admin_note |
| `complaint_attachments` | complaint_id, file_path, file_name, mime_type |

#### กลุ่ม Audit & Webhooks (2 ตาราง)

| ตาราง | คำอธิบาย |
|-------|----------|
| `audit_events` | user_id, event_type (policy_denied, trust_change), details JSONB |
| `provider_webhooks` | provider_name, event_type, payload, signature_valid |

### 6.4 Database Constraints สำคัญ

```
Constraints:
  ├── wallets.available_balance ≥ 0              ← ป้องกันยอดติดลบ
  ├── wallets.held_balance ≥ 0                   ← ป้องกัน held ติดลบ
  ├── ledger_transactions: NO UPDATE, NO DELETE  ← DB trigger ป้องกันแก้ไข
  ├── ledger_transactions.idempotency_key UNIQUE ← ป้องกัน duplicate
  ├── job_assignments UNIQUE(job_id) WHERE status='active' ← 1 active assignment per job
  ├── users: CHECK email OR phone_number required
  ├── users: CHECK guest must have email
  └── users: CHECK member must have phone
```

### 6.5 Schema Migrations — `database/migrations/` (15 ไฟล์ incremental)

| ไฟล์ | คำอธิบาย |
|------|----------|
| `20260113_01_disputes.sql` | Disputes + messages + events tables |
| `20260113_02_patient_profiles_extended.sql` | Extended patient fields |
| `20260113_03_job_posts_risk_reasons.sql` | risk_reason_codes, risk_reason_detail |
| `20260113_04_job_posts_requirements_flags.sql` | job_tasks_flags, required_skills_flags |
| `20260201_01_user_policy_acceptances.sql` | Policy acceptance table |
| `20260203_01_patient_profiles_location.sql` | Patient location fields |
| `20260205_01_audit_events.sql` | Audit events table |
| `20260205_02_job_posts_preferred_caregiver.sql` | preferred_caregiver_id |
| `20260215_01_patient_profiles_birth_year.sql` | birth_year column |
| `20260217_01_job_posts_patient_profile.sql` | patient_profile_id FK |
| `20260218_01_profile_full_name.sql` | full_name column |
| `20260222_01_password_reset_tokens.sql` | Password reset tokens table |
| `20260224_01_users_ban_columns.sql` | ban_login, ban_job_create, etc. |
| `20260319_01_financial_deposits.sql` | job_deposits table + fee columns |
| `20260329_01_otp_codes_user_id_nullable.sql` | otp_codes.user_id nullable |

---

## 7. Mock Provider — ระบบจำลองภายนอก

**หน้าที่**: จำลอง External Services สำหรับ development — ไม่ต้องใช้ API keys จริง

```
Mock Provider (Port 4000)
  │
  ├── Payment Simulation
  │   ├── POST /api/payment/create-session  → คืน mock payment URL
  │   ├── POST /api/payment/verify          → คืน success/failed
  │   └── webhook → POST /api/webhooks/payment (backend)
  │
  ├── SMS Simulation
  │   ├── POST /api/sms/send               → log OTP (ไม่ส่งจริง)
  │   └── default OTP: 123456 (MOCK_SMS_OTP_CODE)
  │
  ├── KYC Simulation
  │   ├── POST /api/kyc/verify             → auto-approve
  │   └── webhook → POST /api/webhooks/kyc (backend)
  │
  └── Withdrawal Simulation
      └── POST /api/withdrawal/process     → mock bank transfer
```

| Config | Default | คำอธิบาย |
|--------|---------|----------|
| `MOCK_PAYMENT_AUTO_SUCCESS` | `true` | Auto-approve payments |
| `MOCK_SMS_OTP_CODE` | `123456` | Fixed OTP code for dev |
| `MOCK_KYC_AUTO_APPROVE` | `true` | Auto-approve KYC |
| `BACKEND_WEBHOOK_URL` | `http://backend:3000/api/webhooks` | Webhook target |

---

## 8. Flowchart การทำงานหลัก

### 8.1 Registration & Authentication Flow

```
                        ┌─────────────────┐
                        │   User เปิด App  │
                        └────────┬────────┘
                                 │
                    ┌────────────┼────────────┐
                    ▼            ▼             ▼
              ┌──────────┐ ┌──────────┐ ┌──────────────┐
              │  Email    │ │  Phone   │ │  Google      │
              │  Register │ │  Register│ │  OAuth       │
              └─────┬────┘ └────┬─────┘ └──────┬───────┘
                    │           │               │
                    ▼           ▼               ▼
              ┌──────────────────────────────────────┐
              │  Backend: authService                 │
              │  1. validate input (Joi)              │
              │  2. hash password (bcrypt)            │
              │  3. INSERT users (role, account_type) │
              │  4. INSERT profile (default name)     │
              │  5. INSERT wallet                     │
              │  6. generate JWT + refresh token      │
              └──────────────────┬───────────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────────┐
              │  Frontend: AuthContext                 │
              │  1. store tokens (localStorage)       │
              │  2. set user state                    │
              │  3. redirect → /select-role           │
              └──────────────────┬───────────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────────┐
              │  RoleSelectionPage                    │
              │  1. เลือก hirer / caregiver           │
              │  2. POST /api/auth/role               │
              │  3. redirect → ConsentPage            │
              └──────────────────┬───────────────────┘
                                 │
                                 ▼
              ┌──────────────────────────────────────┐
              │  ConsentPage                          │
              │  1. แสดงข้อตกลง                        │
              │  2. POST /api/auth/policy/accept      │
              │  3. redirect → Home (hirer/caregiver) │
              └──────────────────────────────────────┘
```

### 8.2 Job Lifecycle Flow (Complete)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         JOB LIFECYCLE FLOWCHART                          │
└─────────────────────────────────────────────────────────────────────────┘

  HIRER                              SYSTEM                      CAREGIVER
  ─────                              ──────                      ─────────

  สร้างงาน (CreateJobPage)
  POST /api/jobs
  { title, job_type, schedule,
    hourly_rate, address, ... }
       │
       ▼
  ┌──────────┐
  │  DRAFT   │  ← risk_level auto-computed
  └────┬─────┘    min_trust_level auto-set
       │
  โพสต์งาน
  POST /api/jobs/:id/publish
       │
       ▼
  ┌──────────────────────────┐
  │  publishJob()             │
  │  1. ตรวจ trust level      │
  │     (L1+ low, L2+ high)  │
  │  2. คำนวณ deposit tier    │
  │  3. hold wallet           │
  │     (amount + deposit)    │
  │  4. INSERT ledger (hold)  │
  └─────────┬────────────────┘
            │
            ▼
  ┌──────────┐                                        ดู feed
  │  POSTED  │ ◄──────────────────────────────── GET /api/jobs/feed
  └────┬─────┘                                        │
       │                                              ▼
       │                                        ┌──────────────────┐
       │                                        │ filter: job_type, │
       │                                        │ risk, location,   │
       │                                        │ trust_level check │
       │                                        └────────┬─────────┘
       │                                                 │
       │                                           รับงาน
       │                                     POST /api/jobs/:id/accept
       │                                                 │
       ▼                                                 ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  acceptJob()                                                  │
  │  1. ตรวจ caregiver trust_level ≥ min_trust_level             │
  │  2. ตรวจ required certifications (high_risk)                  │
  │  3. ตรวจ schedule conflict                                    │
  │  4. hirer held → escrow held (amount + deposit)              │
  │  5. INSERT jobs (status=assigned)                             │
  │  6. INSERT job_assignments                                    │
  │  7. INSERT job_deposits (status=held)                         │
  │  8. CREATE chat_thread                                        │
  │  9. notify hirer (job_accepted)                               │
  └────────────────────────────┬─────────────────────────────────┘
                               │
                               ▼
                         ┌──────────┐
                         │ ASSIGNED │ ← grace period 30 นาที
                         └────┬─────┘
                              │
                    ┌─────────┼──────────────────────────┐
                    │         │                           │
                    ▼         ▼                           ▼
              ไม่มา (No-show)  Check-in                   ยกเลิก
              30 min passed    POST /jobs/:jobId/checkin   POST /jobs/:id/cancel
                    │          { lat, lng, accuracy_m }        │
                    ▼                │                         ▼
            ┌──────────────┐        ▼                   ┌────────────┐
            │ AUTO-CANCEL  │  ┌─────────────┐           │ CANCELLED  │
            │ full refund  │  │ IN_PROGRESS │           │ (5 cases)  │
            │ hirer deposit│  └──────┬──────┘           └────────────┘
            │ trust penalty│         │
            └──────────────┘         │
                              ┌──────┼──────────────────┐
                              │      │                   │
                              ▼      ▼                   ▼
                        อัพโหลดรูป   ส่งงาน             ขอจบงาน
                        POST /jobs/  POST /jobs/         กรณีพิเศษ
                        :id/checkout :jobId/checkout     POST /jobs/:jobId/
                        -photo       { lat, lng,         early-checkout-request
                              │       evidence_note,          │
                              │       evidence_photo_url }    ▼
                              │            │            ┌──────────────┐
                              └────────────┤            │ Hirer Review │
                                           │            │ approve/reject│
                                           ▼            └──────┬───────┘
                              ┌──────────────────────┐         │
                              │  checkOut() — Settlement│◄──────┘
                              │  1. INSERT gps_event   │  (auto-approve 1hr)
                              │  2. escrow → CG wallet │
                              │     (amount - 10% fee) │
                              │  3. escrow → platform  │
                              │     (10% fee)          │
                              │  4. escrow → hirer     │
                              │     (deposit release)  │
                              │  5. UPDATE job_deposits│
                              │  6. trust score update │
                              │  7. notify hirer       │
                              └──────────┬────────────┘
                                         │
                                         ▼
                                   ┌───────────┐
                                   │ COMPLETED │
                                   └───────────┘
```

### 8.3 Payment & Wallet Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                      PAYMENT FLOW (Double-entry Ledger)              │
└─────────────────────────────────────────────────────────────────────┘

Phase 1: TOP-UP
  User ──POST /wallet/topup──▶ Backend ──create session──▶ Stripe
                                  │
                           INSERT topup_intents (pending)
                                  │
  User ◄──payment_url────────────┘
  User ──pay──▶ Stripe ──webhook──▶ Backend
                                      │
                              processTopupSuccess()
                              ├─ UPDATE topup_intents (succeeded)
                              ├─ wallet.available_balance += amount
                              ├─ INSERT ledger (credit/topup)
                              └─ notify user (topup_success)

Phase 2: PUBLISH (Hold)
  publishJob()
  ├─ cost = total_amount + hirer_deposit
  ├─ hirer.available -= cost
  ├─ hirer.held += cost
  ├─ INSERT ledger (hold/job: total_amount)
  └─ INSERT ledger (hold/deposit: hirer_deposit)

Phase 3: ACCEPT (Escrow)
  acceptJob()
  ├─ hirer.held -= cost
  ├─ CREATE escrow wallet (held = cost)
  ├─ INSERT ledger (hold/job: hirer → escrow)
  ├─ INSERT ledger (hold/deposit: hirer → escrow)
  └─ INSERT job_deposits (status=held)

Phase 4: CHECKOUT (Settlement)
  checkOut()
  ├─ fee = floor(total_amount × 0.10)
  ├─ cg_payout = total_amount - fee
  ├─ escrow → CG wallet: cg_payout (release/job)
  ├─ escrow → platform: fee (debit/fee)
  ├─ escrow → hirer: deposit (release/deposit)
  ├─ UPDATE job_deposits (released)
  └─ UPDATE jobs (final amounts, settlement_mode='normal')

Phase 5: CANCEL (5 Sub-cases)
  ┌─────────────────────────────────────────────────────┐
  │ Case B: Before accept                                       │
  │   hirer.held -= cost → hirer.available += cost             │
  │                                                             │
  │ Case C: After accept, ≥24h before start                    │
  │   escrow → hirer: full refund (amount + deposit)           │
  │                                                             │
  │ Case D: After accept, <24h (late cancel)                   │
  │   escrow → hirer: refund amount                            │
  │   50% deposit forfeited:                                    │
  │     70% → CG compensation                                  │
  │     30% → platform penalty revenue                         │
  │   50% deposit → released to hirer                          │
  │                                                             │
  │ Case E: CG cancel after accept                             │
  │   hold in escrow, fault_party='unresolved' → admin settle  │
  │                                                             │
  │ Case F: CG no-show (auto, 30min grace)                     │
  │   escrow → hirer: full refund (amount + deposit)           │
  │   CG trust penalty: -20 score                              │
  └─────────────────────────────────────────────────────┘
```

### 8.4 Trust Level & Score Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                    TRUST LEVEL DETERMINATION FLOW                     │
└─────────────────────────────────────────────────────────────────────┘

  Trigger Event
  (job_completed / no_show / admin_recalculate)
       │
       ▼
  ┌──────────────────────────────────────────┐
  │  trustLevelWorker.triggerUserTrustUpdate  │
  │                                          │
  │  Query factors:                          │
  │  ├─ completed_jobs × +5                  │
  │  ├─ good_reviews (4-5★) × +3            │
  │  ├─ avg_reviews (3★) × +1               │
  │  ├─ bad_reviews (1-2★) × -5             │
  │  ├─ cancellations × -10                  │
  │  ├─ no_shows × -20                       │
  │  ├─ gps_violations × -3                  │
  │  ├─ on_time_checkins × +2               │
  │  └─ profile_complete → +10               │
  │                                          │
  │  score = clamp(0, 100, 50 + sum)         │
  └───────────────────┬──────────────────────┘
                      │
                      ▼
  ┌──────────────────────────────────────────┐
  │  Determine Trust Level                    │
  │                                          │
  │  L0: default (no verification)           │
  │  L1: email OR phone verified             │
  │  L2: L1 + KYC approved                   │
  │  L3: L2 + bank verified + score ≥ 80     │
  │      (hysteresis: drop at score < 75)    │
  └───────────────────┬──────────────────────┘
                      │
                      ▼
  ┌──────────────────────────────────────────┐
  │  Score Enforcement                        │
  │                                          │
  │  score = 0 ──▶ ban_login = true          │
  │                cancel ALL assigned jobs   │
  │                                          │
  │  score < 40 (crossed from ≥40)           │
  │           ──▶ cancel high_risk jobs only  │
  │                                          │
  │  in_progress jobs ──▶ ไม่กระทบ            │
  └──────────────────────────────────────────┘
```

### 8.5 Chat & Real-time Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CHAT SYSTEM FLOW                              │
└─────────────────────────────────────────────────────────────────────┘

  1. Thread Creation (auto on job accept)
     acceptJob() → INSERT chat_thread (job_id)

  2. Connect (เปิดหน้า ChatRoomPage)
     Client ──Socket.IO connect──▶ Backend
             auth: { token: JWT }
                    │
                    ▼
             verify JWT → join user:{userId} room

  3. Join Thread
     Client ──thread:join──▶ Backend
             { threadId }
                    │
                    ├─ canAccessThread(userId, threadId)?
                    │      YES → join thread:{threadId} room
                    │      NO  → emit error
                    │
                    ▼
             Server ──thread:joined──▶ Client

  4. Send Message
     Client ──message:send──▶ Backend
             { threadId, type:'text', content:'สวัสดี' }
                    │
                    ├─ INSERT chat_messages
                    ├─ broadcast to thread room
                    │
                    ▼
             Server ──message:new──▶ All clients in room
             Server ──notification:new──▶ recipient user room

  5. Send Image
     Client ──POST /api/chat/threads/:id/upload──▶ Backend (HTTP)
             FormData: { file: image }
                    │
                    ├─ save to /uploads/chat/
                    ├─ return { attachment_key, url }
                    │
                    ▼
     Client ──message:send──▶ Backend (Socket)
             { threadId, type:'image', attachment_key }

  6. Typing Indicator
     Client ──typing:start──▶ Server ──typing:started──▶ Other clients
     Client ──typing:stop──▶  Server ──typing:stopped──▶ Other clients
```

### 8.6 KYC Verification Flow

```
  User                    Frontend              Backend              Mock/Real Provider
   │                         │                     │                        │
   │── เปิด KYC Page ──────▶│                     │                        │
   │                         │── GET /kyc/status ─▶│                        │
   │                         │◀── status ──────────│                        │
   │                         │                     │                        │
   │── อัพโหลดเอกสาร ──────▶│                     │                        │
   │   (บัตรหน้า+หลัง+selfie)│                     │                        │
   │                         │── POST /kyc/submit ▶│                        │
   │                         │   (multipart)       │── verify ────────────▶│
   │                         │                     │                        │
   │                         │                     │◀── webhook result ────│
   │                         │                     │                        │
   │                         │                     │── IF approved:        │
   │                         │                     │   UPDATE kyc status   │
   │                         │                     │   UPDATE trust_level  │
   │                         │                     │   → L2                │
   │                         │                     │                        │
   │                         │                     │                        │
   │◀── notification ────────│◀── 200 OK ──────────│                        │
```

### 8.7 Notification Delivery Flow

```
  Trigger Event (e.g., job_accepted)
       │
       ▼
  notificationService.createNotification(userId, templateKey, data)
       │
       ├─ 1. INSERT notifications table (status=queued)
       │
       ├─ 2. In-App: emit Socket.IO → user:{userId} room
       │      event: 'notification:new'
       │
       ├─ 3. Push Notification (if enabled + subscription exists)
       │      web-push → browser Service Worker
       │
       ├─ 4. Email (if enabled + email_provider configured)
       │      nodemailer → SMTP
       │
       └─ 5. UPDATE notification status → sent/delivered
```

---

## 9. ความสัมพันธ์ระหว่างโมดูล (Module Relationship Diagram)

### 9.1 Backend Module Dependencies

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    BACKEND MODULE DEPENDENCY MAP                          │
└─────────────────────────────────────────────────────────────────────────┘

  server.js
    ├── routes/* (17 files)
    │     ├── middleware/auth.js
    │     │     ├── utils/errors.js
    │     │     └── utils/db.js (via models)
    │     ├── utils/validation.js (Joi schemas)
    │     └── controllers/* (17 files)
    │           └── services/* (12 files)
    │                 ├── models/* (9 files)
    │                 │     └── utils/db.js (pg pool)
    │                 ├── utils/risk.js
    │                 ├── utils/depositTier.js
    │                 ├── sockets/realtimeHub.js
    │                 └── workers/trustLevelWorker.js
    │
    ├── sockets/chatSocket.js
    │     ├── middleware/auth.js (JWT verify)
    │     └── services/chatService.js
    │
    └── workers/noShowWorker.js
          └── services/jobService.js

  Key Dependency Rules:
  ┌──────────────────────────────────────────────────────┐
  │  Routes → Controllers → Services → Models → DB      │
  │                                                      │
  │  ✓ Routes เรียก Controllers เท่านั้น                  │
  │  ✓ Controllers เรียก Services เท่านั้น                │
  │  ✓ Services เรียก Models + Workers + RealtimeHub     │
  │  ✓ Models เรียก DB (pg pool) เท่านั้น                 │
  │  ✗ Models ห้ามเรียก Services                          │
  │  ✗ Controllers ห้ามเรียก Models โดยตรง                │
  └──────────────────────────────────────────────────────┘
```

### 9.2 Frontend Module Dependencies

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   FRONTEND MODULE DEPENDENCY MAP                         │
└─────────────────────────────────────────────────────────────────────────┘

  main.tsx → App.tsx
    ├── contexts/AuthContext.tsx
    │     ├── services/api.ts (HTTP client)
    │     └── utils/authStorage.ts (token store)
    │
    ├── router.tsx
    │     ├── routerGuards.tsx
    │     │     ├── contexts/AuthContext.tsx (useAuth hook)
    │     │     └── utils/profileName.ts
    │     │
    │     ├── layouts/*
    │     │     ├── components/navigation/TopBar.tsx
    │     │     │     ├── services/api.ts (notifications)
    │     │     │     ├── utils/phone.ts (mask)
    │     │     │     └── utils/avatar.ts
    │     │     └── components/navigation/BottomBar.tsx
    │     │
    │     └── pages/* (49 files)
    │           ├── contexts/AuthContext.tsx (useAuth)
    │           ├── services/api.ts (API calls)
    │           ├── services/appApi.ts (convenience)
    │           ├── components/ui/* (shared UI)
    │           └── utils/* (helpers)
    │
    └── components/ErrorBoundary.tsx

  Key Dependency Rules:
  ┌──────────────────────────────────────────────────────┐
  │  Pages → Services/API → Backend (HTTP)               │
  │  Pages → Contexts (useAuth)                          │
  │  Pages → Components/UI (shared)                      │
  │  Pages → Utils (helpers)                             │
  │                                                      │
  │  ✓ Pages เรียก api.ts สำหรับทุก backend call         │
  │  ✓ Components เป็น stateless (props-driven)          │
  │  │  Context จัดการ global state                       │
  │  ✗ Components ห้ามเรียก API โดยตรง (ยกเว้น TopBar)   │
  │  ✗ Utils ห้าม import React                           │
  └──────────────────────────────────────────────────────┘
```

### 9.3 Cross-system Communication Map

```
┌─────────────────────────────────────────────────────────────────────────┐
│              FRONTEND ↔ BACKEND COMMUNICATION CHANNELS                   │
└─────────────────────────────────────────────────────────────────────────┘

  Channel 1: REST API (HTTP)
  ──────────────────────────────────────────────────────
  Frontend (api.ts)  ───/api/*───▶  Backend (Express routes)
    ├── JSON body + Authorization header
    ├── Success patterns: { success: true, data: ... } หรือ { success: true, ...payload }
    └── Error patterns: { success: false, error: '...' } หรือ { error: { code, message, details? } }

  Channel 2: WebSocket (Socket.IO)
  ──────────────────────────────────────────────────────
  Frontend (ChatRoomPage)  ───ws───▶  Backend (chatSocket.js)
    ├── Auth: JWT token on connect
    ├── Events: thread:join, message:send, typing:start/stop
    └── Server push: message:new, notification:new

  Channel 3: File Upload (Multipart)
  ──────────────────────────────────────────────────────
  Frontend (FormData)  ───POST multipart───▶  Backend (multer)
    ├── Avatar: /api/auth/avatar (max 10MB)
    ├── Chat image: /api/chat/threads/:id/upload
    ├── Checkout photo: /api/jobs/:id/checkout-photo
    ├── KYC docs: /api/kyc/submit
    └── Dispute: /api/disputes/:id/upload

  Channel 4: External Webhooks
  ──────────────────────────────────────────────────────
  Stripe/Mock Provider  ───POST───▶  Backend (/api/webhooks/*)
    ├── Signature verification (HMAC)
    └── Events: payment.success, kyc.result, sms.status
```

### 9.4 Service-to-Service Dependencies

```
┌─────────────────────────────────────────────────────────────────────────┐
│                   SERVICE INTER-DEPENDENCY MAP                           │
└─────────────────────────────────────────────────────────────────────────┘

  jobService.js ──────────────▶ walletService.js
    │  (holdJobPayment, releaseEscrow, refund)
    │
    ├──────────────────────────▶ notificationService.js
    │  (notifyJobAccepted, notifyCheckIn, notifyCheckOut, notifyCancel)
    │
    ├──────────────────────────▶ trustLevelWorker.js
    │  (triggerUserTrustUpdate after checkout/cancel/no-show)
    │
    └──────────────────────────▶ chatService.js
       (getOrCreateThread on acceptJob)

  walletService.js ────────────▶ notificationService.js
    │  (notifyTopupSuccess, notifyWithdrawal)
    │
    └──────────────────────────▶ paymentService.js
       (createCheckoutSession for Stripe)

  authService.js ──────────────▶ notificationService.js
       (notifyWelcome on register)

  disputeService.js ───────────▶ walletService.js
    │  (settleDispute: refund or payout)
    │
    └──────────────────────────▶ notificationService.js
       (notifyDisputeSettled)
  
   adminController ─────────────▶ trustLevelWorker.js
       (recalculateAllCaregivers)
 
 ---

 ## 10. รายละเอียดพารามิเตอร์ระหว่างโปรแกรมย่อย

 ### 10.1 API Request / Response Patterns

 ```
 Typical request patterns in current codebase:
   - Protected routes use Authorization: Bearer <JWT>
   - JSON payloads use Content-Type: application/json
   - File uploads use Content-Type: multipart/form-data
   - Pagination / filters are passed via query string

 Typical response patterns in current codebase:
   - { success: true, data: ... }
   - { success: true, ...payload }
   - { success: false, error: '...' }         // used by many controllers
   - { error: { code, message, details? } }   // ApiError / auth middleware
   - { received: true }                       // webhook handlers
 ```

 ### 10.2 JWT Token Payloads

 ```
 Access token payload:
 {
   userId: string,
   role: 'hirer'|'caregiver'|'admin',
   accountType: 'guest'|'member',
   trustLevel: 'L0'|'L1'|'L2'|'L3',
   iss: 'careconnect',
   sub: user.id,
   iat: number,
   exp: number
 }

 Refresh token payload:
 {
   userId: string,
   type: 'refresh',
   iss: 'careconnect',
   sub: user.id,
   iat: number,
   exp: number
 }
 ```

 ### 10.3 Runtime Parameters & Socket Payloads

 ```
 Auth middleware attaches:
   req.user
   req.userId
   req.userRole
   req.userTrustLevel
   req.userAccountType

 Socket.IO client -> server payloads:
   'thread:join'     -> threadId
   'thread:leave'    -> threadId
   'message:send'    -> { threadId, type, content, attachment_key?, metadata? }
   'typing:start'    -> threadId
   'typing:stop'     -> threadId
   'message:read'    -> { threadId, messageId }

 Socket.IO server -> client payloads:
   'thread:joined'   -> { threadId }
   'thread:left'     -> { threadId }
   'message:new'     -> message object
   'typing:started'  -> { threadId, userId }
   'typing:stopped'  -> { threadId, userId }
   'message:read'    -> { threadId, messageId, userId, readAt }
   'notification:new'-> payload varies by emitter (e.g. { notification } or { title, body })
 ```

 ### 10.4 Wallet Types & Ledger Transaction Types

 ```
 Wallet Types (wallets.wallet_type):
   ├── 'hirer'
   ├── 'caregiver'
   ├── 'escrow'
   ├── 'platform'
   └── 'platform_replacement'

 Ledger Transaction Types (ledger_transactions.type):
   ├── 'credit'
   ├── 'debit'
   ├── 'hold'
   ├── 'release'
   ├── 'reversal'
   ├── 'forfeit'
   └── 'compensation'

 Reference Types (ledger_transactions.reference_type):
   ├── 'topup'
   ├── 'job'
   ├── 'dispute'
   ├── 'withdrawal'
   ├── 'fee'
   ├── 'refund'
   ├── 'penalty'
   ├── 'deposit'
   ├── 'compensation'
   └── 'platform_penalty_revenue'
 ```

 ### 10.5 Status Enums ที่ใช้ใน Job Flow

 ```
 job_status enum:
   draft | posted | assigned | in_progress | completed | cancelled | expired

 assignment_status enum:
   active | replaced | completed | cancelled

 early_checkout_requests.status:
   pending | approved | rejected

 Note:
   cron auto-approve จะ update early_checkout_requests จาก 'pending' -> 'approved'
 ```

 ### 10.6 Docker Compose Services

| Mode | Service | Port | รายละเอียด |
|------|---------|------|-------------|
| **Development** | `postgres` | `5432` | import `database/schema.sql` ครั้งแรกเมื่อ volume ว่าง |
| **Development** | `migrate` | profile only | `npm run migrate` ใช้เมื่ออยากรันแยกเอง |
| **Development** | `backend` | `3000` | `sh -c "npm run migrate && npm run dev"`, depends on `postgres` + `mock-provider` |
| **Development** | `mock-provider` | `4000` | mock payment/SMS/KYC/webhook |
| **Development** | `frontend` | `5173` | Vite dev server, proxy ไป `backend`, รองรับ `VITE_PUBLIC_*` สำหรับ public HMR |
| **Development** | `pgadmin` | `5050` | optional DB UI |
| **Production** | `postgres` | internal | ใช้ volume persistent, ไม่มี initdb schema mount |
| **Production** | `migrate` | profile only | รัน `npm run migrate` แยกจาก app startup |
| **Production** | `backend` | expose `3000` | ใช้ production Dockerfile และ env แบบ fail-fast |
| **Production** | `frontend` | `${HTTP_PORT:-80}:80` | Nginx serve static files และ proxy `/api`, `/health`, `/uploads`, `/socket.io` |

> Current live server ณ ตอนนี้ใช้ **development compose + Cloudflare Tunnel ไปที่ `localhost:5173`** ไม่ได้ใช้ `docker-compose.prod.yml` เป็น public path หลัก

### 10.7 Environment Responsibilities

- **`docker-compose.yml`**
  - ให้ค่า default ที่เหมาะกับ dev stack ปัจจุบัน เช่น `DATABASE_HOST=postgres`, `MOCK_PROVIDER_BASE_URL=http://mock-provider:4000`, `UPLOAD_DIR=/app/uploads`, `WEBHOOK_BASE_URL=http://backend:3000`, `VITE_API_TARGET=http://backend:3000`
  - ทำให้ dev stack ขึ้นได้แม้ไม่มี root `.env`

- **`backend/src/config/loadEnv.js`**
  - โหลด env จาก root `.env` → `backend/.env` → overlays ตาม `NODE_ENV`
  - non-production เติม default และ fallback providers เป็น `mock` พร้อม `console.warn`
  - production ปล่อยให้ `server.js` validate แบบ fail-fast

- **`docker-compose.prod.yml`**
  - บังคับให้ใส่ secrets สำคัญและ provider selectors หลายตัวผ่าน `${VAR:?required}`
  - แยกการรัน migrations ออกเป็น profile `migrate`
  - expose frontend ผ่าน `${HTTP_PORT:-80}:80`

- **`frontend/Dockerfile` + `docker-compose.prod.yml` build args**
  - `VITE_API_URL`, `VITE_API_BASE_URL`, `VITE_SOCKET_URL`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_VAPID_PUBLIC_KEY` ถูกอ่านตอน build image เท่านั้น
  - เปลี่ยนค่าแล้วต้อง rebuild frontend image ใหม่

- **`VITE_PUBLIC_*`**
  - มีผลหลักกับ dev server/HMR เมื่อ frontend ถูกเปิดผ่าน public hostname หรือตัวกลางอย่าง Cloudflare Tunnel
  - ค่าที่ใช้บ่อยกับเครื่องจริงคือ `VITE_PUBLIC_HOST=<public-host>`, `VITE_PUBLIC_PROTOCOL=wss`, `VITE_PUBLIC_HMR_PORT=443`

## ภาคผนวก

 ### A. คำสั่งเริ่มต้นใช้งาน (Quick Start)

```bash
# 1. Clone + setup
git clone <repo-url>
cd Careconnect

# 2. .env เป็น optional ถ้าจะขึ้นแบบ mock/default ก่อน
# cp .env.example .env

# 3. Start all services
docker compose up -d --build

# 4. Migrations รันอัตโนมัติตอน backend start (ไม่ต้องรันเอง)

# 5. (Optional) Seed demo data
docker compose exec backend npm run seed:demo

# 6. Access
# Frontend: http://localhost:5173
# Backend:  http://localhost:3000/health
# Mock:     http://localhost:4000/health
# pgAdmin:  http://localhost:5050
```

เมื่อต้องการ public access แบบเดียวกับเครื่องจริง ให้ตั้งอย่างน้อย `FRONTEND_URL`, `BACKEND_URL`, `CORS_ORIGIN`, `VITE_PUBLIC_HOST`, `VITE_PUBLIC_PROTOCOL=wss`, `VITE_PUBLIC_HMR_PORT=443` แล้วจึงผูก Cloudflare Tunnel ไปที่ `http://localhost:5173`

 ### B. สรุปจำนวนไฟล์ทั้งหมด

 | หมวด | ไฟล์ | โปรแกรมย่อย (ฟังก์ชัน) |
 |------|------|----------------------|
 | Backend Controllers | 17 | ~140 handlers |
 | Backend Services | 12 | ~80 methods |
 | Backend Models | 9 | ~60 queries |
 | Backend Routes | 17 | 145 endpoints |
 | Backend Middleware | 1 | 9 guards (incl. can) |
 | Backend Utils | 9 | ~30 helpers |
 | Backend Workers | 2 | 5 functions |
 | Backend Sockets | 2 | 8 events |
 | Backend Seeds | 5 | seed data generators |
 | Frontend Pages | 49 | 49 page components |
 | Frontend Components | 21 | reusable UI |
 | Frontend Layouts | 5 | 4 layouts + index.ts |
 | Frontend Services | 2 | 80+ API methods |
 | Frontend Contexts | 2 | AuthContext + index.ts |
 | Frontend Utils | 9 | ~25 helpers |
 | Frontend Router | 2 | 53 routes + 5 guards |
 | Database Schema | 1 | 41 tables |
 | Database Migrations | 15 + 23 | database/ (15) + backend/ (23) |
 | Mock Provider | 1 | 4 simulation endpoints |
 | Docker Config | 10 | 4 compose + 6 Dockerfiles |
 | **รวม** | **~186 ไฟล์** | **~530+ โปรแกรมย่อย** |

 ### C. เอกสารอ้างอิง

 | เอกสาร | ที่อยู่ | คำอธิบาย |
 |--------|--------|----------|
 | **SYSTEM.md** | `/SYSTEM.md` | Architectural reference (source of truth) |
| **PROGRESS.md** | `/PROGRESS.md` | สถานะการพัฒนาปัจจุบัน + git log |
| **Schema** | `/database/schema.sql` | Database schema (41 tables) |
| **.env.example** | `/.env.example` | Environment variables template |
| **.env.production.example** | `/.env.production.example` | Production environment template |

---

> เอกสารนี้สร้างโดย AI Assistant เมื่อ 2026-04-06
> อ้างอิงจาก source code จริงของโปรเจค CareConnect
