# CareConnect — เอกสารสรุป Flow การทำงานของระบบ

> **ปรับปรุงล่าสุด:** 20 กุมภาพันธ์ 2569  
> **Tech Stack:** React + TypeScript (Vite) / Node.js + Express / PostgreSQL / Socket.IO / Docker

---

## สารบัญ

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [สถาปัตยกรรม](#2-สถาปัตยกรรม)
3. [บทบาทผู้ใช้ (Roles)](#3-บทบาทผู้ใช้-roles)
4. [Flow การสมัครสมาชิกและเข้าสู่ระบบ](#4-flow-การสมัครสมาชิกและเข้าสู่ระบบ)
5. [Flow ผู้ว่าจ้าง (Hirer)](#5-flow-ผู้ว่าจ้าง-hirer)
6. [Flow ผู้ดูแล (Caregiver)](#6-flow-ผู้ดูแล-caregiver)
7. [Flow งาน (Job Lifecycle)](#7-flow-งาน-job-lifecycle)
8. [Flow กระเป๋าเงิน (Wallet)](#8-flow-กระเป๋าเงิน-wallet)
9. [Flow แชท (Chat)](#9-flow-แชท-chat)
10. [Flow ข้อพิพาท (Dispute)](#10-flow-ข้อพิพาท-dispute)
11. [Flow การแจ้งเตือน (Notification)](#11-flow-การแจ้งเตือน-notification)
12. [Flow KYC และระดับความน่าเชื่อถือ](#12-flow-kyc-และระดับความน่าเชื่อถือ)
13. [Flow ผู้ดูแลระบบ (Admin)](#13-flow-ผู้ดูแลระบบ-admin)
14. [API Endpoints ทั้งหมด](#14-api-endpoints-ทั้งหมด)
15. [Frontend Routes ทั้งหมด](#15-frontend-routes-ทั้งหมด)
16. [โครงสร้างไฟล์โปรเจค](#16-โครงสร้างไฟล์โปรเจค)

---

## 1. ภาพรวมระบบ

**CareConnect** คือแพลตฟอร์มจับคู่ผู้ว่าจ้าง (Hirer) กับผู้ดูแล (Caregiver) สำหรับงานดูแลผู้สูงอายุ/ผู้ป่วย โดยมีระบบ:

- สมัครสมาชิก/เข้าสู่ระบบ (Email, Phone, Google OAuth)
- สร้างงาน ค้นหาผู้ดูแล มอบหมายงาน
- ระบบ Check-in / Check-out ด้วย GPS
- กระเป๋าเงิน (เติมเงิน, ถอนเงิน, ชำระค่าจ้าง)
- แชทระหว่างผู้ว่าจ้างกับผู้ดูแล (Realtime via Socket.IO)
- ระบบรีวิว, รายการโปรด, ข้อพิพาท
- ระบบ KYC ยืนยันตัวตน + Trust Level
- แผงควบคุมสำหรับ Admin

---

## 2. สถาปัตยกรรม

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Frontend   │────▶│    Backend      │────▶│  PostgreSQL  │
│  (React)    │     │  (Express.js)   │     │   Database   │
│  Port 5173  │     │   Port 4000     │     │  Port 5432   │
└─────────────┘     └────────┬────────┘     └──────────────┘
                             │
                    ┌────────┴────────┐
                    │   Socket.IO     │
                    │  (Realtime Chat │
                    │  & Notifications)│
                    └────────┬────────┘
                             │
                    ┌────────┴────────┐
                    │  Mock Provider  │
                    │  (Payment/KYC)  │
                    │   Port 4100     │
                    └─────────────────┘
```

**Docker Services:**
| Service | Container | Port |
|---------|-----------|------|
| Frontend (Vite) | careconnect-frontend | 5173 |
| Backend (Express) | careconnect-backend | 4000 |
| PostgreSQL | careconnect-postgres | 5432 |
| Mock Provider | careconnect-mock-provider | 4100 |
| pgAdmin | careconnect-pgadmin | 5050 |

---

## 3. บทบาทผู้ใช้ (Roles)

| Role | คำอธิบาย | สิทธิ์หลัก |
|------|----------|-----------|
| **Hirer** | ผู้ว่าจ้าง | สร้างงาน, ค้นหาผู้ดูแล, มอบหมายงาน, เติมเงิน, ถอนเงิน, รีวิว |
| **Caregiver** | ผู้ดูแล | ดูฟีดงาน, รับงาน, Check-in/out, ถอนเงิน |
| **Admin** | ผู้ดูแลระบบ | จัดการผู้ใช้, จัดการงาน, จัดการข้อพิพาท, ดูรายงาน |

ผู้ใช้เลือก Role ได้หลังสมัคร และสามารถสลับ Role ได้ผ่านหน้า Profile

---

## 4. Flow การสมัครสมาชิกและเข้าสู่ระบบ

### 4.1 สมัครสมาชิก

```
ผู้ใช้ → /register (เลือกประเภท)
  ├── Guest (Email + Password) → /register/guest
  │     └── POST /api/auth/register/guest
  │           └── สร้าง account → เลือก Role → ยอมรับนโยบาย → ตั้งค่าโปรไฟล์
  │
  └── Member (Phone + Password) → /register/member
        └── POST /api/auth/register/member
              └── สร้าง account → ส่ง OTP ยืนยันเบอร์ → เลือก Role → ยอมรับนโยบาย → ตั้งค่าโปรไฟล์
```

### 4.2 เข้าสู่ระบบ

```
ผู้ใช้ → /login (เลือกวิธี)
  ├── Email → /login/email → POST /api/auth/login/email
  ├── Phone → /login/phone → POST /api/auth/login/phone
  └── Google → GET /api/auth/google → OAuth callback → /auth/callback
```

### 4.3 OTP Verification

```
POST /api/otp/phone/send    → ส่ง OTP ไปเบอร์โทร
POST /api/otp/email/send    → ส่ง OTP ไปอีเมล
POST /api/otp/verify        → ยืนยัน OTP (otp_id + code)
POST /api/otp/resend        → ส่ง OTP ใหม่
```

### 4.4 Route Guards (Frontend)

ทุกหน้าที่ต้องล็อกอินจะผ่าน Guards ตามลำดับ:
```
RequireAuth → RequireRole → RequirePolicy → RequireProfile → Page
```

- **RequireAuth**: ต้องมี token
- **RequireRole**: ต้องมี role ที่ถูกต้อง (hirer/caregiver)
- **RequirePolicy**: ต้องยอมรับนโยบายแล้ว
- **RequireProfile**: ต้องตั้งค่าโปรไฟล์แล้ว

---

## 5. Flow ผู้ว่าจ้าง (Hirer)

### 5.1 หน้าหลัก (/hirer/home)
- แสดงรายการงานทั้งหมดของผู้ว่าจ้าง
- กรองตามสถานะ (ทั้งหมด, แบบร่าง, ประกาศ, มอบหมาย, กำลังทำ, เสร็จ, ยกเลิก)
- ปุ่ม "สร้างงาน" → /hirer/create-job
- ปุ่ม "ดูตารางงาน" → เปิด Modal ปฏิทินแสดงงานตามวัน (กดดูรายละเอียดงานได้)

### 5.2 สร้างงาน (/hirer/create-job)
```
กรอกข้อมูลงาน → เลือกผู้รับการดูแล → ตั้งค่าสถานที่ (Google Places)
  → กำหนดวันเวลา → ตั้งค่าอัตราค่าจ้าง → ตรวจสอบ → POST /api/jobs
  → สร้างเป็น Draft → POST /api/jobs/:id/publish → ประกาศงาน
```

### 5.3 ค้นหาผู้ดูแล (/hirer/search-caregivers)
```
ค้นหา → กรองตาม:
  - ระดับความน่าเชื่อถือ (L0-L3)
  - หมวดหมู่งาน (checkbox)
  - ประสบการณ์ขั้นต่ำ
  - วันที่พร้อมรับงาน (checkbox หลายวัน)
→ ดูรายละเอียดผู้ดูแล (Modal)
→ เพิ่ม/ลบรายการโปรด (Heart icon)
→ มอบหมายงาน (เลือกงานที่มีอยู่ หรือสร้างงานใหม่)
```

### 5.4 ผู้รับการดูแล (/hirer/care-recipients)
```
รายการผู้รับการดูแล → เพิ่มใหม่ / แก้ไข / ลบ
  POST /api/care-recipients
  PUT /api/care-recipients/:id
  DELETE /api/care-recipients/:id
```

### 5.5 รายการโปรด (/hirer/favorites)
```
แสดงผู้ดูแลที่บันทึกไว้ → ดูรายละเอียด → มอบหมายงานตรง
  GET /api/favorites
  POST /api/favorites/toggle
```

### 5.6 กระเป๋าเงินผู้ว่าจ้าง (/hirer/wallet)
- ดูยอดคงเหลือ (คงเหลือ + เงินที่ถูกพัก = รวม)
- เติมเงิน (QR Code จำลอง)
- ถอนเงิน
- ดูธุรกรรมล่าสุด (กรองตามประเภท/อ้างอิง)
- ดูใบเสร็จ (/hirer/wallet/receipt/:jobId)

---

## 6. Flow ผู้ดูแล (Caregiver)

### 6.1 ฟีดงาน (/caregiver/jobs/feed)
```
แสดงงานที่ประกาศ → กรองตาม:
  - ประเภทงาน
  - ระดับความเสี่ยง
  - งานเร่งด่วน
→ ดูรายละเอียดงาน (/caregiver/jobs/:id/preview)
→ รับงาน (POST /api/jobs/:id/accept)
```

### 6.2 งานของฉัน (/caregiver/jobs/my-jobs)
```
แสดงงานที่ได้รับมอบหมาย → กรองตามสถานะ
  - รอการตอบรับ → ตอบรับ / ปฏิเสธ
  - รอเริ่มงาน → Check-in เมื่อถึงที่หมาย
  - กำลังทำ → ส่งงานเสร็จ (Check-out + สรุปงาน)
  - เสร็จสิ้น / ยกเลิก
→ ดูตารางงาน (ปฏิทิน) → กดดูรายละเอียดงานได้
→ เปิดข้อพิพาท
```

### 6.3 กระเป๋าเงินผู้ดูแล (/caregiver/wallet)
- ดูยอดคงเหลือ
- ถอนเงิน (เลือกบัญชีธนาคาร)
- ดูธุรกรรม
- ดูรายละเอียดรายได้ต่องาน (/caregiver/wallet/earning/:jobId)

---

## 7. Flow งาน (Job Lifecycle)

### 7.1 State Machine ของงาน

```
                    ┌──────────┐
                    │  Draft   │  ← สร้างงาน (Hirer)
                    └────┬─────┘
                         │ publish
                    ┌────▼─────┐
                    │  Posted  │  ← ประกาศงาน / มอบหมายตรง
                    └────┬─────┘
                         │ accept (Caregiver) / assign (Hirer)
                    ┌────▼─────┐
                    │ Assigned │  ← ผู้ดูแลรับงานแล้ว
                    └────┬─────┘
                         │ check-in (GPS)
                 ┌───────▼────────┐
                 │  In Progress   │  ← กำลังทำงาน
                 └───────┬────────┘
                         │ check-out + evidence_note
                    ┌────▼─────┐
                    │Completed │  ← งานเสร็จ → ชำระเงิน → รีวิว
                    └──────────┘

        (ยกเลิกได้ทุกสถานะก่อน Completed)
                    ┌──────────┐
                    │Cancelled │
                    └──────────┘
```

### 7.2 การมอบหมายงานตรง (Direct Assignment)

```
Hirer ค้นหาผู้ดูแล → เลือก "มอบหมายงาน"
  → เลือกงานที่มีอยู่ (draft/posted/completed) หรือสร้างใหม่
  → POST /api/caregivers/assign { job_post_id, caregiver_id }
  → ระบบตรวจสอบ:
    - งานเป็นของ Hirer
    - สถานะงานอนุญาต (draft/posted/completed)
    - ผู้ดูแลไม่มีงานซ้อนเวลา
  → อัปเดต preferred_caregiver_id + สร้าง job_assignment
  → ผู้ดูแลเห็นงานใน "รอการตอบรับ" → ตอบรับ/ปฏิเสธ
```

### 7.3 Check-in / Check-out

```
Check-in:
  POST /api/jobs/:jobId/checkin { lat, lng, accuracy_m }
  → ตรวจสอบ GPS (ถ้ามี geofence)
  → เปลี่ยนสถานะ assigned → in_progress

Check-out:
  POST /api/jobs/:jobId/checkout { lat, lng, evidence_note }
  → ต้องมี evidence_note (สรุปงาน ≥ 10 ตัวอักษร)
  → เปลี่ยนสถานะ in_progress → completed
  → ระบบชำระเงินอัตโนมัติ
```

### 7.4 Backend API Endpoints สำหรับงาน

| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | /api/jobs/stats | สถิติงาน |
| GET | /api/jobs/feed | ฟีดงานสำหรับผู้ดูแล |
| GET | /api/jobs/my-jobs | งานของผู้ว่าจ้าง |
| GET | /api/jobs/assigned | งานที่ได้รับมอบหมาย (ผู้ดูแล) |
| GET | /api/jobs/:id | รายละเอียดงาน |
| POST | /api/jobs | สร้างงาน (draft) |
| POST | /api/jobs/:id/publish | ประกาศงาน |
| POST | /api/jobs/:id/accept | รับงาน |
| POST | /api/jobs/:id/reject | ปฏิเสธงานที่มอบหมาย |
| POST | /api/jobs/:jobId/checkin | Check-in |
| POST | /api/jobs/:jobId/checkout | Check-out |
| POST | /api/jobs/:id/cancel | ยกเลิกงาน |

---

## 8. Flow กระเป๋าเงิน (Wallet)

### 8.1 โครงสร้างยอดเงิน

```
available_balance  = เงินที่ใช้ได้
held_balance       = เงินที่ถูกพักไว้ (ระหว่างทำงาน)
total_balance      = available_balance + held_balance
```

### 8.2 Flow เติมเงิน (Hirer)

```
Hirer กรอกจำนวนเงิน → POST /api/wallet/topup
  → ได้รับ topup_id + QR payload
  → แสดง QR Code (จำลอง)
  → กด "ยืนยันการชำระเงิน" → POST /api/wallet/topup/:topupId/confirm
  → ตรวจสอบสถานะ → เติมเงินเข้า available_balance
```

### 8.3 Flow ถอนเงิน (Hirer & Caregiver)

```
เลือกบัญชีธนาคาร → กรอกจำนวนเงิน
  → POST /api/wallet/withdraw { amount, bank_account_id }
  → สร้างรายการถอน (status: queued)
  → Admin อนุมัติ → จ่ายเงิน → status: paid
  → ผู้ใช้สามารถยกเลิกได้ขณะ status = queued
```

### 8.4 Flow ชำระค่าจ้าง (อัตโนมัติเมื่องานเสร็จ)

```
งาน completed → ระบบคำนวณค่าจ้าง (hourly_rate × total_hours)
  → หักเงินจาก Hirer wallet (hold → debit)
  → โอนเงินเข้า Caregiver wallet (credit)
  → หักค่าธรรมเนียมแพลตฟอร์ม (ถ้ามี)
```

### 8.5 API Endpoints

| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | /api/wallet/balance | ดูยอดเงิน |
| GET | /api/wallet/transactions | ประวัติธุรกรรม |
| GET | /api/wallet/bank-accounts | บัญชีธนาคาร |
| POST | /api/wallet/bank-accounts | เพิ่มบัญชีธนาคาร |
| POST | /api/wallet/topup | เติมเงิน |
| GET | /api/wallet/topup/pending | รายการเติมเงินรอดำเนินการ |
| GET | /api/wallet/topup/:topupId | สถานะการเติมเงิน |
| POST | /api/wallet/topup/:topupId/confirm | ยืนยันการเติมเงิน |
| POST | /api/wallet/withdraw | ถอนเงิน |
| GET | /api/wallet/withdrawals | รายการถอนเงิน |
| POST | /api/wallet/withdrawals/:id/cancel | ยกเลิกการถอน |

---

## 9. Flow แชท (Chat)

### 9.1 การเข้าถึงแชท

```
งานถูกรับ (assigned) → ระบบสร้าง Chat Thread อัตโนมัติ
  → ทั้ง Hirer และ Caregiver เข้าแชทผ่าน /chat/:jobId
```

### 9.2 Realtime Messaging

```
Frontend (Socket.IO Client) ←→ Backend (Socket.IO Server)
  - Event: chat:join (เข้าห้อง)
  - Event: chat:message (ส่งข้อความ)
  - Event: chat:typing (กำลังพิมพ์)
  - Event: notification:new (แจ้งเตือนใหม่)
```

### 9.3 UI แชท

- **Header**: แสดงชื่องาน + สถานะ (กดซ่อน/แสดงรายละเอียดได้)
- **Messages**: พื้นที่ข้อความ scroll ได้
- **Input Bar**: ช่องพิมพ์ติดด้านล่างเสมอ (sticky bottom bar)
- **Actions**: ดูรายละเอียดงาน, ยกเลิกงาน, เปิดข้อพิพาท
- **Caregiver Actions**: Check-in, Check-out (ส่งงานเสร็จ)

### 9.4 Chat Lock

แชทจะถูกล็อก (ส่งข้อความไม่ได้) เมื่อ:
- งานถูกยกเลิก
- Thread ถูกปิด

### 9.5 API Endpoints

| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | /api/chat/threads | รายการห้องแชท |
| GET | /api/chat/threads/:threadId | ข้อมูลห้องแชท |
| GET | /api/chat/threads/:threadId/messages | ข้อความในห้อง |
| POST | /api/chat/threads/:threadId/messages | ส่งข้อความ |
| POST | /api/chat/threads/:threadId/read | อ่านข้อความแล้ว |
| GET | /api/chat/threads/:threadId/unread | จำนวนข้อความยังไม่อ่าน |
| POST | /api/chat/threads/:threadId/close | ปิดห้องแชท |
| POST | /api/chat/job/:jobId/thread | สร้าง/ดึง thread ของงาน |
| GET | /api/chat/job/:jobId/thread | ดึง thread ของงาน |

---

## 10. Flow ข้อพิพาท (Dispute)

```
ผู้ใช้ (Hirer/Caregiver) เปิดข้อพิพาท
  → POST /api/disputes { job_id, reason }
  → สร้าง Dispute (status: open)
  → ทั้งสองฝ่ายส่งข้อความในข้อพิพาท
  → POST /api/disputes/:id/messages { content }
  → ขอปิดข้อพิพาท
  → POST /api/disputes/:id/request-close { reason }
  → Admin ตรวจสอบ → ตัดสิน → settle (คืนเงิน/จ่ายเงิน)
```

### สถานะข้อพิพาท
```
open → in_review → resolved / rejected
```

### API Endpoints

| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| POST | /api/disputes | เปิดข้อพิพาท |
| GET | /api/disputes/by-job/:jobId | ดูข้อพิพาทของงาน |
| GET | /api/disputes/:id | รายละเอียดข้อพิพาท |
| POST | /api/disputes/:id/messages | ส่งข้อความ |
| POST | /api/disputes/:id/request-close | ขอปิดข้อพิพาท |

---

## 11. Flow การแจ้งเตือน (Notification)

```
เหตุการณ์ในระบบ (งานใหม่, ข้อความ, สถานะเปลี่ยน)
  → สร้าง Notification record
  → ส่ง Realtime ผ่าน Socket.IO (notification:new)
  → Frontend TopBar แสดง badge จำนวนยังไม่อ่าน
  → Polling ทุก 5 วินาที (fallback)
```

### API Endpoints

| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | /api/notifications | รายการแจ้งเตือน |
| GET | /api/notifications/unread-count | จำนวนยังไม่อ่าน |
| PATCH | /api/notifications/:id/read | อ่านแจ้งเตือน |
| PATCH | /api/notifications/read-all | อ่านทั้งหมด |
| DELETE | /api/notifications | ล้างแจ้งเตือน |

---

## 12. Flow KYC และระดับความน่าเชื่อถือ

### 12.1 Trust Levels

| Level | ชื่อ | เงื่อนไข |
|-------|------|----------|
| L0 | ใหม่ | สมัครสมาชิกแล้ว |
| L1 | ยืนยันเบอร์ | ยืนยันเบอร์โทรผ่าน OTP |
| L2 | ยืนยันตัวตน | ผ่าน KYC (บัตรประชาชน + เซลฟี่) |
| L3 | เชื่อถือสูง | L2 + ผ่านเกณฑ์ trust_score |

### 12.2 KYC Flow

```
ผู้ใช้ → /kyc
  → อัปโหลดบัตรประชาชน (หน้า/หลัง) + เซลฟี่
  → POST /api/kyc/submit
  → ระบบตรวจสอบ (จำลอง: POST /api/kyc/mock/submit)
  → อัปเดต trust_level
```

### 12.3 Trust Score คำนวณจาก

- คะแนนรีวิวเฉลี่ย (weight สูงสุด 70%)
- จำนวนงานที่ทำสำเร็จ
- ระยะเวลาเป็นสมาชิก
- KYC verification status

### API Endpoints

| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | /api/kyc/status | สถานะ KYC |
| POST | /api/kyc/submit | ส่ง KYC (อัปโหลดเอกสาร) |
| POST | /api/kyc/mock/submit | ส่ง KYC จำลอง |

---

## 13. Flow ผู้ดูแลระบบ (Admin)

### 13.1 เข้าสู่ระบบ Admin
```
/admin/login → ล็อกอินด้วย email/password (role = admin)
```

### 13.2 หน้าจัดการ

| หน้า | Path | ฟังก์ชัน |
|------|------|---------|
| Dashboard | /admin/dashboard | ภาพรวมสถิติ |
| จัดการผู้ใช้ | /admin/users | ดู/ระงับ/ลบผู้ใช้ |
| จัดการงาน | /admin/jobs | ดู/ยกเลิกงาน |
| จัดการข้อพิพาท | /admin/disputes | ตรวจสอบ/ตัดสิน/settle |
| การเงิน | /admin/financial | ดูธุรกรรม/อนุมัติถอนเงิน |
| รายงาน | /admin/reports | รายงานสรุป |
| ตั้งค่า | /admin/settings | ตั้งค่าระบบ |

### 13.3 Admin API Endpoints

| Method | Endpoint | คำอธิบาย |
|--------|----------|----------|
| GET | /api/admin/stats | สถิติระบบ |
| GET | /api/admin/users | รายการผู้ใช้ |
| GET | /api/admin/users/:id | รายละเอียดผู้ใช้ |
| POST | /api/admin/users/:id/status | เปลี่ยนสถานะผู้ใช้ |
| GET | /api/admin/jobs | รายการงาน |
| GET | /api/admin/jobs/:id | รายละเอียดงาน |
| POST | /api/admin/jobs/:id/cancel | ยกเลิกงาน |
| GET | /api/admin/disputes | รายการข้อพิพาท |
| GET | /api/admin/disputes/:id | รายละเอียดข้อพิพาท |
| POST | /api/admin/disputes/:id | อัปเดตข้อพิพาท |
| POST | /api/admin/disputes/:id/settle | ตัดสินข้อพิพาท |
| GET | /api/admin/ledger/transactions | ธุรกรรมทั้งหมด |
| GET | /api/admin/health | สถานะระบบ |
| POST | /api/admin/trust/recalculate | คำนวณ Trust Level ใหม่ทั้งหมด |
| POST | /api/admin/trust/recalculate/:userId | คำนวณ Trust Level ผู้ใช้ |
| GET | /api/wallet/admin/stats | สถิติกระเป๋าเงิน |
| POST | /api/wallet/admin/add-funds | เพิ่มเงิน (admin) |
| GET | /api/wallet/admin/withdrawals | รายการถอนเงินทั้งหมด |
| POST | /api/wallet/admin/withdrawals/:id/review | ตรวจสอบการถอน |
| POST | /api/wallet/admin/withdrawals/:id/approve | อนุมัติการถอน |
| POST | /api/wallet/admin/withdrawals/:id/reject | ปฏิเสธการถอน |
| POST | /api/wallet/admin/withdrawals/:id/mark-paid | จ่ายเงินแล้ว |

---

## 14. API Endpoints ทั้งหมด

### Auth (/api/auth)
| Method | Path | Auth | คำอธิบาย |
|--------|------|------|----------|
| POST | /register/guest | ✗ | สมัคร (email) |
| POST | /register/member | ✗ | สมัคร (phone) |
| POST | /login/email | ✗ | ล็อกอิน (email) |
| POST | /login/phone | ✗ | ล็อกอิน (phone) |
| POST | /refresh | ✗ | Refresh token |
| GET | /google | ✗ | Google OAuth |
| GET | /google/callback | ✗ | Google callback |
| GET | /me | ✓ | ข้อมูลผู้ใช้ |
| GET | /profile | ✓ | โปรไฟล์ |
| PUT | /profile | ✓ | อัปเดตโปรไฟล์ |
| POST | /avatar | ✓ | อัปโหลดรูปโปรไฟล์ |
| POST | /phone | ✓ | อัปเดตเบอร์โทร |
| POST | /email | ✓ | อัปเดตอีเมล |
| POST | /policy/accept | ✓ | ยอมรับนโยบาย |
| POST | /role | ✓ | เปลี่ยน role |
| POST | /logout | ✓ | ออกจากระบบ |
| DELETE | /me | ✓ | ลบบัญชี (ยังไม่ยืนยัน) |
| POST | /cancel-registration | ✓ | ยกเลิกการสมัคร |

### OTP (/api/otp)
| Method | Path | Auth | คำอธิบาย |
|--------|------|------|----------|
| POST | /email/send | ✓ | ส่ง OTP email |
| POST | /phone/send | ✓ | ส่ง OTP phone |
| POST | /verify | ✓ | ยืนยัน OTP |
| POST | /resend | ✓ | ส่ง OTP ใหม่ |

### Jobs (/api/jobs)
| Method | Path | Auth | คำอธิบาย |
|--------|------|------|----------|
| GET | /stats | ✓ | สถิติงาน |
| GET | /feed | ✓ | ฟีดงาน (caregiver) |
| GET | /my-jobs | ✓ | งานของฉัน (hirer) |
| GET | /assigned | ✓ | งานที่ได้รับ (caregiver) |
| GET | /:id | ✓ | รายละเอียดงาน |
| POST | / | ✓ | สร้างงาน |
| POST | /:id/publish | ✓ | ประกาศงาน |
| POST | /:id/accept | ✓ | รับงาน |
| POST | /:id/reject | ✓ | ปฏิเสธงาน |
| POST | /:jobId/checkin | ✓ | Check-in |
| POST | /:jobId/checkout | ✓ | Check-out |
| POST | /:id/cancel | ✓ | ยกเลิกงาน |

### Caregivers (/api/caregivers)
| Method | Path | Auth | คำอธิบาย |
|--------|------|------|----------|
| GET | /search | ✓ | ค้นหาผู้ดูแล |
| POST | /assign | ✓ | มอบหมายงาน |

### Reviews (/api/reviews)
| Method | Path | Auth | คำอธิบาย |
|--------|------|------|----------|
| POST | / | ✓ | สร้างรีวิว |
| GET | /caregiver/:id | ✓ | รีวิวของผู้ดูแล |
| GET | /job/:jobId | ✓ | รีวิวของงาน |

### Favorites (/api)
| Method | Path | Auth | คำอธิบาย |
|--------|------|------|----------|
| POST | /favorites/toggle | ✓ | เพิ่ม/ลบรายการโปรด |
| GET | /favorites | ✓ | รายการโปรด |
| GET | /favorites/check/:id | ✓ | ตรวจสอบรายการโปรด |

### Care Recipients (/api/care-recipients)
| Method | Path | Auth | คำอธิบาย |
|--------|------|------|----------|
| GET | / | ✓ | รายการผู้รับการดูแล |
| POST | / | ✓ | เพิ่มผู้รับการดูแล |
| GET | /:id | ✓ | รายละเอียด |
| PUT | /:id | ✓ | แก้ไข |
| DELETE | /:id | ✓ | ลบ |

### Caregiver Documents (/api/caregiver-documents)
| Method | Path | Auth | คำอธิบาย |
|--------|------|------|----------|
| GET | / | ✓ | เอกสารของฉัน |
| POST | / | ✓ | อัปโหลดเอกสาร |
| DELETE | /:id | ✓ | ลบเอกสาร |
| GET | /by-caregiver/:id | ✓ | เอกสารของผู้ดูแล |

### Webhooks (/api/webhooks)
| Method | Path | Auth | คำอธิบาย |
|--------|------|------|----------|
| POST | /payment | ✗ | Webhook ชำระเงิน |
| POST | /kyc | ✗ | Webhook KYC |
| POST | /sms | ✗ | Webhook SMS |

---

## 15. Frontend Routes ทั้งหมด

### Public (ไม่ต้องล็อกอิน)
| Path | หน้า | คำอธิบาย |
|------|------|----------|
| / | LandingPage | หน้าแรก |
| /about | AboutPage | เกี่ยวกับเรา |
| /faq | FAQPage | คำถามที่พบบ่อย |
| /contact | ContactPage | ติดต่อเรา |
| /showcase | ComponentShowcase | ตัวอย่าง UI (dev) |

### Auth (สมัคร/ล็อกอิน)
| Path | หน้า | คำอธิบาย |
|------|------|----------|
| /login | LoginEntryPage | เลือกวิธีล็อกอิน |
| /login/email | LoginEmailPage | ล็อกอินด้วยอีเมล |
| /login/phone | LoginPhonePage | ล็อกอินด้วยเบอร์โทร |
| /auth/callback | AuthCallbackPage | Google OAuth callback |
| /forgot-password | ForgotPasswordPage | ลืมรหัสผ่าน |
| /register | RegisterTypePage | เลือกประเภทสมัคร |
| /register/guest | GuestRegisterPage | สมัคร (email) |
| /register/member | MemberRegisterPage | สมัคร (phone) |
| /select-role | RoleSelectionPage | เลือก role |
| /register/consent | ConsentPage | ยอมรับนโยบาย |

### Hirer (ผู้ว่าจ้าง)
| Path | หน้า | คำอธิบาย |
|------|------|----------|
| /hirer/home | HirerHomePage | หน้าหลัก + รายการงาน |
| /hirer/search-caregivers | SearchCaregiversPage | ค้นหาผู้ดูแล |
| /hirer/create-job | CreateJobPage | สร้างงาน |
| /hirer/care-recipients | CareRecipientsPage | ผู้รับการดูแล |
| /hirer/care-recipients/new | CareRecipientFormPage | เพิ่มผู้รับการดูแล |
| /hirer/care-recipients/:id/edit | CareRecipientFormPage | แก้ไขผู้รับการดูแล |
| /hirer/favorites | FavoritesPage | รายการโปรด |
| /hirer/wallet | HirerWalletPage | กระเป๋าเงิน |
| /hirer/wallet/receipt/:jobId | JobReceiptPage | ใบเสร็จ |
| /hirer/wallet/history | HirerPaymentHistoryPage | ประวัติการชำระ |

### Caregiver (ผู้ดูแล)
| Path | หน้า | คำอธิบาย |
|------|------|----------|
| /caregiver/jobs/feed | CaregiverJobFeedPage | ฟีดงาน |
| /caregiver/jobs/my-jobs | CaregiverMyJobsPage | งานของฉัน |
| /caregiver/jobs/:id/preview | JobPreviewPage | ดูรายละเอียดงาน |
| /caregiver/profile | ProfilePage | โปรไฟล์ |
| /caregiver/wallet | CaregiverWalletPage | กระเป๋าเงิน |
| /caregiver/wallet/earning/:jobId | JobEarningDetailPage | รายละเอียดรายได้ |
| /caregiver/wallet/history | EarningsHistoryPage | ประวัติรายได้ |

### Shared (ทุก role)
| Path | หน้า | คำอธิบาย |
|------|------|----------|
| /chat/:jobId | ChatRoomPage | แชท |
| /jobs/:id | JobDetailPage | รายละเอียดงาน |
| /dispute/:disputeId | DisputeChatPage | ข้อพิพาท |
| /notifications | NotificationsPage | แจ้งเตือน |
| /profile | ProfilePage | โปรไฟล์ |
| /settings | SettingsPage | ตั้งค่า |
| /kyc | KycPage | ยืนยันตัวตน |
| /wallet/bank-accounts | BankAccountsPage | บัญชีธนาคาร |

### Admin
| Path | หน้า | คำอธิบาย |
|------|------|----------|
| /admin/login | AdminLoginPage | ล็อกอิน Admin |
| /admin/dashboard | AdminDashboardPage | Dashboard |
| /admin/users | AdminUsersPage | จัดการผู้ใช้ |
| /admin/jobs | AdminJobsPage | จัดการงาน |
| /admin/financial | AdminFinancialPage | การเงิน |
| /admin/disputes | AdminDisputesPage | ข้อพิพาท |
| /admin/reports | AdminReportsPage | รายงาน |
| /admin/settings | AdminSettingsPage | ตั้งค่า |

---

## 16. โครงสร้างไฟล์โปรเจค

```
Careconnect/
├── frontend/                          # React + TypeScript (Vite)
│   └── src/
│       ├── components/                # UI Components (Button, Card, Input, Modal, etc.)
│       │   ├── navigation/            # TopBar, BottomBar
│       │   └── ui/                    # Button, Card, Input, Badge, Modal, etc.
│       ├── contexts/                  # AuthContext
│       ├── layouts/                   # MainLayout, ChatLayout, AuthLayout, AdminLayout
│       ├── pages/
│       │   ├── admin/                 # Admin pages
│       │   ├── auth/                  # Login, Register, Role selection
│       │   ├── caregiver/             # Job feed, My jobs, Wallet
│       │   ├── hirer/                 # Home, Search, Create job, Wallet
│       │   ├── public/                # Landing, About, FAQ, Contact
│       │   └── shared/                # Chat, Job detail, Profile, Notifications
│       ├── services/
│       │   ├── api.ts                 # HTTP client + type definitions
│       │   ├── appApi.ts              # Application API wrapper
│       │   └── demoStore.ts           # Client-side demo data store
│       ├── router.tsx                 # Route definitions
│       ├── routerGuards.tsx           # Auth/Role/Policy guards
│       └── utils/                     # Helpers (authStorage, etc.)
│
├── backend/                           # Node.js + Express
│   └── src/
│       ├── controllers/               # Request handlers
│       ├── middleware/                 # auth.js, errorHandler.js
│       ├── models/                    # Job.js (state machine)
│       ├── routes/                    # Route definitions
│       │   ├── authRoutes.js
│       │   ├── jobRoutes.js
│       │   ├── walletRoutes.js
│       │   ├── chatRoutes.js
│       │   ├── caregiverSearchRoutes.js
│       │   ├── disputeRoutes.js
│       │   ├── reviewRoutes.js
│       │   ├── notificationRoutes.js
│       │   ├── kycRoutes.js
│       │   ├── paymentRoutes.js
│       │   ├── careRecipientRoutes.js
│       │   ├── caregiverDocumentRoutes.js
│       │   ├── otpRoutes.js
│       │   ├── webhookRoutes.js
│       │   └── adminRoutes.js
│       ├── services/                  # Business logic
│       │   ├── authService.js
│       │   ├── jobService.js
│       │   ├── walletService.js
│       │   ├── chatService.js
│       │   ├── disputeService.js
│       │   ├── notificationService.js
│       │   ├── paymentService.js
│       │   ├── otpService.js
│       │   ├── kycService.js
│       │   └── policyService.js
│       ├── workers/                   # Background workers (trustLevelWorker)
│       ├── utils/                     # DB, validation, errors, rate limiter
│       └── server.js                  # Express app entry point
│
├── database/
│   ├── schema.sql                     # Full database schema
│   └── migrations/                    # Incremental migrations
│
├── mock-provider/                     # Mock payment/KYC/SMS provider
│
├── docker-compose.yml                 # Development environment
├── docker-compose.prod.yml            # Production environment
└── Makefile                           # Build/deploy commands
```

---

## สรุป Flow หลักแบบ End-to-End

```
1. สมัครสมาชิก → ยืนยัน OTP → เลือก Role → ยอมรับนโยบาย → ตั้งค่าโปรไฟล์
2. [Hirer] สร้างงาน → ประกาศ → ค้นหาผู้ดูแล → มอบหมาย
3. [Caregiver] เห็นงานในฟีด / ได้รับมอบหมาย → ตอบรับ
4. ระบบสร้าง Chat Thread → ทั้งสองฝ่ายแชทกัน
5. [Caregiver] Check-in (ถึงที่หมาย) → ทำงาน → Check-out (สรุปงาน)
6. ระบบชำระเงินอัตโนมัติ (Hirer → Platform → Caregiver)
7. [Hirer] รีวิวผู้ดูแล → อัปเดต Trust Score
8. [ถ้ามีปัญหา] เปิดข้อพิพาท → Admin ตัดสิน → Settle
9. [Caregiver] ถอนเงิน → Admin อนุมัติ → จ่ายเงิน
```
