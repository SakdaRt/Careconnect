# CareConnect — System Documentation
> เอกสารนี้อธิบายระบบทั้งหมด: workflow, database schema, UML diagrams
> อัพเดทล่าสุด: 2026-02-22

---

## 1. ภาพรวมระบบ (System Overview)

CareConnect เป็น **Two-sided Marketplace** สำหรับบริการดูแลผู้สูงอายุในประเทศไทย

```
┌─────────────────────────────────────────────────────────┐
│                     CareConnect                         │
│                                                         │
│   ผู้ว่าจ้าง (Hirer)    ←→    ผู้ดูแล (Caregiver)      │
│        │                              │                 │
│        └──────── Platform ────────────┘                 │
│                     │                                   │
│              Admin (ดูแลระบบ)                           │
└─────────────────────────────────────────────────────────┘
```

### Roles
| Role | สิทธิ์ | Trust Level ที่ต้องการ |
|------|--------|----------------------|
| **Hirer** | สร้างงาน, ว่าจ้าง, จ่ายเงิน | L1+ (โพสต์งาน low_risk) |
| **Caregiver** | รับงาน, check-in/out | L1+ (รับงาน low_risk) |
| **Admin** | จัดการ user, approve KYC, resolve dispute | - |

---

## 2. Trust Level System

```
L0 (Unverified)
    │  สมัครสมาชิก
    ▼
L1 (Basic) ─── ยืนยันเบอร์โทรศัพท์ (Phone OTP)
    │
    ▼
L2 (Verified) ─── ยืนยัน KYC (บัตรประชาชน + selfie → Admin approve)
    │
    ▼
L3 (Trusted) ─── ยืนยันบัญชีธนาคาร + Trust Score ≥ 80
```

### สิทธิ์ตาม Trust Level
| Action | L0 | L1 | L2 | L3 |
|--------|----|----|----|----|
| สมัครสมาชิก | ✓ | ✓ | ✓ | ✓ |
| สร้าง job draft | ✓ | ✓ | ✓ | ✓ |
| โพสต์งาน low_risk | ✗ | ✓ | ✓ | ✓ |
| โพสต์งาน high_risk | ✗ | ✗ | ✓ | ✓ |
| รับงาน low_risk | ✗ | ✓ | ✓ | ✓ |
| รับงาน high_risk | ✗ | ✗ | ✓ | ✓ |
| Top up wallet | ✓ | ✓ | ✓ | ✓ |
| ดู/เพิ่มบัญชีธนาคาร | ✗ | ✓ | ✓ | ✓ |
| ถอนเงิน | ✗ | ✗ | ✓ | ✓ |

---

## 3. Job Lifecycle (State Machine)

```
                    ┌─────────┐
                    │  draft  │ ← สร้างโดย hirer
                    └────┬────┘
                         │ publish (L1+ required)
                    ┌────▼────┐
                    │ posted  │ ← caregiver เห็นใน feed
                    └────┬────┘
                         │ assign caregiver
                    ┌────▼────┐
                    │assigned │ ← caregiver ได้รับมอบหมาย
                    └────┬────┘
                         │ check-in (GPS + photo)
                  ┌──────▼──────┐
                  │ in_progress │ ← งานกำลังดำเนินการ
                  └──────┬──────┘
                         │ check-out (GPS + photo)
                  ┌──────▼──────┐
                  │  completed  │ ← งานเสร็จสิ้น → hirer review
                  └─────────────┘

  ทุก state → cancelled (ยกเลิกได้ตลอด)
  posted → expired (หมดอายุอัตโนมัติ)
```

---

## 4. Payment Flow

```
Hirer                    Platform                  Caregiver
  │                          │                         │
  │── Top up ──────────────► │                         │
  │                    wallet.balance++                │
  │                          │                         │
  │── Assign job ──────────► │                         │
  │                    hold(amount)                    │
  │                    wallet.held_balance++            │
  │                    wallet.available_balance--       │
  │                          │                         │
  │── Check-out ───────────► │                         │
  │                    release hold                    │
  │                    transfer to caregiver ──────────►│
  │                          │                wallet.balance++
  │                          │                         │
  │                    (Dispute → Admin resolves)       │
```

### Ledger System (Immutable)
- ทุก transaction บันทึกใน `ledger_transactions` แบบ **append-only**
- ห้าม UPDATE/DELETE ใน ledger
- `balance_after` บันทึกยอดคงเหลือหลังทุก transaction
- ยอดเงินติดลบไม่ได้ (constraint ระดับ DB)

---

## 5. Database Schema (ERD)

### Core Tables

```
┌──────────────────────────────────────────────────────────────────┐
│ users                                                            │
├──────────────────────────────────────────────────────────────────┤
│ id UUID PK                                                       │
│ email VARCHAR(255) UNIQUE                                        │
│ phone_number VARCHAR(20) UNIQUE                                  │
│ password_hash VARCHAR(255)                                       │
│ google_id VARCHAR(255) UNIQUE (nullable)                         │
│ role ENUM(hirer, caregiver, admin)                               │
│ status ENUM(active, suspended, deleted)                          │
│ trust_level ENUM(L0, L1, L2, L3)                                │
│ trust_score INTEGER                                              │
│ email_verified BOOLEAN                                           │
│ phone_verified BOOLEAN                                           │
│ ban_login BOOLEAN                                                │
│ ban_job_create BOOLEAN                                           │
│ ban_job_accept BOOLEAN                                           │
│ ban_withdraw BOOLEAN                                             │
│ ban_reason TEXT                                                  │
│ created_at, updated_at TIMESTAMPTZ                               │
└──────────────────────────────────────────────────────────────────┘
        │ 1                    │ 1                    │ 1
        │                      │                      │
        ▼ N                    ▼ 1                    ▼ 1
┌───────────────┐   ┌──────────────────┐   ┌──────────────────────┐
│    wallets    │   │ hirer_profiles   │   │ caregiver_profiles   │
├───────────────┤   ├──────────────────┤   ├──────────────────────┤
│ id UUID PK    │   │ id UUID PK       │   │ id UUID PK           │
│ user_id FK    │   │ user_id FK UNIQ  │   │ user_id FK UNIQ      │
│ balance       │   │ display_name     │   │ display_name         │
│ available_bal │   │ address          │   │ bio                  │
│ held_balance  │   │ lat, lng         │   │ experience_years     │
└───────────────┘   │ avatar           │   │ hourly_rate          │
        │           └──────────────────┘   │ profile_photo_url    │
        │ 1                                │ specializations[]    │
        ▼ N                                │ certifications[]     │
┌──────────────────────┐                  └──────────────────────┘
│  ledger_transactions │
├──────────────────────┤
│ id UUID PK           │
│ wallet_id FK         │
│ transaction_type     │  ENUM: credit, debit, hold, release, reversal
│ amount NUMERIC       │
│ reference_type       │  ENUM: topup, job, dispute, withdrawal, fee, refund, penalty
│ reference_id UUID    │
│ description TEXT     │
│ balance_after        │
│ created_at           │  ← NO updated_at (immutable)
└──────────────────────┘
```

### Job Tables

```
┌──────────────────────────────────────────────────────────────────┐
│ jobs                                                             │
├──────────────────────────────────────────────────────────────────┤
│ id UUID PK                                                       │
│ hirer_id FK → users.id                                          │
│ patient_id FK → patient_profiles.id                             │
│ title, description TEXT                                          │
│ job_type ENUM(companionship, personal_care, medical_monitoring,  │
│               dementia_care, post_surgery, emergency)            │
│ risk_level ENUM(low_risk, high_risk)                             │
│ status ENUM(draft, posted, assigned, in_progress,                │
│             completed, cancelled, expired)                       │
│ hourly_rate NUMERIC                                              │
│ estimated_duration_hours INTEGER                                 │
│ scheduled_start_time, scheduled_end_time TIMESTAMPTZ            │
│ actual_start_time, actual_end_time TIMESTAMPTZ                   │
│ location_address, location_lat, location_lng                     │
│ min_trust_level ENUM(L0,L1,L2,L3)  ← auto-set จาก risk_level   │
│ preferred_caregiver_id FK → users.id (nullable)                 │
│ created_at, updated_at TIMESTAMPTZ                               │
└──────────────────────────────────────────────────────────────────┘
        │ 1
        ▼ N
┌──────────────────────────────────────────────────────────────────┐
│ job_assignments                                                  │
├──────────────────────────────────────────────────────────────────┤
│ id UUID PK                                                       │
│ job_id FK → jobs.id                                             │
│ caregiver_id FK → users.id                                      │
│ status ENUM(active, replaced, completed, cancelled)              │
│ assigned_at TIMESTAMPTZ                                          │
│ replaced_at TIMESTAMPTZ                                          │
│ UNIQUE(job_id) WHERE status='active'  ← 1 active per job        │
└──────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ patient_profiles                                                 │
├──────────────────────────────────────────────────────────────────┤
│ id UUID PK                                                       │
│ hirer_id FK → users.id                                          │
│ first_name, last_name VARCHAR                                    │
│ date_of_birth DATE, birth_year INTEGER                           │
│ gender VARCHAR                                                   │
│ medical_conditions, special_needs TEXT                           │
│ emergency_contact_name, emergency_contact_phone                  │
│ address TEXT, address_line2 TEXT                                 │
└──────────────────────────────────────────────────────────────────┘
```

### Feature Tables

```
┌─────────────────────────┐   ┌──────────────────────────────────┐
│   kyc_submissions       │   │   caregiver_documents            │
├─────────────────────────┤   ├──────────────────────────────────┤
│ id UUID PK              │   │ id UUID PK                       │
│ user_id FK              │   │ user_id FK → users.id            │
│ status ENUM(pending,    │   │ document_type VARCHAR             │
│   approved, rejected,   │   │ title, description TEXT          │
│   expired)              │   │ issuer VARCHAR                   │
│ verification_data JSONB │   │ issued_date, expiry_date DATE    │
│ submitted_at            │   │ file_path, file_name VARCHAR     │
│ verified_at             │   │ file_size INT, mime_type VARCHAR │
└─────────────────────────┘   └──────────────────────────────────┘

┌─────────────────────────┐   ┌──────────────────────────────────┐
│   caregiver_reviews     │   │   caregiver_favorites            │
├─────────────────────────┤   ├──────────────────────────────────┤
│ id UUID PK              │   │ id UUID PK                       │
│ job_id FK               │   │ hirer_id FK → users.id           │
│ job_post_id FK          │   │ caregiver_id FK → users.id       │
│ reviewer_id FK          │   │ UNIQUE(hirer_id, caregiver_id)   │
│ caregiver_id FK         │   └──────────────────────────────────┘
│ rating INT (1-5)        │
│ comment TEXT            │   ┌──────────────────────────────────┐
│ UNIQUE(job_id,          │   │   notifications                  │
│   reviewer_id)          │   ├──────────────────────────────────┤
└─────────────────────────┘   │ id UUID PK                       │
                              │ user_id FK → users.id            │
┌─────────────────────────┐   │ channel VARCHAR (in_app)         │
│  user_policy_acceptances│   │ template_key VARCHAR             │
├─────────────────────────┤   │ title, body TEXT                 │
│ user_id FK (PK)         │   │ data JSONB                       │
│ role VARCHAR (PK)       │   │ reference_type, reference_id     │
│ policy_accepted_at      │   │ status VARCHAR (sent/read)       │
│ version_policy_accepted │   └──────────────────────────────────┘
└─────────────────────────┘

┌──────────────────────────────────────────────────────────────────┐
│ payments                                                         │
├──────────────────────────────────────────────────────────────────┤
│ id UUID PK                                                       │
│ payer_user_id FK → users.id                                     │
│ payee_user_id FK → users.id                                     │
│ job_id FK → jobs.id (nullable)                                  │
│ amount BIGINT (THB)                                              │
│ fee_amount BIGINT                                                │
│ status ENUM(pending, processing, completed, failed, refunded)    │
│ payment_method VARCHAR                                           │
│ metadata JSONB                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Sequence Diagrams

### 6.1 Registration Flow (Member / Caregiver)

```
User          Frontend         Backend           DB
 │                │                │              │
 │─ กรอกเบอร์ ──►│                │              │
 │                │─ POST /auth/member/send-otp ─►│
 │                │                │─ INSERT OTP ─►│
 │                │◄── 200 OK ─────│              │
 │◄── OTP SMS ────│                │              │
 │─ กรอก OTP ───►│                │              │
 │                │─ POST /auth/member/verify-otp►│
 │                │                │─ verify OTP ─►│
 │                │─ POST /auth/member/register ──►│
 │                │                │─ INSERT user ─►│
 │                │                │─ INSERT profile►│
 │                │                │─ INSERT wallet►│
 │                │◄── JWT + Refresh Token ────────│
 │◄── redirect /home ─────────────│              │
```

### 6.2 Job Posting Flow

```
Hirer         Frontend         Backend           DB
 │                │                │              │
 │─ สร้างงาน ───►│                │              │
 │                │─ POST /jobs ──►│              │
 │                │                │─ INSERT job (draft)►│
 │                │◄── job_id ─────│              │
 │─ กรอกรายละเอียด►│              │              │
 │                │─ PUT /jobs/:id►│              │
 │─ โพสต์งาน ───►│                │              │
 │                │─ POST /jobs/:id/publish ──────►│
 │                │                │─ check trust_level L1+│
 │                │                │─ UPDATE status=posted►│
 │                │◄── 200 OK ─────│              │
```

### 6.3 Job Assignment & Work Flow

```
Caregiver     Frontend         Backend        Hirer
 │                │                │              │
 │─ ดู job feed ─►│               │              │
 │                │─ GET /jobs/feed►│             │
 │─ กด Accept ───►│               │              │
 │                │─ POST /jobs/:id/accept ───────►│
 │                │                │─ INSERT job_assignment│
 │                │                │─ UPDATE job status=assigned│
 │                │                │─ notify hirer ──────►│
 │                │◄── 200 OK ─────│              │
 │                │                │              │
 │─ Check-in ────►│               │              │
 │  (GPS+photo)   │─ POST /jobs/:id/check-in ─────►│
 │                │                │─ UPDATE status=in_progress│
 │                │                │─ hold payment ────────│
 │                │◄── 200 OK ─────│              │
 │                │                │              │
 │─ Check-out ───►│               │              │
 │  (GPS+photo)   │─ POST /jobs/:id/check-out ────►│
 │                │                │─ UPDATE status=completed│
 │                │                │─ release + transfer payment│
 │                │◄── 200 OK ─────│              │
```

### 6.4 KYC Flow

```
User          Frontend         Backend           Admin
 │                │                │              │
 │─ อัพโหลดเอกสาร►│              │              │
 │  (บัตร+selfie) │─ POST /kyc/submit ───────────►│
 │                │                │─ INSERT kyc_submissions│
 │                │◄── 200 OK ─────│              │
 │                │                │              │
 │                │                │◄── GET /admin/kyc ──│
 │                │                │─── kyc list ───────►│
 │                │                │◄── PATCH /admin/kyc/:id/approve│
 │                │                │─ UPDATE kyc status=approved│
 │                │                │─ UPDATE users.trust_level=L2│
 │◄── notification ───────────────│              │
```

### 6.5 Google OAuth Flow

```
User          Frontend         Backend        Google
 │                │                │              │
 │─ กด Sign in ──►│               │              │
 │                │─ GET /auth/google ───────────►│
 │                │◄── redirect to Google ─────────│
 │◄── Google login page ──────────────────────────│
 │─ login ───────────────────────────────────────►│
 │◄── redirect /auth/callback?code=xxx ───────────│
 │                │─ GET /auth/google/callback ───►│
 │                │                │─ exchange code►│
 │                │                │◄── id_token ───│
 │                │                │─ verify token  │
 │                │                │─ find-or-create user│
 │                │◄── JWT + Refresh Token ─────────│
 │◄── redirect /home ─────────────│              │
```

---

## 7. API Routes Overview

### Auth
```
POST /api/auth/guest/register          สมัคร Guest (email)
POST /api/auth/member/send-otp         ส่ง OTP ไปเบอร์โทร
POST /api/auth/member/verify-otp       ยืนยัน OTP
POST /api/auth/member/register         สมัคร Member (phone)
POST /api/auth/login/email             Login ด้วย email
POST /api/auth/login/phone             Login ด้วย phone
POST /api/auth/refresh                 Refresh JWT token
POST /api/auth/logout                  Logout
GET  /api/auth/me                      ดึงข้อมูล user ปัจจุบัน
GET  /api/auth/google                  เริ่ม Google OAuth
GET  /api/auth/google/callback         Google OAuth callback
```

### Jobs
```
GET    /api/jobs                       ดึง job list (hirer)
POST   /api/jobs                       สร้าง job
GET    /api/jobs/:id                   ดึง job detail
PUT    /api/jobs/:id                   แก้ไข job
POST   /api/jobs/:id/publish           โพสต์งาน
POST   /api/jobs/:id/accept            รับงาน (caregiver)
POST   /api/jobs/:id/check-in          Check-in
POST   /api/jobs/:id/check-out         Check-out
POST   /api/jobs/:id/cancel            ยกเลิกงาน
GET    /api/jobs/feed                  Job feed (caregiver)
```

### Users & Profiles
```
GET    /api/users/me                   ดึงโปรไฟล์ตัวเอง
PUT    /api/users/me                   แก้ไขโปรไฟล์
POST   /api/users/me/avatar            อัพโหลด avatar
GET    /api/caregivers/:id             ดูโปรไฟล์ caregiver (public)
GET    /api/caregivers/search          ค้นหา caregiver
```

### KYC
```
POST   /api/kyc/submit                 ส่ง KYC
GET    /api/kyc/status                 ดูสถานะ KYC
GET    /api/admin/kyc                  Admin: ดู KYC list
PATCH  /api/admin/kyc/:id/approve      Admin: approve
PATCH  /api/admin/kyc/:id/reject       Admin: reject
```

### Wallet & Payment
```
GET    /api/wallet                     ดูยอดเงิน
POST   /api/wallet/topup               เติมเงิน
POST   /api/wallet/withdraw            ถอนเงิน
GET    /api/wallet/transactions        ประวัติ transaction
GET    /api/bank-accounts              ดูบัญชีธนาคาร
POST   /api/bank-accounts             เพิ่มบัญชีธนาคาร
```

### Notifications
```
GET    /api/notifications              ดู notifications
GET    /api/notifications/unread-count นับ unread
PATCH  /api/notifications/:id/read    mark as read
PATCH  /api/notifications/read-all    mark all as read
```

### Chat & Disputes
```
GET    /api/chat/:jobId/messages       ดูข้อความ
POST   /api/chat/:jobId/messages       ส่งข้อความ
POST   /api/disputes                   เปิดข้อพิพาท
GET    /api/disputes/:id               ดูข้อพิพาท
GET    /api/disputes/:id/messages      ดูข้อความ dispute
POST   /api/disputes/:id/messages      ส่งข้อความ dispute
```

---

## 8. Frontend Page Map

```
/                          LandingPage (public)
/about                     AboutPage (public)
/login                     LoginPage
/register/guest            GuestRegisterPage
/register/member           MemberRegisterPage
/auth/callback             Google OAuth callback handler

/hirer/home                HirerHomePage ← RequireAuth + RequireRole(hirer)
/hirer/create-job          CreateJobPage
/hirer/jobs/:id            JobDetailPage
/hirer/search-caregivers   SearchCaregiversPage
/hirer/caregiver/:id       CaregiverPublicProfilePage
/hirer/favorites           FavoritesPage
/hirer/care-recipients     CareRecipientsPage
/hirer/wallet              HirerWalletPage

/caregiver/home            CaregiverJobFeedPage ← RequireAuth + RequireRole(caregiver)
/caregiver/my-jobs         CaregiverMyJobsPage
/caregiver/wallet          CaregiverWalletPage

/chat/:jobId               ChatRoomPage (shared)
/kyc                       KycPage (shared)
/profile                   ProfilePage (shared)
/notifications             NotificationsPage (shared)
/settings                  SettingsPage (shared)
/disputes/:id              DisputeChatPage (shared)

/admin                     AdminDashboard ← RequireRole(admin)
/admin/users               AdminUsersPage
/admin/kyc                 AdminKycPage
/admin/disputes            AdminDisputesPage
```

---

## 9. Environment Variables

### Backend (.env)
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://careconnect:password@localhost:5432/careconnect
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)
```env
VITE_API_URL=http://localhost:3000
VITE_API_TARGET=http://backend:3000
```

---

## 10. Key Design Decisions

| Decision | เหตุผล |
|----------|--------|
| **Immutable Ledger** | ป้องกันการแก้ไขประวัติการเงิน, audit trail |
| **Trust Level derived** | คำนวณจาก verification state, ไม่ใช้ manual set |
| **One active assignment per job** | constraint ระดับ DB ป้องกัน race condition |
| **No negative balance** | constraint ระดับ DB ป้องกัน overdraft |
| **JWT + Refresh token** | stateless auth, refresh ทุก 15 นาที |
| **Display name ≠ email/phone** | privacy — ไม่เปิดเผย PII ให้ user อื่น |
| **Risk-based job classification** | งานดูแลผู้ป่วยหนักต้องการ caregiver ที่ verified มากกว่า |
| **Polling notifications (30s)** | ง่ายกว่า WebSocket สำหรับ MVP |
