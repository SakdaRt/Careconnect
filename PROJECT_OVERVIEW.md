# CareConnect — Project Overview

## 1. ปัญหาที่แก้ (Problem Statement)

ประเทศไทยกำลังเข้าสู่สังคมผู้สูงอายุ ผู้ดูแล (Caregiver) ที่มีคุณภาพหาได้ยาก และผู้ว่าจ้าง (Hirer) ไม่มีช่องทางที่น่าเชื่อถือในการจ้างผู้ดูแลแบบ on-demand  
**CareConnect** เป็น Web Platform ที่เชื่อมต่อผู้ว่าจ้างกับผู้ดูแล พร้อมระบบความน่าเชื่อถือ (Trust Level), การยืนยันตัวตน (KYC), ระบบ Escrow สำหรับการเงิน, และหลักฐานการทำงาน (GPS + Photo) เพื่อให้ทุกฝ่ายมั่นใจ

## 2. กลุ่มผู้ใช้ (Users)

| Role | คำอธิบาย |
|------|----------|
| **Hirer (ผู้ว่าจ้าง)** | สร้างงาน, จ่ายเงินผ่าน Wallet, ติดตามงาน, เปิดข้อพิพาท |
| **Caregiver (ผู้ดูแล)** | เรียกดูงาน, สมัครงาน, Check-in/Check-out, รับเงิน |
| **Admin (ผู้ดูแลระบบ)** | จัดการผู้ใช้, อนุมัติงาน, แก้ข้อพิพาท, ดูรายงานการเงิน |

## 3. ฟีเจอร์หลัก (Key Features)

### 3.1 Authentication & Authorization
- สมัครแบบ Guest (Email) หรือ Member (Phone + OTP)
- เลือก Role (Hirer / Caregiver) → ยอมรับ Policy → สร้าง Profile
- JWT + Refresh Token, Route guards ตาม role
- KYC verification ผ่าน Mock Provider
- **ไฟล์**: `backend/src/controllers/authController.js`, `frontend/src/routerGuards.tsx`

### 3.2 Job Lifecycle
- Hirer สร้างงาน (Draft) → เผยแพร่ → Caregiver เรียกดู Feed → สมัคร → Hirer เลือก → Chat → Check-in (GPS) → ทำงาน → Check-out → จบงาน
- ระดับความเสี่ยง (Risk Level) คำนวณอัตโนมัติจากข้อมูลผู้ป่วยและประเภทงาน
- 6 ประเภทงาน: companionship, personal_care, medical_monitoring, dementia_care, post_surgery, emergency
- **ไฟล์**: `backend/src/models/Job.js`, `backend/src/services/jobService.js`, `frontend/src/pages/hirer/CreateJobPage.tsx`

### 3.3 Care Recipient (ผู้รับการดูแล)
- Hirer สร้างโปรไฟล์ผู้ป่วยแบบ persistent (ไม่ต้องกรอกซ้ำ)
- รองรับข้อมูลสุขภาพ: โรคเรื้อรัง, อุปกรณ์การแพทย์, ข้อจำกัดด้านการเคลื่อนที่, ความเสี่ยงด้านพฤติกรรม
- **ไฟล์**: `backend/src/controllers/careRecipientController.js`, `frontend/src/pages/hirer/CareRecipientFormPage.tsx`

### 3.4 Wallet & Payment
- ระบบ Wallet: Hirer Wallet, Caregiver Wallet, Escrow (per job), Platform Wallet
- Top-up ผ่าน QR Code (Mock Payment Gateway)
- Escrow: ล็อคเงินตอนเผยแพร่งาน → ปล่อยเงินเมื่องานเสร็จ
- Immutable Ledger (append-only, double-entry accounting)
- **ไฟล์**: `backend/src/services/walletService.js`, `backend/src/models/Wallet.js`, `database/schema.sql` (wallets + ledger_transactions)

### 3.5 Chat (Real-time)
- WebSocket (Socket.IO) — 1 thread ต่อ 1 job
- รองรับ text, image, file, system messages
- **ไฟล์**: `backend/src/sockets/chatSocket.js`, `frontend/src/pages/shared/ChatRoomPage.tsx`

### 3.6 Dispute System
- ทั้ง Hirer และ Caregiver เปิดข้อพิพาทได้
- Admin review → Settlement (refund / payout)
- Dispute chat แยกจาก job chat
- **ไฟล์**: `backend/src/services/disputeService.js`, `frontend/src/pages/shared/DisputeChatPage.tsx`

### 3.7 Trust & Safety
- Trust Level L0–L3 (คำนวณจาก completed jobs, GPS compliance, reviews)
- KYC verification (National ID hash สำหรับ duplicate detection)
- GPS anti-spoofing (confidence score, cell tower comparison)
- Photo evidence (before/after, perceptual hash, tampering flags)
- **ไฟล์**: `database/schema.sql` (trust_score_history, job_gps_events, job_photo_evidence)

### 3.8 Notification System
- In-app notifications (queued → sent → read)
- Real-time push via Socket.IO (realtimeHub)
- Triggers: job accepted, check-in, check-out, payment, etc.
- **ไฟล์**: `backend/src/services/notificationService.js`, `frontend/src/pages/shared/NotificationsPage.tsx`

### 3.9 Admin Panel
- Dashboard, User Management, Job Management
- Dispute Resolution, Financial Reports
- System Settings
- **ไฟล์**: `frontend/src/pages/admin/`

### 3.10 Caregiver Search
- ค้นหาผู้ดูแลตาม specialization, certification, trust level, availability
- Mock caregivers seeded ใน dev mode
- **ไฟล์**: `backend/src/routes/caregiverSearchRoutes.js`, `frontend/src/pages/hirer/SearchCaregiversPage.tsx`

## 4. Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18, TypeScript, Vite, TailwindCSS, React Router 6, Socket.IO-client, Leaflet (maps) |
| **Backend** | Node.js 20+, Express 4, Socket.IO, Joi validation, JWT auth, Multer (uploads) |
| **Database** | PostgreSQL 15, 25+ tables, immutable ledger, UUID primary keys |
| **Mock Services** | Payment gateway, SMS OTP, KYC, Bank transfer — all via mock-provider |
| **Infrastructure** | Docker Compose (5 services), Makefile shortcuts |
| **Testing** | Jest (backend), Vitest + Testing Library (frontend) |

## 5. Database Tables (25+)

`users`, `user_policy_acceptances`, `user_kyc_info`, `hirer_profiles`, `caregiver_profiles`, `patient_profiles`, `job_posts`, `jobs`, `job_assignments`, `job_patient_requirements`, `job_patient_sensitive_data`, `job_gps_events`, `job_photo_evidence`, `chat_threads`, `chat_messages`, `disputes`, `dispute_events`, `dispute_messages`, `wallets`, `ledger_transactions`, `banks`, `bank_accounts`, `withdrawal_requests`, `audit_events`, `notifications`, `trust_score_history`, `auth_sessions`, `topup_intents`, `provider_webhooks`

## 6. สถานะปัจจุบัน

- ✅ Frontend build สำเร็จ (0 TypeScript errors)
- ✅ Backend API ทำงานได้
- ✅ Docker Compose รันครบ 5 services
- ✅ ฟีเจอร์หลักครบ (Auth, Job, Chat, Wallet, Dispute, Admin)
- ✅ Mock provider สำหรับ Payment/SMS/KYC
- ⚠️ Trust score recompute worker ยังเป็น placeholder
- ⚠️ Email/Push notification เป็น mock mode
