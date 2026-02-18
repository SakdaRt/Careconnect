# CareConnect — Report Outline (โครงรายงาน)

> เอกสารนี้เป็นโครงร่างรายงานที่สามารถนำไปเขียนรายงานฉบับเต็มได้ แต่ละหัวข้อมี bullet points ให้เติมเนื้อหา

---

## บทที่ 1: บทนำ (Introduction)

### 1.1 ที่มาและความสำคัญ
- ประเทศไทยเข้าสู่สังคมผู้สูงอายุ (Aging Society) — สัดส่วนผู้สูงอายุ 60+ เพิ่มขึ้นต่อเนื่อง
- ปัญหาการหาผู้ดูแลที่มีคุณภาพและน่าเชื่อถือ
- ไม่มี platform กลางที่เชื่อมต่อผู้ว่าจ้างกับผู้ดูแลแบบ on-demand พร้อมระบบการเงินที่ปลอดภัย
- ความต้องการระบบที่มี Trust & Safety mechanism

### 1.2 วัตถุประสงค์
- พัฒนา Web Platform เชื่อมต่อผู้ว่าจ้าง (Hirer) กับผู้ดูแล (Caregiver)
- สร้างระบบ Trust Level เพื่อจัดระดับความน่าเชื่อถือ
- สร้างระบบ Escrow Wallet เพื่อความปลอดภัยทางการเงิน
- สร้างระบบหลักฐานการทำงาน (GPS + Photo) เพื่อป้องกันการฉ้อโกง
- สร้างระบบข้อพิพาท (Dispute) เพื่อแก้ปัญหาระหว่างผู้ใช้

### 1.3 ขอบเขต
- Web Application (responsive, ไม่ใช่ mobile app)
- 3 roles: Hirer, Caregiver, Admin
- ฟีเจอร์หลัก: Auth, Job Management, Chat, Wallet, Dispute, Admin Panel
- ใช้ Mock Provider สำหรับ external services (Payment, SMS, KYC)
- รันได้จริงผ่าน Docker Compose

### 1.4 ประโยชน์ที่คาดว่าจะได้รับ
- ผู้ว่าจ้างหาผู้ดูแลได้สะดวกและปลอดภัย
- ผู้ดูแลมีช่องทางรับงานที่น่าเชื่อถือ
- ระบบการเงินโปร่งใส ตรวจสอบได้ (Immutable Ledger)
- ลดความเสี่ยงด้านการฉ้อโกง

---

## บทที่ 2: ทฤษฎีและงานวิจัยที่เกี่ยวข้อง (Literature Review)

### 2.1 แนวคิด Gig Economy / On-demand Platform
- เปรียบเทียบกับ Grab, Uber, TaskRabbit
- ความแตกต่างของ caregiving platform (ต้องการ trust สูงกว่า)

### 2.2 Trust & Reputation System
- Trust Level model (L0–L3)
- Trust Score calculation (job completion, GPS compliance, reviews)
- เปรียบเทียบกับ Airbnb Superhost, Grab Diamond Driver

### 2.3 Escrow Payment System
- Double-entry bookkeeping
- Immutable Ledger concept
- เปรียบเทียบกับ Escrow.com, Shopee Guarantee

### 2.4 KYC (Know Your Customer)
- National ID verification
- Privacy-preserving approach (hash instead of raw data)

### 2.5 เทคโนโลยีที่ใช้
- React, Express.js, PostgreSQL, Docker
- WebSocket (Socket.IO) สำหรับ real-time communication
- JWT Authentication

---

## บทที่ 3: การออกแบบระบบ (System Design)

### 3.1 สถาปัตยกรรมระบบ (System Architecture)
- อ้างอิง `ARCHITECTURE.md`
- Client-Server Architecture
- Docker Compose Microservice-like deployment
- แผนภาพ: System Architecture Diagram

### 3.2 การออกแบบฐานข้อมูล (Database Design)
- ER Diagram (25+ tables)
- Key design decisions:
  - Immutable Ledger (prevent UPDATE/DELETE)
  - Double-entry accounting for wallets
  - UUID primary keys
  - ENUM types for type safety
  - One active assignment per job (unique constraint)

### 3.3 การออกแบบ API (API Design)
- RESTful API endpoints
- Route → Controller → Service → Model pattern
- Joi validation on all routes
- JWT authentication middleware

### 3.4 การออกแบบ UI/UX (UI/UX Design)
- Responsive web design (mobile-first)
- Role-based navigation (TopBar + BottomBar)
- Route guards (RequireAuth, RequireRole, RequireProfile, RequirePolicy)
- Lazy loading for performance

### 3.5 การออกแบบ Security
- JWT + Refresh Token
- bcrypt password hashing
- Helmet security headers
- Input validation (Joi)
- National ID hashing (KYC)
- Encrypted bank account numbers

### 3.6 Use Case Diagram
- Hirer: Register, Create Job, Top-up, Publish Job, Chat, Review, Dispute
- Caregiver: Register, Browse Jobs, Accept Job, Check-in/out, Earn, Dispute
- Admin: Manage Users, Manage Jobs, Resolve Disputes, View Reports

### 3.7 Sequence Diagrams
- Registration Flow
- Job Lifecycle Flow
- Payment Flow (Top-up → Escrow → Payout)
- Dispute Resolution Flow

---

## บทที่ 4: การพัฒนาระบบ (Implementation)

### 4.1 เครื่องมือที่ใช้

| เครื่องมือ | เวอร์ชัน | วัตถุประสงค์ |
|-----------|----------|-------------|
| Node.js | 20+ | Runtime |
| React | 18 | Frontend framework |
| TypeScript | 5.3 | Type safety |
| Express.js | 4 | Backend framework |
| PostgreSQL | 15 | Database |
| Docker | 20+ | Containerization |
| Vite | 5 | Build tool |
| TailwindCSS | 3.4 | Styling |
| Socket.IO | 4.6 | Real-time communication |
| Jest / Vitest | 29 / 1.1 | Testing |

### 4.2 โครงสร้างโปรเจค
- อ้างอิง `PROJECT_OVERVIEW.md` section Repo Map

### 4.3 การพัฒนาฟีเจอร์สำคัญ

#### 4.3.1 ระบบ Authentication
- Guest registration (email + password)
- Member registration (phone + OTP)
- JWT token management (access + refresh)
- Route guards (frontend + backend)

#### 4.3.2 ระบบ Job Lifecycle
- 7 states: draft → posted → assigned → in_progress → completed → cancelled → expired
- Risk Level calculation (อัตโนมัติจากข้อมูลผู้ป่วย)
- GPS Check-in/Check-out
- Assignment management (support replacement up to 3 times)

#### 4.3.3 ระบบ Wallet & Escrow
- 5 wallet types: hirer, caregiver, escrow, platform, platform_replacement
- Immutable Ledger with DB triggers
- Double-entry accounting
- Idempotency keys for transaction safety

#### 4.3.4 ระบบ Chat
- WebSocket (Socket.IO)
- One thread per job
- Support: text, image, file, system messages

#### 4.3.5 ระบบ Trust & Safety
- Trust Level L0–L3
- Trust Score 0–100
- GPS anti-spoofing (confidence score, cell tower comparison)
- Photo evidence (before/after with metadata)

#### 4.3.6 ระบบ Admin
- User management (view, suspend, activate)
- Job management (approve, cancel)
- Dispute resolution (review, settle with refund/payout)
- Financial reports

### 4.4 Mock Provider
- จำลอง Payment Gateway (QR + auto-webhook)
- จำลอง SMS OTP (fixed code "123456")
- จำลอง KYC (auto-approve)
- จำลอง Bank Transfer

---

## บทที่ 5: การทดสอบ (Testing)

### 5.1 แผนการทดสอบ
- อ้างอิง `TEST_PLAN.md`

### 5.2 ผลการทดสอบ Unit Test
- Backend: 9 unit test suites (policy, job, wallet, dispute, chat, otp)
- Frontend: 11 test files (auth, guards, api, navigation, components)

### 5.3 ผลการทดสอบ Integration Test
- Auth flow: Register → Login → Token refresh
- Job lifecycle: Create → Publish → Accept → Complete
- Wallet operations: Top-up → Escrow → Payout

### 5.4 ผลการทดสอบ Manual (ตาม Demo Script)
- Registration flow: ✅ ผ่าน
- Job creation + publish: ✅ ผ่าน
- Wallet top-up: ✅ ผ่าน
- Chat messaging: ✅ ผ่าน
- Admin panel: ✅ ผ่าน

### 5.5 ข้อจำกัดการทดสอบ
- External services ใช้ mock ทั้งหมด
- ไม่มี load testing / performance testing
- GPS testing ใช้ mock coordinates

---

## บทที่ 6: สรุปและข้อเสนอแนะ (Conclusion)

### 6.1 สรุปผลการดำเนินงาน
- พัฒนา CareConnect platform สำเร็จตามวัตถุประสงค์
- ฟีเจอร์หลักครบ: Auth, Job, Chat, Wallet, Dispute, Admin
- รันได้จริงผ่าน Docker Compose
- มี test coverage ในส่วนสำคัญ

### 6.2 ปัญหาและอุปสรรค
- ความซับซ้อนของ Escrow system
- การจัดการ state ของ Job lifecycle (7 states, หลาย transition)
- Real-time communication (Socket.IO) กับ authentication
- TypeScript type safety กับ dynamic API responses

### 6.3 ข้อเสนอแนะในการพัฒนาต่อ
1. เชื่อมต่อ Payment Gateway จริง (PromptPay / Omise)
2. เชื่อมต่อ SMS Provider จริง (Twilio)
3. พัฒนา Trust Score Recompute Worker
4. เพิ่ม Push Notification (FCM)
5. พัฒนา Mobile App (React Native)
6. เพิ่ม Review/Rating system
7. เพิ่ม API Documentation (Swagger/OpenAPI)
8. Load testing & Performance optimization
9. เพิ่ม Monitoring & Logging (ELK Stack / Grafana)

---

## ภาคผนวก (Appendix)

### ผนวก ก: Database Schema (ER Diagram)
- อ้างอิง `database/schema.sql`

### ผนวก ข: API Endpoints
- อ้างอิง `backend/src/routes/`

### ผนวก ค: Screenshots
- Landing Page
- Registration Flow
- Hirer Dashboard
- Job Creation
- Caregiver Job Feed
- Chat Room
- Wallet & Payment
- Admin Panel

### ผนวก ง: วิธีติดตั้งและรันระบบ
- อ้างอิง `RUNBOOK.md`
