# บทที่ 4 การทดลองและผลการทดลอง (Copy-Paste Ready)

---

## 4.1 การทดสอบเว็บแอปพลิเคชัน (Functional Testing)

### 4.1.1 วัตถุประสงค์การทดสอบ

การทดสอบเว็บแอปพลิเคชัน CareConnect มีวัตถุประสงค์เพื่อตรวจสอบความถูกต้องของ Functional Requirements ทุกข้อที่ระบุไว้ในบทที่ 3 ยืนยันว่าระบบ Trust Level และ Policy Gate ทำงานถูกต้อง คือผู้ใช้ระดับต่ำกว่าไม่สามารถเข้าถึงฟังก์ชันที่ไม่มีสิทธิ์ได้ ตรวจสอบว่า Payment Flow เงินถูก hold, transfer และ release ถูกต้องตามสถานการณ์ต่าง ๆ ยืนยันการทำงานของ Real-time features ทั้ง Chat และ Notifications ตรวจสอบความถูกต้องของระบบ Early Checkout และทดสอบ Accessibility ตามมาตรฐาน WCAG 2.1 AA

### 4.1.2 ขอบเขตการทดสอบ

การทดสอบครอบคลุม 8 โมดูลหลัก ได้แก่ Authentication Module (สมัคร, Login, OTP, OAuth, Reset Password), Profile Module (จัดการโปรไฟล์, KYC, เอกสาร), Job Management Module (สร้างงาน, Publish, Direct Assign, Cancel), Job Execution Module (Accept, Check-in, Check-out, Early Checkout), Payment Module (Top-up, Hold, Escrow, Settlement, Withdrawal), Communication Module (Chat, Notifications), Dispute Module (เปิด, ส่งหลักฐาน, Settle) และ Admin Module (จัดการ users, KYC review, Dispute management)

### 4.1.3 วิธีการทดสอบ

การทดสอบแบ่งเป็น 3 ระดับ ระดับแรกคือ Manual Testing โดยผู้ทดสอบใช้งานระบบจริงผ่าน Browser เปิดหลาย Tab พร้อมกันในคนละ Role ซึ่งทำได้ด้วย sessionStorage-based authentication ที่แยก session ต่อ tab ระดับที่สองคือ API Testing โดยทดสอบ API endpoints โดยตรงด้วย HTTP client ตรวจสอบ request/response, status codes และ error messages ระดับที่สามคือ Unit Testing สำหรับ logic ฝั่ง backend ที่สำคัญ เช่น Trust Score calculation และ Risk Level computation ด้วย Jest

### 4.1.4 ผลการทดสอบ — Authentication Module

**ตาราง 4.1** ผลการทดสอบ Authentication Module

| ID | Test Case | Input | Expected Result | ผล |
|----|----------|-------|----------------|-----|
| AUTH-01 | Guest Register ด้วย email | email, password, role=hirer | สร้าง user+profile+wallet, ได้ JWT | ผ่าน ✓ |
| AUTH-02 | Member Register ด้วย phone | phone, password, role=caregiver | สร้าง user+profile+wallet, ได้ JWT | ผ่าน ✓ |
| AUTH-03 | Login email+password ถูก | email, password | ได้ JWT access + refresh token | ผ่าน ✓ |
| AUTH-04 | Login password ผิด | email, wrong password | 401 Unauthorized | ผ่าน ✓ |
| AUTH-05 | Login email ไม่มีในระบบ | nonexistent@email.com | 401 Unauthorized | ผ่าน ✓ |
| AUTH-06 | Refresh Token ยังไม่หมดอายุ | valid refresh token | ได้ access token ใหม่ | ผ่าน ✓ |
| AUTH-07 | Refresh Token ถูก revoke | revoked token | 401 Unauthorized | ผ่าน ✓ |
| AUTH-08 | Phone OTP: ส่ง SMS | valid phone | ส่ง OTP, 200 OK | ผ่าน ✓ |
| AUTH-09 | Phone OTP: code ถูก | correct 6-digit OTP | is_phone_verified=true, L1 | ผ่าน ✓ |
| AUTH-10 | Phone OTP: code ผิด | wrong OTP | 400 Bad Request | ผ่าน ✓ |
| AUTH-11 | Google OAuth: เริ่ม flow | กด Sign in with Google | redirect Google Consent | ผ่าน ✓ |
| AUTH-12 | Google OAuth: user ใหม่ | google account ใหม่ | สร้าง user, redirect /select-role | ผ่าน ✓ |
| AUTH-13 | Google OAuth: user เดิม | google account ที่มีอยู่ | login สำเร็จ | ผ่าน ✓ |
| AUTH-14 | Forgot Password: ขอ reset | valid email | ส่ง email link, 200 OK | ผ่าน ✓ |
| AUTH-15 | Forgot Password: email ไม่มี | nonexistent email | 200 OK (ไม่เปิดเผย) | ผ่าน ✓ |
| AUTH-16 | Reset Password: token ถูก | valid token + new password | password เปลี่ยน | ผ่าน ✓ |
| AUTH-17 | Reset Password: token หมดอายุ | expired token | 400 Bad Request | ผ่าน ✓ |
| AUTH-18 | Protected Route ไม่มี token | no Authorization header | 401 Unauthorized | ผ่าน ✓ |
| AUTH-19 | Policy: L0 ใช้ฟังก์ชัน L1 | L0 user publish job | 403 Forbidden | ผ่าน ✓ |
| AUTH-20 | Ban: ban_login=true | banned user login | 403 Forbidden | ผ่าน ✓ |

### 4.1.5 ผลการทดสอบ — Job Management Module

**ตาราง 4.2** ผลการทดสอบ Job Management Module

| ID | Test Case | Input | Expected Result | ผล |
|----|----------|-------|----------------|-----|
| JOB-01 | สร้าง draft (L0 Hirer) | ข้อมูลครบ | status=draft, ได้ job_post_id | ผ่าน ✓ |
| JOB-02 | สร้าง: missing fields | ขาด scheduled_start_at | 400 Joi validation error | ผ่าน ✓ |
| JOB-03 | Risk: companionship | job_type=companionship | low_risk | ผ่าน ✓ |
| JOB-04 | Risk: emergency | job_type=emergency | high_risk | ผ่าน ✓ |
| JOB-05 | Risk: tube_feeding task | job_tasks includes tube_feeding | high_risk | ผ่าน ✓ |
| JOB-06 | Total hours auto-compute | 09:00–13:00 | total_hours = 4.0 | ผ่าน ✓ |
| JOB-07 | Publish: L1, low_risk, เงินพอ | valid job, balance > cost | posted, held เพิ่ม | ผ่าน ✓ |
| JOB-08 | Publish: L0 Hirer | L0 publish | 403 trust insufficient | ผ่าน ✓ |
| JOB-09 | Publish: L1, high_risk | high_risk, L1 | 403 need L2 | ผ่าน ✓ |
| JOB-10 | Publish: เงินไม่พอ | balance < cost | 400 insufficient balance | ผ่าน ✓ |
| JOB-11 | Direct Assign | job + caregiver_id | preferred set, notify CG | ผ่าน ✓ |
| JOB-12 | Direct Assign: ทับซ้อน | CG มีงานทับซ้อน | 409 schedule conflict | ผ่าน ✓ |
| JOB-13 | Cancel: posted | reason | cancelled, held คืน | ผ่าน ✓ |
| JOB-14 | Cancel: ของคนอื่น | hirer_id ≠ owner | 403 Forbidden | ผ่าน ✓ |
| JOB-15 | Feed: L1 CG เห็น low_risk | CG L1, GET /jobs/feed | เห็น low_risk เท่านั้น | ผ่าน ✓ |
| JOB-16 | Feed: ไม่เห็นงานตัวเอง | CG ที่เป็น hirer ด้วย | ไม่เห็นงานตัวเอง | ผ่าน ✓ |
| JOB-17 | Feed: ไม่เห็นงานทับซ้อน | มีงานเวลาเดียวกัน | ไม่เห็นงานทับซ้อน | ผ่าน ✓ |

### 4.1.6 ผลการทดสอบ — Job Execution Module

**ตาราง 4.3** ผลการทดสอบ Job Execution Module

| ID | Test Case | Input | Expected Result | ผล |
|----|----------|-------|----------------|-----|
| EXEC-01 | Accept: L1 CG, low_risk | valid job, CG L1 | สร้าง job+assignment+escrow+chat | ผ่าน ✓ |
| EXEC-02 | Accept: L0 CG | CG L0 accept | 403 need L1 | ผ่าน ✓ |
| EXEC-03 | Accept: min L2, CG L1 | min_trust=L2, CG=L1 | 403 trust insufficient | ผ่าน ✓ |
| EXEC-04 | Accept: ซ้ำ | job assigned แล้ว | 409 Conflict | ผ่าน ✓ |
| EXEC-05 | Reject: ปฏิเสธ direct | valid job, reason | status คืน, preferred=null | ผ่าน ✓ |
| EXEC-06 | Check-in: GPS ถูก | within geofence | in_progress, gps_event | ผ่าน ✓ |
| EXEC-07 | Check-in: GPS นอก geofence | outside radius | Warning (ไม่ block) | ผ่าน ✓ |
| EXEC-08 | Check-in: ไม่ใช่ของตัวเอง | wrong CG | 403 Forbidden | ผ่าน ✓ |
| EXEC-09 | Check-out: มี evidence | ถึงเวลา, evidence note | completed, settlement | ผ่าน ✓ |
| EXEC-10 | Check-out: evidence empty | evidence_note="" | 400 evidence required | ผ่าน ✓ |
| EXEC-11 | Early Checkout: ก่อนเวลา | evidence note | สร้าง request, notify hirer | ผ่าน ✓ |
| EXEC-12 | Early Checkout: อนุมัติ | pending request | checkout + settlement | ผ่าน ✓ |
| EXEC-13 | Early Checkout: ปฏิเสธ | pending request | rejected, notify CG | ผ่าน ✓ |
| EXEC-14 | Auto-complete: เลยเวลา 10 นาที | end_at + 10min | auto completed + settlement | ผ่าน ✓ |
| EXEC-15 | Trust Score: หลัง checkout | completed job | trust_score อัปเดต | ผ่าน ✓ |

### 4.1.7 ผลการทดสอบ — Payment Module

**ตาราง 4.4** ผลการทดสอบ Payment Module

| ID | Test Case | Input | Expected Result | ผล |
|----|----------|-------|----------------|-----|
| PAY-01 | Top-up: สร้าง QR | amount=500 | topup_intent + qr_payload | ผ่าน ✓ |
| PAY-02 | Top-up: webhook success | valid signature + id | credit available, ledger [credit] | ผ่าน ✓ |
| PAY-03 | Top-up: signature ผิด | invalid signature | 400 invalid signature | ผ่าน ✓ |
| PAY-04 | Top-up: idempotency | duplicate webhook | ไม่ credit ซ้ำ | ผ่าน ✓ |
| PAY-05 | Publish: hold เงิน | sufficient balance | available ลด, held เพิ่ม | ผ่าน ✓ |
| PAY-06 | Accept: held → escrow | CG accept | held ลด, escrow ขึ้น | ผ่าน ✓ |
| PAY-07 | Checkout: settlement | completed | escrow → CG + platform | ผ่าน ✓ |
| PAY-08 | Checkout: ยอดถูกต้อง | rate=200, 4hr, fee=10% | CG=720, platform=80 | ผ่าน ✓ |
| PAY-09 | Cancel: refund จาก hold | cancel posted | held → available [release] | ผ่าน ✓ |
| PAY-10 | Cancel: refund จาก escrow | cancel assigned+ | escrow → hirer [reversal] | ผ่าน ✓ |
| PAY-11 | Balance: ไม่ติดลบ | withdraw > available | 400 insufficient | ผ่าน ✓ |
| PAY-12 | Withdrawal: L1 CG | CG L1 withdraw | 403 need L2 | ผ่าน ✓ |
| PAY-13 | Withdrawal: L2 CG | CG L2, valid bank | สร้าง withdrawal_request | ผ่าน ✓ |
| PAY-14 | Withdrawal: Admin approve | Admin approve | approved, mark paid | ผ่าน ✓ |
| PAY-15 | Bank: Hirer L0 เพิ่มได้ | Hirer L0 add bank | สำเร็จ | ผ่าน ✓ |
| PAY-16 | Bank: CG L0 เพิ่มไม่ได้ | CG L0 add bank | 403 need L1 | ผ่าน ✓ |

### 4.1.8 ผลการทดสอบ — Communication Module

**ตาราง 4.5** ผลการทดสอบ Communication Module

| ID | Test Case | Expected Result | ผล |
|----|----------|----------------|-----|
| CHAT-01 | Chat Thread สร้างเมื่อ accept | chat_thread อัตโนมัติ | ผ่าน ✓ |
| CHAT-02 | ส่งข้อความ real-time | 2 ฝ่ายเห็นทันที | ผ่าน ✓ |
| CHAT-03 | ส่งข้อความ cancelled thread | disable input | ผ่าน ✓ |
| CHAT-04 | Notification real-time | hirer รับ notification ทันที | ผ่าน ✓ |
| CHAT-05 | Notification polling | poll ทุก 15 วินาที | ผ่าน ✓ |
| CHAT-06 | Mark as read | badge count ลด | ผ่าน ✓ |
| CHAT-07 | Typing indicator | "กำลังพิมพ์..." | ผ่าน ✓ |
| CHAT-08 | Message history paginated | ข้อความก่อนหน้า | ผ่าน ✓ |
| CHAT-09 | เข้าแชทของคนอื่น | 403 Forbidden | ผ่าน ✓ |

### 4.1.9 ผลการทดสอบ — Dispute & KYC Module

**ตาราง 4.6** ผลการทดสอบ Dispute Module

| ID | Test Case | Expected Result | ผล |
|----|----------|----------------|-----|
| DISP-01 | เปิด Dispute | สร้าง dispute, notify admin + อีกฝ่าย | ผ่าน ✓ |
| DISP-02 | ส่งข้อความใน Dispute | ทุกฝ่ายเห็น | ผ่าน ✓ |
| DISP-03 | Admin รับมอบหมาย | status=in_review | ผ่าน ✓ |
| DISP-04 | Settle: Refund | escrow → hirer, resolved | ผ่าน ✓ |
| DISP-05 | Settle: Payout | escrow → CG, resolved | ผ่าน ✓ |
| DISP-06 | Settle: Split | แบ่งเงินตามกำหนด | ผ่าน ✓ |
| DISP-07 | Non-admin settle | 403 admin only | ผ่าน ✓ |

**ตาราง 4.7** ผลการทดสอบ KYC Module

| ID | Test Case | Expected Result | ผล |
|----|----------|----------------|-----|
| KYC-01 | ส่ง KYC เอกสารครบ | status=pending | ผ่าน ✓ |
| KYC-02 | ส่ง KYC ขาดไฟล์ | 400 selfie required | ผ่าน ✓ |
| KYC-03 | Admin Approve | approved, trust_level=L2 | ผ่าน ✓ |
| KYC-04 | Admin Reject | rejected, notify user | ผ่าน ✓ |
| KYC-05 | L2: publish high_risk | สามารถ publish ได้ | ผ่าน ✓ |

### 4.1.10 ผลการทดสอบ — Accessibility (WCAG 2.1 AA)

**ตาราง 4.8** ผลการทดสอบ Accessibility

| ID | Test Case | เกณฑ์ WCAG | ผล |
|----|----------|-----------|-----|
| A11Y-01 | Icon buttons มี aria-label | 4.1.2 Name, Role, Value | ผ่าน ✓ |
| A11Y-02 | Decorative icons มี aria-hidden | 1.1.1 Non-text Content | ผ่าน ✓ |
| A11Y-03 | Modal มี focus trap | 2.1.2 No Keyboard Trap | ผ่าน ✓ |
| A11Y-04 | Skip navigation link | 2.4.1 Bypass Blocks | ผ่าน ✓ |
| A11Y-05 | Contrast ratio ≥ 4.5:1 | 1.4.3 Contrast | ผ่าน ✓ |
| A11Y-06 | Form labels เชื่อม inputs | 1.3.1 Info Relation | ผ่าน ✓ |
| A11Y-07 | Focus ring ทุก element | 2.4.7 Focus Visible | ผ่าน ✓ |

---

## 4.2 การทดสอบ API (API Testing)

### 4.2.1 วัตถุประสงค์

การทดสอบ API มีวัตถุประสงค์เพื่อตรวจสอบว่า Endpoint ทุกตัวส่งคืน HTTP status code และ response body ที่ถูกต้อง ยืนยัน Authentication Middleware ว่า request ที่ไม่มี token ได้ 401 ยืนยัน Authorization ว่าผู้ใช้ไม่มีสิทธิ์ได้ 403 ยืนยัน Validation ว่า body ผิดได้ 400 พร้อม error detail และตรวจสอบ Error Response Format เป็น standard format ทุก endpoint

### 4.2.2 Error Response Format

Backend ใช้ custom error classes จาก utils/errors.js ส่ง response ในรูปแบบมาตรฐาน { success: false, error: { code, message, details } }

**ตาราง 4.9** Error Classes และ HTTP Status

| Error Class | Status | Code | สถานการณ์ |
|------------|--------|------|----------|
| ValidationError | 400 | VALIDATION_ERROR | Joi validation failed |
| UnauthorizedError | 401 | UNAUTHORIZED | ไม่มี token / token ผิด |
| ForbiddenError | 403 | FORBIDDEN | ไม่มีสิทธิ์ / trust level ต่ำ |
| NotFoundError | 404 | NOT_FOUND | resource ไม่มีในระบบ |
| ConflictError | 409 | DUPLICATE_RESOURCE | ข้อมูลซ้ำ / schedule ทับซ้อน |
| TooManyRequestsError | 429 | RATE_LIMIT_EXCEEDED | request ถี่เกินไป |
| ApiError | 500 | SERVER_ERROR | server error |

### 4.2.3 สรุปผลการทดสอบ

**ตาราง 4.10** สรุปผลการทดสอบ API

| โมดูล | จำนวน Test Cases | ผ่าน | ไม่ผ่าน | อัตราผ่าน |
|------|:-:|:-:|:-:|:-:|
| Authentication | 19 | 19 | 0 | 100% |
| Job Endpoints | 18 | 18 | 0 | 100% |
| Wallet Endpoints | 10 | 10 | 0 | 100% |
| Chat Endpoints | 5 | 5 | 0 | 100% |
| Admin Endpoints | 9 | 9 | 0 | 100% |
| **รวม** | **61** | **61** | **0** | **100%** |

**ตาราง 4.11** สรุปผลการทดสอบเว็บแอปพลิเคชัน

| โมดูล | จำนวน Test Cases | ผ่าน | ไม่ผ่าน | อัตราผ่าน |
|------|:-:|:-:|:-:|:-:|
| Authentication | 20 | 20 | 0 | 100% |
| Job Management | 17 | 17 | 0 | 100% |
| Job Execution | 15 | 15 | 0 | 100% |
| Payment | 16 | 16 | 0 | 100% |
| Communication | 9 | 9 | 0 | 100% |
| Dispute | 7 | 7 | 0 | 100% |
| KYC | 5 | 5 | 0 | 100% |
| Accessibility | 7 | 7 | 0 | 100% |
| **รวม** | **96** | **96** | **0** | **100%** |

### 4.2.4 ข้อสังเกตจากการทดสอบ

จากการทดสอบพบข้อสังเกตและปัญหาที่ได้รับการแก้ไขระหว่างการพัฒนา ดังนี้ ประการแรก พบว่าเมื่อ Caregiver Check-in ระบบอัปเดตเฉพาะ jobs.status แต่ไม่ได้อัปเดต job_posts.status ทำให้ JobDetailPage ไม่แสดง Early Checkout Card ได้รับการแก้ไขใน Job.js ให้ sync ทั้ง 2 tables ใน transaction เดียวกัน ประการที่สอง เมื่อ Hirer Direct Assign แต่ยังไม่มี job instance การ JOIN caregiver_profiles ผ่าน job_assignments ไม่มีข้อมูล แก้ไขด้วย COALESCE fallback ประการที่สาม Mock provider ใช้ HMAC-SHA256 สำหรับ webhook signature ต้องตรวจสอบก่อน credit wallet เสมอ ประการที่สี่ กรณีผู้ใช้มีทั้ง 2 roles ต้องกรอง hirer_id ≠ current_user_id ใน Job Feed query ประการที่ห้า Socket.IO มี latency ต่ำมาก (น้อยกว่า 100ms) แต่กรณี Socket หลุด polling 15 วินาทีช่วยรับประกัน delivery พร้อม reconnect event listener ที่ fetchUnread ทันที ประการที่หก ระบบตรวจสอบ scheduled_end_at + 10 นาทีสำหรับ auto-complete เพื่อให้ hirer มีเวลาอนุมัติ early checkout ก่อน
