# CareConnect — System Documentation

> Source of truth สำหรับ architecture, database, API, UML ทั้งหมด
> อัพเดทล่าสุด: 2026-02-22

---

## 1. ภาพรวมระบบ (System Overview)

CareConnect เป็น **Two-sided Marketplace** สำหรับบริการดูแลผู้สูงอายุในประเทศไทย

### Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     Client (Web Browser)                       │
│              Hirer  /  Caregiver  /  Admin                     │
└───────────┬────────────────────────────────────┬───────────────┘
            │ HTTPS                              │ WSS (Socket.IO)
            ▼                                    ▼
┌────────────────────────┐       ┌───────────────────────────────┐
│   Frontend Container   │       │     Backend Container         │
│   React 18 + Vite      │──────▶│     Express.js + Socket.IO    │
│   TailwindCSS          │proxy  │     JWT Auth + Joi Validation │
│   Port 5173            │/api   │     Port 3000                 │
└────────────────────────┘       └──────┬──────────┬─────────────┘
                                        │          │
                          ┌─────────────┘          └─────────────┐
                          ▼                                      ▼
              ┌───────────────────┐              ┌───────────────────────┐
              │  PostgreSQL 15    │              │  Mock Provider        │
              │  Port 5432       │              │  (Payment/SMS/KYC)    │
              │  25+ tables      │              │  Port 4000            │
              └───────────────────┘              └───────────────────────┘
```

### Roles & Account Types

| Role          | Account Type                      | คำอธิบาย                                  |
| ------------- | --------------------------------- | ----------------------------------------- |
| **Hirer**     | guest (email) หรือ member (phone) | สร้างงาน, ว่าจ้าง, จ่ายเงิน               |
| **Caregiver** | guest (email) หรือ member (phone) | รับงาน, check-in/out, รับเงิน             |
| **Admin**     | —                                 | จัดการ user, approve KYC, resolve dispute |

---

## 2. Trust Level System

```
L0 (Unverified)  ← สมัครสมาชิก
    │
    ▼  ยืนยัน Email OTP หรือ Phone OTP
L1 (Basic)
    │
    ▼  ยืนยัน KYC (บัตรประชาชน + selfie → Admin approve)
L2 (Verified)
    │
    ▼  ยืนยันบัญชีธนาคาร + Trust Score ≥ 80
L3 (Trusted)
```

### สิทธิ์ตาม Trust Level

> Source: `backend/src/middleware/auth.js` → `can()` function

| Action                       | Role      | L0  | L1  | L2  | L3  |
| ---------------------------- | --------- | :-: | :-: | :-: | :-: |
| สมัคร / login / me / profile | any       |  ✓  |  ✓  |  ✓  |  ✓  |
| สร้าง job draft              | hirer     |  ✓  |  ✓  |  ✓  |  ✓  |
| ดู job stats                 | any       |  ✓  |  ✓  |  ✓  |  ✓  |
| ดู job feed                  | caregiver |  ✓  |  ✓  |  ✓  |  ✓  |
| ดู my-jobs                   | hirer     |  ✓  |  ✓  |  ✓  |  ✓  |
| Top up wallet                | any       |  ✓  |  ✓  |  ✓  |  ✓  |
| ดูยอด/ประวัติ wallet         | any       |  ✓  |  ✓  |  ✓  |  ✓  |
| ยกเลิกงาน                    | hirer/cg  |  ✓  |  ✓  |  ✓  |  ✓  |
| ดูบัญชีธนาคาร (hirer)        | hirer     |  ✓  |  ✓  |  ✓  |  ✓  |
| ดู/เพิ่มบัญชีธนาคาร (cg)     | caregiver |  ✗  |  ✓  |  ✓  |  ✓  |
| โพสต์งาน low_risk            | hirer     |  ✗  |  ✓  |  ✓  |  ✓  |
| รับงาน (accept/reject)       | caregiver |  ✗  |  ✓  |  ✓  |  ✓  |
| Check-in / Check-out         | caregiver |  ✗  |  ✓  |  ✓  |  ✓  |
| ดูงานที่ได้รับมอบหมาย        | caregiver |  ✗  |  ✓  |  ✓  |  ✓  |
| โพสต์งาน high_risk           | hirer     |  ✗  |  ✗  |  ✓  |  ✓  |
| ถอนเงิน                      | caregiver |  ✗  |  ✗  |  ✓  |  ✓  |

---

## 3. Job Lifecycle (Two-table Pattern)

ระบบใช้ 2 table: `job_posts` (ประกาศงาน) + `jobs` (instance งานจริง)

```
job_posts (ประกาศงาน)              jobs (instance)
┌──────────┐                      ┌──────────────┐
│  draft   │                      │              │
└────┬─────┘                      │              │
     │ publish (L1+)              │              │
┌────▼─────┐                      │              │
│  posted  │                      │              │
└────┬─────┘                      │              │
     │ caregiver accept           │              │
     │──── สร้าง job instance ───▶│  assigned    │
┌────▼─────┐                      └──────┬───────┘
│ assigned │                             │ checkin (GPS)
└──────────┘                      ┌──────▼───────┐
                                  │ in_progress  │
                                  └──────┬───────┘
                                         │ checkout (GPS)
                                  ┌──────▼───────┐
                                  │  completed   │
                                  └──────────────┘

ทุก state → cancelled (ยกเลิกได้)
posted → expired (หมดอายุ)
max 3 replacement chains per job_post
```

---

## 4. Payment Flow (Double-entry Ledger)

> Source: `backend/src/services/jobService.js`

### 4 Phases:

```
Phase 1: Top-up
  Hirer ── POST /wallet/topup ──► topup_intent (pending)
  Provider webhook ──► topup_intent (succeeded)
  → credit hirer wallet.available_balance
  → INSERT ledger_transaction (type=credit)

Phase 2: Publish (Hold on hirer wallet)
  Hirer ── POST /jobs/:id/publish ──►
  → cost = total_amount + platform_fee_amount
  → hirer wallet: available_balance -= cost, held_balance += cost
  → INSERT ledger_transaction (type=hold, from=hirer, to=hirer)
  Note: Dev mode auto-tops up if insufficient

Phase 3: Accept (Escrow creation)
  Caregiver ── POST /jobs/:id/accept ──►
  → hirer wallet: held_balance -= cost (or available_balance if no held)
  → CREATE escrow wallet (job_id, held_balance=cost)
  → INSERT ledger_transaction (type=hold, from=hirer, to=escrow)
  → CREATE jobs record + job_assignments + chat_thread

Phase 4: Checkout (Settlement)
  Caregiver ── POST /jobs/:jobId/checkout ──►
  → escrow wallet: held_balance -= total_amount
  → caregiver wallet: available_balance += total_amount
  → INSERT ledger_transaction (type=release, from=escrow, to=caregiver)
  → IF platform_fee > 0:
    escrow wallet: held_balance -= platform_fee
    platform wallet: available_balance += platform_fee
    INSERT ledger_transaction (type=debit, from=escrow, to=platform)
  → Trust score recalculation triggered (fire-and-forget)

Cancel (Refund):
  → escrow wallet: held_balance → 0
  → hirer wallet: available_balance += escrow amount
  → INSERT ledger_transaction (type=reversal, reference_type=refund)
  → IF posted but no job instance: held_balance → available_balance (unhold)
```

### Wallet Types (5 ประเภท)

| Type                   | Owner   | คำอธิบาย                       |
| ---------------------- | ------- | ------------------------------ |
| `hirer`                | user_id | กระเป๋า hirer (1 ต่อ user)     |
| `caregiver`            | user_id | กระเป๋า caregiver (1 ต่อ user) |
| `escrow`               | job_id  | กระเป๋าพักเงินงาน (1 ต่อ job)  |
| `platform`             | —       | กระเป๋า platform fee           |
| `platform_replacement` | —       | กระเป๋า replacement fee        |

### Ledger (Immutable, Double-entry)

- ทุก transaction มี `from_wallet_id` → `to_wallet_id`
- `idempotency_key` ป้องกัน duplicate
- DB trigger ป้องกัน UPDATE/DELETE
- ยอดเงินติดลบไม่ได้ (constraint ระดับ DB)

---

## 5. Database Schema (ERD)

> Source: `database/schema.sql` (1111 lines, 25+ tables)

### 5.1 Users & Profiles

```
┌─────────────────────────────────────────────────┐
│ users                                           │
├─────────────────────────────────────────────────┤
│ id UUID PK                                      │
│ email VARCHAR(255) UNIQUE (nullable)            │
│ phone_number VARCHAR(20) UNIQUE (nullable)      │
│ password_hash VARCHAR(255)                      │
│ google_id VARCHAR(255) UNIQUE (nullable)        │
│ account_type VARCHAR(10) ('guest'|'member')     │
│ role ENUM(hirer, caregiver, admin)              │
│ status ENUM(active, suspended, deleted)         │
│ is_email_verified BOOLEAN                       │
│ is_phone_verified BOOLEAN                       │
│ two_factor_enabled BOOLEAN                      │
│ trust_level ENUM(L0, L1, L2, L3)               │
│ trust_score INT (0-100)                         │
│ completed_jobs_count INT                        │
│ ban_login, ban_job_create BOOLEAN               │
│ ban_job_accept, ban_withdraw BOOLEAN            │
│ ban_reason TEXT                                 │
│ created_at, updated_at, last_login_at           │
│ CHECK: email OR phone_number required           │
│ CHECK: guest must have email                    │
│ CHECK: member must have phone                   │
└─────────────────────────────────────────────────┘
    │1          │1          │1
    ▼1          ▼1          ▼N
┌──────────┐ ┌──────────┐ ┌──────────────────────┐
│ hirer_   │ │caregiver_│ │ user_policy_         │
│ profiles │ │ profiles │ │ acceptances          │
├──────────┤ ├──────────┤ ├──────────────────────┤
│ id PK    │ │ id PK    │ │ user_id+role PK (FK) │
│ user_id  │ │ user_id  │ │ policy_accepted_at   │
│ display_ │ │ display_ │ │ version_policy_      │
│  name    │ │  name    │ │   accepted           │
│ full_name│ │ full_name│ └──────────────────────┘
│ address  │ │ bio      │
│ district │ │ experience_years     │
│ province │ │ certifications[]     │
│ lat, lng │ │ specializations[]    │
│ total_   │ │ available_from/to    │
│  jobs_*  │ │ available_days[]     │
└──────────┘ │ average_rating       │
             │ total_reviews        │
             └─────────────────────┘
```

### 5.2 Job System (Two-table Pattern)

```
┌─────────────────────────────────────────────────┐
│ job_posts (ประกาศงาน/draft)                      │
├─────────────────────────────────────────────────┤
│ id UUID PK                                      │
│ hirer_id FK → users                             │
│ title, description                              │
│ job_type ENUM(6 types)                          │
│ risk_level ENUM(low_risk, high_risk)            │
│ scheduled_start_at, scheduled_end_at            │
│ address_line1/2, district, province, postal_code│
│ lat, lng, geofence_radius_m                     │
│ hourly_rate INT, total_hours NUMERIC            │
│ total_amount INT, platform_fee_* INT            │
│ min_trust_level, required_certifications[]      │
│ job_tasks_flags[], required_skills_flags[]      │
│ status ENUM(7 states), is_urgent BOOLEAN        │
│ preferred_caregiver_id FK → users (nullable)    │
│ patient_profile_id FK → patient_profiles        │
│ replacement_chain_count INT (max 3)             │
│ original_job_post_id FK → job_posts (nullable)  │
└───────────────────┬─────────────────────────────┘
                    │ 1
                    ▼ N
┌─────────────────────────────────────────────────┐
│ jobs (instance งานจริง — สร้างเมื่อ assign)       │
├─────────────────────────────────────────────────┤
│ id UUID PK                                      │
│ job_post_id FK → job_posts                      │
│ hirer_id FK → users                             │
│ status ENUM(assigned,in_progress,completed,     │
│        cancelled,expired)                       │
│ assigned_at, started_at, completed_at           │
│ cancelled_at, expired_at, job_closed_at         │
└───────────────────┬─────────────────────────────┘
                    │ 1
                    ▼ N
┌─────────────────────────────────────────────────┐
│ job_assignments                                 │
├─────────────────────────────────────────────────┤
│ id UUID PK                                      │
│ job_id FK → jobs                                │
│ job_post_id FK → job_posts                      │
│ caregiver_id FK → users                         │
│ status ENUM(active, replaced, completed,        │
│        cancelled)                               │
│ assigned_at, start_confirmed_at,                │
│ end_confirmed_at, replaced_at                   │
│ UNIQUE(job_id) WHERE status='active'            │
└─────────────────────────────────────────────────┘
```

### 5.3 Patient & Job Requirements

```
┌───────────────────────────┐  ┌──────────────────────────────┐
│ patient_profiles          │  │ job_patient_requirements     │
├───────────────────────────┤  ├──────────────────────────────┤
│ id UUID PK                │  │ job_id PK FK → jobs          │
│ hirer_id FK → users       │  │ patient_id FK → patient_     │
│ patient_display_name      │  │   profiles                   │
│ address_line1/2, district │  │ job_care_scope TEXT           │
│ province, postal_code     │  │ personal_care_tasks[]        │
│ lat, lng, birth_year      │  │ monitoring_focus[]           │
│ age_band, gender          │  │ environment_notes            │
│ mobility_level            │  │ temporary_restrictions       │
│ communication_style       │  └──────────────────────────────┘
│ general_health_summary    │
│ chronic_conditions_flags[]│  ┌──────────────────────────────┐
│ cognitive_status          │  │ job_patient_sensitive_data   │
│ symptoms_flags[]          │  ├──────────────────────────────┤
│ medical_devices_flags[]   │  │ job_id PK FK → jobs          │
│ care_needs_flags[]        │  │ patient_id FK                │
│ behavior_risks_flags[]    │  │ diagnosis_summary            │
│ allergies_flags[]         │  │ medication_brief             │
│ is_active BOOLEAN         │  │ behavioural_risk_notes       │
└───────────────────────────┘  │ emergency_protocol           │
                               └──────────────────────────────┘
```

### 5.4 GPS & Photo Evidence

```
┌───────────────────────────┐  ┌──────────────────────────────┐
│ job_gps_events            │  │ job_photo_evidence           │
├───────────────────────────┤  ├──────────────────────────────┤
│ id UUID PK                │  │ id UUID PK                   │
│ job_id FK → jobs          │  │ job_id FK → jobs             │
│ caregiver_id FK → users   │  │ caregiver_id FK → users      │
│ event_type ENUM(check_in, │  │ phase ENUM(before, after)    │
│   check_out, ping)        │  │ storage_key VARCHAR           │
│ lat, lng NUMERIC          │  │ taken_at TIMESTAMPTZ          │
│ accuracy_m NUMERIC        │  │ lat, lng                     │
│ confidence_score INT      │  │ exif_metadata JSONB           │
│ fraud_indicators[]        │  │ verified BOOLEAN              │
│ recorded_at TIMESTAMPTZ   │  │ perceptual_hash VARCHAR       │
└───────────────────────────┘  └──────────────────────────────┘
```

### 5.5 Financial System

```
┌─────────────────────────────────────────────────┐
│ wallets                                         │
├─────────────────────────────────────────────────┤
│ id UUID PK                                      │
│ user_id FK → users (nullable)                   │
│ job_id FK → jobs (nullable, for escrow)         │
│ wallet_type ('hirer'|'caregiver'|'escrow'|      │
│   'platform'|'platform_replacement')            │
│ available_balance BIGINT (≥0)                   │
│ held_balance BIGINT (≥0)                        │
│ currency VARCHAR(3) DEFAULT 'THB'               │
└───────────────────┬─────────────────────────────┘
                    │ 1
                    ▼ N
┌─────────────────────────────────────────────────┐
│ ledger_transactions (IMMUTABLE — append-only)   │
├─────────────────────────────────────────────────┤
│ id UUID PK                                      │
│ amount BIGINT (>0)                              │
│ currency VARCHAR(3)                             │
│ from_wallet_id FK → wallets                     │
│ to_wallet_id FK → wallets                       │
│ type ENUM(credit,debit,hold,release,reversal)   │
│ reference_type ENUM(topup,job,dispute,          │
│   withdrawal,fee,refund,penalty)                │
│ reference_id UUID                               │
│ idempotency_key VARCHAR UNIQUE                  │
│ description TEXT, metadata JSONB                │
│ created_at (NO updated_at — immutable!)         │
└─────────────────────────────────────────────────┘

┌────────────────────────┐  ┌──────────────────────────────┐
│ banks                  │  │ bank_accounts                │
├────────────────────────┤  ├──────────────────────────────┤
│ code VARCHAR PK        │  │ id UUID PK                   │
│ full_name_th VARCHAR   │  │ user_id FK → users           │
│ full_name_en VARCHAR   │  │ bank_code FK → banks         │
│ is_active BOOLEAN      │  │ account_number_encrypted     │
└────────────────────────┘  │ account_number_last4         │
                            │ account_name VARCHAR          │
┌────────────────────────┐  │ is_verified, is_primary      │
│ topup_intents          │  └──────────────────────────────┘
├────────────────────────┤
│ id UUID PK             │  ┌──────────────────────────────┐
│ user_id FK → users     │  │ withdrawal_requests          │
│ amount BIGINT          │  ├──────────────────────────────┤
│ method (dynamic_qr|    │  │ id UUID PK                   │
│   payment_link)        │  │ user_id FK → users           │
│ provider_name          │  │ bank_account_id FK           │
│ qr_payload TEXT        │  │ amount BIGINT                │
│ payment_link_url       │  │ status ENUM(queued,review,   │
│ status (pending|       │  │   approved,paid,rejected,    │
│  succeeded|failed|     │  │   cancelled)                 │
│  expired|cancelled)    │  │ reviewed_by, approved_by,    │
│ idempotency_key UNIQUE │  │   paid_by, rejected_by       │
└────────────────────────┘  └──────────────────────────────┘
```

### 5.6 Chat & Disputes

```
┌────────────────────────┐     ┌──────────────────────────────┐
│ chat_threads           │     │ disputes                     │
├────────────────────────┤     ├──────────────────────────────┤
│ id UUID PK             │     │ id UUID PK                   │
│ job_id FK → jobs UNIQ  │     │ job_post_id FK → job_posts   │
│ status (open|closed)   │     │ job_id FK → jobs (nullable)  │
│ pre_confirmation_      │     │ opened_by_user_id FK → users │
│   chat_opened_at       │     │ status ENUM(open,in_review,  │
└──────────┬─────────────┘     │   resolved,rejected)         │
           │ 1                 │ reason TEXT                   │
           ▼ N                 │ assigned_admin_id FK → users  │
┌────────────────────────┐     │ resolution TEXT               │
│ chat_messages          │     │ settlement_refund/payout_amt  │
├────────────────────────┤     └──────────────┬───────────────┘
│ id UUID PK             │                    │ 1
│ thread_id FK           │                    ▼ N
│ sender_id FK → users   │     ┌──────────────────────────────┐
│ type ENUM(text,image,  │     │ dispute_messages             │
│   file,system)         │     ├──────────────────────────────┤
│ content TEXT            │     │ id UUID PK                   │
│ attachment_key          │     │ dispute_id FK → disputes     │
│ is_system_message      │     │ sender_id FK → users         │
│ metadata JSONB          │     │ type, content, attachment_key│
└────────────────────────┘     └──────────────────────────────┘

┌──────────────────────────────┐
│ dispute_events (timeline)    │
├──────────────────────────────┤
│ id UUID PK                   │
│ dispute_id FK → disputes     │
│ actor_user_id FK → users     │
│ event_type (note|status_change)│
│ message TEXT                 │
└──────────────────────────────┘
```

### 5.7 Other Tables

```
┌────────────────────────┐  ┌──────────────────────────────┐
│ notifications          │  │ user_kyc_info                │
├────────────────────────┤  ├──────────────────────────────┤
│ id UUID PK             │  │ id UUID PK                   │
│ user_id FK → users     │  │ user_id FK → users UNIQUE    │
│ channel ENUM(email,    │  │ provider_name, provider_*    │
│  sms,push,in_app)      │  │ status ENUM(pending,approved,│
│ template_key VARCHAR   │  │   rejected,expired)          │
│ title, body TEXT       │  │ national_id_hash VARCHAR     │
│ data JSONB             │  │ verified_at, expires_at      │
│ reference_type/id      │  └──────────────────────────────┘
│ status ENUM(queued,    │
│  sent,delivered,       │  ┌──────────────────────────────┐
│  read,failed)          │  │ caregiver_documents          │
└────────────────────────┘  ├──────────────────────────────┤
                            │ id UUID PK                   │
┌────────────────────────┐  │ user_id FK → users           │
│ trust_score_history    │  │ document_type, title         │
├────────────────────────┤  │ issuer, issued_date          │
│ id UUID PK             │  │ file_path, file_name         │
│ user_id FK → users     │  │ file_size, mime_type         │
│ delta INT              │  └──────────────────────────────┘
│ score_before/after     │
│ trust_level_before/    │  ┌──────────────────────────────┐
│   after                │  │ caregiver_reviews            │
│ reason_code VARCHAR    │  ├──────────────────────────────┤
└────────────────────────┘  │ id UUID PK                   │
                            │ job_id, job_post_id          │
┌────────────────────────┐  │ reviewer_id, caregiver_id    │
│ auth_sessions          │  │ rating INT (1-5)             │
├────────────────────────┤  │ comment TEXT                 │
│ id UUID PK             │  │ UNIQUE(job_id, reviewer_id)  │
│ user_id FK → users     │  └──────────────────────────────┘
│ token_hash UNIQUE      │
│ refresh_token_hash     │  ┌──────────────────────────────┐
│ device_info, ip_addr   │  │ caregiver_favorites          │
│ status (active|revoked │  ├──────────────────────────────┤
│  |expired)             │  │ id UUID PK                   │
│ expires_at             │  │ hirer_id, caregiver_id       │
└────────────────────────┘  │ UNIQUE(hirer_id,caregiver_id)│
                            └──────────────────────────────┘
┌────────────────────────┐  ┌──────────────────────────────┐
│ audit_events           │  │ provider_webhooks            │
├────────────────────────┤  ├──────────────────────────────┤
│ id UUID PK             │  │ id UUID PK                   │
│ user_id FK → users     │  │ provider_name, event_id      │
│ event_type VARCHAR     │  │ event_type, payload JSONB    │
│   (policy_denied,      │  │ signature_valid BOOLEAN      │
│    trust_level_change,  │  │ processed BOOLEAN            │
│    trust_recompute)    │  └──────────────────────────────┘
│ action VARCHAR          │
│ old_level, new_level   │
│   (nullable — trust    │
│    change events only) │
│ details JSONB          │
└────────────────────────┘
```

---

## 6. Sequence Diagrams

### 6.1 Guest Registration (Email + Password)

```
User              Frontend                   Backend                    DB
 │                    │                          │                       │
 │─ กรอก email ──────►│                          │                       │
 │  + password + role │─ POST /auth/register/guest►                      │
 │                    │                          │─ INSERT user ────────►│
 │                    │                          │─ INSERT profile ─────►│
 │                    │                          │─ INSERT wallet ──────►│
 │                    │◄── JWT + Refresh Token ──│                       │
 │◄── redirect /select-role ────────────────────│                       │
```

### 6.2 Member Registration (Phone + OTP)

```
User              Frontend                   Backend                    DB
 │                    │                          │                       │
 │─ กรอกเบอร์โทร ───►│                          │                       │
 │                    │─ POST /auth/register/member►                     │
 │                    │                          │─ INSERT user ────────►│
 │                    │                          │─ INSERT profile ─────►│
 │                    │                          │─ INSERT wallet ──────►│
 │                    │◄── JWT + Refresh Token ──│                       │
 │◄── redirect ──────│                          │                       │
 │                    │                          │                       │
 │  (ต้องการยืนยัน OTP ภายหลัง)                   │                       │
 │─ กดส่ง OTP ──────►│                          │                       │
 │                    │─ POST /otp/phone/send ──►│                       │
 │                    │                          │─ INSERT OTP ────────►│
 │                    │◄── 200 + otp_id ────────│                       │
 │◄── SMS OTP ───────│                          │                       │
 │─ กรอก OTP ───────►│                          │                       │
 │                    │─ POST /otp/verify ──────►│                       │
 │                    │                          │─ verify + UPDATE ────►│
 │                    │◄── 200 OK ──────────────│                       │
```

### 6.3 Email OTP Verification

```
User              Frontend                   Backend                    DB
 │                    │                          │                       │
 │─ กดส่ง OTP ──────►│                          │                       │
 │                    │─ POST /otp/email/send ──►│                       │
 │                    │                          │─ INSERT OTP ────────►│
 │                    │◄── 200 + otp_id ────────│                       │
 │◄── Email OTP ─────│                          │                       │
 │─ กรอก OTP ───────►│                          │                       │
 │                    │─ POST /otp/verify ──────►│                       │
 │                    │                          │─ verify + mark ─────►│
 │                    │◄── 200 OK ──────────────│                       │
```

### 6.4 Job Posting & Assignment Flow

```
Hirer             Frontend                   Backend                    DB
 │                    │                          │                       │
 │─ สร้างงาน ────────►│                          │                       │
 │                    │─ POST /jobs ────────────►│                       │
 │                    │                          │─ INSERT job_posts ───►│
 │                    │◄── job_post_id ──────────│                       │
 │─ โพสต์งาน ────────►│                          │                       │
 │                    │─ POST /jobs/:id/publish ►│                       │
 │                    │                          │─ check trust_level ──►│
 │                    │                          │─ UPDATE status=posted►│
 │                    │◄── 200 OK ──────────────│                       │

Caregiver                                                               │
 │─ ดู feed ─────────►│─ GET /jobs/feed ────────►│                       │
 │◄── job list ───────│◄── jobs[] ──────────────│                       │
 │─ กด Accept ───────►│                          │                       │
 │                    │─ POST /jobs/:id/accept ─►│                       │
 │                    │                          │─ INSERT jobs ────────►│
 │                    │                          │─ INSERT assignment ──►│
 │                    │                          │─ hold payment ───────►│
 │                    │                          │─ notify hirer ───────►│
 │                    │◄── 200 OK ──────────────│                       │
```

### 6.5 Check-in / Check-out Flow

```
Caregiver         Frontend                   Backend                    DB
 │                    │                          │                       │
 │─ Check-in ────────►│                          │                       │
 │  (GPS lat/lng)     │─ POST /jobs/:jobId/checkin►                      │
 │                    │                          │─ INSERT gps_event ───►│
 │                    │                          │─ UPDATE job status ──►│
 │                    │                          │  = in_progress        │
 │                    │                          │─ notify hirer ───────►│
 │                    │◄── 200 OK ──────────────│                       │
 │                    │                          │                       │
 │─ Check-out ───────►│                          │                       │
 │  (GPS lat/lng)     │─ POST /jobs/:jobId/checkout►                     │
 │                    │                          │─ INSERT gps_event ───►│
 │                    │                          │─ UPDATE job status ──►│
 │                    │                          │  = completed          │
 │                    │                          │─ release escrow ─────►│
 │                    │                          │─ transfer to cg ─────►│
 │                    │                          │─ platform fee ───────►│
 │                    │                          │─ notify hirer ───────►│
 │                    │◄── 200 OK ──────────────│                       │
```

### 6.6 KYC Flow

```
User              Frontend                   Backend                    DB
 │                    │                          │                       │
 │─ อัพโหลดเอกสาร ──►│                          │                       │
 │  (บัตร+selfie)    │─ POST /kyc/submit ──────►│                       │
 │                    │  (multipart: front,back,selfie)                  │
 │                    │                          │─ INSERT user_kyc_info►│
 │                    │◄── 200 OK ──────────────│                       │

Admin                                                                   │
 │─ ดู KYC list ─────►│─ GET /admin/users ──────►│                       │
 │─ approve ─────────►│─ POST /admin/users/:id/status►                   │
 │                    │                          │─ UPDATE kyc status ──►│
 │                    │                          │─ UPDATE trust_level ─►│
 │                    │                          │  = L2                 │
 │                    │◄── 200 OK ──────────────│                       │
User◄── notification ─────────────────────────────                      │
```

### 6.7 Google OAuth Flow

```
User              Frontend                   Backend              Google
 │                    │                          │                    │
 │─ กด Sign in ─────►│                          │                    │
 │                    │─ GET /auth/google ───────►│                    │
 │                    │◄── redirect URL ─────────│                    │
 │◄── redirect ──────│                          │                    │
 │───────────────────────────────── login ──────────────────────────►│
 │◄── redirect /auth/callback?code=xxx ────────────────────────────│
 │                    │─ GET /auth/google/callback►                   │
 │                    │                          │─ exchange code ──►│
 │                    │                          │◄── id_token ─────│
 │                    │                          │─ find/create user  │
 │                    │◄── JWT + Refresh Token ──│                    │
 │◄── redirect /select-role or /home ───────────│                    │
```

### 6.8 Top-up Flow (QR Payment)

```
Hirer             Frontend                   Backend              MockProvider
 │                    │                          │                       │
 │─ เติมเงิน ────────►│                          │                       │
 │                    │─ POST /wallet/topup ────►│                       │
 │                    │                          │─ create intent ──────►│
 │                    │                          │◄── qr_payload ───────│
 │                    │                          │─ INSERT topup_intent─►│
 │                    │◄── QR code ─────────────│                       │
 │─ สแกน QR ─────────────────────────────────────────── pay ──────────►│
 │                    │                          │◄── webhook (paid) ───│
 │                    │                          │─ UPDATE intent ──────►│
 │                    │                          │─ credit wallet ──────►│
 │                    │                          │─ INSERT ledger ──────►│
```

### 6.9 Dispute Flow

```
User              Frontend                   Backend                    DB
 │                    │                          │                       │
 │─ เปิดข้อพิพาท ───►│                          │                       │
 │                    │─ POST /disputes ────────►│                       │
 │                    │                          │─ INSERT dispute ─────►│
 │                    │◄── dispute_id ──────────│                       │
 │─ ส่งข้อความ ──────►│                          │                       │
 │                    │─ POST /disputes/:id/messages►                    │
 │                    │                          │─ INSERT msg ─────────►│

Admin                                                                   │
 │─ ดู disputes ─────►│─ GET /admin/disputes ───►│                       │
 │─ settle ──────────►│─ POST /admin/disputes/:id/settle►                │
 │                    │                          │─ refund/payout ──────►│
 │                    │                          │─ UPDATE dispute ─────►│
 │                    │                          │  = resolved           │
```

---

## 7. API Routes Overview

> Source: `backend/src/routes/` (17 route files), mounted in `server.js`

### 7.1 Auth — `/api/auth`

```
POST   /api/auth/register/guest        สมัคร Guest (email + password + role)
POST   /api/auth/register/member       สมัคร Member (phone + password + role)
POST   /api/auth/login/email           Login ด้วย email + password
POST   /api/auth/login/phone           Login ด้วย phone + password
POST   /api/auth/refresh               Refresh JWT token
POST   /api/auth/logout                Logout
GET    /api/auth/me                    ดึงข้อมูล user ปัจจุบัน
DELETE /api/auth/me                    ลบ unverified account
POST   /api/auth/cancel-registration   ลบ unverified account (sendBeacon)
GET    /api/auth/profile               ดึงโปรไฟล์
PUT    /api/auth/profile               แก้ไขโปรไฟล์
POST   /api/auth/avatar                อัพโหลด avatar (multipart)
POST   /api/auth/phone                 อัพเดทเบอร์โทร
POST   /api/auth/email                 อัพเดทอีเมล
POST   /api/auth/change-password       เปลี่ยนรหัสผ่าน
POST   /api/auth/forgot-password       ขอลิงก์รีเซ็ตรหัสผ่าน (email)
POST   /api/auth/reset-password        รีเซ็ตรหัสผ่านด้วย token
POST   /api/auth/policy/accept         ยอมรับ policy (role + version)
POST   /api/auth/role                  เปลี่ยน role
GET    /api/auth/google                เริ่ม Google OAuth
GET    /api/auth/google/callback       Google OAuth callback
```

### 7.2 OTP — `/api/otp`

```
POST   /api/otp/email/send             ส่ง OTP ไป email
POST   /api/otp/phone/send             ส่ง OTP ไป phone
POST   /api/otp/verify                 ยืนยัน OTP (otp_id + code)
POST   /api/otp/resend                 ส่ง OTP ซ้ำ (otp_id)
```

### 7.3 Jobs — `/api/jobs`

```
GET    /api/jobs/stats                 สถิติงาน (สำหรับ dashboard)
GET    /api/jobs/feed                  Job feed สำหรับ caregiver (filter: job_type, risk, urgent)
GET    /api/jobs/my-jobs               งานของ hirer (filter: status)
GET    /api/jobs/assigned              งานที่ caregiver ได้รับมอบหมาย (filter: status)
GET    /api/jobs/:id                   ดู job detail
POST   /api/jobs                       สร้าง job draft
POST   /api/jobs/:id/publish           โพสต์งาน (draft→posted)
POST   /api/jobs/:id/accept            รับงาน (posted→assigned)
POST   /api/jobs/:id/reject            ปฏิเสธงาน direct-assigned
POST   /api/jobs/:jobId/checkin        Check-in (GPS: lat, lng, accuracy_m)
POST   /api/jobs/:jobId/checkout       Check-out (GPS: lat, lng, accuracy_m)
POST   /api/jobs/:jobId/early-checkout-request   ขอส่งงานก่อนเวลา (evidence_note)
POST   /api/jobs/:jobId/early-checkout-respond   ตอบรับ/ปฏิเสธคำขอส่งงานก่อนเวลา (action, reason?)
GET    /api/jobs/:jobId/early-checkout-request    ดูคำขอส่งงานก่อนเวลา
POST   /api/jobs/:id/cancel            ยกเลิกงาน (reason required)
```

### 7.4 Caregivers — `/api/caregivers`

```
GET    /api/caregivers/public/featured ดู featured caregivers (no auth, landing page)
GET    /api/caregivers/search          ค้นหา caregiver (q, skills, trust_level, experience, day)
GET    /api/caregivers/:id             ดูโปรไฟล์ caregiver (public)
POST   /api/caregivers/assign          มอบหมาย caregiver ให้ job (hirer)
```

### 7.5 Care Recipients — `/api/care-recipients`

```
GET    /api/care-recipients            ดูรายชื่อผู้รับดูแลของ hirer
POST   /api/care-recipients            สร้างผู้รับดูแลใหม่
GET    /api/care-recipients/:id        ดูรายละเอียดผู้รับดูแล
PUT    /api/care-recipients/:id        แก้ไขผู้รับดูแล
DELETE /api/care-recipients/:id        ลบ (deactivate) ผู้รับดูแล
```

### 7.6 Caregiver Documents — `/api/caregiver-documents`

```
GET    /api/caregiver-documents                    ดูเอกสารตัวเอง
POST   /api/caregiver-documents                    อัพโหลดเอกสาร (multipart)
DELETE /api/caregiver-documents/:id                ลบเอกสาร
GET    /api/caregiver-documents/by-caregiver/:id   ดูเอกสาร caregiver (hirer/admin)
```

### 7.7 Reviews — `/api/reviews`

```
POST   /api/reviews                          รีวิว caregiver (job_id, caregiver_id, rating, comment)
GET    /api/reviews/caregiver/:caregiverId   ดูรีวิว caregiver (paginated)
GET    /api/reviews/job/:jobId               ตรวจสอบว่ารีวิวงานนี้แล้วหรือยัง
```

### 7.7b Favorites — `/api/favorites`

```
POST   /api/favorites/toggle                 toggle favorite (caregiver_id)
GET    /api/favorites                        ดูรายการ favorite ทั้งหมด (paginated)
GET    /api/favorites/check/:caregiverId     ตรวจสอบว่า favorite อยู่หรือไม่
```

### 7.8 KYC — `/api/kyc`

```
GET    /api/kyc/status                 ดูสถานะ KYC
POST   /api/kyc/submit                 ส่ง KYC จริง (multipart: front, back, selfie)
POST   /api/kyc/mock/submit            ส่ง KYC mock (สำหรับ dev/demo)
```

### 7.9 Wallet — `/api/wallet`

```
GET    /api/wallet/balance                              ดูยอดเงิน
GET    /api/wallet/transactions                         ประวัติ transaction (paginated)
GET    /api/wallet/bank-accounts                        ดูบัญชีธนาคาร
POST   /api/wallet/bank-accounts                        เพิ่มบัญชีธนาคาร
POST   /api/wallet/topup                                เติมเงิน (amount, payment_method)
GET    /api/wallet/topup/pending                        ดู pending top-ups
GET    /api/wallet/topup/:topupId                       ดูสถานะ top-up
POST   /api/wallet/topup/:topupId/confirm               ยืนยัน top-up manual
POST   /api/wallet/withdraw                             ถอนเงิน (amount, bank_account_id)
GET    /api/wallet/withdrawals                          ดู withdrawal requests
POST   /api/wallet/withdrawals/:withdrawalId/cancel     ยกเลิก withdrawal
GET    /api/wallet/admin/stats                          Admin: platform stats
POST   /api/wallet/admin/add-funds                      Admin: เพิ่มเงินตรง
GET    /api/wallet/admin/withdrawals                    Admin: ดู withdrawals
POST   /api/wallet/admin/withdrawals/:id/review         Admin: review
POST   /api/wallet/admin/withdrawals/:id/approve        Admin: approve
POST   /api/wallet/admin/withdrawals/:id/reject         Admin: reject
POST   /api/wallet/admin/withdrawals/:id/mark-paid      Admin: mark paid
```

### 7.10 Payments — `/api/payments`

```
GET    /api/payments                   ดูรายการ payment (paginated, filter: status)
GET    /api/payments/:id               ดูรายละเอียด payment
POST   /api/payments/:id/simulate      Simulate payment (admin/testing)
```

### 7.11 Chat — `/api/chat`

```
GET    /api/chat/threads                          ดู chat threads ทั้งหมด
GET    /api/chat/threads/:threadId                ดู thread detail
GET    /api/chat/threads/:threadId/messages       ดูข้อความ (paginated)
POST   /api/chat/threads/:threadId/messages       ส่งข้อความ (type, content)
POST   /api/chat/threads/:threadId/read           mark messages as read
GET    /api/chat/threads/:threadId/unread         นับ unread
POST   /api/chat/threads/:threadId/close          ปิด thread
POST   /api/chat/job/:jobId/thread                get-or-create thread สำหรับ job
GET    /api/chat/job/:jobId/thread                ดู thread ของ job
```

### 7.12 Disputes — `/api/disputes`

```
POST   /api/disputes                       เปิดข้อพิพาท (job_id, reason)
GET    /api/disputes/by-job/:jobId         ดูข้อพิพาทของ job
GET    /api/disputes/:id                   ดูข้อพิพาท detail
POST   /api/disputes/:id/messages          ส่งข้อความใน dispute
POST   /api/disputes/:id/request-close     ขอปิดข้อพิพาท
```

### 7.13 Notifications — `/api/notifications`

```
GET    /api/notifications              ดู notifications (paginated)
GET    /api/notifications/unread-count นับ unread
PATCH  /api/notifications/:id/read     mark as read
PATCH  /api/notifications/read-all     mark all as read
DELETE /api/notifications              ลบ notifications ทั้งหมด
```

### 7.14 Webhooks — `/api/webhooks`

```
POST   /api/webhooks/payment           Payment provider webhook
POST   /api/webhooks/kyc               KYC provider webhook
POST   /api/webhooks/sms               SMS provider webhook
```

### 7.15 Admin — `/api/admin`

```
GET    /api/admin/stats                          System statistics
GET    /api/admin/health                         Health check
POST   /api/admin/trust/recalculate              คำนวณ trust level ทุก user
POST   /api/admin/trust/recalculate/:userId      คำนวณ trust level user เดียว
GET    /api/admin/users                          ดู user list (q, role, status)
GET    /api/admin/users/:id                      ดู user detail
POST   /api/admin/users/:id/status               เปลี่ยน user status
PATCH  /api/admin/users/:id/edit                 แก้ไข user (trust, verify, note)
GET    /api/admin/users/:id/wallet               ดู wallet ของ user
POST   /api/admin/users/:id/ban                  ban user (ban_type, value, reason)
GET    /api/admin/reports/summary                 Reports summary (from, to)
GET    /api/admin/jobs                           ดู job list (q, status, risk, type)
GET    /api/admin/jobs/:id                       ดู job detail
POST   /api/admin/jobs/:id/cancel                ยกเลิก job
GET    /api/admin/ledger/transactions            ดู ledger transactions
GET    /api/admin/disputes                       ดู disputes (q, status, assigned)
GET    /api/admin/disputes/:id                   ดู dispute detail
POST   /api/admin/disputes/:id                   update dispute (status, note)
POST   /api/admin/disputes/:id/settle            settle dispute (refund, payout)
```

---

## 8. Frontend Page Map

> Source: `frontend/src/router.tsx`

### Public (ไม่ต้อง login)

```
/                              LandingPage
/about                         AboutPage
/faq                           FAQPage
/contact                       ContactPage
/showcase                      ComponentShowcase (dev only)
```

### Auth (ไม่ต้อง login)

```
/login                         LoginEntryPage (เลือก email/phone/google)
/login/email                   LoginEmailPage
/login/phone                   LoginPhonePage
/auth/callback                 AuthCallbackPage (Google OAuth callback)
/forgot-password               ForgotPasswordPage
/register                      RegisterTypePage (เลือก guest/member)
/register/guest                GuestRegisterPage (email + password)
/register/member               MemberRegisterPage (phone + password)
/select-role                   RoleSelectionPage (เลือก hirer/caregiver)
/register/consent              ConsentPage (ยอมรับ policy)
```

### Hirer — RequireAuth + RequireRole(hirer) + RequirePolicy

```
/hirer/home                    HirerHomePage
/hirer/search-caregivers       SearchCaregiversPage (+RequireProfile)
/hirer/caregiver/:id           CaregiverPublicProfilePage
/hirer/create-job              CreateJobPage (+RequireProfile)
/hirer/care-recipients         CareRecipientsPage
/hirer/care-recipients/new     CareRecipientFormPage
/hirer/care-recipients/:id/edit CareRecipientFormPage
/hirer/favorites               FavoritesPage
/hirer/wallet                  HirerWalletPage
/hirer/wallet/receipt/:jobId   JobReceiptPage
/hirer/wallet/history          HirerPaymentHistoryPage
```

### Caregiver — RequireAuth + RequireRole(caregiver) + RequirePolicy

```
/caregiver/jobs/feed           CaregiverJobFeedPage
/caregiver/jobs/my-jobs        CaregiverMyJobsPage
/caregiver/jobs/:id/preview    JobPreviewPage
/caregiver/profile             ProfilePage (caregiver-specific)
/caregiver/wallet              CaregiverWalletPage
/caregiver/wallet/earning/:jobId JobEarningDetailPage
/caregiver/wallet/history      EarningsHistoryPage
```

### Shared — RequireAuth

```
/jobs/:id                      JobDetailPage
/jobs/:id/cancel               CancelJobPage
/chat/:jobId                   ChatRoomPage
/dispute/:disputeId            DisputeChatPage
/notifications                 NotificationsPage
/profile                       ProfilePage
/settings                      SettingsPage
/kyc                           KycPage
/wallet/bank-accounts          BankAccountsPage (+RequireRole hirer|caregiver)
```

### Admin — RequireAdmin

```
/admin/login                   AdminLoginPage
/admin/dashboard               AdminDashboardPage
/admin/users                   AdminUsersPage
/admin/jobs                    AdminJobsPage
/admin/financial               AdminFinancialPage (+AdminLayout)
/admin/disputes                AdminDisputesPage
/admin/reports                 AdminReportsPage
/admin/settings                AdminSettingsPage
```

### Fallback

```
/*                             → redirect to /
```

---

## 9. Environment Variables

### Backend (.env)

```env
NODE_ENV=development
PORT=3000
CORS_ORIGIN=*

# Database (docker-compose sets these; DATABASE_URL for local dev)
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=careconnect
DATABASE_USER=careconnect
DATABASE_PASSWORD=careconnect_dev_password

# Auth
JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000

# Providers (mock in dev)
MOCK_PROVIDER_BASE_URL=http://mock-provider:4000
PAYMENT_PROVIDER=mock
SMS_PROVIDER=mock
KYC_PROVIDER=mock
BANK_TRANSFER_PROVIDER=mock
WEBHOOK_BASE_URL=http://backend:3000
WEBHOOK_SECRET=your_webhook_secret

# SMS - SMSOK (production)
SMSOK_API_URL=https://api.smsok.co/s
SMSOK_API_KEY=
SMSOK_API_SECRET=
SMSOK_SENDER=CareConnect

# Email (production)
EMAIL_PROVIDER=mock
EMAIL_FROM=noreply@careconnect.local
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# File Storage
UPLOAD_DIR=/app/uploads
MAX_FILE_SIZE_MB=10

# Admin bootstrap
ADMIN_EMAIL=admin@careconnect.com
ADMIN_PASSWORD=Admin1234!

# Mock seeding (dev only, default: true)
SEED_MOCK_CAREGIVERS=true
SEED_MOCK_JOBS=true
```

### Frontend (.env)

```env
VITE_API_TARGET=http://backend:3000
```

### Mock Provider (Port 4000)

> Source: `mock-provider/` — จำลอง Payment/SMS/KYC providers สำหรับ dev

```env
BACKEND_WEBHOOK_URL=http://backend:3000/api/webhooks
MOCK_PAYMENT_AUTO_SUCCESS=true
MOCK_SMS_OTP_CODE=123456
MOCK_KYC_AUTO_APPROVE=true
```

---

## 10. Key Design Decisions

| Decision                                     | เหตุผล                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| **Two-table job pattern** (job_posts + jobs) | แยก draft/posting จาก instance จริง, รองรับ replacement chain          |
| **Immutable Ledger** (double-entry)          | from_wallet→to_wallet, ป้องกันแก้ไข, idempotency_key ป้องกัน duplicate |
| **Trust Level = derived state**              | คำนวณจาก worker (score 0-100), ไม่ manual set                          |
| **One active assignment per job**            | UNIQUE constraint ระดับ DB ป้องกัน race condition                      |
| **No negative balance**                      | CHECK constraint ระดับ DB ป้องกัน overdraft                            |
| **5 wallet types**                           | hirer, caregiver, escrow (per job), platform, platform_replacement     |
| **JWT + Refresh token**                      | stateless auth, access 15m, refresh 7d                                 |
| **Display name ≠ email/phone**               | privacy — ไม่เปิดเผย PII ให้ user อื่น                                 |
| **Risk-based job classification**            | high_risk ต้อง L2+, low_risk ต้อง L1+                                  |
| **Thread-based chat**                        | 1 thread per job, thread-centric (ไม่ใช่ job-centric)                  |
| **Guest (email) vs Member (phone)**          | รองรับ 2 account types + Google OAuth                                  |
| **Policy consent per role**                  | user ต้องยอมรับ policy ก่อนใช้งานแต่ละ role                            |
| **Geofence + GPS evidence**                  | พิสูจน์การทำงาน ณ สถานที่จริง                                          |
| **Replacement chain (max 3)**                | job_post สามารถ re-post ได้สูงสุด 3 ครั้ง                              |
| **Polling notifications (30s)**              | ง่ายกว่า WebSocket สำหรับ MVP                                          |
| **Auto-complete overdue jobs**               | getCaregiverJobs auto-checkout jobs ที่เลยเวลา                         |
| **Dev auto-topup**                           | publishJob เติมเงินอัตโนมัติ (dev only) ถ้ายอดไม่พอ                    |
| **L3 hysteresis**                            | ลง L2 เมื่อ score < 75 (ไม่ใช่ 80) ป้องกันการสั่นไหว                   |

---

## 11. Middleware Chain & Policy Gate System

> Source: `backend/src/middleware/auth.js`

### Middleware Functions Available

| Middleware                  | คำอธิบาย                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `requireAuth`               | ตรวจ JWT → attach `req.user`, `req.userId`, `req.userRole`, `req.userTrustLevel`, `req.userAccountType` |
| `optionalAuth`              | เหมือน requireAuth แต่ไม่บังคับ (token invalid → `req.user = null`)                                     |
| `requireRole(roles)`        | ตรวจว่า user มี role ที่กำหนด (string หรือ array)                                                       |
| `requireTrustLevel(min)`    | ตรวจ trust level ขั้นต่ำ (L0-L3)                                                                        |
| `requirePolicy(action)`     | ตรวจ action-based permission ผ่าน `can()` function + audit log                                          |
| `requireAccountType(types)` | ตรวจ account type (guest/member)                                                                        |
| `requireVerified`           | ตรวจว่า email หรือ phone verified                                                                       |
| `requireOwnership(param)`   | ตรวจว่า user เป็นเจ้าของ resource (admin bypass)                                                        |

### Typical Route Middleware Chain

```
Public route:      handler
Auth route:        requireAuth → handler
Protected route:   requireAuth → requirePolicy(action) → handler
Role route:        requireAuth → requireRole('admin') → handler
```

### Policy Actions (`can()` function)

```
auth:me, auth:profile:view, auth:profile:update     → L0, any role
auth:phone, auth:email, auth:otp, auth:policy        → L0, any role
auth:role, auth:logout                                → L0, any role

job:stats, job:get                                    → L0, any role
job:create                                            → L0, hirer only
job:publish                                           → L1, hirer only
job:my-jobs                                           → L0, hirer only
job:feed                                              → L0, caregiver only
job:assigned                                          → L1, caregiver only
job:accept, job:checkin, job:checkout                 → L1, caregiver only
job:cancel                                            → L0, hirer or caregiver

wallet:balance, wallet:transactions                   → L0, any role
wallet:topup, wallet:topup:pending, wallet:topup:status → L0, any role
wallet:bank-accounts, wallet:bank-add                 → L0 hirer / L1 caregiver
wallet:withdrawals                                    → L0, any role
wallet:withdraw, wallet:withdraw:cancel               → L2, caregiver only

care-recipient:manage                                 → L0, hirer only
dispute:access                                        → L0, hirer or caregiver
chat:access                                           → L0, hirer or caregiver

admin role → allowed for ALL actions (bypass)
```

### Policy Denial → Audit Log

เมื่อ `can()` return `{ allowed: false }` → INSERT `audit_events` (event_type=`policy_denied`, action, role, trust_level, path)

---

## 12. Socket.IO Real-time Events

> Source: `backend/src/sockets/chatSocket.js`, `backend/src/sockets/realtimeHub.js`

### Authentication

- Token ส่งผ่าน `socket.handshake.auth.token` หรือ `Authorization` header
- Verify JWT → attach `socket.userId`, `socket.userRole`

### Room Structure

- `user:{userId}` — personal room (join on connect) สำหรับ notifications
- `thread:{threadId}` — chat thread room (join on `thread:join`)

### Client → Server Events

| Event          | Payload                                                 | คำอธิบาย                          |
| -------------- | ------------------------------------------------------- | --------------------------------- |
| `thread:join`  | `threadId`                                              | เข้า chat room (ตรวจ access ก่อน) |
| `thread:leave` | `threadId`                                              | ออกจาก chat room                  |
| `message:send` | `{ threadId, type, content, attachment_key, metadata }` | ส่งข้อความ                        |
| `typing:start` | `threadId`                                              | แจ้งว่ากำลังพิมพ์                 |
| `typing:stop`  | `threadId`                                              | หยุดพิมพ์                         |
| `message:read` | `{ threadId, messageId }`                               | mark as read                      |

### Server → Client Events

| Event            | Payload                                   | คำอธิบาย                          |
| ---------------- | ----------------------------------------- | --------------------------------- |
| `thread:joined`  | `{ threadId }`                            | ยืนยันว่าเข้า room แล้ว           |
| `thread:left`    | `{ threadId }`                            | ยืนยันว่าออก room แล้ว            |
| `message:new`    | message object                            | ข้อความใหม่ (broadcast ทั้ง room) |
| `typing:started` | `{ threadId, userId }`                    | user อื่นกำลังพิมพ์               |
| `typing:stopped` | `{ threadId, userId }`                    | user อื่นหยุดพิมพ์                |
| `message:read`   | `{ threadId, messageId, userId, readAt }` | user อื่นอ่านข้อความแล้ว          |
| `error`          | `{ message }`                             | error event                       |

### Realtime Hub (`realtimeHub.js`)

- `emitToUserRoom(userId, event, payload)` — ส่ง event ไปยัง personal room ของ user
- ใช้สำหรับ push notifications, status updates

---

## 13. Error Response Format

> Source: `backend/src/utils/errors.js`

### Standardized Error Classes

| Class                  | HTTP Status | Default Code          |
| ---------------------- | :---------: | --------------------- |
| `ApiError`             |     500     | `SERVER_ERROR`        |
| `ValidationError`      |     400     | `VALIDATION_ERROR`    |
| `NotFoundError`        |     404     | `NOT_FOUND`           |
| `UnauthorizedError`    |     401     | `UNAUTHORIZED`        |
| `ForbiddenError`       |     403     | `FORBIDDEN`           |
| `ConflictError`        |     409     | `DUPLICATE_RESOURCE`  |
| `TooManyRequestsError` |     429     | `RATE_LIMIT_EXCEEDED` |

### Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Missing required field: title",
    "details": {
      "field": "title",
      "section": "job_basic"
    }
  }
}
```

### Error Handler Middleware (`errorHandler`)

- `ApiError` → ใช้ status/code ตรง
- Joi validation error → แปลงเป็น `ValidationError`
- JWT errors → `UnauthorizedError` (INVALID_TOKEN / TOKEN_EXPIRED)
- DB unique violation (23505) → `ConflictError`
- DB integrity error (23xxx) → `ConflictError`
- Unknown → 500 (dev mode แสดง stack trace)

### Key Error Codes

```
UNAUTHORIZED, INVALID_TOKEN, TOKEN_EXPIRED, FORBIDDEN
VALIDATION_ERROR, INVALID_REQUEST_BODY, MISSING_REQUIRED_FIELD
NOT_FOUND, USER_NOT_FOUND, JOB_NOT_FOUND, WALLET_NOT_FOUND
INSUFFICIENT_BALANCE, INVALID_STATUS_TRANSITION, DUPLICATE_RESOURCE
INTERNAL_SERVER_ERROR, DATABASE_ERROR, RATE_LIMIT_EXCEEDED
```

### Job-specific Error Codes

```
JOB_REQUIRED_FIELD, JOB_SCHEDULE_INVALID, JOB_TYPE_INVALID
JOB_FLAGS_INVALID, JOB_TASKS_REQUIRED, JOB_TIME_CONFLICT
JOB_PREFERRED_CAREGIVER_ONLY, CERTIFICATIONS_MISSING
PATIENT_NOT_FOUND, PATIENT_TASK_MISMATCH
HIRER_TRUST_RESTRICTION, INSUFFICIENT_BALANCE
```

---

## 14. Trust Score Calculation

> Source: `backend/src/workers/trustLevelWorker.js`

### Score Weights (base = 50)

| Factor              |  Points  |   Cap    |
| ------------------- | :------: | :------: |
| Completed job       | +5 each  | max +30  |
| Good review (4-5★)  | +3 each  | max +20  |
| Average review (3★) | +1 each  |    —     |
| Bad review (1-2★)   | -5 each  | max -20  |
| Cancellation        | -10 each | max -30  |
| GPS violation       | -3 each  | max -15  |
| On-time check-in    | +2 each  | max +20  |
| Profile complete    |   +10    | one-time |

**Formula**: `score = clamp(0, 100, 50 + all_factors)`

### Trust Level Determination

```
L0: default (no verification)
L1: phone_verified = true
L2: phone_verified + KYC approved
L3: phone_verified + KYC approved + bank_verified + score ≥ 80
    (hysteresis: ลงจาก L3 เมื่อ score < 75)
```

Note: `email_verified` alone ไม่เพียงพอสำหรับ L1 — ต้อง phone_verified

### Triggers

- **Auto**: หลัง checkout สำเร็จ (`triggerUserTrustUpdate(caregiverId, 'job_completed')`)
- **Manual**: Admin POST `/api/admin/trust/recalculate/:userId`
- **Batch**: Admin POST `/api/admin/trust/recalculate` (ทุก caregiver)
- **Script**: `node trustLevelWorker.js` (run as standalone)

---

## 15. Risk Level Auto-compute

> Source: `backend/src/utils/risk.js`

### Criteria

```
high_risk IF:
  - job_type ∈ {emergency, post_surgery, dementia_care, medical_monitoring}
  - OR patient has: feeding_tube, tracheostomy, urinary_catheter, oxygen
  - OR patient mobility: bedbound
  - OR patient cognitive: severe_dementia
  - OR tasks include: tube_feeding, catheter_care, oxygen_monitoring, wound_dressing

low_risk: everything else
```

### Auto-set on Job Creation

- `risk_level` → computed from job_type + patient_profile + tasks
- `min_trust_level` → `high_risk` = L2, `low_risk` = L1
- `risk_reason_codes[]` → array of reason codes
- `risk_reason_detail` → human-readable explanation

### Publish Restriction (in `publishJob`)

- `low_risk` → hirer ต้อง L1+
- `high_risk` → hirer ต้อง L2+

### Accept Restriction (in `acceptJob`)

- ตรวจ caregiver trust_level ≥ job.min_trust_level
- ตรวจ required_certifications (ถ้า hirer กำหนด)
- ตรวจ schedule conflict กับงานอื่น

### Job Type Options (6 types)

```
companionship, personal_care, medical_monitoring,
dementia_care, post_surgery, emergency
```

### Task Options (22 types)

```
companionship, hospital_companion, hospital_registration_support,
hospital_transport_coordination, medication_pickup, meal_prep,
light_housekeeping, mobility_assist, transfer_assist, bathing,
dressing, toileting, diaper_change, feeding, tube_feeding,
medication_reminder, medication_administration, vitals_check,
blood_sugar_check, wound_dressing, catheter_care, oxygen_monitoring,
dementia_supervision
```

### Required Skills Options (9 types)

```
basic_first_aid, dementia_care, post_surgery_care, safe_transfer,
wound_care, catheter_care, tube_feeding_care, vitals_monitoring,
medication_management
```
