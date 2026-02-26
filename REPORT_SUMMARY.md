# CareConnect — สรุประบบสำหรับรายงาน

> จัดทำ: 2026-02-26 | อ้างอิงจาก SYSTEM.md + codebase จริง

---

## 1. ภาพรวมระบบ (System Overview)

**CareConnect** คือแพลตฟอร์มออนไลน์แบบ Two-sided Marketplace สำหรับเชื่อมต่อผู้ว่าจ้าง (Hirer) กับผู้ดูแลผู้สูงอายุ (Caregiver) ในประเทศไทย พัฒนาเป็น Web Application รองรับการใช้งานบนคอมพิวเตอร์และมือถือ

### เป้าหมายของระบบ
- ให้ผู้ว่าจ้างสามารถสร้างและเผยแพร่ประกาศงานดูแลผู้สูงอายุได้
- ให้ผู้ดูแลสามารถค้นหา รับงาน และบันทึกการทำงานได้
- มีระบบชำระเงินผ่าน Escrow (พักเงินระหว่างงาน) ป้องกันความเสี่ยงทั้งสองฝ่าย
- มีระบบยืนยันตัวตนและประเมินความน่าเชื่อถือ (Trust Level)

---

## 2. เทคโนโลยีที่ใช้ (Technology Stack)

### 2.1 Frontend (ฝั่งผู้ใช้งาน)

| เทคโนโลยี | เวอร์ชัน | หน้าที่ |
|-----------|---------|---------|
| **React** | 18 | UI Framework หลัก (Component-based) |
| **TypeScript** | 5+ | Type-safe JavaScript ลด bug |
| **Vite** | 5+ | Build tool + Dev server (เร็วกว่า webpack) |
| **Tailwind CSS** | 3 | Utility-first CSS framework สำหรับ styling |
| **React Router** | 6 | Client-side routing (SPA) |
| **Axios** | 1+ | HTTP client เรียก REST API |
| **Socket.IO Client** | 4 | Real-time chat + notification |
| **react-hot-toast** | — | Toast notification |
| **Lucide React** | — | Icon library |
| **shadcn/ui** | — | UI components (Modal, Card, Badge, Button) |

### 2.2 Backend (ฝั่ง Server)

| เทคโนโลยี | เวอร์ชัน | หน้าที่ |
|-----------|---------|---------|
| **Node.js** | 20 LTS | JavaScript runtime |
| **Express.js** | 4 | HTTP server + REST API routing |
| **Socket.IO** | 4 | Real-time bidirectional communication (chat) |
| **PostgreSQL** | 15 | Relational database หลัก (25+ tables) |
| **node-postgres (pg)** | — | PostgreSQL client |
| **JWT (jsonwebtoken)** | — | Authentication token (access 15min, refresh 7d) |
| **bcrypt** | — | Password hashing |
| **Joi** | — | Request validation (body/query/params) |
| **Multer** | — | File upload (KYC เอกสาร, avatar) |
| **ESM** | — | ES Modules (`import/export`) |

### 2.3 Infrastructure & DevOps

| เทคโนโลยี | หน้าที่ |
|-----------|---------|
| **Docker** | Container platform |
| **Docker Compose** | Multi-container orchestration (dev/prod) |
| **Nginx** (prod) | Reverse proxy + SSL termination |
| **Mock Provider** | จำลอง Payment/SMS/KYC providers สำหรับ dev |

### 2.4 Architecture Diagram

```
┌────────────────────────────────────────────────────────┐
│                   Web Browser (Client)                  │
│           React 18 + TypeScript + Tailwind CSS          │
└──────────────────┬─────────────────┬───────────────────┘
                   │ HTTPS/REST API  │ WSS (WebSocket)
                   ▼                 ▼
┌─────────────────────────────────────────────────────────┐
│              Backend Container (Node.js)                 │
│     Express.js + Socket.IO + JWT Auth + Joi Validation  │
│                      Port 3000                          │
└──────────────┬──────────────────────┬───────────────────┘
               │ SQL queries          │ Webhook calls
               ▼                      ▼
┌──────────────────────┐  ┌──────────────────────────────┐
│   PostgreSQL 15      │  │   Mock Provider              │
│   Port 5432          │  │   Payment / SMS / KYC        │
│   25+ tables         │  │   Port 4000                  │
└──────────────────────┘  └──────────────────────────────┘
```

---

## 3. ความสามารถของผู้ใช้แต่ละฝ่าย (User Capabilities)

### 3.1 ผู้ว่าจ้าง (Hirer)

| หมวด | ความสามารถ | Trust Level ที่ต้องการ |
|------|-----------|----------------------|
| **บัญชีผู้ใช้** | สมัครสมาชิก (email/phone/Google) | L0 |
| | ตั้งชื่อ-นามสกุล, แก้ไขโปรไฟล์ | L0 |
| | เปลี่ยนรหัสผ่าน, ลืมรหัสผ่าน | L0 |
| | ยืนยันตัวตน KYC (บัตรประชาชน + selfie) | L0 (เพื่อขึ้น L2) |
| **งาน** | สร้างงาน draft (กำหนดวัน/เวลา/สถานที่/งาน) | L0 |
| | เผยแพร่งาน low_risk (ประกาศสาธารณะ) | L1 |
| | เผยแพร่งาน high_risk | L2 |
| | มอบหมายงานตรงให้ผู้ดูแลที่เลือก | L0 |
| | ยกเลิกงาน (พร้อมระบุเหตุผล) | L0 |
| | ดูรายการงานทั้งหมด (กรองตามสถานะ) | L0 |
| | ดูตารางงาน (calendar view) | L0 |
| | ดูรายละเอียดงาน | L0 |
| | ตอบรับ/ปฏิเสธคำขอส่งงานก่อนกำหนด | L0 |
| **ผู้รับการดูแล** | เพิ่ม/แก้ไข/ลบผู้รับการดูแล | L0 |
| | บันทึกข้อมูลสุขภาพ, ยา, อุปกรณ์การแพทย์ | L0 |
| **ค้นหาผู้ดูแล** | ค้นหาผู้ดูแลด้วย keyword/ทักษะ/วันที่ว่าง | L0 |
| | ดูโปรไฟล์ผู้ดูแล (rating, ใบรับรอง) | L0 |
| | บันทึก Favorite ผู้ดูแล | L0 |
| | รีวิวผู้ดูแลหลังงานเสร็จ | L0 |
| **กระเป๋าเงิน** | ดูยอดเงิน + ประวัติ transaction | L0 |
| | เติมเงิน (QR Payment) | L0 |
| | เพิ่มบัญชีธนาคาร | L0 |
| **การสื่อสาร** | แชทกับผู้ดูแล (real-time) | L0 |
| | เปิดข้อพิพาท (dispute) | L0 |
| | รับ notification (job accepted, check-in, check-out) | L0 |

### 3.2 ผู้ดูแล (Caregiver)

| หมวด | ความสามารถ | Trust Level ที่ต้องการ |
|------|-----------|----------------------|
| **บัญชีผู้ใช้** | สมัครสมาชิก, แก้ไขโปรไฟล์ | L0 |
| | ตั้งค่าทักษะ, ใบรับรอง, วันที่ว่างงาน | L0 |
| | อัพโหลดเอกสารประกอบ (ใบรับรอง, ใบอนุญาต) | L0 |
| | ยืนยันตัวตน KYC | L0 (เพื่อขึ้น L2) |
| **งาน** | ดู Job Feed (ประกาศงานที่เผยแพร่แล้ว) | L0 |
| | รับงาน (Accept) | L1 |
| | ปฏิเสธงานที่ถูก assign ตรง | L1 |
| | Check-in (GPS บันทึกตำแหน่ง) | L1 |
| | Check-out (GPS + evidence note) | L1 |
| | ขอส่งงานก่อนกำหนด (Early checkout request) | L1 |
| | ยกเลิกงาน (พร้อมระบุเหตุผล) | L0 |
| | ดูรายการงานที่ได้รับมอบหมาย | L1 |
| | ดูตารางงาน (calendar view) | L1 |
| **กระเป๋าเงิน** | ดูยอดเงิน + ประวัติรายรับ | L0 |
| | เพิ่มบัญชีธนาคาร | L1 |
| | ถอนเงิน (ต้องมี KYC approved) | L2 |
| **การสื่อสาร** | แชทกับผู้ว่าจ้าง (real-time) | L0 |
| | เปิดข้อพิพาท (dispute) | L0 |
| | รับ notification (job assigned, payment) | L0 |

### 3.3 ผู้ดูแลระบบ (Admin)

| หมวด | ความสามารถ |
|------|-----------|
| **ผู้ใช้** | ดูรายการผู้ใช้ทั้งหมด, ค้นหา, กรองตาม role/status |
| | ดูรายละเอียดผู้ใช้ (ข้อมูล, wallet, KYC) |
| | Approve / Reject KYC |
| | ban/suspend user (หลายประเภท: login, create, accept, withdraw) |
| | แก้ไข trust level, verify status |
| **งาน** | ดูงานทั้งหมดในระบบ, กรองตามสถานะ/ประเภท |
| | ดูรายละเอียดงาน |
| | ยกเลิกงานแทน |
| **การเงิน** | ดู ledger transactions ทั้งหมด |
| | ดู platform stats (รายรับ, ค่าธรรมเนียม) |
| | ดู + approve/reject/pay withdrawal requests |
| | เพิ่มเงินให้ user ตรง (add-funds) |
| **ข้อพิพาท** | ดูข้อพิพาททั้งหมด, รับมอบหมายคดี |
| | ตัดสินและ settle (refund / payout) |
| **ระบบ** | ดู dashboard stats |
| | คำนวณ trust score ใหม่ (batch/individual) |
| | ดู audit events (policy denials) |
| | ดู reports summary (date range) |

---

## 4. Trust Level System

ระบบประเมินความน่าเชื่อถือ 4 ระดับ ที่กำหนดสิทธิ์การใช้งาน

```
L0 (Unverified)  ← ทุกคนเริ่มที่นี่
     │
     ▼  ยืนยันเบอร์โทรผ่าน OTP
L1 (Basic)       ← รับงาน / เผยแพร่งาน low_risk ได้
     │
     ▼  ยืนยัน KYC (บัตรประชาชน + selfie) → Admin approve
L2 (Verified)    ← เผยแพร่งาน high_risk / ถอนเงินได้
     │
     ▼  KYC + บัญชีธนาคาร verified + Trust Score ≥ 80
L3 (Trusted)     ← สถานะสูงสุด ผ่านการพิสูจน์ความน่าเชื่อถือ
```

**Trust Score** คำนวณจาก: งานเสร็จ (+5/งาน), รีวิวดี (+3), รีวิวแย่ (-5), ยกเลิก (-10), GPS violations (-3), เช็คอินตรงเวลา (+2), โปรไฟล์ครบ (+10)

---

## 5. Flow การทำงานหลัก (Main Workflows)

### 5.1 Flow การสมัครและยืนยันตัวตน

```
[ผู้ใช้] → เลือก Guest (email) หรือ Member (phone)
         → กรอกข้อมูล → ระบบสร้าง account + profile + wallet
         → เลือก Role (Hirer / Caregiver)
         → ยอมรับ Policy
         → [L0] เริ่มใช้งาน

         → (ต้องการยืนยันตัวตน)
         → ยืนยันเบอร์โทรด้วย OTP → [L1]
         → อัพโหลดบัตรประชาชน + selfie → Admin approve → [L2]
         → เพิ่มบัญชีธนาคาร + Trust Score ≥ 80 → [L3]
```

### 5.2 Flow การสร้างและประกาศงาน (Hirer)

```
[Hirer]
  1. สร้างงาน (draft)
     - กำหนดชื่องาน, ประเภทงาน, วัน/เวลา, สถานที่
     - เลือกผู้รับการดูแล (care recipient)
     - กำหนด tasks, skills, ค่าจ้าง/ชั่วโมง
     - ระบบคำนวณ risk_level + min_trust_level อัตโนมัติ

  2. เผยแพร่งาน (publish)
     - ต้อง trust_level ≥ L1 (low_risk) หรือ L2 (high_risk)
     - ระบบ hold เงินค่าจ้าง + platform fee จาก wallet
     - status เปลี่ยนเป็น "posted"

  3. (ทางเลือก) มอบหมายตรง
     - ค้นหาผู้ดูแล → เลือก → assign
     - ระบบส่ง notification ไปผู้ดูแล
     - ผู้ดูแลต้องตอบรับหรือปฏิเสธ
```

### 5.3 Flow การรับงานและทำงาน (Caregiver)

```
[Caregiver]
  1. ดู Job Feed
     - เห็นงานที่เผยแพร่แล้ว (ตาม trust_level ที่กำหนด)
     - กรองตามประเภท, risk_level, ความเร่งด่วน

  2. รับงาน (Accept)
     - ต้อง trust_level ≥ min_trust_level ของงาน
     - ต้องไม่มีงาน overlap ช่วงเวลาเดียวกัน
     - ระบบสร้าง: jobs record + job_assignment + chat_thread + escrow wallet
     - เงินถูกย้ายจาก held_balance ของ hirer → escrow

  3. Check-in (เริ่มงาน)
     - บันทึก GPS (lat, lng, accuracy_m)
     - status เปลี่ยนเป็น "in_progress"
     - ระบบแจ้ง hirer ว่าเริ่มงานแล้ว

  4. Check-out (จบงาน)
     - บันทึก GPS + evidence note (บันทึกการทำงาน)
     - status เปลี่ยนเป็น "completed"
     - ระบบปล่อย escrow: โอนเงินให้ caregiver, หัก platform fee
     - ระบบคำนวณ Trust Score ใหม่ (fire-and-forget)
```

### 5.4 Flow การชำระเงิน (4 ขั้นตอน)

```
Phase 1: เติมเงิน (Top-up)
  Hirer → สร้าง topup_intent → รับ QR Code → สแกนจ่าย
  → Mock Provider webhook → credit wallet

Phase 2: Hold (ตอน Publish)
  available_balance -= ค่าจ้าง + platform_fee
  held_balance += ค่าจ้าง + platform_fee

Phase 3: Escrow (ตอน Caregiver Accept)
  held_balance (hirer) → escrow wallet (per job)

Phase 4: Settlement (ตอน Checkout)
  escrow → caregiver wallet (ค่าจ้าง)
  escrow → platform wallet (platform_fee)

Cancel/Refund:
  escrow → available_balance (hirer) คืนเงินเต็มจำนวน
```

### 5.5 Flow ระบบ Chat

```
[Chat Thread สร้างตอน caregiver accept งาน]
  1 job = 1 thread (thread-based)

Hirer/Caregiver:
  → เข้าห้องแชท → Socket.IO join thread room
  → พิมพ์ข้อความ → real-time broadcast ทั้ง 2 ฝ่าย
  → typing indicator (start/stop)
  → mark as read
  → (งานถูกยกเลิก → thread ปิด, ส่งไม่ได้)
```

### 5.6 Flow ระบบ Dispute

```
[Hirer หรือ Caregiver] เปิดข้อพิพาท
  → ระบุเหตุผล → สร้าง dispute record
  → ส่งข้อความหลักฐาน (รูปภาพ/ข้อความ)

[Admin]
  → รับมอบหมาย dispute
  → ตรวจสอบหลักฐาน
  → Settle: กำหนด refund (คืน hirer) หรือ payout (จ่าย caregiver)
  → status = resolved
```

### 5.7 Flow ระบบ Notification

```
In-app notification triggers:
  - Caregiver รับงาน → notify hirer
  - Hirer มอบหมายงาน → notify caregiver
  - Caregiver check-in → notify hirer
  - Caregiver check-out → notify hirer
  - งานถูกยกเลิก → notify อีกฝ่าย
  - (เพิ่มเติมตามระบบ)

ช่องทาง:
  - Real-time: Socket.IO emit ไปห้อง user:{userId}
  - Polling fallback: frontend poll ทุก 5 วินาที
  - DB: บันทึกใน notifications table
```

---

## 6. Database Overview

**25+ tables** แบ่งเป็นหมวดหลัก:

| หมวด | Tables |
|------|--------|
| **Users & Auth** | users, hirer_profiles, caregiver_profiles, auth_sessions, user_policy_acceptances |
| **Job System** | job_posts, jobs, job_assignments, job_patient_requirements, job_patient_sensitive_data |
| **Evidence** | job_gps_events, job_photo_evidence, early_checkout_requests |
| **Patients** | patient_profiles |
| **Finance** | wallets, ledger_transactions, topup_intents, withdrawal_requests, bank_accounts, banks |
| **Chat** | chat_threads, chat_messages |
| **Dispute** | disputes, dispute_messages, dispute_events |
| **Notification** | notifications |
| **KYC & Docs** | user_kyc_info, caregiver_documents |
| **Trust** | trust_score_history, audit_events |
| **Reviews** | caregiver_reviews, caregiver_favorites |
| **Webhooks** | provider_webhooks |

**ออกแบบพิเศษ:**
- **Two-table Job Pattern**: `job_posts` (ประกาศ) + `jobs` (instance จริง) แยกชัดเจน
- **Immutable Ledger**: ledger_transactions ห้าม UPDATE/DELETE ระดับ DB trigger
- **No Negative Balance**: CHECK constraint ระดับ DB ป้องกัน overdraft
- **One Active Assignment**: UNIQUE constraint ป้องกัน race condition

---

## 7. ความปลอดภัย (Security)

| มาตรการ | รายละเอียด |
|---------|-----------|
| **JWT Authentication** | Access token 15 นาที, Refresh token 7 วัน, เก็บใน sessionStorage |
| **Policy Gate** | ทุก route ผ่าน `requireAuth + requirePolicy()` ตรวจ role + trust_level |
| **Joi Validation** | ทุก request body/query/params ผ่าน Joi schema |
| **Password Hashing** | bcrypt |
| **Idempotency Key** | ป้องกัน duplicate payment |
| **GPS Verification** | บันทึก lat/lng + confidence_score ตอน check-in/out |
| **Privacy** | ไม่เปิดเผย email/phone ระหว่าง user (ใช้ display_name) |
| **Audit Log** | บันทึก policy_denied events ทุกครั้ง |
| **DB Constraints** | ป้องกัน data integrity ระดับ database |
| **Rate Limiting** | TooManyRequestsError (429) |

---

## 8. รายการทดสอบ (Test Cases)

### 8.1 ระบบ Authentication & Authorization

| # | Test Case | ประเภท | ผลที่คาดหวัง |
|---|-----------|--------|-------------|
| A-01 | สมัครสมาชิก Guest ด้วย email + password ใหม่ | Functional | account + profile + wallet สร้างสำเร็จ, ได้รับ JWT |
| A-02 | สมัครสมาชิก Member ด้วยเบอร์โทรซ้ำกับที่มีอยู่ | Negative | error 409 Conflict |
| A-03 | Login ด้วย email + password ถูกต้อง | Functional | ได้รับ access_token + refresh_token |
| A-04 | Login ด้วย password ผิด | Negative | error 401 Unauthorized |
| A-05 | ใช้ access_token หมดอายุ | Negative | error 401 TOKEN_EXPIRED |
| A-06 | Refresh token เพื่อรับ access_token ใหม่ | Functional | ได้ access_token ใหม่ |
| A-07 | ยืนยันเบอร์โทรด้วย OTP ถูกต้อง | Functional | is_phone_verified = true, trust_level ≥ L1 |
| A-08 | กรอก OTP ผิด 3 ครั้งติดกัน | Negative | error ล็อค OTP ชั่วคราว |
| A-09 | Login ผ่าน Google OAuth | Functional | redirect กลับ frontend พร้อม token |
| A-10 | เปลี่ยนรหัสผ่านด้วยรหัสเก่าถูกต้อง | Functional | รหัสผ่านเปลี่ยนสำเร็จ |
| A-11 | ขอลิงก์ reset password ผ่าน email | Functional | ได้รับ email พร้อม token |
| A-12 | Reset password ด้วย token ที่หมดอายุ | Negative | error 400 token expired |
| A-13 | Hirer เข้าถึง route caregiver-only | Negative | error 403 Forbidden |
| A-14 | L0 user พยายาม publish งาน | Negative | error 403 HIRER_TRUST_RESTRICTION |

### 8.2 ระบบจัดการงาน (Job Management)

| # | Test Case | ประเภท | ผลที่คาดหวัง |
|---|-----------|--------|-------------|
| J-01 | Hirer สร้างงาน draft พร้อมข้อมูลครบถ้วน | Functional | job_post สร้างสำเร็จ status=draft |
| J-02 | Hirer สร้างงานโดยไม่กรอก title | Negative | error 400 MISSING_REQUIRED_FIELD |
| J-03 | Hirer (L1) publish งาน low_risk | Functional | status=posted, เงิน hold จาก wallet |
| J-04 | Hirer (L1) publish งาน high_risk | Negative | error 403 HIRER_TRUST_RESTRICTION |
| J-05 | Hirer (L2) publish งาน high_risk | Functional | status=posted สำเร็จ |
| J-06 | Hirer publish งานแต่ wallet ไม่พอ | Negative | error 400 INSUFFICIENT_BALANCE |
| J-07 | Risk level คำนวณอัตโนมัติ (bedbound patient) | Functional | risk_level = high_risk |
| J-08 | Caregiver (L1) รับงาน low_risk | Functional | jobs + assignment สร้าง, escrow hold, chat thread เปิด |
| J-09 | Caregiver (L0) พยายามรับงาน | Negative | error 403 |
| J-10 | Caregiver รับงานที่ overlap กับงานที่มีอยู่ | Negative | error 409 JOB_TIME_CONFLICT |
| J-11 | Caregiver check-in พร้อม GPS | Functional | status=in_progress, GPS event บันทึก, notify hirer |
| J-12 | Caregiver check-out พร้อม evidence note | Functional | status=completed, escrow settle, caregiver รับเงิน |
| J-13 | Hirer ยกเลิกงานหลัง caregiver check-in | Functional | status=cancelled, escrow คืนเงิน hirer |
| J-14 | Caregiver ขอส่งงานก่อนกำหนด | Functional | early_checkout_request สร้าง, notify hirer |
| J-15 | Hirer ปฏิเสธ early checkout request | Functional | request rejected, งานดำเนินต่อ |
| J-16 | Hirer มอบหมายงานตรงให้ caregiver | Functional | preferred_caregiver_id set, notification ส่งหา caregiver |
| J-17 | Caregiver ปฏิเสธงานที่ถูก assign ตรง | Functional | job กลับสู่สถานะ posted หรือ cancelled |
| J-18 | Job feed caregiver ไม่เห็นงานของตัวเอง (ที่สร้างเป็น hirer) | Functional | ไม่แสดงงานของตัวเอง |
| J-19 | Auto-complete overdue job (เลยเวลา 10 นาที) | Functional | checkout อัตโนมัติ, settlement ทำงาน |

### 8.3 ระบบการเงิน (Wallet & Payment)

| # | Test Case | ประเภท | ผลที่คาดหวัง |
|---|-----------|--------|-------------|
| W-01 | Hirer เติมเงินผ่าน QR Payment | Functional | topup_intent pending → webhook → credited |
| W-02 | Webhook จาก provider ซ้ำกัน (idempotency) | Security | ไม่ credit ซ้ำ |
| W-03 | ยอดเงิน wallet คำนวณถูกต้อง (available + held) | Functional | total = available_balance + held_balance |
| W-04 | Ledger transaction ไม่สามารถแก้ไขหรือลบได้ | Security | error (DB trigger block) |
| W-05 | Caregiver (L2) ถอนเงินสำเร็จ | Functional | withdrawal_request queued, ยอด deducted |
| W-06 | Caregiver (L1) พยายามถอนเงิน | Negative | error 403 (ต้อง L2) |
| W-07 | ถอนเงินเกินยอดที่มี | Negative | error 400 INSUFFICIENT_BALANCE |
| W-08 | Admin approve withdrawal | Functional | status → approved → paid |
| W-09 | เพิ่มบัญชีธนาคาร (Hirer L0) | Functional | bank_account สร้างสำเร็จ |
| W-10 | เพิ่มบัญชีธนาคาร (Caregiver L0) | Negative | error 403 (caregiver ต้อง L1) |
| W-11 | Platform fee หักถูกต้องตอน settlement | Functional | platform wallet ได้รับ fee ถูกต้อง |
| W-12 | ยกเลิกงานหลัง escrow สร้าง → คืนเงิน hirer | Functional | escrow → hirer.available_balance |

### 8.4 ระบบ Chat & Real-time

| # | Test Case | ประเภท | ผลที่คาดหวัง |
|---|-----------|--------|-------------|
| C-01 | ส่งข้อความ real-time ระหว่าง hirer-caregiver | Functional | ทั้ง 2 ฝ่ายได้รับข้อความทันที |
| C-02 | Typing indicator แสดงถูกต้อง | Functional | อีกฝ่ายเห็น "กำลังพิมพ์" |
| C-03 | Mark as read | Functional | unread count ลดลง |
| C-04 | ส่งข้อความในงานที่ถูกยกเลิก | Negative | error หรือ disabled input |
| C-05 | 1 job มีเพียง 1 chat thread | Functional | ไม่มี duplicate thread |
| C-06 | Socket.IO reconnect หลัง disconnect | Functional | re-join room สำเร็จ, ได้รับข้อความที่ค้าง |

### 8.5 ระบบ Notification

| # | Test Case | ประเภท | ผลที่คาดหวัง |
|---|-----------|--------|-------------|
| N-01 | Caregiver รับงาน → hirer ได้รับ notification | Functional | notification badge +1 ทันที |
| N-02 | Hirer assign ตรง → caregiver ได้รับ notification | Functional | in-app + real-time |
| N-03 | Check-in/Check-out → hirer ได้รับ notification | Functional | notification บันทึกใน DB |
| N-04 | Mark all as read | Functional | unread_count = 0 |
| N-05 | Polling fallback ทำงาน (กรณี socket disconnect) | Functional | badge count update ภายใน 5 วินาที |

### 8.6 ระบบ KYC & Trust

| # | Test Case | ประเภท | ผลที่คาดหวัง |
|---|-----------|--------|-------------|
| K-01 | ส่ง KYC document ครบ (front, back, selfie) | Functional | user_kyc_info pending สร้าง |
| K-02 | Admin approve KYC | Functional | trust_level = L2 |
| K-03 | Admin reject KYC | Functional | status = rejected, user ส่งใหม่ได้ |
| K-04 | Trust Score คำนวณถูกต้องหลัง checkout | Functional | score เพิ่มขึ้น +5 (completed job) |
| K-05 | Trust Score ลดลงหลัง cancel | Functional | score ลดลง -10 |
| K-06 | L3 hysteresis: score ลดจาก 82 → 73 | Functional | ลงมาเป็น L2 (threshold = 75) |

### 8.7 ระบบ Dispute

| # | Test Case | ประเภท | ผลที่คาดหวัง |
|---|-----------|--------|-------------|
| D-01 | Hirer เปิด dispute พร้อมระบุเหตุผล | Functional | dispute record สร้าง |
| D-02 | ทั้ง 2 ฝ่ายส่งข้อความใน dispute | Functional | dispute_messages บันทึก |
| D-03 | Admin settle (refund hirer) | Functional | เงินคืน hirer.available_balance |
| D-04 | Admin settle (payout caregiver) | Functional | เงินโอน caregiver.available_balance |

### 8.8 ระบบ Admin

| # | Test Case | ประเภท | ผลที่คาดหวัง |
|---|-----------|--------|-------------|
| AD-01 | Admin login สำเร็จ | Functional | เข้า dashboard ได้ |
| AD-02 | Non-admin เข้าถึง /admin/* | Negative | error 403 |
| AD-03 | Admin ban user (ban_login) | Functional | user login ไม่ได้ |
| AD-04 | Admin ดู ledger ทุก transaction | Functional | แสดงครบถ้วน, paginated |
| AD-05 | Admin คำนวณ trust score batch | Functional | trust_score + trust_level อัพเดท |

### 8.9 ระบบ Review & Favorites

| # | Test Case | ประเภท | ผลที่คาดหวัง |
|---|-----------|--------|-------------|
| R-01 | Hirer รีวิว caregiver หลังงานเสร็จ | Functional | caregiver_reviews บันทึก, average_rating อัพเดท |
| R-02 | Hirer รีวิวงานเดิมซ้ำ | Negative | error 409 Duplicate |
| R-03 | Toggle favorite caregiver (เพิ่ม) | Functional | caregiver_favorites บันทึก |
| R-04 | Toggle favorite caregiver (ลบ) | Functional | favorite ลบออก |

### 8.10 UI/UX & Accessibility

| # | Test Case | ประเภท | ผลที่คาดหวัง |
|---|-----------|--------|-------------|
| UI-01 | Cancel modal แสดง preset reasons | Functional | เลือกเหตุผลได้, textarea ไม่บังคับ |
| UI-02 | Job card แสดงชื่อผู้ดูแลที่มอบหมาย | Functional | ชื่อแสดงทันทีหลัง assign |
| UI-03 | วันที่จบงานแสดงครบถ้วนเมื่อข้ามวัน | Functional | แสดงทั้งวันเริ่ม-จบ |
| UI-04 | Filter "รอตอบรับ" / "กำลังทำ" แสดงก่อน | Functional | ลำดับถูกต้อง |
| UI-05 | Onboarding checklist step 6 ถูกต้อง | Functional | ✓ ทันทีที่เคยสร้างงาน แม้ filter ว่างอยู่ |
| UI-06 | Responsive บนมือถือ 360x800 | UI | layout ไม่แตก, ปุ่มกดได้ |
| UI-07 | ปุ่ม icon-only มี aria-label | Accessibility | WCAG 2.1 AA ผ่าน |
| UI-08 | Modal มี focus trap | Accessibility | Tab วนในModal เท่านั้น |

---

## 9. สรุปจำนวน API Endpoints

| Route Group | Endpoints | คำอธิบาย |
|------------|-----------|---------|
| `/api/auth` | 19 | Authentication ทุกรูปแบบ |
| `/api/otp` | 4 | OTP email/phone |
| `/api/jobs` | 13 | Job lifecycle ทั้งหมด |
| `/api/caregivers` | 4 | ค้นหา + assign |
| `/api/care-recipients` | 5 | CRUD care recipients |
| `/api/caregiver-documents` | 4 | เอกสาร caregiver |
| `/api/reviews` | 3 | Reviews |
| `/api/favorites` | 3 | Favorites |
| `/api/kyc` | 3 | KYC submit/status |
| `/api/wallet` | 17 | Wallet ทุกฟีเจอร์ |
| `/api/payments` | 3 | Payment history |
| `/api/chat` | 9 | Chat threads/messages |
| `/api/disputes` | 5 | Dispute management |
| `/api/notifications` | 5 | Notifications |
| `/api/webhooks` | 3 | Provider webhooks |
| `/api/admin` | 21 | Admin operations |
| **รวม** | **121** | |

---

## 10. หน้าจอในระบบ (Page Map)

| หมวด | จำนวนหน้า | หน้าสำคัญ |
|------|----------|---------|
| Public | 5 | Landing, About, FAQ, Contact |
| Auth | 9 | Login, Register, Google OAuth, Forgot/Reset Password |
| Hirer | 11 | Home (My Jobs), Search, Create Job, Care Recipients, Wallet, Favorites |
| Caregiver | 8 | Job Feed, My Jobs, Profile, Wallet, Earning Detail |
| Shared | 9 | Job Detail, Chat Room, Dispute, Notifications, Profile, KYC |
| Admin | 8 | Dashboard, Users, Jobs, Financial, Disputes, Reports |
| **รวม** | **~50** | |
