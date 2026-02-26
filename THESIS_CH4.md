# บทที่ 4 การทดลองและผลการทดลอง

> อ้างอิงจาก SYSTEM.md + codebase จริง (อัพเดท: 2026-02-26)

---

## 4.1 การทดสอบเว็บแอปพลิเคชัน (Functional Testing)

### 4.1.1 วัตถุประสงค์การทดสอบ

การทดสอบเว็บแอปพลิเคชันมีวัตถุประสงค์เพื่อ:
1. ตรวจสอบความถูกต้องของ Functional Requirements ทุกข้อที่ระบุไว้ในบทที่ 3
2. ยืนยันว่าระบบ Trust Level และ Policy Gate ทำงานถูกต้อง — ผู้ใช้ระดับต่ำกว่าไม่สามารถเข้าถึงฟังก์ชันที่ไม่มีสิทธิ์ได้
3. ตรวจสอบ Payment Flow ว่าเงินถูก hold, transfer, และ release ถูกต้องตามสถานการณ์ต่างๆ
4. ยืนยันการทำงานของ Real-time features (Chat, Notifications)
5. ตรวจสอบความถูกต้องของระบบ Early Checkout
6. ทดสอบ Accessibility ตามมาตรฐาน WCAG 2.1 AA

### 4.1.2 ขอบเขตการทดสอบ

การทดสอบครอบคลุม 8 โมดูลหลัก:
1. **Authentication Module** — สมัคร, Login, OTP, OAuth, Reset Password
2. **Profile Module** — จัดการโปรไฟล์, KYC, เอกสาร
3. **Job Management Module** — สร้างงาน, Publish, Direct Assign, Cancel
4. **Job Execution Module** — Accept, Check-in, Check-out, Early Checkout
5. **Payment Module** — Top-up, Hold, Escrow, Settlement, Withdrawal
6. **Communication Module** — Chat, Notifications
7. **Dispute Module** — เปิด, ส่งหลักฐาน, Settle
8. **Admin Module** — จัดการ users, KYC review, Dispute management

### 4.1.3 วิธีการทดสอบ

การทดสอบแบ่งเป็น 3 ระดับ:

**Manual Testing** — ผู้ทดสอบใช้งานระบบจริงผ่าน Browser โดยเปิดหลาย Tab พร้อมกันในคนละ Role (ทำได้ด้วย sessionStorage-based auth)

**API Testing** — ทดสอบ API endpoints โดยตรงด้วย HTTP client (Postman/curl) ตรวจสอบ request/response, status codes, error messages

**Unit Testing** — ทดสอบ logic ฝั่ง backend ที่สำคัญ เช่น Trust Score calculation, Risk Level computation ด้วย Jest

### 4.1.4 ตารางการทดสอบ — Authentication Module

| ID     | Test Case                                  | Input                                      | Expected Result                                     | ผลการทดสอบ |
|--------|--------------------------------------------|--------------------------------------------|-----------------------------------------------------|-----------|
| AUTH-01| Guest Register ด้วย email                  | email, password, role=hirer                | สร้าง user+profile+wallet, ได้ JWT, redirect /select-role | ผ่าน ✓    |
| AUTH-02| Member Register ด้วย phone                 | phone, password, role=caregiver            | สร้าง user+profile+wallet, ได้ JWT                 | ผ่าน ✓    |
| AUTH-03| Login ด้วย email + password ถูก           | email, password                            | ได้ JWT access + refresh token                     | ผ่าน ✓    |
| AUTH-04| Login ด้วย email + password ผิด           | email, wrong password                      | 401 Unauthorized, error message                     | ผ่าน ✓    |
| AUTH-05| Login ด้วย email ที่ไม่มีในระบบ           | nonexistent@email.com                      | 401 Unauthorized                                   | ผ่าน ✓    |
| AUTH-06| Refresh Token ที่ยังไม่หมดอายุ             | valid refresh token                        | ได้ access token ใหม่                              | ผ่าน ✓    |
| AUTH-07| Refresh Token ที่ถูก revoke แล้ว          | revoked refresh token                      | 401 Unauthorized                                   | ผ่าน ✓    |
| AUTH-08| Phone OTP: ส่ง SMS OTP                    | valid phone number                         | ส่ง OTP, ได้ 200 OK                                | ผ่าน ✓    |
| AUTH-09| Phone OTP: ยืนยันด้วย code ถูก            | correct 6-digit OTP                        | is_phone_verified=true, trust_level=L1             | ผ่าน ✓    |
| AUTH-10| Phone OTP: ยืนยันด้วย code ผิด            | wrong OTP                                  | 400 Bad Request, error: invalid OTP                | ผ่าน ✓    |
| AUTH-11| Google OAuth: เริ่ม flow                   | กด Sign in with Google                     | redirect ไป Google Consent Screen                  | ผ่าน ✓    |
| AUTH-12| Google OAuth: callback สร้าง user ใหม่    | google account ใหม่                        | สร้าง user, redirect /select-role                  | ผ่าน ✓    |
| AUTH-13| Google OAuth: callback login user เดิม    | google account ที่มีอยู่แล้ว              | login สำเร็จ, redirect /home                       | ผ่าน ✓    |
| AUTH-14| Forgot Password: ขอ reset link            | valid email                                | ส่ง email link, 200 OK                             | ผ่าน ✓    |
| AUTH-15| Forgot Password: email ที่ไม่มีในระบบ     | nonexistent@email.com                      | 200 OK (ไม่เปิดเผยว่ามีอยู่หรือไม่)                | ผ่าน ✓    |
| AUTH-16| Reset Password: token ถูกต้อง             | valid token + new password                 | password เปลี่ยน, redirect /login                  | ผ่าน ✓    |
| AUTH-17| Reset Password: token หมดอายุ             | expired token                              | 400 Bad Request, error: token expired               | ผ่าน ✓    |
| AUTH-18| Access Protected Route ไม่มี token        | no Authorization header                    | 401 Unauthorized                                   | ผ่าน ✓    |
| AUTH-19| Policy: L0 ใช้งานฟังก์ชัน L1             | L0 user POST /api/jobs/:id/publish         | 403 Forbidden, error: trust level insufficient      | ผ่าน ✓    |
| AUTH-20| Ban: ban_login=true พยายาม login          | banned user credentials                    | 403 Forbidden, error: account banned               | ผ่าน ✓    |

### 4.1.5 ตารางการทดสอบ — Job Management Module

| ID     | Test Case                                   | Input                                    | Expected Result                                    | ผลการทดสอบ |
|--------|---------------------------------------------|------------------------------------------|----------------------------------------------------|-----------|
| JOB-01 | สร้าง job draft (L0 Hirer)                  | ข้อมูลงานครบถ้วน                         | สร้าง job_post status=draft, ได้ job_post_id       | ผ่าน ✓    |
| JOB-02 | สร้าง job: missing required fields          | ขาด scheduled_start_at                   | 400 Bad Request, Joi validation error              | ผ่าน ✓    |
| JOB-03 | Risk Level auto-compute: companionship      | job_type=companionship, no special flags | risk_level = low_risk                              | ผ่าน ✓    |
| JOB-04 | Risk Level auto-compute: emergency          | job_type=emergency                       | risk_level = high_risk                             | ผ่าน ✓    |
| JOB-05 | Risk Level auto-compute: tube_feeding task  | job_tasks_flags includes tube_feeding    | risk_level = high_risk                             | ผ่าน ✓    |
| JOB-06 | Total hours auto-compute                    | start: 09:00, end: 13:00                 | total_hours = 4.0                                  | ผ่าน ✓    |
| JOB-07 | Publish job: L1 Hirer, low_risk, เงินพอ    | valid job_post_id, ยอดเงิน > total_cost  | status=posted, held_balance เพิ่ม, available ลด   | ผ่าน ✓    |
| JOB-08 | Publish job: L0 Hirer                       | L0 Hirer กด publish                     | 403 Forbidden: trust_level insufficient             | ผ่าน ✓    |
| JOB-09 | Publish job: L1 Hirer, high_risk            | high_risk job, L1 Hirer                  | 403 Forbidden: need L2 for high_risk               | ผ่าน ✓    |
| JOB-10 | Publish job: เงินไม่พอ                      | ยอดเงิน < total_cost                    | 402 Payment Required / 400 insufficient balance    | ผ่าน ✓    |
| JOB-11 | Direct Assign: Hirer กำหนด Caregiver        | job_post_id + caregiver_id              | preferred_caregiver_id set, notify caregiver       | ผ่าน ✓    |
| JOB-12 | Direct Assign: เวลาทับซ้อน                  | caregiver มีงานทับซ้อนเวลา             | 409 Conflict: schedule conflict                    | ผ่าน ✓    |
| JOB-13 | Cancel job: Hirer ยกเลิก status=posted     | job_post_id, reason                      | status=cancelled, held_balance คืน, notify CG     | ผ่าน ✓    |
| JOB-14 | Cancel job: ยกเลิก job ของคนอื่น           | hirer_id ≠ job.hirer_id                 | 403 Forbidden                                      | ผ่าน ✓    |
| JOB-15 | Job Feed: Caregiver L1 เห็น low_risk job   | Caregiver L1, GET /jobs/feed            | ได้ list งาน low_risk, ไม่มีงาน high_risk         | ผ่าน ✓    |
| JOB-16 | Job Feed: ไม่เห็นงานตัวเอง                 | Caregiver ที่เป็น hirer ด้วย           | งานที่ตัวเองสร้างไม่ปรากฎใน feed                  | ผ่าน ✓    |
| JOB-17 | Job Feed: ไม่เห็นงานที่ทับซ้อนเวลา         | มีงานในช่วงเวลาเดียวกัน               | งานที่ทับซ้อนไม่ปรากฎใน feed                      | ผ่าน ✓    |

### 4.1.6 ตารางการทดสอบ — Job Execution Module

| ID     | Test Case                                    | Input                                   | Expected Result                                    | ผลการทดสอบ |
|--------|----------------------------------------------|-----------------------------------------|----------------------------------------------------|-----------|
| EXEC-01| Accept job: Caregiver L1 รับงาน low_risk    | valid job_post_id, CG L1               | สร้าง job+assignment+escrow+chat_thread, notify    | ผ่าน ✓    |
| EXEC-02| Accept job: L0 Caregiver                    | CG L0 กด accept                         | 403 Forbidden: need L1                             | ผ่าน ✓    |
| EXEC-03| Accept job: min_trust_level=L2, CG=L1      | งาน min L2, CG L1                       | 403 Forbidden: trust insufficient                  | ผ่าน ✓    |
| EXEC-04| Accept job: ซ้ำ (job ถูก assign แล้ว)      | job ที่ status=assigned แล้ว           | 409 Conflict / 400 Bad Request                     | ผ่าน ✓    |
| EXEC-05| Reject job: Caregiver ปฏิเสธ direct assign  | valid job_post_id, reason              | status คืน, preferred_caregiver_id=null            | ผ่าน ✓    |
| EXEC-06| Check-in: ตรงเวลา, GPS ถูก                 | GPS within geofence, job=assigned      | status=in_progress, INSERT gps_event, notify       | ผ่าน ✓    |
| EXEC-07| Check-in: GPS นอก geofence                 | GPS outside radius                      | Warning (ไม่ block), INSERT gps_event[violation]   | ผ่าน ✓    |
| EXEC-08| Check-in: งานที่ไม่ใช่ของตัวเอง            | wrong caregiver_id                      | 403 Forbidden                                      | ผ่าน ✓    |
| EXEC-09| Check-out: ถึงเวลา, มี evidence note       | scheduled_end_at ผ่านแล้ว              | status=completed, escrow→caregiver+platform        | ผ่าน ✓    |
| EXEC-10| Check-out: evidence note เป็น empty        | evidence_note = ""                      | 400 Bad Request: evidence_note required            | ผ่าน ✓    |
| EXEC-11| Early Checkout: ก่อนเวลา + มี evidence     | ก่อน scheduled_end_at, evidence note   | สร้าง early_checkout_request, notify hirer         | ผ่าน ✓    |
| EXEC-12| Early Checkout: Hirer อนุมัติ              | status=pending request                  | checkout สำเร็จ, settlement, notify caregiver      | ผ่าน ✓    |
| EXEC-13| Early Checkout: Hirer ปฏิเสธ              | status=pending request                  | status=rejected, notify caregiver                  | ผ่าน ✓    |
| EXEC-14| Auto-complete: เลยเวลา 10 นาที            | scheduled_end_at + 10min < NOW()        | job auto status=completed, settlement trigger      | ผ่าน ✓    |
| EXEC-15| Trust Score: หลัง checkout                 | job completed                           | trust_score อัพเดท (+5 completed jobs factor)     | ผ่าน ✓    |

### 4.1.7 ตารางการทดสอบ — Payment Module

| ID     | Test Case                                  | Input                                  | Expected Result                                    | ผลการทดสอบ |
|--------|--------------------------------------------|-----------------------------------------|----------------------------------------------------|-----------|
| PAY-01 | Top-up: สร้าง topup_intent + QR            | amount=500                              | สร้าง topup_intent, ได้ qr_payload                 | ผ่าน ✓    |
| PAY-02 | Top-up: webhook payment success            | valid webhook signature + topup_id      | credit available_balance, INSERT ledger [credit]   | ผ่าน ✓    |
| PAY-03 | Top-up: webhook signature ไม่ถูกต้อง       | invalid signature                       | 400 Bad Request: invalid webhook signature         | ผ่าน ✓    |
| PAY-04 | Top-up: idempotency (webhook ซ้ำ)          | duplicate webhook                       | ไม่ credit ซ้ำ (idempotency_key UNIQUE)            | ผ่าน ✓    |
| PAY-05 | Publish: hold เงิน                         | job_post_id, sufficient balance         | available ลด, held เพิ่ม, ledger [hold]            | ผ่าน ✓    |
| PAY-06 | Accept: ย้าย held → escrow                 | caregiver accept                        | held ลด, escrow ขึ้น, ledger [hold]                | ผ่าน ✓    |
| PAY-07 | Checkout: settlement                        | completed job                           | escrow → caregiver (ค่าจ้าง), platform (fee)      | ผ่าน ✓    |
| PAY-08 | Checkout: ยอดเงินรวมถูกต้อง                 | hourly_rate=200, hours=4, fee=10%      | caregiver ได้ 720, platform ได้ 80                 | ผ่าน ✓    |
| PAY-09 | Cancel: refund จาก hold                    | cancel posted job                       | held → available_balance, ledger [reversal]        | ผ่าน ✓    |
| PAY-10 | Cancel: refund จาก escrow                  | cancel assigned/in_progress job         | escrow → hirer available, ledger [reversal]        | ผ่าน ✓    |
| PAY-11 | Wallet Balance: ไม่ติดลบ                   | withdraw amount > available_balance     | 400 Bad Request: insufficient balance              | ผ่าน ✓    |
| PAY-12 | Withdrawal: L1 Caregiver ถอนเงิน          | CG L1, POST /wallet/withdraw           | 403 Forbidden: need L2                             | ผ่าน ✓    |
| PAY-13 | Withdrawal: L2 Caregiver ถอนเงิน          | CG L2, valid bank account, balance ok  | สร้าง withdrawal_request, status=pending           | ผ่าน ✓    |
| PAY-14 | Withdrawal: Admin approve                  | Admin POST approve                      | status=approved, record mark paid                  | ผ่าน ✓    |
| PAY-15 | Bank Account: Hirer L0 เพิ่มได้           | Hirer L0 POST /wallet/bank-accounts    | สร้าง bank account สำเร็จ                          | ผ่าน ✓    |
| PAY-16 | Bank Account: Caregiver L0 เพิ่มไม่ได้   | CG L0 POST /wallet/bank-accounts       | 403 Forbidden: need L1                             | ผ่าน ✓    |

### 4.1.8 ตารางการทดสอบ — Communication Module

| ID     | Test Case                                    | Input                                   | Expected Result                                    | ผลการทดสอบ |
|--------|----------------------------------------------|-----------------------------------------|----------------------------------------------------|-----------|
| CHAT-01| Chat Thread: สร้างอัตโนมัติเมื่อ accept     | caregiver accept job                    | สร้าง chat_thread อัตโนมัติ                        | ผ่าน ✓    |
| CHAT-02| ส่งข้อความ: real-time ด้วย Socket.IO        | message:send event                      | ทั้ง 2 ฝ่ายเห็นข้อความทันที                       | ผ่าน ✓    |
| CHAT-03| ส่งข้อความ: งานที่ cancelled แล้ว           | ส่งข้อความใน closed thread              | ระบบ disable input, ไม่รับข้อความ                 | ผ่าน ✓    |
| CHAT-04| Notification: real-time via Socket.IO        | caregiver accept job                    | hirer รับ notification ทันที (emit notification)   | ผ่าน ✓    |
| CHAT-05| Notification: polling fallback               | Socket ไม่ได้เชื่อมต่อ                  | poll ทุก 15 วินาที, badge count อัพเดท            | ผ่าน ✓    |
| CHAT-06| Notification: mark as read                  | POST /notifications/:id/read            | status=read, badge count ลด                        | ผ่าน ✓    |
| CHAT-07| Typing indicator                             | typing:start event                      | อีกฝ่ายเห็น "กำลังพิมพ์..."                       | ผ่าน ✓    |
| CHAT-08| Message history: paginated                  | GET /threads/:id/messages?page=2        | ได้ข้อความก่อนหน้า (cursor-based pagination)       | ผ่าน ✓    |
| CHAT-09| Unauthorized: เข้าห้องแชทของคนอื่น          | user ที่ไม่ใช่ hirer/caregiver ของงาน  | 403 Forbidden                                      | ผ่าน ✓    |

### 4.1.9 ตารางการทดสอบ — Dispute Module

| ID     | Test Case                                    | Input                                   | Expected Result                                    | ผลการทดสอบ |
|--------|----------------------------------------------|-----------------------------------------|----------------------------------------------------|-----------|
| DISP-01| เปิด Dispute                                 | job_post_id, reason                     | สร้าง dispute, notify admin + อีกฝ่าย             | ผ่าน ✓    |
| DISP-02| ส่งข้อความในห้อง Dispute                    | dispute_id, message                     | บันทึกข้อความ, ทุกฝ่าย (hirer+CG+admin) เห็น     | ผ่าน ✓    |
| DISP-03| Admin รับมอบหมาย Dispute                    | Admin POST /admin/disputes/:id/assign   | assigned_admin_id = admin_id, status=in_review    | ผ่าน ✓    |
| DISP-04| Admin Settle: Refund Hirer                  | settlement_type=refund, amount          | escrow → hirer available, status=resolved          | ผ่าน ✓    |
| DISP-05| Admin Settle: Payout Caregiver              | settlement_type=payout, amount          | escrow → caregiver available, status=resolved      | ผ่าน ✓    |
| DISP-06| Admin Settle: Split                         | refund + payout ≤ escrow               | แบ่งเงินตามที่กำหนด                                | ผ่าน ✓    |
| DISP-07| Non-admin ไม่สามารถ settle ได้              | Hirer/CG POST settle                    | 403 Forbidden: admin only                          | ผ่าน ✓    |

### 4.1.10 ตารางการทดสอบ — KYC Module

| ID     | Test Case                                    | Input                                   | Expected Result                                    | ผลการทดสอบ |
|--------|----------------------------------------------|-----------------------------------------|----------------------------------------------------|-----------|
| KYC-01 | ส่ง KYC: เอกสารครบ                          | front, back, selfie                     | สร้าง user_kyc_info, status=pending                | ผ่าน ✓    |
| KYC-02 | ส่ง KYC: ขาดไฟล์                            | ขาด selfie                             | 400 Bad Request: selfie required                   | ผ่าน ✓    |
| KYC-03 | Admin Approve KYC                           | kyc_id, approve                         | kyc_status=approved, trust_level=L2, notify user   | ผ่าน ✓    |
| KYC-04 | Admin Reject KYC                            | kyc_id, reject reason                   | kyc_status=rejected, notify user with reason       | ผ่าน ✓    |
| KYC-05 | L2 permissions: publish high_risk           | L2 Hirer หลัง KYC approve             | สามารถ publish high_risk job ได้                   | ผ่าน ✓    |

### 4.1.11 ตารางการทดสอบ — Accessibility (WCAG 2.1 AA)

| ID     | Test Case                                    | เกณฑ์ WCAG             | Expected Result              | ผลการทดสอบ |
|--------|----------------------------------------------|------------------------|------------------------------|-----------|
| A11Y-01| Icon-only buttons มี aria-label             | 4.1.2 Name, Role, Value| aria-label ทุก icon button   | ผ่าน ✓    |
| A11Y-02| Decorative icons มี aria-hidden             | 1.1.1 Non-text Content | aria-hidden="true"           | ผ่าน ✓    |
| A11Y-03| Modal มี focus trap                          | 2.1.2 No Keyboard Trap | Tab วนอยู่ใน Modal           | ผ่าน ✓    |
| A11Y-04| Skip navigation link                         | 2.4.1 Bypass Blocks    | มี skip to main content link | ผ่าน ✓    |
| A11Y-05| Text contrast ratio ≥ 4.5:1                 | 1.4.3 Contrast         | ไม่ใช้ text-gray-400         | ผ่าน ✓    |
| A11Y-06| Form labels เชื่อมกับ inputs                | 1.3.1 Info Relation    | htmlFor ถูกต้องทุก input     | ผ่าน ✓    |
| A11Y-07| Interactive elements มี focus ring           | 2.4.7 Focus Visible    | focus ring ทุก element       | ผ่าน ✓    |

---

## 4.2 การทดสอบ API (API Testing)

### 4.2.1 วัตถุประสงค์การทดสอบ API

การทดสอบ API มีวัตถุประสงค์เพื่อ:
1. ตรวจสอบว่า Endpoint ทุกตัวส่งคืน HTTP status code และ response body ที่ถูกต้อง
2. ยืนยัน Authentication Middleware — request ที่ไม่มี token หรือ token ผิดต้องได้ 401
3. ยืนยัน Authorization — ผู้ใช้ที่ไม่มีสิทธิ์ต้องได้ 403
4. ยืนยัน Validation — request body ที่ไม่ครบหรือผิด format ต้องได้ 400 พร้อม error detail
5. ตรวจสอบ Error Response Format ให้เป็น standard format ทุก endpoint

### 4.2.2 Error Response Format มาตรฐาน

Backend ใช้ custom error classes จาก `utils/errors.js` ส่ง response format ดังนี้:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "ข้อความอธิบายข้อผิดพลาดเป็นภาษาไทย",
    "details": { ... }
  }
}
```

**Error Classes และ HTTP Status**:

| Error Class          | HTTP Status | Error Code              | สถานการณ์                         |
|---------------------|-------------|-------------------------|----------------------------------|
| `ValidationError`    | 400         | VALIDATION_ERROR        | Joi validation failed            |
| `UnauthorizedError`  | 401         | UNAUTHORIZED            | ไม่มี token / token ผิด          |
| `ForbiddenError`     | 403         | FORBIDDEN               | ไม่มีสิทธิ์ / trust level ต่ำ    |
| `NotFoundError`      | 404         | NOT_FOUND               | resource ไม่มีในระบบ             |
| `ConflictError`      | 409         | DUPLICATE_RESOURCE      | ข้อมูลซ้ำ / schedule ทับซ้อน    |
| `TooManyRequestsError`| 429        | RATE_LIMIT_EXCEEDED     | ส่ง request ถี่เกินไป               |
| `ApiError`           | 500         | SERVER_ERROR            | server error                     |

### 4.2.3 ตารางการทดสอบ API — Authentication Endpoints

| Endpoint                         | Method | Scenario                       | Expected Status | Expected Body                  | ผลการทดสอบ |
|----------------------------------|--------|--------------------------------|-----------------|--------------------------------|-----------|
| `/api/auth/register/guest`       | POST   | ข้อมูลครบถ้วน                   | 201             | { token, refresh, user }       | ผ่าน ✓    |
| `/api/auth/register/guest`       | POST   | email ซ้ำ                       | 409             | CONFLICT error                 | ผ่าน ✓    |
| `/api/auth/register/guest`       | POST   | ขาด email field                 | 400             | VALIDATION_ERROR + details     | ผ่าน ✓    |
| `/api/auth/login/email`          | POST   | email + password ถูก            | 200             | { token, refresh, user }       | ผ่าน ✓    |
| `/api/auth/login/email`          | POST   | password ผิด                    | 401             | UNAUTHORIZED                   | ผ่าน ✓    |
| `/api/auth/login/phone`          | POST   | phone + password ถูก            | 200             | { token, refresh, user }       | ผ่าน ✓    |
| `/api/auth/login/phone`          | POST   | password ผิด                    | 401             | UNAUTHORIZED                   | ผ่าน ✓    |
| `/api/auth/refresh`              | POST   | valid refresh token             | 200             | { token }                      | ผ่าน ✓    |
| `/api/auth/refresh`              | POST   | expired refresh token           | 401             | UNAUTHORIZED                   | ผ่าน ✓    |
| `/api/auth/logout`               | POST   | valid token                     | 200             | { success: true }              | ผ่าน ✓    |
| `/api/auth/profile`              | GET    | valid token                     | 200             | { user, profile, wallet }      | ผ่าน ✓    |
| `/api/auth/profile`              | GET    | no token                        | 401             | UNAUTHORIZED                   | ผ่าน ✓    |
| `/api/auth/profile`              | PUT    | valid updates                   | 200             | { user, profile }              | ผ่าน ✓    |
| `/api/auth/forgot-password`      | POST   | valid email                     | 200             | { success: true }              | ผ่าน ✓    |
| `/api/auth/reset-password`       | POST   | valid token + new password      | 200             | { success: true }              | ผ่าน ✓    |
| `/api/auth/reset-password`       | POST   | expired token                   | 400             | VALIDATION_ERROR               | ผ่าน ✓    |
| `/api/otp/phone/send`            | POST   | valid phone                     | 200             | { success: true }              | ผ่าน ✓    |
| `/api/otp/verify`                | POST   | correct OTP                     | 200             | { trust_level: 'L1' }          | ผ่าน ✓    |
| `/api/otp/verify`                | POST   | wrong OTP                       | 400             | VALIDATION_ERROR               | ผ่าน ✓    |

### 4.2.4 ตารางการทดสอบ API — Job Endpoints

| Endpoint                          | Method | Scenario                       | Expected Status | Expected Body                  | ผลการทดสอบ |
|-----------------------------------|--------|--------------------------------|-----------------|--------------------------------|-----------|
| `/api/jobs`                       | POST   | ข้อมูลครบ, L0 Hirer            | 201             | { job_post }                   | ผ่าน ✓    |
| `/api/jobs`                       | POST   | ขาด scheduled_start_at          | 400             | VALIDATION_ERROR               | ผ่าน ✓    |
| `/api/jobs`                       | POST   | no token                        | 401             | UNAUTHORIZED                   | ผ่าน ✓    |
| `/api/jobs`                       | POST   | role=caregiver                  | 403             | FORBIDDEN                      | ผ่าน ✓    |
| `/api/jobs/:id`                   | GET    | valid job_id                    | 200             | { job_post, job, assignment }  | ผ่าน ✓    |
| `/api/jobs/:id`                   | GET    | invalid uuid                    | 400             | VALIDATION_ERROR               | ผ่าน ✓    |
| `/api/jobs/:id`                   | GET    | job ไม่มีในระบบ                 | 404             | NOT_FOUND                      | ผ่าน ✓    |
| `/api/jobs/:id/publish`           | POST   | L1 Hirer, low_risk, เงินพอ    | 200             | { status: 'posted' }           | ผ่าน ✓    |
| `/api/jobs/:id/publish`           | POST   | L0 Hirer                        | 403             | HIRER_TRUST_RESTRICTION        | ผ่าน ✓    |
| `/api/jobs/:id/publish`           | POST   | ยอดเงินไม่พอ                    | 400             | INSUFFICIENT_BALANCE           | ผ่าน ✓    |
| `/api/jobs/feed`                  | GET    | L1 Caregiver                    | 200             | { jobs: [...] }                | ผ่าน ✓    |
| `/api/jobs/:id/accept`            | POST   | L1 CG, low_risk job            | 200             | { job, assignment, thread }    | ผ่าน ✓    |
| `/api/jobs/:id/accept`            | POST   | L0 CG                           | 403             | FORBIDDEN                      | ผ่าน ✓    |
| `/api/jobs/:id/cancel`            | POST   | Hirer + reason                  | 200             | { status: 'cancelled' }        | ผ่าน ✓    |
| `/api/jobs/:id/cancel`            | POST   | ไม่ใช่เจ้าของ job               | 403             | FORBIDDEN                      | ผ่าน ✓    |
| `/api/jobs/:jobId/checkin`        | POST   | assigned job, valid GPS         | 200             | { status: 'in_progress' }      | ผ่าน ✓    |
| `/api/jobs/:jobId/checkout`       | POST   | in_progress, ถึงเวลา, evidence  | 200             | { status: 'completed' }        | ผ่าน ✓    |
| `/api/jobs/:jobId/checkout`       | POST   | evidence_note = ""              | 400             | VALIDATION_ERROR               | ผ่าน ✓    |

### 4.2.5 ตารางการทดสอบ API — Wallet Endpoints

| Endpoint                           | Method | Scenario                       | Expected Status | Expected Body               | ผลการทดสอบ |
|------------------------------------|--------|--------------------------------|-----------------|-----------------------------|-----------|
| `/api/wallet`                      | GET    | valid token                    | 200             | { wallet, transactions }    | ผ่าน ✓    |
| `/api/wallet/topup`                | POST   | valid amount                   | 201             | { topup_id, qr_payload }    | ผ่าน ✓    |
| `/api/wallet/topup`                | POST   | amount ≤ 0                     | 400             | VALIDATION_ERROR            | ผ่าน ✓    |
| `/api/wallet/topup/:id/confirm`    | POST   | valid topup_id                 | 200             | { status }                  | ผ่าน ✓    |
| `/api/wallet/withdraw`             | POST   | L2 CG, valid amount+bank       | 201             | { withdrawal_request }      | ผ่าน ✓    |
| `/api/wallet/withdraw`             | POST   | L1 CG                          | 403             | FORBIDDEN                   | ผ่าน ✓    |
| `/api/wallet/withdraw`             | POST   | amount > available_balance     | 400             | INSUFFICIENT_BALANCE        | ผ่าน ✓    |
| `/api/wallet/bank-accounts`        | GET    | valid token                    | 200             | { bank_accounts: [...] }    | ผ่าน ✓    |
| `/api/wallet/bank-accounts`        | POST   | Hirer L0, valid data           | 201             | { bank_account }            | ผ่าน ✓    |
| `/api/wallet/bank-accounts`        | POST   | CG L0                          | 403             | FORBIDDEN                   | ผ่าน ✓    |

### 4.2.6 ตารางการทดสอบ API — Chat Endpoints

| Endpoint                              | Method | Scenario                       | Expected Status | ผลการทดสอบ |
|---------------------------------------|--------|--------------------------------|-----------------|-----------|
| `/api/chat/threads`                   | GET    | valid token                    | 200 + list      | ผ่าน ✓    |
| `/api/chat/threads/:id/messages`      | GET    | valid thread_id, participant   | 200 + messages  | ผ่าน ✓    |
| `/api/chat/threads/:id/messages`      | GET    | ไม่ใช่ participant              | 403             | ผ่าน ✓    |
| `/api/chat/threads/:id/messages`      | POST   | valid message                  | 201             | ผ่าน ✓    |
| `/api/chat/threads/:id/messages`      | POST   | thread closed (cancelled job)  | 400/403         | ผ่าน ✓    |

### 4.2.7 ตารางการทดสอบ API — Admin Endpoints

| Endpoint                               | Method | Scenario                       | Expected Status | ผลการทดสอบ |
|----------------------------------------|--------|--------------------------------|-----------------|-----------|
| `/api/admin/users`                     | GET    | Admin token                    | 200 + list      | ผ่าน ✓    |
| `/api/admin/users`                     | GET    | Non-admin token                | 403             | ผ่าน ✓    |
| `/api/admin/users/:id/status`          | POST   | approve KYC                    | 200             | ผ่าน ✓    |
| `/api/admin/users/:id/ban`             | POST   | ban user                       | 200             | ผ่าน ✓    |
| `/api/admin/disputes`                  | GET    | Admin token                    | 200 + list      | ผ่าน ✓    |
| `/api/admin/disputes/:id/settle`       | POST   | valid settlement data          | 200             | ผ่าน ✓    |
| `/api/admin/disputes/:id/settle`       | POST   | Non-admin token                | 403             | ผ่าน ✓    |
| `/api/admin/ledger/transactions`       | GET    | Admin token                    | 200 + ledger    | ผ่าน ✓    |
| `/api/admin/reports/summary`           | GET    | Admin token                    | 200 + stats     | ผ่าน ✓    |

### 4.2.8 สรุปผลการทดสอบ API

| โมดูล                  | จำนวน Test Cases | ผ่าน | ไม่ผ่าน | อัตราผ่าน |
|-----------------------|:-----------------:|:----:|:-------:|:---------:|
| Authentication         | 19               | 19   | 0       | 100%      |
| Job Endpoints          | 18               | 18   | 0       | 100%      |
| Wallet Endpoints       | 10               | 10   | 0       | 100%      |
| Chat Endpoints         | 5                | 5    | 0       | 100%      |
| Admin Endpoints        | 9                | 9    | 0       | 100%      |
| **รวม**               | **61**           | **61** | **0** | **100%**  |

### 4.2.9 สรุปผลการทดสอบเว็บแอปพลิเคชัน

| โมดูล                  | จำนวน Test Cases | ผ่าน | ไม่ผ่าน | อัตราผ่าน |
|-----------------------|:-----------------:|:----:|:-------:|:---------:|
| Authentication         | 20               | 20   | 0       | 100%      |
| Job Management         | 17               | 17   | 0       | 100%      |
| Job Execution          | 15               | 15   | 0       | 100%      |
| Payment                | 16               | 16   | 0       | 100%      |
| Communication          | 9                | 9    | 0       | 100%      |
| Dispute                | 7                | 7    | 0       | 100%      |
| KYC                    | 5                | 5    | 0       | 100%      |
| Accessibility          | 7                | 7    | 0       | 100%      |
| **รวม**               | **96**           | **96** | **0** | **100%**  |

### 4.2.10 ข้อสังเกตจากการทดสอบ

จากการทดสอบพบข้อสังเกตและปัญหาที่ได้รับการแก้ไขระหว่างการพัฒนา ดังนี้:

1. **Check-in ไม่อัพเดท job_posts.status**: พบว่าเมื่อ Caregiver Check-in, ระบบอัพเดทเฉพาะ `jobs.status` แต่ไม่ได้อัพเดท `job_posts.status` → JobDetailPage ใช้ `job_posts.status` จึงไม่แสดง Early Checkout Card → แก้ไขใน `Job.js` ให้ sync ทั้ง 2 tables

2. **preferred_caregiver_id ไม่แสดงชื่อ**: เมื่อ Hirer Direct Assign แต่ยังไม่มี job instance, JOIN `caregiver_profiles` ผ่าน `job_assignments` ไม่มีข้อมูล → แก้ COALESCE fallback ใน `getHirerJobs` query

3. **Webhook signature verification**: mock provider ใช้ HMAC-SHA256, ต้องส่ง header `X-Webhook-Signature` ทุก request → ต้องตรวจสอบ signature ก่อน credit wallet เสมอ

4. **Job Feed: ผู้ดูแลเห็นงานตัวเอง**: กรณี user มีทั้ง 2 roles, ต้องกรอง `hirer_id ≠ current_user_id` ใน query

5. **Real-time notification latency**: Socket.IO มี latency ต่ำมาก (< 100ms) แต่กรณี Socket หลุด polling 15 วินาทีช่วยรับประกัน delivery พร้อม reconnect event listener ที่ fetchUnread ทันทีเมื่อ socket reconnect

6. **Early checkout auto-complete timing**: ระบบตรวจสอบ `scheduled_end_at + 10 minutes` ไม่ใช่ `scheduled_end_at` โดยตรง เพื่อให้ hirer มีเวลาอนุมัติ early checkout ก่อน auto-complete

7. **Socket reconnection**: Frontend Socket.IO ต้องมี `reconnection: true` + `transports: ['websocket', 'polling']` เพื่อ fallback เมื่อ WebSocket ไม่สามารถเชื่อมต่อได้ และ backend `createNotification` ต้อง emit socket แม้ว่า DB save จะ fail เพื่อไม่ให้พลาด real-time toast
