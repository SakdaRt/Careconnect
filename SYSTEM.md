# CareConnect — System Documentation

> Source of truth สำหรับ architecture, database, API, UML ทั้งหมด
> อัพเดทล่าสุด: 2026-04-06

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
              │  34 tables       │              │  Port 4000            │
              └───────────────────┘              └───────────────────────┘
```

Dev mock seed data ถูกแยกออกจาก `server.js` ไปที่ `backend/src/seeds/mockData.js` และถูกเรียกใช้ตอน bootstrap เท่านั้น

### Roles & Account Types

| Role          | Account Type                      | คำอธิบาย                                  |
| ------------- | --------------------------------- | ----------------------------------------- |
| **Hirer**     | guest (email) หรือ member (phone) | สร้างงาน, ว่าจ้าง, จ่ายเงิน               |
| **Caregiver** | guest (email) หรือ member (phone) | รับงาน, check-in/out, รับเงิน             |
| **Admin**     | —                                 | จัดการ user, approve KYC, resolve dispute |

---

## 2. Trust Level System

```
L0 (เริ่มต้น)  ← ลงทะเบียน ยังไม่ยืนยันอะไร
    │
    ▼  ยืนยัน Email OTP หรือ Phone OTP (อย่างน้อย 1 ช่องทาง)
L1 (ยืนยันการติดต่อ)
    │
    ▼  ยืนยัน KYC (บัตรประชาชน/passport + selfie)
L2 (ยืนยันตัวตน)
    │
    ▼  ยืนยันบัญชีธนาคาร + Trust Score ≥ 80
L3 (มืออาชีพ)
```

> Trust level เป็นค่ากลาง (role-neutral) ใช้ได้ทั้ง hirer และ caregiver
>
> `caregiver_documents` (ใบรับรอง/ใบประกอบวิชาชีพ) **ไม่ผูกกับ trust level**
> แต่ใช้เป็นเงื่อนไขแยกสำหรับ caregiver job eligibility:
> - งาน high_risk ต้องอัปโหลดเอกสารอย่างน้อย 1 รายการ (ตรวจตอน accept job)
> - hirer สามารถกำหนด required_certifications เพิ่มเติมต่องานได้

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

### Direct Assignment Path (CreateJobPage Step 4)

เมื่อ hirer เลือก caregiver ในขั้นตอนสร้างงาน:
1. `POST /api/jobs` — สร้าง draft พร้อม `preferred_caregiver_id` (backend รับค่าจาก request body)
2. `POST /api/jobs/:id/publish` — auto-publish ทันที (frontend เรียกต่อเนื่อง)
3. job_post.status = `posted` + `preferred_caregiver_id` set → caregiver เห็นเฉพาะ job นี้เท่านั้น
4. caregiver กด accept → flow ปกติ (assigned → in_progress → completed)

> ก่อนหน้านี้ backend hardcode `preferred_caregiver_id = null` ใน `createJob` → แก้แล้ว (2026-03-31)

---

## 4. Payment Flow (Double-entry Ledger)

> Source: `backend/src/services/jobService.js`
> Updated: 2026-03-19 — Financial MVP (fee deducted from wage + hirer deposit)

### Fee Model

- Platform fee = `Math.floor(total_amount * 0.10)` — **หักจากค่าจ้าง**
- Hirer จ่าย `total_amount` ตามราคาที่ตั้ง (ไม่บวก fee เพิ่ม)
- Caregiver ได้รับ `total_amount - platform_fee_amount`
- Fee รับรู้เมื่อ job completed เท่านั้น

### Hirer Deposit (Tiered)

| total_amount | Deposit |
|-------------|---------|
| ≤ 500 | 100 |
| 501–2,000 | 200 |
| 2,001–5,000 | 500 |
| 5,001–10,000 | 1,000 |
| > 10,000 | 2,000 |

Hardcoded ใน `backend/src/utils/depositTier.js` — MVP: hirer only, caregiver deposit = 0

### 5 Phases:

```
Phase 1: Top-up
  Hirer ── POST /wallet/topup ──► topup_intent (pending)
  accepted payment_method = payment_link | dynamic_qr | stripe(alias)
  backend normalize stripe -> payment_link ก่อน persist
  PAYMENT_PROVIDER=mock ──► /api/webhooks/payment หรือ /wallet/topup/:id/confirm ──► topup_intent (succeeded)
  PAYMENT_PROVIDER=stripe ──► /api/webhooks/stripe ──► topup_intent (succeeded)
  → credit hirer wallet.available_balance
  → INSERT ledger (type=credit, ref=topup)

Phase 2: Publish (Hold job payment + deposit)
  Hirer ── POST /jobs/:id/publish ──►
  → cost = total_amount + hirer_deposit_amount
  → hirer wallet: available -= cost, held += cost
  → INSERT ledger: hold/job (total_amount) + hold/deposit (hirer_deposit)
  Note: Dev mode auto-tops up if insufficient

Phase 3: Accept (Escrow creation + deposit record)
  Caregiver ── POST /jobs/:id/accept ──►
  → hirer held -= cost → escrow held += cost
  → CREATE escrow wallet (held = total_amount + hirer_deposit)
  → INSERT ledger: hold/job + hold/deposit (hirer→escrow)
  → INSERT job_deposits (party=hirer, status=held)
  → CREATE jobs + job_assignments + chat_thread

Phase 4: Checkout (Settlement — fee deducted from wage)
  Caregiver ── POST /jobs/:jobId/checkout ──►
  → escrow → caregiver: total_amount - platform_fee (release/job)
  → escrow → platform: platform_fee (debit/fee)
  → escrow → hirer: hirer_deposit (release/deposit)
  → UPDATE job_deposits → released
  → UPDATE jobs: final_caregiver_payout, final_platform_fee, settlement_mode='normal'
  → Trust score recalculation (fire-and-forget)

Cancel (5 sub-cases):
  B: Before accept → unhold J+DH from hirer wallet
  C: After accept ≥24h → refund J + release DH from escrow
  D: After accept <24h (late cancel) →
     refund J + forfeit 50% DH (70% CG compensation, 30% platform penalty revenue)
  E: CG cancel → hold in escrow, fault_party='unresolved', admin settle
  F: CG no-show (auto) → status='assigned' + grace period 30min passed →
     cancellation_reason='caregiver_no_show', fault_party='caregiver', full refund to hirer
     trigger: getHirerJobs/getCaregiverJobs (view-trigger) + noShowWorker cron (*/5 min)

Admin Settlement:
  POST /api/admin/jobs/:id/settle
  → admin specifies refund/payout/fee/penalty/deposit/compensation amounts
  → validation: total ≤ escrow, prevent double-settle
  → INSERT ledger entries + UPDATE job_deposits + audit_events
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

> Source: `database/schema.sql` (1470 lines, 41 tables)

### 5.1 Users & Profiles

```
┌─────────────────────────────────────────────────┐
│ users                                           │
├─────────────────────────────────────────────────┤
│ id UUID PK                                      │
│ email VARCHAR(255) UNIQUE (nullable)            │
│ phone_number VARCHAR(20) UNIQUE (nullable)      │
│ password_hash VARCHAR(255)                      │
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
│ admin_note TEXT                                 │
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
│ postal_  │ │ specializations[]    │
│  code    │ │ available_from/to    │
│ lat, lng │ │ available_days[]     │
│ total_   │ │ is_public_profile    │
│  jobs_*  │ │ average_rating       │
└──────────┘ │ total_reviews        │
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
│ evidence_note TEXT (nullable)                   │
│ evidence_photo_url TEXT (nullable)              │
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

- `notification_preferences`
  - `user_id` (PK + FK → users)
  - `email_enabled BOOLEAN`, `push_enabled BOOLEAN`
  - `created_at`, `updated_at`
- `push_subscriptions`
  - `id UUID PK`
  - `user_id FK → users`, `endpoint` (UNIQUE)
  - `p256dh_key`, `auth_key`, `created_at`, `updated_at`
- `otp_codes` (OTP verification — persistent storage)
  - `id UUID PK`
  - `user_id FK → users`, `type` (email|phone), `destination`
  - `code_hash VARCHAR(255)` (SHA-256 hashed)
  - `verified BOOLEAN`, `attempts INT` (brute-force protection, max 5)
  - `sent_at`, `expires_at` (5 min TTL)
- `early_checkout_requests` (caregiver ขอ checkout ก่อนเวลา → hirer approve/reject)
  - `id UUID PK`, `job_id`, `job_post_id`, `caregiver_id`, `hirer_id`, `evidence_note`, `status`, `rejected_reason`, `responded_at`
- `password_reset_tokens` (forgot password flow)
  - `id UUID PK`, `user_id FK → users`, `token_hash`, `expires_at`, `used_at`
- `payments` (payment records for UI display)
  - `id UUID PK`, `payer_user_id`, `payee_user_id`
  - `job_id`, `amount`, `fee_amount`, `status` (payment_status ENUM), `payment_method`
- `complaints` (general complaint/report system, ไม่ผูก job)
  - `id UUID PK`, `reporter_id FK → users`
  - `category` (inappropriate_name, scam_fraud, harassment, safety_concern, payment_issue, etc.)
  - `target_user_id FK → users` (nullable), `related_job_post_id FK → job_posts` (nullable)
  - `subject`, `description`, `status` (complaint_status ENUM: open|in_review|resolved|dismissed)
  - `assigned_admin_id`, `admin_note`, `resolved_at`
- `complaint_attachments`
  - `id UUID PK`, `complaint_id FK → complaints`
  - `file_path`, `file_name`, `file_size`, `mime_type`

> **Note**: `google_id` column บน `users` table อยู่ใน `schema.sql` แล้ว + มี runtime fallback ใน `authController.js` (`ALTER TABLE ADD COLUMN IF NOT EXISTS`)
>
> **Note**: `otp_codes` / `early_checkout_requests` มี runtime fallback (`CREATE TABLE IF NOT EXISTS`) ใน `otpService.js` / `jobController.js` ด้วย

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
 │─ อัปโหลดรูปหลักฐาน►│                          │                       │
 │                    │─ POST /jobs/:id/checkout-photo►                  │
 │                    │  (multipart: file)        │─ save /uploads/jobs/ ►│
 │                    │◄── { photo_url } ─────────│                       │
 │                    │                          │                       │
 │─ Check-out ───────►│                          │                       │
 │  (GPS + note +     │─ POST /jobs/:jobId/checkout►                     │
 │   photo_url)       │                          │─ INSERT gps_event ───►│
 │                    │                          │─ UPDATE job status ──►│
 │                    │                          │  + evidence_note/url  │
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

### 6.8 Top-up Flow (Provider-aware)

```
Hirer             Frontend                   Backend                Payment Provider
 │                    │                          │                        │
 │─ เติมเงิน ────────►│                          │                        │
 │                    │─ POST /wallet/topup ────►│                        │
 │                    │                          │ normalize method       │
 │                    │                          │ (stripe->payment_link) │
 │                    │                          │─ create intent / start payment ─►│
 │                    │◄── payment_url / qr_code │                        │
 │─ เปิดหน้าชำระเงิน ────────────────────────────────────────────────►│
 │                    │                          │◄── webhook (provider) ─│
 │─ หรือกดยืนยัน top-up ─►│─ POST /wallet/topup/:id/confirm ───────────►│
 │                    │                          │─ UPDATE intent=succeeded►│
 │                    │                          │─ credit wallet ───────►│
 │                    │                          │─ INSERT ledger ───────►│
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
POST   /api/auth/refresh               Refresh JWT token (body: { refreshToken })
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
POST   /api/jobs/:jobId/checkout-photo อัปโหลดรูปภาพหลักฐาน (multipart: file, 10MB, jpeg/png/webp/heic)
POST   /api/jobs/:jobId/checkout       Check-out (GPS + evidence_note + evidence_photo_url — บังคับแนบรูป)
POST   /api/jobs/:jobId/early-checkout-request   ขอส่งงานก่อนเวลา (evidence_note, ไม่บังคับรูป)
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
POST   /api/wallet/topup                                เติมเงิน (amount, payment_method=payment_link|dynamic_qr|stripe(alias))
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
POST   /api/chat/threads/:threadId/messages       ส่งข้อความ (type, content, attachment_key?)
POST   /api/chat/threads/:threadId/upload         อัปโหลดรูปภาพ (multipart, 5MB, jpeg/png/webp/gif)
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
POST   /api/disputes/:id/messages          ส่งข้อความใน dispute (content?, attachment_key?, type?)
POST   /api/disputes/:id/upload            อัปโหลดรูปภาพ (multipart, 5MB, jpeg/png/webp/gif)
POST   /api/disputes/:id/request-close     ขอปิดข้อพิพาท
```

### 7.13 Notifications — `/api/notifications`

```
GET    /api/notifications              ดู notifications (paginated)
GET    /api/notifications/unread-count นับ unread
PATCH  /api/notifications/:id/read     mark as read
PATCH  /api/notifications/read-all     mark all as read
DELETE /api/notifications              ลบ notifications ทั้งหมด
GET    /api/notifications/preferences  ดู notification preferences
PUT    /api/notifications/preferences  แก้ notification preferences
POST   /api/notifications/push-subscriptions    บันทึก push subscription
DELETE /api/notifications/push-subscriptions    ลบ push subscription
```

### 7.14 Complaints — `/api/complaints`

```
POST   /api/complaints                       สร้างเรื่องร้องเรียน (multipart, max 5 attachments)
GET    /api/complaints                       ดูเรื่องร้องเรียนของตัวเอง
GET    /api/complaints/:id                   ดูรายละเอียดเรื่องร้องเรียน
GET    /api/complaints/admin/list            Admin: ดูเรื่องร้องเรียนทั้งหมด (status, category, page)
POST   /api/complaints/admin/:id             Admin: อัพเดทเรื่องร้องเรียน (status, admin_note, assign_to_me)
```

### 7.15 Webhooks — `/api/webhooks`

```
POST   /api/webhooks/payment           Payment provider webhook
POST   /api/webhooks/kyc               KYC provider webhook
POST   /api/webhooks/sms               SMS provider webhook
POST   /api/webhooks/stripe            Stripe webhook (raw body + signature)
```

### 7.16 Admin — `/api/admin`

```
GET    /api/admin/stats                          System statistics
GET    /api/admin/health                         Health check
POST   /api/admin/trust/recalculate              คำนวณ trust level ทุก user
POST   /api/admin/trust/recalculate/:userId      คำนวณ trust level user เดียว
GET    /api/admin/users                          ดู user list (q, role, status, reg_type)
GET    /api/admin/users/:id                      ดู user detail
POST   /api/admin/users/:id/status               เปลี่ยน user status
PATCH  /api/admin/users/:id/edit                 แก้ไข user (trust, verify, note)
GET    /api/admin/users/:id/wallet               ดู wallet ของ user
POST   /api/admin/users/:id/ban                  ban user (ban_type, value, reason)
GET    /api/admin/reports/summary                 Reports summary (from, to)
GET    /api/admin/jobs                           ดู job list (q, status, risk, type)
GET    /api/admin/jobs/no-show                   ดู no-show jobs (settlement_mode, from, to)
GET    /api/admin/jobs/no-show/stats             stats: total, admin_override, total_refunded, unrefunded_estimate
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
```

> `LandingPage` เป็น public landing page ไม่ใช่ dashboard ของ role ใดโดยตรง
> เมื่อ user login แล้ว CTA `เข้าหน้าหลัก (...)` จะ resolve ตาม role จริงจาก `user.role`/`activeRole`: `admin -> /admin/dashboard`, `caregiver -> /caregiver/jobs/feed`, `hirer -> /hirer/home`; ถ้ายังไม่มี role ที่ resolve ได้จะพาไป `/select-role`

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
/reset-password                ResetPasswordPage
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
/caregiver/availability        AvailabilityCalendarPage
/caregiver/wallet              CaregiverWalletPage
/caregiver/wallet/earning/:jobId JobEarningDetailPage
/caregiver/wallet/history      EarningsHistoryPage
```

### Shared — RequireAuth

```
/jobs/:id                      JobDetailPage
/jobs/:id/cancel               CancelJobRedirect (redirect → /jobs/:id)
/chat/:jobId                   ChatRoomPage
/dispute/:disputeId            DisputeChatPage
/notifications                 NotificationsPage
/profile                       ProfilePage
/complaint                     ComplaintFormPage
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

### Backend (`.env` for dev, `.env.production` for deploy)

> Source of truth templates: `/home/careconnect/Careconnect/.env.example` และ `/home/careconnect/Careconnect/.env.production.example`
> Loader: `backend/src/config/loadEnv.js` โหลด root `.env` และ `backend/.env` ก่อน แล้วค่อย overlay optional `.env.<NODE_ENV>` / `backend/.env.<NODE_ENV>` โดยไม่ override env ที่ inject จากภายนอก
> Validation: `backend/src/server.js` ใช้ Joi validate env ตอน startup; dev/test จะเติม default ที่ปลอดภัยสำหรับ local พร้อม `console.warn` และ fallback provider เป็น `mock`, ส่วน production จะ fail-fast ถ้าขาดค่า required
> Docker note: ใน `docker-compose.yml` / `docker-compose.prod.yml` ค่า env ถูก inject เข้า container โดยตรง ดังนั้น root `.env` ถูกอ่านโดย Docker Compose ฝั่ง host เป็นหลัก ไม่ใช่จาก path ใน container

```env
NODE_ENV=development
TZ=Asia/Bangkok
PORT=3000
CORS_ORIGIN=http://localhost:5173

DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=careconnect
DATABASE_USER=careconnect
DATABASE_PASSWORD=careconnect_dev_password

JWT_SECRET=careconnect_jwt_secret_dev_only
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d
WEBHOOK_SECRET=careconnect_webhook_secret_dev

FRONTEND_URL=http://localhost:5173
BACKEND_URL=http://localhost:3000

MOCK_PROVIDER_BASE_URL=http://localhost:4000
WEBHOOK_BASE_URL=http://localhost:3000
BACKEND_WEBHOOK_URL=http://localhost:3000/api/webhooks
MOCK_PAYMENT_CALLBACK_URL=http://localhost:3000/api/webhooks/payment

PAYMENT_PROVIDER=mock
SMS_PROVIDER=mock
EMAIL_PROVIDER=mock
EMAIL_FROM=noreply@careconnect.local
PUSH_PROVIDER=mock
KYC_PROVIDER=mock
BANK_TRANSFER_PROVIDER=mock

STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_ACCOUNT_ID=

SMSOK_API_URL=https://api.smsok.co/s
SMSOK_API_KEY=
SMSOK_API_SECRET=
SMSOK_SENDER=CareConnect

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10

ADMIN_EMAIL=admin@careconnect.com
ADMIN_PASSWORD=Admin1234!

SEED_MOCK_CAREGIVERS=true
SEED_MOCK_JOBS=true
```

### Frontend (`VITE_*`)

> Local non-Docker: `frontend/vite.config.ts` merge env จาก root `.env` และ `frontend/.env.local`
> Docker development: `docker-compose.yml` inject `VITE_*` เข้า frontend container โดยตรง
> Docker production: `docker-compose.prod.yml` ส่ง `VITE_*` เข้า `frontend/Dockerfile` ผ่าน build args ก่อน `npm run build`

```env
VITE_API_TARGET=http://localhost:3000
VITE_API_URL=
VITE_API_BASE_URL=
VITE_SOCKET_URL=
VITE_GOOGLE_MAPS_API_KEY=
VITE_VAPID_PUBLIC_KEY=
VITE_DEV_PORT=5173
VITE_PUBLIC_HOST=
VITE_PUBLIC_PROTOCOL=
VITE_PUBLIC_PORT=
VITE_PUBLIC_HMR_PORT=
VITE_USE_POLLING=false
VITE_POLL_INTERVAL=300
```

### Playwright E2E (`docker-compose.test.yml` profile `e2e`)

> Service `frontend-e2e` ใช้ image `mcr.microsoft.com/playwright:v1.58.2-jammy`
> รัน smoke specs เท่านั้น (Google OAuth manual verification แยกนอก automation)

```env
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4173
VITE_API_TARGET=http://host.docker.internal:3000
```

### Mock Provider (Port 4000)

> Source: `mock-provider/` — จำลอง Payment/SMS/KYC providers สำหรับ dev

```env
BACKEND_WEBHOOK_URL=http://backend:3000/api/webhooks
MOCK_PAYMENT_CALLBACK_URL=http://backend:3000/api/webhooks/payment
MOCK_PAYMENT_AUTO_SUCCESS=true
MOCK_SMS_OTP_CODE=123456
MOCK_EMAIL_OTP_CODE=123456
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
| **JWT + Refresh token**                      | stateless auth, access 7d, refresh 30d                                 |
| **Display name ≠ email/phone**               | privacy — ไม่เปิดเผย PII ให้ user อื่น                                 |
| **Risk-based job classification**            | high_risk ต้อง L2+, low_risk ต้อง L1+                                  |
| **Thread-based chat**                        | 1 thread per job, thread-centric (ไม่ใช่ job-centric)                  |
| **Guest (email) vs Member (phone)**          | รองรับ 2 account types + Google OAuth                                  |
| **Policy consent per role**                  | user ต้องยอมรับ policy ก่อนใช้งานแต่ละ role                            |
| **Geofence + GPS evidence**                  | พิสูจน์การทำงาน ณ สถานที่จริง                                          |
| **Replacement chain (max 3)**                | job_post สามารถ re-post ได้สูงสุด 3 ครั้ง                              |
| **Polling notifications (15s)**              | ง่ายกว่า WebSocket สำหรับ MVP                                          |
| **Auto-complete overdue jobs**               | getCaregiverJobs auto-checkout jobs ที่เลยเวลา                         |
| **Dev auto-topup**                           | publishJob เติมเงินอัตโนมัติ (dev only) ถ้ายอดไม่พอ                    |
| **L3 hysteresis**                            | ลง L2 เมื่อ score < 75 (ไม่ใช่ 80) ป้องกันการสั่นไหว                   |

---

## 11. Middleware Chain & Policy Gate System

> Source: `backend/src/middleware/auth.js`

### Middleware Functions Available

| Middleware                  | คำอธิบาย                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `requireAuth`               | ตรวจ JWT → attach req.user fields; ถ้า `ban_login=true` → 403 `BAN_LOGIN` ทันที |
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

### Notification Events (via `notification:new` / `notification:push`)

> Source: `backend/src/services/notificationService.js`
> Template keys ที่ใช้ใน `notifications.template_key`:

| templateKey | Trigger | ผู้รับ |
|---|---|---|
| `job_accepted` | CG รับงาน | Hirer |
| `job_started` | CG check-in | Hirer |
| `job_completed` | CG check-out | Hirer |
| `job_assigned` | Hirer assign ตรง | Caregiver |
| `job_cancelled` | ยกเลิกงาน / no-show / score-ban | ฝั่งตรงข้าม หรือ ทั้งคู่ |
| `job_settled` | Admin settle job | Hirer + Caregiver |
| `early_checkout_request` | CG ขอส่งงานก่อนเวลา | Hirer |
| `early_checkout_approved` | Hirer อนุมัติ | Caregiver |
| `early_checkout_rejected` | Hirer ปฏิเสธ | Caregiver |
| `chat_message` | ข้อความแชทใหม่ | Recipient |
| `topup_success` | เติมเงินสำเร็จ | User เจ้าของ wallet |
| `topup_failed` | เติมเงินล้มเหลว | User เจ้าของ wallet |
| `withdrawal_review` | Withdrawal อยู่ระหว่างตรวจสอบ | User เจ้าของ |
| `withdrawal_approved` | Withdrawal อนุมัติ | User เจ้าของ |
| `withdrawal_rejected` | Withdrawal ถูกปฏิเสธ | User เจ้าของ |
| `withdrawal_paid` | โอนเงินสำเร็จ | User เจ้าของ |
| `dispute_settled` | Admin settle dispute | Hirer + Caregiver |
| `account_banned` | Admin ban/suspend account | User ที่ถูกกระทำ |
| `review_received` | มีรีวิวใหม่ | Caregiver |
| `complaint_updated` | Admin เปลี่ยนสถานะ complaint | Reporter |

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

| Factor              |  Points  | Cap |
| ------------------- | :------: | :-: |
| Completed job       | +5 each  |  —  |
| Good review (4-5★)  | +3 each  |  —  |
| Average review (3★) | +1 each  |  —  |
| Bad review (1-2★)   | -5 each  |  —  |
| Cancellation        | -10 each |  —  |
| No-show             | -20 each |  —  |
| GPS violation       | -3 each  |  —  |
| On-time check-in    | +2 each  |  —  |
| Profile complete    |   +10    |  —  |

ไม่มี individual cap ต่อปัจจัย — ทำดีมากก็ได้คะแนนสูง ทำแย่มากก็หักมาก

**Formula**: `score = clamp(0, 100, 50 + all_factors)`

### Trust Level Determination

```
L0: default (no verification)
L1: phone_verified OR email_verified
L2: phone_verified + KYC approved
L3: phone_verified + KYC approved + bank_verified + score ≥ 80
    (hysteresis: ลงจาก L3 เมื่อ score < 75)
```

Note: L1 ต้องการ `phoneVerified || emailVerified` — L2+ ต้อง `phoneVerified` ร่วมด้วยเสมอ

Note: `RESPONSE_TIME_BONUS` (+5) ถูกประกาศใน SCORE_WEIGHTS แต่ยังไม่ถูก implement จริง (always = 0)

Note: **No-show vs Cancellation ไม่ double-count** — cancellation query กรอง `cancellation_reason != 'caregiver_no_show'` ออก

### Score Enforcement (real-time หลัง recalculate)

| Score | ผลทันที |
|-------|---------|
| score < 40 (crossing จาก ≥ 40) | auto-cancel assigned jobs ที่เป็น `high_risk` → re-post |
| score = 0 (crossing จาก > 0) | `ban_login = true` + cancel assigned jobs ทั้งหมด → re-post |
| `in_progress` jobs | ไม่แตะ — ทำต่อจนจบ |

`requireAuth` enforce `ban_login` → 403 `BAN_LOGIN` ทุก request

### Triggers

- **Auto**: หลัง checkout สำเร็จ (`triggerUserTrustUpdate(caregiverId, 'job_completed')`)
- **Auto**: หลัง no-show auto-cancel (`triggerUserTrustUpdate(caregiverId)` ใน `_cancelNoShowJob`)
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
  - OR patient devices: ventilator, tracheostomy, oxygen, feeding_tube
  - OR patient symptoms: shortness_of_breath, chest_pain, seizure,
      altered_consciousness, uncontrolled_bleeding, high_fever
  - OR patient needs: tube_feeding, medication_administration
  - OR patient behavior: aggression
  - OR patient cognitive: delirium
  - OR patient behavior: wandering + (fall_risk | dementia | delirium)
  - OR tasks include: tube_feeding, medication_administration,
      wound_dressing, catheter_care, oxygen_monitoring, dementia_supervision

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

### Task Options (23 types)

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
