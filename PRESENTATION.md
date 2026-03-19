# CareConnect — Presentation Guide

> คู่มือนำเสนอโปรเจค สำหรับสอบวิทยานิพนธ์ต่อคณะกรรมการภาควิศวกรรมคอมพิวเตอร์
> เวลาแนะนำ: 15-20 นาที นำเสนอ + 10-15 นาที Q&A

---

## โครงสร้างสไลด์ทั้งหมด (20 สไลด์)

| สไลด์ | หัวข้อ | เวลา |
|:-----:|-------|:----:|
| 1 | Title Slide | 30 วิ |
| 2 | ที่มาและความสำคัญ | 1 นาที |
| 3 | วัตถุประสงค์ | 30 วิ |
| 4 | ขอบเขตโปรเจค | 1 นาที |
| 5 | Technology Stack | 1 นาที |
| 6 | System Architecture | 1.5 นาที |
| 7 | Database Design (ERD) | 1 นาที |
| 8 | User Roles & Trust Level | 1 นาที |
| 9 | Job Lifecycle & Payment Flow | 1.5 นาที |
| 10 | Use Case Diagram | 1 นาที |
| 11 | Demo — Hirer Flow | 2 นาที |
| 12 | Demo — Caregiver Flow | 2 นาที |
| 13 | Demo — Admin Flow | 1 นาที |
| 14 | Real-time Features | 1 นาที |
| 15 | Security & Policy Gate | 1 นาที |
| 16 | Testing & Results | 1 นาที |
| 17 | ข้อจำกัด | 30 วิ |
| 18 | ข้อเสนอแนะ | 30 วิ |
| 19 | สรุป | 1 นาที |
| 20 | Q&A | — |

---

## สไลด์ 1: Title Slide

### เนื้อหาบนสไลด์
- ชื่อโปรเจค: **CareConnect — ระบบเว็บแอปพลิเคชันสำหรับเชื่อมต่อผู้ว่าจ้างกับผู้ดูแลผู้สูงอายุ**
- ชื่อผู้จัดทำ, รหัสนักศึกษา
- อาจารย์ที่ปรึกษา
- ภาควิชาวิศวกรรมคอมพิวเตอร์

### สิ่งที่ต้องพูด
> "สวัสดีครับ/ค่ะ วันนี้จะนำเสนอโปรเจค CareConnect ซึ่งเป็นระบบเว็บแอปพลิเคชันสำหรับเชื่อมต่อผู้ว่าจ้างกับผู้ดูแลผู้สูงอายุในประเทศไทย"

---

## สไลด์ 2: ที่มาและความสำคัญ

### เนื้อหาบนสไลด์
- สถิติ: ประเทศไทยก้าวเข้าสู่สังคมสูงอายุ (ผู้สูงอายุ 20%+ ของประชากร)
- ปัญหา: ขาดแพลตฟอร์มที่น่าเชื่อถือสำหรับจ้างผู้ดูแล
- ช่องว่าง: ไม่มีระบบ Trust/Verification, ไม่มี Escrow payment, ไม่มีหลักฐานการทำงาน (GPS)
- โอกาส: Two-sided marketplace ที่แก้ปัญหาทั้ง 2 ฝ่าย

### สิ่งที่ต้องพูด
> "ปัจจุบันประเทศไทยมีผู้สูงอายุมากกว่า 20% ของประชากร การหาผู้ดูแลที่ไว้วางใจได้ยังเป็นปัญหาใหญ่ ระบบที่มีอยู่ส่วนใหญ่เป็นแค่ประกาศงานธรรมดา ไม่มีระบบยืนยันตัวตน ไม่มีการรับประกันเงิน และไม่มีหลักฐานการทำงาน CareConnect จึงถูกพัฒนาขึ้นเพื่อแก้ปัญหาเหล่านี้"

### ดักคำถาม
- **ถ้าถามว่า "ทำไมต้องเป็นเว็บแอป ไม่ทำ mobile app?"**
  → "เลือกเว็บแอปเพราะเข้าถึงได้ง่ายกว่า ไม่ต้องติดตั้ง ผู้สูงอายุหรือลูกหลานเปิด browser ใช้ได้ทันที และออกแบบเป็น Responsive ใช้งานบนมือถือได้ดี ในอนาคตสามารถต่อยอดเป็น React Native ได้"
- **ถ้าถามว่า "มีคู่แข่งไหม?"**
  → "ในไทยมีบริษัทจัดหาพยาบาลแบบ offline แต่ยังไม่มีแพลตฟอร์มที่มี Trust Level System + Escrow Payment + GPS Evidence ครบวงจรแบบนี้"

---

## สไลด์ 3: วัตถุประสงค์

### เนื้อหาบนสไลด์
1. พัฒนาระบบเว็บแอปพลิเคชันสำหรับเชื่อมต่อผู้ว่าจ้างกับผู้ดูแลผู้สูงอายุ
2. พัฒนาระบบ Trust Level เพื่อยืนยันความน่าเชื่อถือของผู้ใช้
3. พัฒนาระบบ Escrow Payment เพื่อรับประกันการจ่ายเงิน
4. พัฒนาระบบ GPS Evidence เพื่อบันทึกหลักฐานการทำงาน
5. พัฒนาระบบ Real-time Chat และ Notification

### สิ่งที่ต้องพูด
> "วัตถุประสงค์หลัก 5 ข้อ ได้แก่..."  (อ่านตามสไลด์)

---

## สไลด์ 4: ขอบเขตโปรเจค

### เนื้อหาบนสไลด์
- **3 บทบาท**: ผู้ว่าจ้าง (Hirer), ผู้ดูแล (Caregiver), ผู้ดูแลระบบ (Admin)
- **40 Use Cases** ครอบคลุม 8 กลุ่มฟังก์ชัน
- **128 API Endpoints** จาก 16 Controllers
- **40 Database Tables**
- **179 Automated Tests** (Jest + Playwright)

### สิ่งที่ต้องพูด
> "ระบบรองรับ 3 บทบาทหลัก มี 40 Use Cases ครอบคลุมตั้งแต่สมัครสมาชิกจนถึงถอนเงิน Backend มี 128 API endpoints, ฐานข้อมูล 40 ตาราง และมี automated tests 179 กรณี"

### ดักคำถาม
- **"ทำคนเดียวหรือเปล่า?"**
  → "ใช่ครับ/ค่ะ ทำคนเดียวทั้ง Frontend + Backend + Database + Testing + Deployment"
- **"ใช้เวลาเท่าไร?"**
  → "ประมาณ 3-4 เดือน โดยเริ่มจาก architecture design → database schema → backend API → frontend UI → testing → documentation"

---

## สไลด์ 5: Technology Stack

### เนื้อหาบนสไลด์

| Layer | เทคโนโลยี |
|-------|----------|
| Frontend | React 18 + TypeScript + Tailwind CSS + Vite |
| Backend | Node.js + Express.js + Socket.IO |
| Database | PostgreSQL 15 (40 tables) |
| Auth | JWT + Refresh Token + Google OAuth 2.0 |
| Validation | Joi |
| Testing | Jest (179 tests) + Playwright (E2E) |
| DevOps | Docker Compose (dev/test/prod) |
| Real-time | Socket.IO (Chat + Notifications) |

### สิ่งที่ต้องพูด
> "Stack หลักคือ React + Node.js + PostgreSQL ซึ่งเป็น 3-Tier Architecture ใช้ TypeScript ฝั่ง frontend เพื่อ type safety, Tailwind CSS เพื่อความเร็วในการพัฒนา UI, Socket.IO สำหรับ real-time features, และ Docker Compose สำหรับจัดการ environment"

### ดักคำถาม
- **"ทำไมเลือก PostgreSQL ไม่ใช่ MongoDB?"**
  → "เพราะระบบมี financial transactions ที่ต้องการ ACID compliance, foreign keys, และ transaction isolation ที่ relational database ทำได้ดีกว่า เช่น escrow wallet ต้อง lock row ด้วย SELECT FOR UPDATE"
- **"ทำไมใช้ Socket.IO ไม่ใช่ WebSocket ตรงๆ?"**
  → "Socket.IO ให้ auto-reconnect, room management, fallback to polling กรณี WebSocket ไม่รองรับ และมี built-in authentication middleware"
- **"ทำไมไม่ใช้ Next.js?"**
  → "เลือก Vite + React เพราะเป็น SPA ที่ไม่ต้องการ SSR, build เร็วกว่า, และ simple architecture เหมาะกับ project scope นี้"
- **"ทำไมใช้ JWT ไม่ใช้ session?"**
  → "JWT เหมาะกับ stateless API + Socket.IO authentication, ใช้ access token หมดอายุเร็ว + refresh token สำหรับ renewal เพื่อ security"

---

## สไลด์ 6: System Architecture

### เนื้อหาบนสไลด์
- แผนภาพ 3-Tier Architecture:
  ```
  Client (Browser) → Frontend (React/Vite:5173)
       ↓ /api proxy          ↓ WSS
  Backend (Express:3000) → Socket.IO
       ↓ SQL                  ↓
  PostgreSQL (5432)      Mock Provider (4000)
  ```
- Docker Compose: 4 containers (frontend, backend, postgres, pgadmin)

### สิ่งที่ต้องพูด
> "ระบบเป็น 3-Tier Architecture ประกอบด้วย Frontend container (React+Vite), Backend container (Express+Socket.IO), PostgreSQL database, และ Mock Provider สำหรับจำลอง payment/SMS/KYC ในขั้นตอนพัฒนา Frontend ส่ง request ผ่าน /api proxy ไปยัง Backend ซึ่งเชื่อมต่อ DB ผ่าน connection pool"

### ดักคำถาม
- **"Mock Provider คืออะไร?"**
  → "เป็น service จำลองสำหรับ Payment QR, SMS OTP, KYC verification ที่ production จริงจะเปลี่ยนเป็น Omise/2C2P, SMSOK, และ provider จริง โดย architecture ออกแบบให้ swap ได้โดยไม่ต้องเปลี่ยนโค้ดหลัก"
- **"ทำไมต้อง Docker?"**
  → "เพื่อให้ทุก environment (dev/test/prod) มี setup เหมือนกัน ลดปัญหา works on my machine และ seed data ก็ load อัตโนมัติตอน init"

---

## สไลด์ 7: Database Design (ERD)

### เนื้อหาบนสไลด์
- ERD ย่อ แสดง core tables:
  - `users` → `hirer_profiles` / `caregiver_profiles`
  - `job_posts` → `jobs` → `job_assignments`
  - `wallets` → `ledger_transactions`
  - `chat_threads` → `chat_messages`
  - `disputes` → `dispute_messages`
- Highlight: **Two-table Job Pattern** (job_posts + jobs)
- Highlight: **Immutable Ledger** (append-only ledger_transactions)

### สิ่งที่ต้องพูด
> "ฐานข้อมูลมี 40 ตาราง ออกแบบด้วย 2 pattern สำคัญ ตัวแรกคือ Two-table Job Pattern ที่แยก job_posts เป็นประกาศงาน กับ jobs เป็น instance จริงที่สร้างเมื่อผู้ดูแลรับงาน ทำให้รองรับ replacement chain ได้ ตัวที่สองคือ Immutable Ledger ที่ ledger_transactions เป็น append-only ทุก transaction มี idempotency_key ป้องกัน duplicate"

### ดักคำถาม
- **"ทำไมแยก job_posts กับ jobs?"**
  → "เพราะ 1 ประกาศงาน (job_posts) อาจมีหลาย instance (jobs) ได้ เช่น กรณี caregiver คนแรกยกเลิก hirer สามารถเปิดให้คนใหม่รับได้ โดย job_posts ยัง posted อยู่"
- **"Immutable Ledger คืออะไร?"**
  → "ทุก financial transaction บันทึกเป็น row ใหม่เสมอ ไม่มี UPDATE หรือ DELETE ทำให้ audit trail ครบถ้วน ตรวจสอบย้อนหลังได้ว่าเงินไหลอย่างไร"
- **"ใช้ migration อย่างไร?"**
  → "มี migration runner ที่ track applied migrations ใน schema_migrations table, Docker init ใช้ schema.sql สร้างครั้งแรก แล้ว migration runner เพิ่ม columns/indexes ที่เพิ่มทีหลัง"

---

## สไลด์ 8: User Roles & Trust Level

### เนื้อหาบนสไลด์
- **4 ระดับ Trust Level**:
  - L0: สมัครใหม่
  - L1: ยืนยัน Email + Phone (OTP)
  - L2: ผ่าน KYC (บัตรประชาชน + selfie)
  - L3: Bank verified + Trust Score ≥ 80
- **Trust Score**: คำนวณจาก 9 weights (งานเสร็จ, รีวิว, อายุบัญชี, เอกสาร, etc.)
- **Policy Gate**: `can()` function ตรวจสิทธิ์ 30+ actions
- ตัวอย่าง: L0 สร้าง draft ได้ แต่ publish ไม่ได้, L1 publish low_risk ได้, L2 publish high_risk ได้

### สิ่งที่ต้องพูด
> "ระบบ Trust Level มี 4 ระดับ เป็น derived state จาก Trust Score ที่คำนวณจาก 9 factors ไม่ใช่แค่ verification อย่างเดียว ใช้ Policy Gate ตรวจสิทธิ์ก่อนทุก action เช่น ผู้ว่าจ้าง L0 สร้าง draft ได้ แต่ต้องเป็น L1 ขึ้นไปถึงจะ publish งาน low_risk ได้ และ L2 สำหรับ high_risk"

### ดักคำถาม
- **"Trust Score คำนวณยังไง?"**
  → "ใช้ weighted sum จาก 9 factors: จำนวนงานเสร็จ, average rating, อายุบัญชี, KYC status, เอกสารใบรับรอง, phone verified, email verified, bank verified, dispute history มี hysteresis ป้องกัน level ขึ้นลงถี่เกิน"
- **"Policy Gate ทำงานยังไง?"**
  → "เป็น middleware function `can(action)` ที่ตรวจ role + trust_level ก่อนเข้า route เช่น `requirePolicy('job:publish')` ตรวจว่า user เป็น hirer + L1 ขึ้นไป ถ้าไม่ผ่านคืน 403 Forbidden ทันที"
- **"L1 ต้อง verify ทั้ง email AND phone?"**
  → "ใช่ครับ ต้องยืนยันทั้งคู่ถึงจะได้ L1 ตาม `determineTrustLevel()` ใน trustLevelWorker.js"

---

## สไลด์ 9: Job Lifecycle & Payment Flow

### เนื้อหาบนสไลด์
- **Job Status Flow**: draft → posted → assigned → in_progress → completed / cancelled
- **Money Flow**:
  1. Hirer top-up wallet (QR Code)
  2. Publish → hold funds (available → held)
  3. CG Accept → escrow (held → escrow wallet)
  4. CG Check-out → settlement (escrow → CG wallet + platform fee)
  5. Cancel → refund (escrow/held → hirer)
- แผนภาพ flow ของเงิน

### สิ่งที่ต้องพูด
> "นี่คือหัวใจของระบบ — Money Flow ผ่าน Escrow เมื่อ hirer publish งาน ระบบจะ hold เงิน เมื่อ caregiver accept จะย้ายเข้า escrow wallet เมื่องานเสร็จ escrow จะ settle ให้ caregiver ได้ total_amount และ platform ได้ fee ถ้ายกเลิก escrow จะ refund กลับ hirer ทุก step บันทึกใน immutable ledger"

### ดักคำถาม
- **"Escrow คืออะไร?"**
  → "เป็น wallet กลางที่สร้างขึ้นสำหรับแต่ละงาน เงินถูก lock ไว้ใน escrow ระหว่างทำงาน ไม่มีฝ่ายไหนเข้าถึงได้ เมื่องานเสร็จหรือ dispute ถูกตัดสินแล้ว escrow จึงปล่อยเงิน"
- **"ถ้า CG ทำงานไม่เสร็จแล้วหายไป?"**
  → "ระบบมี auto-complete หลัง scheduled_end_at + 10 นาที ถ้า CG ไม่ checkout ระบบจะ checkout ให้อัตโนมัติ และ hirer สามารถ cancel ได้ทุกเวลาก่อน completed"
- **"Platform fee คิดยังไง?"**
  → "แยก field เป็น total_amount (ค่าจ้าง CG) + platform_fee_amount (ค่าบริการ) คำนวณตอนสร้างงาน CG ได้ total_amount ทั้งหมด, platform ได้ fee แยก"

---

## สไลด์ 10: Use Case Diagram

### เนื้อหาบนสไลด์
- Use Case Diagram (PlantUML) แสดง 40 UCs, 4 Actors
- กลุ่มสีฟ้า = หน้าหลัก (Tab), กลุ่มอื่น = extend actions
- แสดง navigation flow: ผู้ใช้ต้องอยู่หน้าไหนก่อนถึงทำ action ได้

### สิ่งที่ต้องพูด
> "Use Case Diagram มี 40 Use Cases แบ่งเป็น 8 กลุ่ม ออกแบบเป็น navigation-based คือ bubble สีฟ้าเป็นหน้าหลักที่ผู้ใช้เข้าถึงผ่าน Tab และ bubble อื่นเป็น extend actions ที่ทำได้จากหน้านั้น"

---

## สไลด์ 11: Demo — Hirer Flow

### เนื้อหาบนสไลด์
- Screenshot / Live demo ขั้นตอน:
  1. สมัคร → เลือกบทบาท → หน้าหลัก
  2. เพิ่มผู้รับการดูแล
  3. สร้างงาน (wizard form) → เห็น risk level auto-compute
  4. เติมเงิน (QR) → publish งาน → เห็น hold
  5. ค้นหาผู้ดูแล → Direct Assign
  6. ดู notification เมื่อ CG accept/check-in/check-out
  7. เขียนรีวิว

### สิ่งที่ต้องพูด
> "ทดสอบ demo จากมุมผู้ว่าจ้าง..." (เดิน flow ทีละขั้น)

### ดักคำถาม
- **"Risk level คำนวณจากอะไร?"**
  → "จาก 3 factors: job_type (เช่น emergency = high_risk), patient profile (เช่น bedbound, มี feeding tube), และ job tasks (เช่น tube_feeding, wound_dressing) ระบบเรียก `computeRiskLevel()` อัตโนมัติ"

---

## สไลด์ 12: Demo — Caregiver Flow

### เนื้อหาบนสไลด์
- Screenshot / Live demo:
  1. ดู Job Feed → กรองตาม trust level
  2. Accept งาน → เห็น chat สร้างอัตโนมัติ
  3. Check-in (GPS) → สถานะเปลี่ยน
  4. Check-out (evidence note) → เงินเข้า wallet
  5. ถอนเงิน → รอ Admin อนุมัติ

### สิ่งที่ต้องพูด
> "ฝั่งผู้ดูแล เห็นเฉพาะงานที่ trust level ตัวเองรับได้ ไม่เห็นงานที่ทับซ้อนเวลา ไม่เห็นงานของตัวเอง (กรณีมี 2 roles) เมื่อ accept ระบบสร้าง chat thread + escrow อัตโนมัติ Check-in บันทึก GPS เป็นหลักฐาน Check-out ต้องเขียน evidence note สรุปการทำงาน"

### ดักคำถาม
- **"GPS accuracy ดีแค่ไหน?"**
  → "ใช้ Browser Geolocation API ความแม่นยำขึ้นกับ device ในอาคารอาจผิดพลาด 100-500 เมตร ปัจจุบัน log violation แต่ไม่ block เพราะ priority คือให้ CG ทำงานได้ ไม่ใช่ block โดยเทคนิค"
- **"ถ้า CG อยากส่งงานก่อนเวลา?"**
  → "มีระบบ Early Checkout Request CG ต้องเขียนเหตุผล + หลักฐาน ส่งไป hirer อนุมัติ/ปฏิเสธ ถ้าเลย end time + 10 นาที ระบบ auto-complete"

---

## สไลด์ 13: Demo — Admin Flow

### เนื้อหาบนสไลด์
- Screenshot:
  1. จัดการผู้ใช้ — search, filter, ban, edit trust level
  2. KYC review — ดูเอกสาร, approve/reject
  3. Dispute management — รับมอบหมาย, อ่านหลักฐาน, settle เงิน
  4. Financial dashboard — ledger, reports, withdrawal review

### สิ่งที่ต้องพูด
> "Admin มีหน้า dashboard สำหรับจัดการทุกอย่าง ดูผู้ใช้ทั้งหมด review KYC ตัดสิน dispute โดย settle เงินจาก escrow ดู ledger transactions ทั้งหมด และอนุมัติถอนเงิน"

---

## สไลด์ 14: Real-time Features

### เนื้อหาบนสไลด์
- **Chat**: Socket.IO, thread-based, typing indicator, message read status
- **Notification**: Dual channel — Socket.IO (real-time) + Polling 15s (fallback)
- **Push Notification**: PWA Service Worker
- **Email Notification**: Nodemailer

### สิ่งที่ต้องพูด
> "ระบบ real-time มี 2 ส่วน Chat ใช้ Socket.IO แบบ room-based มี typing indicator และ read status Notification ใช้ hybrid approach คือ Socket.IO เป็น primary ส่ง event ทันที + polling ทุก 15 วินาทีเป็น fallback กรณี socket หลุด รองรับ push notification ผ่าน PWA ด้วย"

### ดักคำถาม
- **"ทำไมต้องมี polling ด้วย?"**
  → "Socket.IO เป็น best-effort ถ้า user เพิ่งเปิดหน้าหรือ connection หลุดอาจพลาด event polling 15s เป็น safety net + reconnect event listener ที่ fetchUnread ทันที"
- **"Socket.IO scale ยังไง?"**
  → "ตอนนี้เป็น single-instance ถ้าต้อง scale ใช้ Redis adapter ให้หลาย instance share room state ได้"

---

## สไลด์ 15: Security & Policy Gate

### เนื้อหาบนสไลด์
- **Authentication**: JWT + Refresh Token + Google OAuth 2.0
- **Authorization**: Policy Gate `can()` — 30+ actions × role × trust level
- **Financial Security**: Escrow, Immutable Ledger, Idempotency Key, HMAC-SHA256 webhook
- **Session**: sessionStorage (tab-scoped) — ป้องกัน session sharing
- **Validation**: Joi schema ทุก endpoint
- **Password**: bcrypt hash
- **Rate Limiting**: authLimiter, otpLimiter, webhookLimiter

### สิ่งที่ต้องพูด
> "Security ออกแบบหลายชั้น Auth ใช้ JWT + Refresh Token Authorization ผ่าน Policy Gate ที่ตรวจทุก request Financial security ใช้ Escrow + Immutable Ledger + Idempotency Key ป้องกัน duplicate payment Webhook ตรวจ HMAC-SHA256 signature Session ใช้ sessionStorage แยกต่อ tab ทดสอบหลาย role พร้อมกันได้"

### ดักคำถาม
- **"JWT เก็บไว้ที่ไหน?"**
  → "เก็บใน sessionStorage (tab-scoped) ไม่ใช่ localStorage เพื่อให้แต่ละ tab มี session แยก ปิด tab = logout ลด risk XSS attack ที่ persist"
- **"Idempotency Key คืออะไร?"**
  → "เป็น UNIQUE key ใน ledger_transactions ป้องกัน webhook ซ้ำจาก payment provider ทำให้ไม่ credit เงินซ้ำ"
- **"SQL Injection ป้องกันยังไง?"**
  → "ใช้ parameterized queries ($1, $2) ทุก SQL statement + Joi validation ทุก input ก่อนเข้า business logic"

---

## สไลด์ 16: Testing & Results

### เนื้อหาบนสไลด์
- **65 Test Case Tables** อิงจาก 40 Use Cases (ครอบคลุม Main + Exceptional Flow)
- **179 Automated Tests** ผ่าน 100%
  - Jest: Unit + Integration (backend)
  - Playwright: E2E (browser)
- **128 API Endpoints** ทดสอบทั้งหมด
- ตาราง: ผลรวม 71 test cases, ผ่าน 71, ไม่ผ่าน 0

### สิ่งที่ต้องพูด
> "การทดสอบแบ่งเป็น 2 ส่วน ส่วนแรกคือ Functional Testing ที่ออกแบบ test cases จาก Use Case ทั้ง 40 ตัว มีทั้ง main flow และ exceptional flow รวม 71 กรณี ผ่านทั้งหมด ส่วนที่สองคือ Automated Tests ด้วย Jest 179 tests ผ่าน 100%"

### ดักคำถาม
- **"Test coverage เท่าไร?"**
  → "Jest tests ครอบคลุม critical paths: auth, job lifecycle, payment flow, trust calculation, validation สำหรับ non-critical UI interactions ทดสอบ manual"
- **"Playwright ทดสอบอะไรบ้าง?"**
  → "Baseline smoke specs ครอบคลุม registration, login, job creation, basic navigation ทดสอบบน Chromium"

---

## สไลด์ 17: ข้อจำกัด

### เนื้อหาบนสไลด์
1. GPS ขึ้นกับ device (อาจผิด 100-500m ในอาคาร)
2. Real-time ขึ้นกับ internet connection
3. Payment ยังใช้ Mock Provider (มี Stripe handler พร้อมแต่ยังไม่ production)
4. ไม่มี Horizontal Scaling (single-instance)
5. Chat ยังไม่รองรับ file/image preview สมบูรณ์

### สิ่งที่ต้องพูด
> "ข้อจำกัดหลัก 5 ข้อ..." (อ่านตามสไลด์ กระชับ)

---

## สไลด์ 18: ข้อเสนอแนะ

### เนื้อหาบนสไลด์
- **สูง**: Payment Gateway จริง (Omise/2C2P), Background Check สำหรับ CG
- **กลาง**: Advanced Review (multi-dimension), Horizontal Scaling (Redis)
- **ต่ำ**: Mobile App (React Native), AI Matching, GPS Anti-spoofing

### สิ่งที่ต้องพูด
> "ข้อเสนอแนะเรียงตามลำดับความสำคัญ สูงสุดคือ integrate payment gateway จริงเพราะ architecture รองรับแล้ว"

---

## สไลด์ 19: สรุป

### เนื้อหาบนสไลด์
- **จุดเด่น 5 ข้อ**:
  1. 3-Tier Architecture + Immutable Financial Ledger
  2. Trust Level System (4 ระดับ, 9 score weights)
  3. Escrow Payment รับประกันเงิน
  4. Real-time Chat + Notification (Socket.IO + Polling fallback)
  5. WCAG 2.1 AA Accessibility
- ✅ พัฒนาครบตามวัตถุประสงค์ทั้ง 5 ข้อ
- ✅ ทดสอบผ่าน 100% (71 test cases + 179 automated tests)

### สิ่งที่ต้องพูด
> "สรุป ระบบ CareConnect ได้รับการพัฒนาสำเร็จครบตามวัตถุประสงค์ทั้ง 5 ข้อ จุดเด่นคือ Trust Level System ที่วัดผลได้ Escrow Payment ที่ปลอดภัย Real-time features ที่มี fallback และผ่านมาตรฐาน Accessibility ขอบคุณครับ/ค่ะ"

---

## สไลด์ 20: Q&A

### เนื้อหาบนสไลด์
- "ขอบคุณครับ/ค่ะ"
- ข้อมูลติดต่อ

---

## คำถามที่อาจารย์มักถาม (เตรียมไว้เพิ่ม)

### คำถามเชิง Architecture

| คำถาม | แนวตอบ |
|-------|--------|
| ทำไมไม่ใช้ microservices? | Project scope เหมาะกับ monolith มากกว่า ลด complexity ของ distributed systems สำหรับ 1 developer แต่ออกแบบให้ modules แยกกันชัดเจน พร้อม split ได้ในอนาคต |
| Database normalization ถึงระดับไหน? | ส่วนใหญ่ 3NF ยกเว้น denormalize บางส่วนเพื่อ performance เช่น completed_jobs_count, trust_score ใน users table |
| ถ้ามี concurrent users 1000 คนจะรับได้ไหม? | ปัจจุบัน single-instance รับได้ประมาณ 500-1000 concurrent connections scale ต่อได้ด้วย Redis adapter สำหรับ Socket.IO + connection pool สำหรับ DB |

### คำถามเชิง Security

| คำถาม | แนวตอบ |
|-------|--------|
| XSS ป้องกันยังไง? | React escape HTML โดย default + Content-Type: application/json ทุก response + Joi validation strip unknown fields |
| CSRF ป้องกันยังไง? | ใช้ JWT ใน Authorization header ไม่ใช่ cookie จึงไม่มี CSRF risk |
| Token ถูกขโมยจะเป็นยังไง? | Access token หมดอายุ 15 นาที, Refresh token หมดอายุ 7 วัน + เก็บใน sessionStorage (ปิด tab = หาย) |

### คำถามเชิง Business Logic

| คำถาม | แนวตอบ |
|-------|--------|
| ถ้าทั้ง 2 ฝ่ายมีปัญหา dispute ตัดสินยังไง? | Admin อ่านหลักฐานจากทั้ง 2 ฝ่ายใน dispute chat แล้ว settle โดยกำหนด refund_amount + payout_amount แบ่งจาก escrow ตามดุลยพินิจ |
| Platform fee กี่ %? | กำหนดตอนสร้างงานแยกเป็น platform_fee_amount ไม่ hardcode เป็น % ใน code ปรับได้ตามนโยบาย |
| ถ้า CG ไม่มา check-in เลย? | Hirer สามารถ cancel ได้ทุกเวลา เงินจาก escrow คืน hirer อัตโนมัติ ถ้าเลย end time + 10 นาที ระบบ auto-complete |

### คำถามเชิง Testing

| คำถาม | แนวตอบ |
|-------|--------|
| ทดสอบ concurrent transactions ยังไง? | ใช้ SELECT FOR UPDATE lock row ใน transaction ป้องกัน race condition Jest tests ทดสอบ concurrent accept (409 Conflict) |
| Test DB แยกจาก dev DB ไหม? | ปัจจุบันใช้ DB ตัวเดียว แต่ test cleanup ใช้ blacklist strategy ลบเฉพาะ test data ไม่กระทบ seed data |
| Performance test ทำไหม? | ไม่ได้ทำ formal load test แต่ Socket.IO latency < 100ms, API response < 200ms สำหรับ normal operations |

### คำถามเชิงตัวโปรเจค

| คำถาม | แนวตอบ |
|-------|--------|
| ส่วนไหนยากที่สุด? | Financial flow (Escrow + Ledger) เพราะต้อง atomic transactions ทุก step เงินต้องไม่หาย ไม่ซ้ำ และ audit ได้ |
| ถ้าทำใหม่จะเปลี่ยนอะไร? | อาจใช้ Next.js สำหรับ SSR performance, แยก financial service เป็น microservice ตั้งแต่แรก, และทำ E2E tests ก่อน implement |
| สามารถนำไปใช้จริงได้เลยไหม? | Architecture พร้อม แต่ต้อง integrate payment gateway จริง (Omise/2C2P), ตั้ง production credentials สำหรับ SMS/Email, และผ่าน security audit ก่อน |

---

## Tips การนำเสนอ

1. **เปิด Demo พร้อมไว้** — เปิด 3 tabs: Hirer, Caregiver, Admin ใน browser ก่อนเริ่ม
2. **เน้น Architecture decisions** — อาจารย์วิศวะสนใจ "ทำไม" มากกว่า "อะไร"
3. **อย่าอ่านสไลด์** — ใช้สไลด์เป็น bullet points พูดอธิบายเอง
4. **ตอบคำถามตรง ๆ** — ถ้าไม่รู้ให้บอกตรง ๆ ว่า "ส่วนนี้ยังไม่ได้ทำ" ดีกว่าตอบอ้อมค้อม
5. **เตรียม code ไว้โชว์** — อาจารย์อาจขอดู code จริง เปิด VS Code ไว้พร้อม highlight ที่สำคัญ:
   - `auth.js` (Policy Gate)
   - `jobService.js` (Escrow + Settlement)
   - `trustLevelWorker.js` (Trust Score)
   - `chatSocket.js` (Socket.IO events)
