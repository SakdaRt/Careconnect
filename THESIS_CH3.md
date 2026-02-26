# บทที่ 3 การออกแบบและพัฒนาระบบ

> อ้างอิงจาก SYSTEM.md + codebase จริง (อัพเดท: 2026-02-26)

---

## 3.1 System Architecture (3-Tier Architecture)

ระบบ CareConnect ออกแบบตามแนวคิด **3-Tier Architecture** แบ่งการทำงานออกเป็น 3 ชั้น:

```
┌──────────────────────────────────────────────────────────┐
│         TIER 1 — Presentation Layer                      │
│    React 18 + TypeScript + Vite + TailwindCSS            │
│               Web Browser (Port 5173)                    │
└──────────────────────┬───────────────────────────────────┘
                       │ HTTPS / REST API
                       │ WSS (Socket.IO)
┌──────────────────────▼───────────────────────────────────┐
│         TIER 2 — Application Layer                       │
│    Node.js + Express.js + Socket.IO                      │
│    JWT Auth + Joi Validation + Policy Gates              │
│               API Server (Port 3000)                     │
└───────────────┬──────────────────────┬───────────────────┘
                │ SQL                  │ HTTP
┌───────────────▼───────────┐  ┌───────▼────────────────────┐
│  TIER 3 — Data Layer      │  │  External Services (Mock)  │
│  PostgreSQL 15 / 25+tables│  │  Payment/SMS/KYC Port 4000 │
└───────────────────────────┘  └────────────────────────────┘
```

### 3.1.1 Presentation Layer

ชั้นที่ผู้ใช้โต้ตอบโดยตรง พัฒนาด้วย **React 18** รูปแบบ Single Page Application (SPA) ใช้ **Vite** เป็น build tool และ **React Router 6** จัดการ routing ฝั่ง client สื่อสารกับ Application Layer ผ่าน REST API (Axios) และ WebSocket (Socket.IO)

### 3.1.2 Application Layer

Backend พัฒนาด้วย **Node.js (ESM) + Express.js** ประมวลผล business logic มีระบบ:
- **Authentication**: JWT Access Token (15 นาที) + Refresh Token (7 วัน)
- **Authorization**: Policy Gate System (`can()` function) ตรวจสิทธิ์แบบ action-based
- **Validation**: Joi Schema ทุก request
- **Real-time**: Socket.IO สำหรับ chat และ notifications
- **Workers**: `trustLevelWorker.js` คำนวณ Trust Score แบบ background

### 3.1.3 Data Layer

**PostgreSQL 15** ออกแบบด้วยหลักการสำคัญ:
- **Immutable Ledger**: `ledger_transactions` เป็น append-only ห้าม UPDATE/DELETE
- **Derived State**: `trust_level` คำนวณโดย worker เท่านั้น
- **Constraint integrity**: ยอดเงินติดลบไม่ได้, 1 job มี active assignment ได้ 1 ครั้ง
- **UUID Primary Keys**: ทุกตาราง

### 3.1.4 ภาพรวมโครงสร้างระบบ (Docker Containers)

| Container       | Port | หน้าที่                                    |
|----------------|------|-------------------------------------------|
| `frontend`      | 5173 | Serve React SPA + proxy /api → backend    |
| `backend`       | 3000 | REST API + Socket.IO server               |
| `postgres`      | 5432 | PostgreSQL database                       |
| `mock-provider` | 4000 | จำลอง Payment/SMS/KYC providers           |

---

## 3.2 System Components

### 3.2.1 Frontend Application

```
frontend/src/
├── pages/          หน้าต่างๆ แบ่งตาม role (public/auth/hirer/caregiver/admin/shared)
├── components/ui/  Reusable UI components (Button, Modal, Badge, Card...)
├── contexts/       AuthContext (global auth state)
├── layouts/        MainLayout, AdminLayout
├── services/       api.ts (Axios), appApi.ts
├── utils/          authStorage.ts (sessionStorage-based)
└── router.tsx      Route definitions + Guards
```

**Route Guards**: `RequireAuth`, `RequireRole`, `RequirePolicy`, `RequireProfile`

**Session Storage Strategy**: ใช้ `sessionStorage` (แทน `localStorage`) รองรับหลาย tab พร้อมกันในคนละ role

### 3.2.2 Backend API Server

```
backend/src/
├── routes/      16 route files
├── controllers/ Business logic handlers
├── services/    Core services (authService, jobService, notificationService...)
├── models/      DB query abstractions (User.js, Job.js, Wallet.js...)
├── middleware/  auth.js (JWT + Policy Gates)
├── utils/       errors.js, risk.js, db.js
├── workers/     trustLevelWorker.js
├── sockets/     chatSocket.js, realtimeHub.js
└── server.js    Entry point
```

**Route Files (16 ไฟล์)**:

| Route File                   | Mount Path               | Endpoints |
|-----------------------------|--------------------------|-----------|
| `authRoutes.js`              | `/api/auth`              | 19        |
| `otpRoutes.js`               | `/api/otp`               | 4         |
| `jobRoutes.js`               | `/api/jobs`              | 13        |
| `caregiverSearchRoutes.js`   | `/api/caregivers`        | 4         |
| `careRecipientRoutes.js`     | `/api/care-recipients`   | 5         |
| `caregiverDocumentRoutes.js` | `/api/caregiver-documents` | 4       |
| `reviewRoutes.js`            | `/api/reviews`           | 3         |
| `favoritesRoutes.js`         | `/api/favorites`         | 3         |
| `kycRoutes.js`               | `/api/kyc`               | 3         |
| `walletRoutes.js`            | `/api/wallet`            | 16        |
| `paymentRoutes.js`           | `/api/payments`          | 3         |
| `chatRoutes.js`              | `/api/chat`              | 9         |
| `disputeRoutes.js`           | `/api/disputes`          | 5         |
| `notificationRoutes.js`      | `/api/notifications`     | 5         |
| `webhookRoutes.js`           | `/api/webhooks`          | 3         |
| `adminRoutes.js`             | `/api/admin`             | 20+       |

### 3.2.3 WebSocket Server (Real-time)

**chatSocket.js** — Chat events:
- Room: `thread:{threadId}` (per-job)
- Events: `thread:join`, `message:send`, `typing:start/stop`, `message:read`

**realtimeHub.js** — Notification push:
- Room: `user:{userId}` (personal, join on connect)
- Function: `emitToUserRoom(userId, event, payload)`

### 3.2.4 Database (25+ Tables)

| กลุ่ม                | Tables                                                        |
|---------------------|---------------------------------------------------------------|
| Users & Auth        | users, hirer_profiles, caregiver_profiles, auth_sessions, user_policy_acceptances |
| KYC & Documents     | user_kyc_info, caregiver_documents                           |
| Job System          | job_posts, jobs, job_assignments, patient_profiles, job_patient_requirements |
| Evidence            | job_gps_events, job_photo_evidence, early_checkout_requests  |
| Financial           | wallets, ledger_transactions, topup_intents, withdrawal_requests, bank_accounts, banks |
| Communication       | chat_threads, chat_messages                                  |
| Dispute             | disputes, dispute_messages, dispute_events                   |
| Notification        | notifications                                                |
| Trust & Audit       | trust_score_history, audit_events                            |
| Social              | caregiver_reviews, caregiver_favorites                       |

### 3.2.5 Technology Stack

**Frontend**:

| เทคโนโลยี         | Version | หน้าที่                               |
|------------------|---------|---------------------------------------|
| React            | 18      | UI Framework (Component-based SPA)    |
| TypeScript       | 5+      | Type-safe JavaScript                  |
| Vite             | 5+      | Build tool + Dev server               |
| TailwindCSS      | 3       | Utility-first CSS                     |
| React Router     | 6       | Client-side routing                   |
| Axios            | 1+      | HTTP client                           |
| Socket.IO Client | 4       | Real-time WebSocket                   |
| react-hot-toast  | —       | Toast notifications                   |
| Lucide React     | —       | Icon library                          |
| shadcn/ui        | —       | UI components (Modal, Card, Button)   |

**Backend**:

| เทคโนโลยี        | Version | หน้าที่                               |
|-----------------|---------|---------------------------------------|
| Node.js         | 18      | JavaScript runtime (ESM)              |
| Express.js      | 4+      | Web framework + REST API              |
| Socket.IO       | 4       | WebSocket server                      |
| jsonwebtoken    | —       | JWT generation + verification         |
| bcrypt          | —       | Password hashing                      |
| Joi             | —       | Request validation                    |
| pg              | —       | PostgreSQL client                     |
| multer          | —       | Multipart file upload                 |
| PostgreSQL      | 15      | Relational database                   |
| Docker Compose  | —       | Multi-container orchestration         |

---

## 3.3 User Roles

### 3.3.1 ประเภทผู้ใช้งานทั้งหมด

| Role      | Account Type       | คำอธิบาย                                    |
|----------|--------------------|---------------------------------------------|
| Hirer    | guest (email)      | ผู้ว่าจ้าง — สร้างงาน, ว่าจ้าง, จ่ายเงิน   |
|          | member (phone)     |                                             |
| Caregiver| guest (email)      | ผู้ดูแล — รับงาน, check-in/out, รับเงิน     |
|          | member (phone)     |                                             |
| Admin    | —                  | จัดการระบบ, approve KYC, resolve dispute    |

รองรับ **Google OAuth 2.0** — สร้าง account เป็น Guest type อัตโนมัติ

### 3.3.2 Trust Level System

```
L0 (Unverified)  ← สมัครสมาชิก (ค่าเริ่มต้น)
     │  ยืนยัน Phone OTP
L1 (Basic)       ← รับงาน, เผยแพร่งาน low_risk
     │  KYC + Admin approve
L2 (Verified)    ← เผยแพร่งาน high_risk, ถอนเงิน
     │  Bank verified + Trust Score ≥ 80
L3 (Trusted)     ← สถานะสูงสุด (hysteresis: ลง L2 เมื่อ score < 75)
```

**Trust Score** (base = 50, clamp 0-100):

| ปัจจัย              | คะแนน      | เพดาน   |
|--------------------|-----------:|---------|
| งานที่ทำเสร็จ        | +5 ต่องาน  | +30     |
| รีวิว 4-5 ดาว       | +3 ต่อรีวิว | +20     |
| รีวิว 3 ดาว         | +1 ต่อรีวิว | —       |
| รีวิว 1-2 ดาว       | -5 ต่อรีวิว | -20     |
| ยกเลิกงาน          | -10 ต่อครั้ง| -30     |
| GPS violation      | -3 ต่อครั้ง | -15     |
| Check-in ตรงเวลา   | +2 ต่อครั้ง | +20     |
| โปรไฟล์ครบถ้วน     | +10        | ครั้งเดียว|

### 3.3.3 สิทธิ์การเข้าถึงตาม Role และ Trust Level

| Action                        | Role          | L0 | L1 | L2 | L3 |
|------------------------------|---------------|:--:|:--:|:--:|:--:|
| สมัคร / Login / ดูโปรไฟล์    | ทุก role      | ✓  | ✓  | ✓  | ✓  |
| สร้าง job draft               | Hirer         | ✓  | ✓  | ✓  | ✓  |
| Top-up wallet                 | ทุก role      | ✓  | ✓  | ✓  | ✓  |
| ยกเลิกงาน                    | Hirer/CG      | ✓  | ✓  | ✓  | ✓  |
| ดูบัญชีธนาคาร (hirer)         | Hirer         | ✓  | ✓  | ✓  | ✓  |
| เพิ่มบัญชีธนาคาร (caregiver)  | Caregiver     | ✗  | ✓  | ✓  | ✓  |
| เผยแพร่งาน low_risk          | Hirer         | ✗  | ✓  | ✓  | ✓  |
| รับงาน / Check-in/out         | Caregiver     | ✗  | ✓  | ✓  | ✓  |
| เผยแพร่งาน high_risk         | Hirer         | ✗  | ✗  | ✓  | ✓  |
| ถอนเงิน                      | Caregiver     | ✗  | ✗  | ✓  | ✓  |
| Admin: จัดการทุกอย่าง         | Admin         | ✓  | ✓  | ✓  | ✓  |

---

## 3.4 Functional Requirements

### 3.4.1 Authentication System

**3 ช่องทางการสมัคร**:
- `POST /api/auth/register/guest` — email + password + role → สร้าง user, profile, wallet อัตโนมัติ
- `POST /api/auth/register/member` — phone + password + role
- `GET /api/auth/google` → Google OAuth 2.0 (Authorization Code Flow)

**Token**: JWT Access (15 นาที) + Refresh Token (7 วัน), `POST /api/auth/refresh`

**OTP Verification**: `/api/otp/phone/send` → `/api/otp/verify` → Trust Level L0→L1

**Password Management**: `forgot-password` (email link), `reset-password` (token), `change-password`

### 3.4.2 Profile Management

- `GET/PUT /api/auth/profile` — ดู/แก้ไขโปรไฟล์ (ชื่อเต็ม, ที่อยู่, bio, ความเชี่ยวชาญ)
- `POST /api/auth/avatar` — อัพโหลดรูปโปรไฟล์ (multipart)
- `GET/POST/DELETE /api/caregiver-documents` — จัดการเอกสาร/ใบรับรอง
- `GET/POST/PUT/DELETE /api/care-recipients` — จัดการผู้รับการดูแล (hirer)
- `POST /api/kyc/submit` — ส่ง KYC (บัตรประชาชน front/back + selfie)

### 3.4.3 Search System

- `GET /api/caregivers/search` — ค้นหาด้วย `q`, `skills`, `trust_level`, `experience`, `day`
- `GET /api/caregivers/public/featured` — featured caregivers (ไม่ต้อง login)
- `POST /api/favorites/toggle` — บันทึก/ยกเลิก caregiver ที่ชอบ
- `GET /api/jobs/feed` — Job Feed (กรอง trust level + ไม่ทับซ้อน + ไม่ใช่งานตัวเอง)

### 3.4.4 Chat / Real-time System

Thread-based: **1 งาน = 1 chat thread** สร้างอัตโนมัติเมื่อ Caregiver รับงาน

**REST**: `GET/POST /api/chat/threads/:threadId/messages`, mark-read, unread count

**Socket.IO Events**:

| Client → Server  | Server → Client   | คำอธิบาย           |
|-----------------|------------------|--------------------|
| `thread:join`   | `thread:joined`  | เข้าห้องแชท        |
| `message:send`  | `message:new`    | ส่ง/รับข้อความ     |
| `typing:start`  | `typing:started` | กำลังพิมพ์         |
| `typing:stop`   | `typing:stopped` | หยุดพิมพ์          |
| `message:read`  | `message:read`   | อ่านแล้ว           |

### 3.4.5 Task / Appointment Management

**Hirer**: สร้าง job draft → Publish → Direct Assign (optional) → Cancel

**Job Types (6)**: `companionship`, `personal_care`, `medical_monitoring`, `dementia_care`, `post_surgery`, `emergency`

**Task Flags (22)**: ครอบคลุมตั้งแต่ `companionship`, `meal_prep`, `mobility_assist`, `tube_feeding`, `catheter_care`, `wound_dressing`, `oxygen_monitoring` ฯลฯ

**Risk Level** คำนวณอัตโนมัติ — `high_risk` หากงานประเภท emergency/dementia_care หรือผู้ป่วย bedbound/feeding_tube/tracheostomy

**Caregiver**: Accept → Check-in (GPS) → Check-out (GPS + evidence note)

**Early Checkout System**: ก่อนเวลา → ส่ง request → Hirer อนุมัติ; เลยเวลา 10 นาที → auto-complete

### 3.4.6 Notification System

**Real-time (Socket.IO)**: backend emit `notification` → `user:{userId}` personal room

**Polling Fallback**: `GET /api/notifications/unread-count` ทุก 5 วินาที

**Events ที่ trigger**:

| Event                       | ผู้ส่ง          | ผู้รับ           |
|----------------------------|----------------|-----------------|
| Caregiver รับงาน            | Caregiver      | Hirer           |
| Hirer มอบหมายงานตรง         | Hirer          | Caregiver       |
| Check-in / Check-out        | Caregiver      | Hirer           |
| ยกเลิกงาน                   | Hirer/CG       | อีกฝ่าย         |
| Early checkout request/response | Hirer/CG  | อีกฝ่าย         |
| Dispute สร้างใหม่            | Hirer/CG       | Admin + อีกฝ่าย |
| KYC อนุมัติ/ปฏิเสธ          | Admin          | User            |

### 3.4.7 Order / Payment System

**Double-entry Ledger** — ทุก transaction มี `from_wallet_id → to_wallet_id`, immutable, `idempotency_key`

**Wallet Types (5)**: `hirer`, `caregiver`, `escrow` (per job), `platform`, `platform_replacement`

**Payment Flow (4 Phases)**:

```
Phase 1 Top-up:    POST /wallet/topup → QR → webhook → credit available_balance [credit]
Phase 2 Publish:   available_balance -= cost → held_balance += cost [hold]
Phase 3 Accept:    held_balance (hirer) → escrow wallet (new) [hold]
Phase 4 Checkout:  escrow → caregiver wallet [release] + platform wallet [debit]
Cancel:            escrow → hirer.available_balance [reversal]
```

**Withdrawal**: `POST /api/wallet/withdraw` (L2+) → Admin review → approve → mark paid

### 3.4.8 Content / Information System

**Dispute**: เปิด → ส่งหลักฐาน → Admin รับมอบหมาย → Settle (refund/payout)

**Reviews**: `POST /api/reviews` — rating 1-5 + comment หลังงานเสร็จ (hirer only)

**Admin**: จัดการ users, KYC approve/reject, ดู ledger, reports summary

---

## 3.5 Use Case Diagram

### 3.5.1 Use Case ภาพรวม

```
                 ┌────────────────────────────────────────────────┐
                 │              CareConnect System                │
                 │                                                │
 ┌──────┐        │  (สมัคร/Login)     (จัดการโปรไฟล์)            │
 │Guest │───────►│  (ยืนยัน OTP)      (KYC)                      │
 └──────┘        │                                                │
                 │  (สร้างงาน)        (ค้นหา Caregiver)          │
 ┌───────┐       │  (เผยแพร่งาน)      (Direct Assign)            │
 │Hirer  │───────►  (Top-up Wallet)   (ดูรายงาน/Receipt)         │
 └───────┘       │  (เปิด Dispute)    (อนุมัติ Early Checkout)   │
                 │                                                │
                 │  (ดู Job Feed)     (รับ/ปฏิเสธงาน)           │
 ┌──────────┐    │  (Check-in/out)    (ส่ง Early Checkout Req)   │
 │Caregiver │───►│  (Chat Real-time)  (ถอนเงิน)                  │
 └──────────┘    │  (เปิด Dispute)                               │
                 │                                                │
 ┌───────┐       │  (จัดการ Users)    (Approve KYC)              │
 │Admin  │───────►  (Settle Dispute)  (ดู Reports/Ledger)        │
 └───────┘       │  (Ban User)        (Manage Jobs)              │
                 └────────────────────────────────────────────────┘
```

### 3.5.2 Use Case Descriptions

#### UC-01: สมัครสมาชิก

| ส่วน               | รายละเอียด                                                                                        |
|-------------------|--------------------------------------------------------------------------------------------------|
| **Actor**         | Guest                                                                                             |
| **Preconditions** | ยังไม่มีบัญชีในระบบ                                                                               |
| **Main Flow**     | 1. เลือก Guest/Member/Google → 2. กรอกข้อมูล → 3. ระบบสร้าง user+profile+wallet → 4. รับ JWT → 5. เลือก role → 6. ยอมรับ policy → 7. เข้าหน้าหลัก |
| **Postconditions**| มีบัญชี, Trust Level = L0                                                                        |

#### UC-02: สร้างและเผยแพร่งาน

| ส่วน               | รายละเอียด                                                                                        |
|-------------------|--------------------------------------------------------------------------------------------------|
| **Actor**         | Hirer (Trust Level ≥ L1)                                                                         |
| **Preconditions** | Login แล้ว, มีผู้รับการดูแล, ยอดเงินเพียงพอ                                                     |
| **Main Flow**     | 1. กรอกข้อมูลงาน → 2. ระบบคำนวณ risk_level → 3. บันทึก draft → 4. กด Publish → 5. ตรวจ Trust+ยอดเงิน → 6. hold เงิน → 7. status=posted |
| **Postconditions**| งานปรากฎใน Job Feed                                                                              |
| **Alternative**   | Direct Assign → แจ้ง Caregiver โดยตรง                                                           |

#### UC-03: รับงานและทำงาน

| ส่วน               | รายละเอียด                                                                                        |
|-------------------|--------------------------------------------------------------------------------------------------|
| **Actor**         | Caregiver (Trust Level ≥ min_trust_level)                                                        |
| **Preconditions** | งาน status=posted, ไม่มีเวลาทับซ้อน                                                             |
| **Main Flow**     | 1. Accept → 2. สร้าง job+assignment+chat_thread+escrow → 3. Check-in (GPS) → 4. Check-out (GPS+evidence) → 5. Settlement |
| **Postconditions**| completed, Caregiver ได้รับเงิน, Trust Score อัพเดท                                            |

#### UC-04: เติมเงิน (Top-up)

| ส่วน               | รายละเอียด                                                                                        |
|-------------------|--------------------------------------------------------------------------------------------------|
| **Actor**         | Hirer                                                                                             |
| **Preconditions** | Login แล้ว                                                                                       |
| **Main Flow**     | 1. ระบุจำนวนเงิน → 2. ระบบสร้าง QR → 3. สแกน QR จ่ายเงิน → 4. Provider ส่ง webhook → 5. credit wallet |
| **Postconditions**| ยอดเงินเพิ่มขึ้น, มี ledger transaction [credit]                                                |

#### UC-05: เปิดและแก้ไข Dispute

| ส่วน               | รายละเอียด                                                                                        |
|-------------------|--------------------------------------------------------------------------------------------------|
| **Actor**         | Hirer/Caregiver + Admin                                                                          |
| **Preconditions** | มีงานที่ดำเนินการอยู่หรือเพิ่งเสร็จ                                                             |
| **Main Flow**     | 1. เปิด dispute → 2. ส่งหลักฐาน → 3. Admin รับมอบหมาย → 4. Admin Settle (refund/payout) → 5. notify ทั้ง 2 ฝ่าย |
| **Postconditions**| Dispute resolved, เงินจาก escrow แจกจ่ายแล้ว                                                   |

---

## 3.6 Sequence Diagram

### 3.6.1 Guest Registration

```
User         Frontend              Backend               DB
 │               │                     │                  │
 │─ กรอกข้อมูล─►│                     │                  │
 │               │─ POST /auth/register/guest ───────────►│
 │               │                     │─ INSERT users ──►│
 │               │                     │─ INSERT profile ►│
 │               │                     │─ INSERT wallet ─►│
 │               │◄── { token, refresh }─│                │
 │◄── redirect /select-role ───────────►│                │
 │─ POST /auth/policy/accept ──────────►│                │
 │◄── redirect /hirer/home ────────────►│                │
```

### 3.6.2 Job Creation & Publishing

```
Hirer        Frontend              Backend               DB
 │               │                     │                  │
 │─ กรอกข้อมูล─►│─ POST /api/jobs ───►│                  │
 │               │                     │─ compute risk   │
 │               │                     │─ INSERT job_posts►
 │               │◄── { job_post_id }──│                  │
 │─ Publish ────►│─ POST /jobs/:id/publish──────────────►│
 │               │                     │─ CHECK trust    │
 │               │                     │─ CHECK balance  │
 │               │                     │─ UPDATE held ──►│
 │               │                     │─ status=posted ►│
 │               │◄── 200 OK ──────────│                  │
```

### 3.6.3 Caregiver Accept & Check-in/out

```
Caregiver    Frontend              Backend               DB
 │               │                     │                  │
 │─ Accept ─────►│─ POST /jobs/:id/accept────────────────►│
 │               │                     │─ INSERT jobs ───►│
 │               │                     │─ INSERT assign ─►│
 │               │                     │─ CREATE escrow ─►│
 │               │                     │─ held→escrow ───►│
 │               │                     │─ CREATE thread ─►│
 │               │                     │─ notify hirer   │
 │               │◄── 200 OK ──────────│                  │
 │─ Check-in ───►│─ POST /checkin ─────►│─ INSERT gps ───►│
 │               │                     │─ status=in_prog►│
 │               │                     │─ notify hirer   │
 │─ Check-out ──►│─ POST /checkout ────►│─ INSERT gps ───►│
 │               │                     │─ status=complete►
 │               │                     │─ escrow→caregiver►
 │               │                     │─ escrow→platform►
 │               │                     │─ recalc trust   │
```

### 3.6.4 Top-up Flow

```
Hirer        Frontend              Backend          MockProvider
 │               │                     │                  │
 │─ จำนวนเงิน ──►│─ POST /wallet/topup►│─ POST /create-qr►│
 │               │                     │◄── qr_payload ──│
 │               │                     │─ INSERT intent ─►│
 │               │◄── { qr_payload } ──│                  │
 │─ สแกน QR ───────────────────────────────────── pay ──►│
 │               │                     │◄── POST /webhooks/payment
 │               │                     │─ CREDIT wallet ─►│
 │               │                     │─ INSERT ledger ─►│
```

### 3.6.5 Real-time Chat

```
Hirer (Client A)    Socket.IO Server    Caregiver (Client B)
      │                    │                    │
      ├── connect (JWT) ──►│◄── connect (JWT) ──┤
      ├── thread:join ─────►                    │
      │                    ├─── thread:join ────►
      ◄── thread:joined ───┤◄── thread:joined ──┤
      │                    │                    │
      ├── typing:start ────►                    │
      │                    ├── typing:started ──►
      ├── message:send ────►── INSERT DB        │
      ◄── message:new ─────┼── message:new ─────►
```

### 3.6.6 KYC Flow

```
User         Frontend              Backend               DB
 │               │                     │                  │
 │─ อัพโหลดเอกสาร►─ POST /kyc/submit ─►│─ INSERT kyc ───►│
 │               │◄── 200 OK ──────────│                  │
                                        │
Admin                                  │
 │─ ดู KYC list ─►─ GET /admin/users ─►│                  │
 │─ Approve ─────►─ POST /admin/users/:id/status──────────►
 │               │                     │─ UPDATE kyc ────►│
 │               │                     │─ trust_level=L2 ►│
 User ◄── notification (KYC approved) ─│                  │
```

---

## 3.7 UI Design

### 3.7.1 หน้าจอหลักของระบบ

**Public**:

| URL      | หน้าจอ      | คำอธิบาย                         |
|---------|------------|----------------------------------|
| `/`     | LandingPage | แนะนำระบบ, featured caregivers   |
| `/about`| AboutPage   | เกี่ยวกับแพลตฟอร์ม               |
| `/faq`  | FAQPage     | คำถามที่พบบ่อย                   |

**Authentication**:

| URL                   | หน้าจอ             | คำอธิบาย                    |
|----------------------|-------------------|----------------------------|
| `/login`             | LoginEntryPage     | เลือก email/phone/google   |
| `/register/guest`    | GuestRegisterPage  | สมัครด้วย email            |
| `/register/member`   | MemberRegisterPage | สมัครด้วยเบอร์โทร           |
| `/select-role`       | RoleSelectionPage  | เลือก Hirer/Caregiver      |
| `/register/consent`  | ConsentPage        | ยอมรับ policy              |
| `/forgot-password`   | ForgotPasswordPage | ขอลิงก์ reset password     |

**Hirer**:

| URL                         | หน้าจอ                   | คำอธิบาย                        |
|----------------------------|--------------------------|---------------------------------|
| `/hirer/home`              | HirerHomePage            | รายการงาน, ปฏิทิน, สถิติ        |
| `/hirer/create-job`        | CreateJobPage            | สร้างงานใหม่ (wizard form)      |
| `/hirer/search-caregivers` | SearchCaregiversPage     | ค้นหา + Direct Assign           |
| `/hirer/care-recipients`   | CareRecipientsPage       | จัดการผู้รับการดูแล             |
| `/hirer/wallet`            | HirerWalletPage          | กระเป๋าเงิน, เติม/ถอน          |
| `/hirer/favorites`         | FavoritesPage            | caregiver ที่บันทึกไว้          |

**Caregiver**:

| URL                         | หน้าจอ                   | คำอธิบาย                        |
|----------------------------|--------------------------|---------------------------------|
| `/caregiver/jobs/feed`     | CaregiverJobFeedPage     | ดูประกาศงานที่เหมาะสม           |
| `/caregiver/jobs/my-jobs`  | CaregiverMyJobsPage      | งานที่รับ, check-in/out         |
| `/caregiver/wallet`        | CaregiverWalletPage      | กระเป๋าเงิน, ประวัติรายได้      |

**Shared**:

| URL                    | หน้าจอ             | คำอธิบาย                        |
|-----------------------|-------------------|---------------------------------|
| `/jobs/:id`           | JobDetailPage      | รายละเอียดงาน, early checkout   |
| `/chat/:jobId`        | ChatRoomPage       | ห้องแชท hirer/caregiver         |
| `/dispute/:disputeId` | DisputeChatPage    | ห้องแชทข้อพิพาท (admin เข้าได้) |
| `/notifications`      | NotificationsPage  | ประวัติการแจ้งเตือน             |
| `/kyc`                | KycPage            | KYC verification (3 ขั้นตอน)   |

**Admin**:

| URL                  | หน้าจอ               | คำอธิบาย                      |
|---------------------|---------------------|-------------------------------|
| `/admin/dashboard`  | AdminDashboardPage   | ภาพรวมระบบ, สถิติ             |
| `/admin/users`      | AdminUsersPage       | จัดการ user, KYC, ban         |
| `/admin/jobs`       | AdminJobsPage        | ดูและยกเลิกงาน               |
| `/admin/financial`  | AdminFinancialPage   | ดู ledger transactions        |
| `/admin/disputes`   | AdminDisputesPage    | จัดการและ settle disputes     |

### 3.7.2 User Flow การใช้งาน

**Hirer Flow**:
```
Register/Login → เลือก Role → ยอมรับ Policy → HirerHomePage
  ├── สร้างงาน → Draft → Publish (hold เงิน) → posted
  ├── ค้นหา Caregiver → Direct Assign → notify caregiver
  ├── งาน in_progress → อนุมัติ/ปฏิเสธ Early Checkout
  ├── Top-up Wallet → QR → จ่ายเงิน
  └── Dispute → ส่งหลักฐาน → รอ Admin settle
```

**Caregiver Flow**:
```
Register/Login → ยืนยัน Phone OTP (L1) → เลือก Role → ยอมรับ Policy
  ├── Job Feed → Accept → Chat กับ Hirer
  ├── Check-in (GPS) → in_progress → Check-out (evidence)
  ├── รับเงิน (Settlement) → Trust Score อัพเดท
  ├── KYC (L2) → ถอนเงิน
  └── Dispute → ส่งหลักฐาน
```

---

## 3.8 Database Design

### 3.8.1 ER Diagram (ความสัมพันธ์หลัก)

```
users (1)─(1) hirer_profiles
users (1)─(1) caregiver_profiles
users (1)─(1) user_kyc_info
users (1)─(N) user_policy_acceptances
users (1)─(N) auth_sessions
users (1)─(1) wallets [hirer/caregiver]
users (1)─(N) patient_profiles        [hirer]
users (1)─(N) caregiver_documents     [caregiver]
users (1)─(N) trust_score_history

patient_profiles (1)─(N) job_posts

job_posts (N)─(1) users [hirer_id]
job_posts (N)─(1) users [preferred_caregiver_id, nullable]
job_posts (1)─(N) jobs

jobs (1)─(N) job_assignments
jobs (1)─(1) wallets [escrow]
jobs (1)─(1) chat_threads
jobs (1)─(N) job_gps_events
jobs (1)─(N) job_photo_evidence
jobs (1)─(N) disputes
jobs (1)─(N) caregiver_reviews
jobs (1)─(N) early_checkout_requests

job_assignments (N)─(1) users [caregiver_id]
  UNIQUE constraint: one active assignment per job

wallets (1)─(N) ledger_transactions [from_wallet_id]
wallets (1)─(N) ledger_transactions [to_wallet_id]

disputes (1)─(N) dispute_messages
disputes (1)─(N) dispute_events
chat_threads (1)─(N) chat_messages
users (1)─(N) notifications
users (N)─(N) caregiver_favorites
```

### 3.8.2 รายละเอียดตารางหลัก

#### `users` — ตารางผู้ใช้หลัก

| Column                  | Type         | Constraint           | คำอธิบาย                 |
|------------------------|--------------|----------------------|--------------------------|
| `id`                   | UUID         | PK                   | รหัสผู้ใช้               |
| `email`                | VARCHAR(255) | UNIQUE, nullable     | อีเมล                    |
| `phone_number`         | VARCHAR(20)  | UNIQUE, nullable     | เบอร์โทร                 |
| `password_hash`        | VARCHAR(255) | NOT NULL             | รหัสผ่าน (bcrypt)         |
| `account_type`         | VARCHAR(10)  | CHECK guest/member   | ประเภทบัญชี              |
| `role`                 | ENUM         | NOT NULL             | hirer/caregiver/admin    |
| `status`               | ENUM         | DEFAULT active       | active/suspended/deleted |
| `is_phone_verified`    | BOOLEAN      | DEFAULT false        | ยืนยันเบอร์แล้ว          |
| `trust_level`          | ENUM         | DEFAULT L0           | L0/L1/L2/L3 (derived)    |
| `trust_score`          | INT          | 0-100                | คะแนนความน่าเชื่อถือ     |
| `ban_login/create/accept/withdraw` | BOOLEAN | DEFAULT false | flags การแบน        |

#### `hirer_profiles` — โปรไฟล์ผู้ว่าจ้าง

| Column              | Type         | คำอธิบาย               |
|--------------------|--------------|------------------------|
| `user_id`          | UUID FK      | → users.id (UNIQUE)    |
| `display_name`     | VARCHAR(255) | ชื่อแสดงผล (สาธารณะ)   |
| `full_name`        | VARCHAR(255) | ชื่อ-นามสกุลจริง       |
| `address_line1`    | VARCHAR(255) | ที่อยู่                |
| `district/province`| VARCHAR      | เขต/จังหวัด            |
| `total_jobs_posted`| INT          | จำนวนงานที่ประกาศ      |

#### `caregiver_profiles` — โปรไฟล์ผู้ดูแล

| Column                | Type         | คำอธิบาย                     |
|----------------------|--------------|------------------------------|
| `user_id`            | UUID FK      | → users.id (UNIQUE)          |
| `display_name`       | VARCHAR(255) | ชื่อแสดงผล                   |
| `bio`                | TEXT         | ประวัติส่วนตัว               |
| `experience_years`   | INT          | ประสบการณ์ (ปี)              |
| `certifications`     | TEXT[]       | ใบรับรอง                     |
| `specializations`    | TEXT[]       | ความเชี่ยวชาญ                |
| `available_days`     | INT[]        | วันที่ว่าง (0=อาทิตย์)       |
| `average_rating`     | NUMERIC(3,2) | คะแนนรีวิวเฉลี่ย             |

#### `patient_profiles` — ผู้รับการดูแล

| Column                     | Type    | คำอธิบาย                     |
|---------------------------|---------|------------------------------|
| `hirer_id`                | UUID FK | → users.id                   |
| `patient_display_name`    | VARCHAR | ชื่อผู้รับการดูแล            |
| `age_band`                | VARCHAR | ช่วงอายุ เช่น "70-80"        |
| `mobility_level`          | VARCHAR | การเคลื่อนไหว                |
| `chronic_conditions_flags`| TEXT[]  | โรคประจำตัว                  |
| `medical_devices_flags`   | TEXT[]  | อุปกรณ์การแพทย์              |

#### `job_posts` — ประกาศงาน

| Column                   | Type         | คำอธิบาย                        |
|-------------------------|--------------|----------------------------------|
| `hirer_id`              | UUID FK      | → users.id                       |
| `job_type`              | ENUM         | 6 ประเภท                         |
| `risk_level`            | ENUM         | low_risk / high_risk             |
| `scheduled_start_at`    | TIMESTAMPTZ  | วันเวลาเริ่ม                     |
| `scheduled_end_at`      | TIMESTAMPTZ  | วันเวลาสิ้นสุด                   |
| `lat`, `lng`            | NUMERIC(10,7)| พิกัด GPS                        |
| `geofence_radius_m`     | INT          | รัศมี geofence (DEFAULT 100 ม.)  |
| `hourly_rate`           | INT          | ค่าจ้างต่อชั่วโมง               |
| `total_hours`           | NUMERIC(5,2) | ชั่วโมงรวม (คำนวณอัตโนมัติ)    |
| `total_amount`          | INT          | ค่าจ้างรวม                      |
| `platform_fee_amount`   | INT          | ค่าธรรมเนียม (DEFAULT 10%)       |
| `min_trust_level`       | ENUM         | Trust Level ขั้นต่ำ              |
| `job_tasks_flags`       | TEXT[]       | งานที่ต้องทำ                    |
| `required_skills_flags` | TEXT[]       | ทักษะที่ต้องการ                  |
| `status`                | ENUM         | draft/posted/assigned/...        |
| `preferred_caregiver_id`| UUID FK      | → users.id (nullable)            |
| `replacement_chain_count`| INT         | จำนวนครั้งที่ re-post (max 3)    |

#### `jobs` — instance งานจริง

| Column           | Type        | คำอธิบาย                            |
|-----------------|-------------|-------------------------------------|
| `job_post_id`   | UUID FK     | → job_posts.id                       |
| `hirer_id`      | UUID FK     | → users.id                           |
| `status`        | ENUM        | assigned/in_progress/completed/...   |
| `assigned_at`   | TIMESTAMPTZ | เวลามอบหมาย                          |
| `started_at`    | TIMESTAMPTZ | เวลา check-in                        |
| `completed_at`  | TIMESTAMPTZ | เวลา check-out                       |

#### `job_assignments` — ประวัติการมอบหมาย

| Column         | Type    | คำอธิบาย                               |
|---------------|---------|----------------------------------------|
| `job_id`      | UUID FK | → jobs.id                              |
| `job_post_id` | UUID FK | → job_posts.id                         |
| `caregiver_id`| UUID FK | → users.id                             |
| `status`      | ENUM    | active/replaced/completed/cancelled    |
| UNIQUE        | INDEX   | (job_id) WHERE status='active' — 1 per job |

#### `wallets` — กระเป๋าเงิน

| Column              | Type    | คำอธิบาย                              |
|--------------------|---------|---------------------------------------|
| `user_id`          | UUID FK | → users.id (nullable, ไม่มีใน escrow) |
| `job_id`           | UUID FK | → jobs.id (nullable, เฉพาะ escrow)   |
| `wallet_type`      | VARCHAR | hirer/caregiver/escrow/platform/...   |
| `available_balance`| BIGINT  | CHECK ≥ 0                             |
| `held_balance`     | BIGINT  | CHECK ≥ 0                             |
| `currency`         | VARCHAR | DEFAULT 'THB'                         |

#### `ledger_transactions` — บันทึกการเงิน (Immutable)

| Column              | Type    | คำอธิบาย                            |
|--------------------|---------|-------------------------------------|
| `amount`           | BIGINT  | จำนวนเงิน (> 0)                     |
| `from_wallet_id`   | UUID FK | → wallets.id                        |
| `to_wallet_id`     | UUID FK | → wallets.id                        |
| `type`             | ENUM    | credit/debit/hold/release/reversal  |
| `reference_type`   | ENUM    | topup/job/dispute/withdrawal/...    |
| `idempotency_key`  | VARCHAR | UNIQUE — ป้องกัน duplicate charge   |
| `created_at`       | TIMESTAMPTZ | **ไม่มี updated_at** (immutable)|

#### `chat_threads` และ `chat_messages`

| Table           | Column Key    | คำอธิบาย                          |
|----------------|---------------|-----------------------------------|
| chat_threads   | `job_id`      | FK → jobs.id (UNIQUE — 1 per job) |
|                | `status`      | open / closed                     |
| chat_messages  | `thread_id`   | FK → chat_threads.id              |
|                | `sender_id`   | FK → users.id                     |
|                | `type`        | text/image/file/system            |
|                | `is_system_message` | BOOLEAN                   |

#### `disputes`, `dispute_messages`, `dispute_events`

| Table            | Column Key          | คำอธิบาย                          |
|-----------------|---------------------|-----------------------------------|
| disputes         | `job_post_id`       | FK → job_posts.id                 |
|                  | `opened_by_user_id` | FK → users.id                     |
|                  | `assigned_admin_id` | FK → users.id (nullable)          |
|                  | `status`            | open/in_review/resolved/rejected  |
|                  | `settlement_refund_amount` | จำนวนเงินคืน             |
|                  | `settlement_payout_amount` | จำนวนเงินจ่าย             |
| dispute_messages | `dispute_id`        | FK → disputes.id                  |
|                  | `sender_id`         | FK → users.id                     |
| dispute_events   | `dispute_id`        | FK → disputes.id                  |
|                  | `event_type`        | note / status_change              |

#### `notifications`

| Column          | Type    | คำอธิบาย                              |
|----------------|---------|---------------------------------------|
| `user_id`      | UUID FK | → users.id                            |
| `channel`      | ENUM    | email/sms/push/in_app                 |
| `template_key` | VARCHAR | รหัส template การแจ้งเตือน            |
| `title`, `body`| TEXT    | หัวข้อและเนื้อหา                      |
| `status`       | ENUM    | queued→sent→delivered→read→failed     |
| `reference_type/id` | —  | อ้างอิงไปยัง entity ที่เกี่ยวข้อง    |

#### `caregiver_reviews`

| Column         | Type    | คำอธิบาย                              |
|---------------|---------|---------------------------------------|
| `job_id`      | UUID FK | → jobs.id                             |
| `reviewer_id` | UUID FK | → users.id (hirer)                    |
| `caregiver_id`| UUID FK | → users.id                            |
| `rating`      | INT     | 1-5 ดาว                               |
| `comment`     | TEXT    | ความคิดเห็น                           |
| UNIQUE        | —       | (job_id, reviewer_id) — รีวิวได้ 1 ครั้ง|

#### `early_checkout_requests`

| Column          | Type        | คำอธิบาย                              |
|----------------|-------------|---------------------------------------|
| `job_id`       | UUID FK     | → jobs.id                             |
| `caregiver_id` | UUID FK     | → users.id                            |
| `hirer_id`     | UUID FK     | → users.id                            |
| `evidence_note`| TEXT        | เหตุผลและบันทึกงาน                   |
| `status`       | ENUM        | pending/approved/rejected             |

### 3.8.3 Primary Key / Foreign Key สรุป

| ตาราง                  | Primary Key | Foreign Keys หลัก                                    |
|-----------------------|-------------|------------------------------------------------------|
| users                 | id          | —                                                    |
| hirer_profiles        | id          | user_id → users.id                                   |
| caregiver_profiles    | id          | user_id → users.id                                   |
| patient_profiles      | id          | hirer_id → users.id                                  |
| job_posts             | id          | hirer_id, preferred_caregiver_id, patient_profile_id |
| jobs                  | id          | job_post_id → job_posts.id, hirer_id → users.id      |
| job_assignments       | id          | job_id → jobs.id, caregiver_id → users.id            |
| wallets               | id          | user_id → users.id, job_id → jobs.id                 |
| ledger_transactions   | id          | from_wallet_id, to_wallet_id → wallets.id            |
| chat_threads          | id          | job_id → jobs.id (UNIQUE)                            |
| chat_messages         | id          | thread_id → chat_threads.id, sender_id → users.id    |
| disputes              | id          | job_post_id, job_id, opened_by_user_id, assigned_admin_id |
| notifications         | id          | user_id → users.id                                   |
| caregiver_reviews     | id          | job_id → jobs.id, reviewer_id, caregiver_id → users.id |
| caregiver_favorites   | id          | hirer_id, caregiver_id → users.id (UNIQUE pair)      |

### 3.8.4 Database Enums

| ENUM Type          | Values                                                   |
|-------------------|----------------------------------------------------------|
| `user_role`        | hirer, caregiver, admin                                 |
| `user_status`      | active, suspended, deleted                              |
| `trust_level`      | L0, L1, L2, L3                                         |
| `job_status`       | draft, posted, assigned, in_progress, completed, cancelled, expired |
| `job_type`         | companionship, personal_care, medical_monitoring, dementia_care, post_surgery, emergency |
| `risk_level`       | low_risk, high_risk                                     |
| `assignment_status`| active, replaced, completed, cancelled                  |
| `transaction_type` | credit, debit, hold, release, reversal                  |
| `kyc_status`       | pending, approved, rejected, expired                    |
| `dispute_status`   | open, in_review, resolved, rejected                     |
| `notification_status` | queued, sent, delivered, read, failed               |
| `chat_message_type`| text, image, file, system                               |
| `gps_event_type`   | check_in, check_out, ping                               |
