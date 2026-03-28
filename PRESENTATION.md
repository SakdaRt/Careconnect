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

## สไลด์ 5: Technology Stack (แยก 2 สไลด์ถ้าจอไม่พอ)

### เนื้อหาบนสไลด์

| เทคโนโลยี | คืออะไร | ทำไมต้องใช้ตัวนี้ |
|----------|--------|-----------------|
| **React 18** | JavaScript library สำหรับสร้าง UI แบบ component-based | รองรับ Hooks, Concurrent rendering, ecosystem ใหญ่ มี library พร้อมใช้เยอะ |
| **TypeScript** | superset ของ JavaScript ที่เพิ่มระบบ type | ป้องกัน bug ตั้งแต่ตอน compile, IDE แนะนำ code ได้ดี, refactor ปลอดภัย |
| **Tailwind CSS** | utility-first CSS framework เขียน style ผ่าน class name | พัฒนา UI เร็ว ไม่ต้องเขียน CSS แยก ลด context switching ระหว่างไฟล์ |
| **Vite** | build tool สำหรับ frontend ใช้ ESBuild + Rollup | Hot Module Replacement เร็วมาก, build เร็วกว่า Webpack 10-100 เท่า |
| **Node.js** | JavaScript runtime บน server ใช้ V8 engine | ใช้ภาษาเดียวทั้ง frontend + backend, non-blocking I/O เหมาะกับ real-time |
| **Express.js** | web framework สำหรับ Node.js | เบา ยืดหยุ่น middleware architecture, ecosystem ใหญ่ |
| **Socket.IO** | library สำหรับ real-time bidirectional communication | auto-reconnect, room management, fallback to polling, auth middleware ในตัว |
| **PostgreSQL 15** | relational database (SQL) | ACID compliance สำหรับ financial transactions, SELECT FOR UPDATE lock row สำหรับ escrow, foreign keys รับประกัน data integrity |
| **JWT** | JSON Web Token สำหรับ authentication แบบ stateless | ไม่ต้อง store session บน server, ใช้กับ Socket.IO auth ได้ตรง, scale ง่าย |
| **Google OAuth 2.0** | protocol สำหรับ login ผ่านบัญชี Google | ผู้ใช้ไม่ต้องจำ password ใหม่, ได้ verified email ทันที |
| **Joi** | schema validation library สำหรับ JavaScript | validate ทุก API input ก่อนเข้า business logic, ป้องกัน invalid data + injection |
| **bcrypt** | password hashing algorithm | hash รหัสผ่านแบบ one-way + salt, ปลอดภัยกว่า SHA/MD5 |
| **Docker Compose** | tool สำหรับ define + run multi-container applications | ทุก environment เหมือนกัน, ลด "works on my machine", seed data auto-load |
| **Jest** | JavaScript testing framework | รองรับ unit + integration test, mock system, code coverage, 179 tests |
| **Playwright** | E2E browser testing framework | ทดสอบบน browser จริง (Chromium), จำลอง user interaction ครบ |

### สิ่งที่ต้องพูด
> "เทคโนโลยีหลักที่เลือกใช้ แต่ละตัวเลือกมาด้วยเหตุผลเฉพาะ
>
> Frontend ใช้ React 18 ซึ่งเป็น component-based UI library ร่วมกับ TypeScript ที่เพิ่มระบบ type ช่วยป้องกัน bug ตั้งแต่ตอน compile Tailwind CSS เป็น utility-first CSS framework ที่ช่วยพัฒนา UI ได้เร็วโดยไม่ต้องเขียน CSS file แยก และ Vite เป็น build tool ที่เร็วกว่า Webpack มาก
>
> Backend ใช้ Node.js เพราะใช้ JavaScript ภาษาเดียวกันกับ frontend ลด context switching ร่วมกับ Express.js ซึ่งเป็น web framework ที่เบาและยืดหยุ่น
>
> Real-time ใช้ Socket.IO ซึ่งเป็น library สำหรับ bidirectional communication เลือกใช้แทน WebSocket ตรงๆ เพราะมี auto-reconnect, room management, fallback to polling กรณีเครือข่ายไม่รองรับ WebSocket
>
> Database ใช้ PostgreSQL เลือกแทน MongoDB เพราะระบบมี financial transactions ที่ต้องการ ACID compliance และ SELECT FOR UPDATE สำหรับ lock row ตอนทำ escrow ซึ่ง relational database ทำได้ดีกว่า
>
> Authentication ใช้ JWT ซึ่งเป็น stateless token ไม่ต้อง store session บน server เหมาะกับ Socket.IO authentication ด้วย password hash ด้วย bcrypt ที่เป็น one-way hash + salt
>
> ทั้งหมดรันใน Docker Compose เพื่อให้ dev, test, production ใช้ environment เหมือนกันครับ/ค่ะ"

### ดักคำถาม
- **"ทำไมเลือก PostgreSQL ไม่ใช่ MongoDB?"**
  → "MongoDB เป็น document DB เหมาะกับ schema ที่เปลี่ยนบ่อย แต่ระบบนี้มี financial transactions ที่ต้องการ ACID (Atomicity, Consistency, Isolation, Durability) เช่น escrow ต้อง lock row ด้วย SELECT FOR UPDATE ต้องมี foreign keys รับประกัน data integrity และ ledger_transactions ต้อง immutable PostgreSQL ตอบโจทย์กว่า"
- **"ทำไมใช้ Socket.IO ไม่ใช้ WebSocket ตรงๆ?"**
  → "WebSocket เป็น raw protocol ต้องจัดการ reconnect, room, fallback เอง Socket.IO ให้ทั้งหมดนี้พร้อมใช้ มี auto-reconnect ตอน network หลุด, room management สำหรับ chat threads, fallback to HTTP long-polling กรณี browser ไม่รองรับ WebSocket, และ authentication middleware ใช้ JWT verify ก่อน connect"
- **"ทำไมไม่ใช้ Next.js?"**
  → "Next.js เป็น full-stack React framework ที่เด่นเรื่อง SSR (Server-Side Rendering) แต่ระบบนี้เป็น SPA (Single Page Application) ที่ทุกหน้าต้อง login ก่อน ไม่ต้องการ SEO ไม่ต้องการ SSR Vite + React เบากว่า build เร็วกว่า simple architecture เหมาะกับ project scope"
- **"ทำไมใช้ JWT ไม่ใช้ session-based auth?"**
  → "Session-based ต้อง store session บน server ถ้ามีหลาย instance ต้องใช้ Redis share session JWT เป็น stateless เก็บ user info ใน token เลย server ไม่ต้อง store อะไร scale ง่าย และใช้กับ Socket.IO auth ได้ตรงโดย verify JWT ตอน handshake"
- **"ทำไมใช้ Tailwind CSS ไม่ใช่ Bootstrap หรือ MUI?"**
  → "Bootstrap/MUI เป็น component library มี style สำเร็จรูป แต่ customize ยาก Tailwind เป็น utility-first ให้ control ทุก pixel ไม่ต้อง override styles ออกแบบ UI ตาม design ได้ตรง bundle size เล็กเพราะ purge class ที่ไม่ใช้ออก"
- **"ทำไมใช้ Joi ไม่ใช้ Zod?"**
  → "Joi เป็น validation library ที่ mature กว่า มี ecosystem กับ Express.js ดี support complex validation rules เช่น conditional fields, custom validators Zod ดีสำหรับ TypeScript แต่ backend เป็น plain JavaScript Joi เหมาะกว่า"
- **"bcrypt กับ argon2 ต่างกันยังไง?"**
  → "ทั้งคู่เป็น password hashing ที่ปลอดภัย argon2 ใหม่กว่าและ memory-hard ดีกว่า แต่ bcrypt เป็น industry standard ที่ proven มานาน library support ดีทุก platform เลือกใช้ bcrypt เพราะ battle-tested และเพียงพอสำหรับ project scope"
- **"Docker Compose กับ Kubernetes ต่างกันยังไง?"**
  → "Kubernetes เป็น container orchestration สำหรับ production scale ใหญ่ Docker Compose เป็นเครื่องมือง่ายสำหรับ define multi-container ในเครื่องเดียว เหมาะกับ development + single-server deployment ถ้าต้อง scale ค่อยย้ายไป Kubernetes"

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

---

## Full Speaking Script (แนวทางการพูดทุกสไลด์)

> ด้านล่างคือ script เต็มสำหรับฝึกพูด ไม่จำเป็นต้องท่องทุกคำ แต่ให้จับ flow และ key points

---

### สไลด์ 1 — Title (30 วินาที)

> "สวัสดีครับ/ค่ะ ผม/ดิฉัน [ชื่อ] รหัส [รหัส] วันนี้จะนำเสนอโปรเจคจบเรื่อง CareConnect ซึ่งเป็นระบบเว็บแอปพลิเคชันสำหรับเชื่อมต่อผู้ว่าจ้างกับผู้ดูแลผู้สูงอายุ โดยมี [ชื่ออาจารย์] เป็นอาจารย์ที่ปรึกษาครับ/ค่ะ"

---

### สไลด์ 2 — ที่มาและความสำคัญ (1 นาที)

> "ที่มาของโปรเจคนี้คือ ปัจจุบันประเทศไทยก้าวเข้าสู่สังคมสูงอายุ มีผู้สูงอายุมากกว่า 20% ของประชากร
>
> ปัญหาที่พบคือ เมื่อครอบครัวต้องการจ้างผู้ดูแล มักต้องหาผ่านคนรู้จักหรือบริษัทจัดหา ซึ่งไม่มีระบบยืนยันตัวตนที่น่าเชื่อถือ ไม่มีระบบรับประกันเงิน คือจ่ายเงินไปแล้วถ้าผู้ดูแลไม่มาก็ไม่ได้คืน และไม่มีหลักฐานการทำงานว่าผู้ดูแลมาทำงานจริงหรือเปล่า
>
> CareConnect จึงถูกพัฒนาขึ้นเพื่อแก้ปัญหาเหล่านี้ โดยเป็น Two-sided Marketplace ที่มีระบบ Trust Level ยืนยันตัวตน ระบบ Escrow Payment รับประกันเงิน และระบบ GPS Evidence บันทึกหลักฐานการทำงานครับ/ค่ะ"

---

### สไลด์ 3 — วัตถุประสงค์ (30 วินาที)

> "วัตถุประสงค์ของโปรเจคมี 5 ข้อ
>
> ข้อแรก พัฒนาระบบเว็บแอปพลิเคชันสำหรับเชื่อมต่อผู้ว่าจ้างกับผู้ดูแลผู้สูงอายุ
> ข้อสอง พัฒนาระบบ Trust Level เพื่อยืนยันความน่าเชื่อถือของผู้ใช้
> ข้อสาม พัฒนาระบบ Escrow Payment เพื่อรับประกันการจ่ายเงิน
> ข้อสี่ พัฒนาระบบ GPS Evidence เพื่อบันทึกหลักฐานการทำงาน
> และข้อห้า พัฒนาระบบ Real-time Chat และ Notification ครับ/ค่ะ"

---

### สไลด์ 4 — ขอบเขตโปรเจค (1 นาที)

> "ขอบเขตของโปรเจค ระบบรองรับ 3 บทบาทหลัก คือผู้ว่าจ้าง ผู้ดูแล และผู้ดูแลระบบ
>
> ในแง่ขนาด มี Use Case ทั้งหมด 40 ตัว ครอบคลุม 8 กลุ่มฟังก์ชัน ตั้งแต่สมัครสมาชิก สร้างงาน จ่ายเงิน แชท ไปจนถึงระบบข้อพิพาท Backend มี API 128 endpoints จาก 16 Controllers ฐานข้อมูล 40 ตาราง และมี Automated Tests 179 กรณี ทดสอบด้วย Jest และ Playwright ครับ/ค่ะ"

---

### สไลด์ 5 — Technology Stack (1 นาที)

> "เทคโนโลยีที่ใช้ Frontend เป็น React 18 กับ TypeScript ใช้ Tailwind CSS สำหรับ styling และ Vite สำหรับ build
>
> Backend เป็น Node.js กับ Express.js ใช้ Socket.IO สำหรับ real-time features
>
> Database ใช้ PostgreSQL เวอร์ชัน 15 เลือกใช้เพราะต้องการ ACID compliance สำหรับ financial transactions ระบบมีการ lock row ด้วย SELECT FOR UPDATE ตอนทำ escrow ซึ่ง relational database เหมาะกว่า NoSQL
>
> Authentication ใช้ JWT กับ Refresh Token รองรับ Google OAuth ด้วย Validation ใช้ Joi ทุก endpoint และรัน environment ด้วย Docker Compose ทั้ง dev test และ production ครับ/ค่ะ"

---

### สไลด์ 6 — System Architecture (1.5 นาที)

> "สถาปัตยกรรมเป็นแบบ 3-Tier
>
> ชั้นแรกคือ Client Layer ผู้ใช้เข้าผ่าน Browser ไปยัง Frontend ที่เป็น React SPA
>
> ชั้นที่สองคือ Application Layer Frontend ส่ง HTTP request ผ่าน /api proxy ไปยัง Backend ที่เป็น Express.js ส่วน real-time จะเชื่อมผ่าน WebSocket ของ Socket.IO
>
> ชั้นที่สามคือ Data Layer Backend เชื่อมต่อ PostgreSQL ผ่าน connection pool
>
> นอกจากนี้มี Mock Provider ที่จำลอง Payment, SMS, KYC สำหรับขั้นตอนพัฒนา ซึ่งในโปรดักชันจะเปลี่ยนเป็น provider จริงโดยไม่ต้องแก้โค้ดหลัก เพราะ interface เหมือนกัน
>
> ทั้งหมดรันใน Docker Compose 4 containers ครับ/ค่ะ"

---

### สไลด์ 7 — Database Design (1 นาที)

> "ฐานข้อมูลมี 40 ตาราง มี 2 design pattern สำคัญ
>
> ตัวแรกคือ Two-table Job Pattern แยก job_posts ซึ่งเป็นประกาศงาน กับ jobs ซึ่งเป็น instance จริงที่สร้างเมื่อผู้ดูแลรับงาน ประโยชน์คือ ถ้า caregiver คนแรกยกเลิก ประกาศยังอยู่ สามารถเปิดให้คนใหม่รับได้
>
> ตัวที่สองคือ Immutable Ledger ตาราง ledger_transactions เป็น append-only ไม่มี UPDATE ไม่มี DELETE ทุก transaction มี idempotency_key เป็น UNIQUE ป้องกันการบันทึกซ้ำ ทำให้ audit trail ครบถ้วนครับ/ค่ะ"

---

### สไลด์ 8 — Trust Level (1 นาที)

> "ระบบ Trust Level มี 4 ระดับ
>
> L0 คือเพิ่งสมัคร ยังไม่ยืนยันอะไร สร้าง draft งานได้แต่ publish ไม่ได้
> L1 คือยืนยัน Email และ Phone ทั้งคู่ผ่าน OTP publish งาน low_risk ได้
> L2 คือผ่าน KYC ส่งบัตรประชาชนและ selfie ให้ Admin ตรวจ publish งาน high_risk ได้ และถอนเงินได้
> L3 คือยืนยันบัญชีธนาคาร + Trust Score 80 ขึ้นไป
>
> Trust Score คำนวณจาก 9 factors เช่น จำนวนงานเสร็จ average rating อายุบัญชี เอกสารใบรับรอง ใช้ weighted sum
>
> การตรวจสิทธิ์ใช้ Policy Gate คือ function can() ที่ตรวจ role กับ trust level ก่อนเข้าทุก route ถ้าไม่ผ่านคืน 403 Forbidden ทันทีครับ/ค่ะ"

---

### สไลด์ 9 — Job Lifecycle & Payment Flow (1.5 นาที)

> "สไลด์นี้เป็นหัวใจของระบบ คือวงจรชีวิตงานและการเงิน
>
> เริ่มจาก ผู้ว่าจ้างเติมเงินเข้า wallet ผ่าน QR Code แล้วสร้างงานซึ่งเป็น draft ก่อน
>
> เมื่อกด publish ระบบจะ hold เงิน คือย้ายจาก available ไป held balance
>
> เมื่อผู้ดูแล accept งาน เงินจะย้ายจาก held เข้า escrow wallet ที่สร้างขึ้นสำหรับงานนี้โดยเฉพาะ ทั้ง 2 ฝ่ายเข้าถึงเงินนี้ไม่ได้
>
> ผู้ดูแล check-in ด้วย GPS เปลี่ยนสถานะเป็น in_progress ทำงานจนเสร็จ แล้ว check-out พร้อมเขียน evidence note
>
> ตอน check-out ระบบทำ settlement คือจ่าย total_amount ให้ผู้ดูแล และ platform_fee ให้แพลตฟอร์ม ทั้งหมดจาก escrow
>
> ถ้ามีปัญหาและยกเลิก เงินจะ refund กลับผู้ว่าจ้างอัตโนมัติ
>
> ทุกขั้นตอนบันทึกใน immutable ledger ตรวจสอบย้อนหลังได้ทั้งหมดครับ/ค่ะ"

---

### สไลด์ 10 — Use Case Diagram (1 นาที)

> "Use Case Diagram มี 40 Use Cases แบ่ง 8 กลุ่ม สำหรับ 4 Actors คือ Guest, Hirer, Caregiver, และ Admin
>
> ออกแบบเป็น navigation-based คือ bubble สีฟ้าเป็นหน้าหลักที่ผู้ใช้เข้าผ่าน Tab เช่น หน้างานของฉัน หน้าค้นหาผู้ดูแล หน้ากระเป๋าเงิน และ bubble อื่นเป็น extend actions ที่ทำได้จากหน้านั้น
>
> ทุก Use Case มี description table ที่ระบุ preconditions, main flow, exceptional flow และมี test case ทดสอบทุกตัวครับ/ค่ะ"

---

### สไลด์ 11 — Demo: Hirer Flow (2 นาที)

> "ทีนี้จะ demo จากมุมผู้ว่าจ้าง
>
> *[เปิด browser tab ผู้ว่าจ้าง]*
>
> นี่คือหน้าหลัก มี 4 แท็บ คืองานของฉัน ค้นหาผู้ดูแล ผู้รับการดูแล และกระเป๋าเงิน
>
> เริ่มจากเพิ่มผู้รับการดูแลก่อน กรอกข้อมูล ชื่อ อายุ โรคประจำตัว อุปกรณ์การแพทย์
>
> จากนั้นสร้างงาน เป็น wizard form เลือกผู้รับการดูแล กรอกรายละเอียด เลือกวันเวลา ระบบคำนวณจำนวนชั่วโมงอัตโนมัติ กรอกค่าจ้างต่อชั่วโมง เลือก job tasks ระบบคำนวณ risk level อัตโนมัติจากข้อมูลที่กรอก
>
> กดบันทึก ได้ draft กดเผยแพร่ ระบบ hold เงินและงานปรากฏใน feed ของผู้ดูแล
>
> หรือจะไปหน้าค้นหาผู้ดูแล กรองตามทักษะ ประสบการณ์ แล้ว Direct Assign ให้ผู้ดูแลที่ต้องการเลยก็ได้ครับ/ค่ะ"

---

### สไลด์ 12 — Demo: Caregiver Flow (2 นาที)

> "ทีนี้เปลี่ยนมาดูฝั่งผู้ดูแล
>
> *[เปิด browser tab ผู้ดูแล]*
>
> หน้า Job Feed แสดงเฉพาะงานที่ trust level รับได้ งานที่ทับซ้อนเวลากับงานที่รับแล้วจะไม่แสดง และงานที่สร้างเองก็ไม่เห็น
>
> กด accept งาน ระบบสร้าง escrow wallet และห้องแชทอัตโนมัติ สามารถแชทกับผู้ว่าจ้างได้ทันที
>
> ถึงเวลา กด check-in ระบบขอ GPS จาก browser บันทึกตำแหน่ง สถานะเปลี่ยนเป็นกำลังดำเนินการ ผู้ว่าจ้างได้รับ notification ทันที
>
> ทำงานเสร็จ กด check-out ต้องเขียน evidence note สรุปการทำงาน ระบบจ่ายเงินเข้า wallet อัตโนมัติ
>
> ถ้าต้องการถอนเงิน ต้องมี trust level L2 ขึ้นไป คือผ่าน KYC แล้ว เลือกบัญชีธนาคาร ระบุจำนวน แล้วรอ Admin อนุมัติครับ/ค่ะ"

---

### สไลด์ 13 — Demo: Admin Flow (1 นาที)

> "สุดท้ายฝั่ง Admin
>
> *[เปิด browser tab Admin]*
>
> Admin มี dashboard ดูสถิติภาพรวม จัดการผู้ใช้ได้ทั้งหมด ค้นหา กรองตาม role สถานะ
>
> Review KYC ดูเอกสารบัตรประชาชนและ selfie แล้ว approve หรือ reject ถ้า approve trust level ขึ้นเป็น L2
>
> จัดการ dispute รับมอบหมาย อ่านหลักฐานจากทั้ง 2 ฝ่าย แล้ว settle คือกำหนดว่าจะคืนเงินให้ฝ่ายไหนเท่าไร
>
> และดูรายงานการเงิน ledger transactions ทั้งหมด อนุมัติถอนเงินครับ/ค่ะ"

---

### สไลด์ 14 — Real-time Features (1 นาที)

> "ระบบ real-time มี 2 ส่วนหลัก
>
> ส่วนแรกคือ Chat ใช้ Socket.IO เป็น room-based ระบบสร้างห้องแชทอัตโนมัติเมื่อ caregiver accept งาน มี typing indicator แสดงว่าอีกฝ่ายกำลังพิมพ์ มี read status แสดงว่าอ่านแล้ว
>
> ส่วนที่สองคือ Notification ใช้ hybrid approach คือ Socket.IO เป็น primary ส่ง event ทันที กับ polling ทุก 15 วินาทีเป็น fallback กรณี socket หลุด เมื่อ reconnect หรือ tab กลับมา focus ระบบจะ fetch จำนวน unread ทันที
>
> นอกจากนี้ยังรองรับ Push Notification ผ่าน PWA Service Worker และ Email Notification ผ่าน Nodemailer ด้วยครับ/ค่ะ"

---

### สไลด์ 15 — Security & Policy Gate (1 นาที)

> "Security ออกแบบหลายชั้น
>
> Authentication ใช้ JWT access token หมดอายุ 15 นาที กับ refresh token 7 วัน เก็บใน sessionStorage ที่แยกต่อ tab ปิด tab เท่ากับ logout
>
> Authorization ใช้ Policy Gate function can() ตรวจ role กับ trust level ก่อนทุก request มากกว่า 30 actions
>
> Financial Security ใช้ Escrow wallet แยกต่องาน Immutable Ledger บันทึกทุก transaction Idempotency Key ป้องกัน duplicate payment และ HMAC-SHA256 ตรวจ webhook signature
>
> Validation ใช้ Joi schema ทุก endpoint ป้องกัน invalid input Password ใช้ bcrypt hash และมี Rate Limiting ป้องกัน brute force ครับ/ค่ะ"

---

### สไลด์ 16 — Testing & Results (1 นาที)

> "การทดสอบแบ่ง 2 ส่วน
>
> ส่วนแรก Functional Testing ออกแบบ test cases จาก Use Case ทั้ง 40 ตัว ครอบคลุมทั้ง main flow และ exceptional flow รวม 71 กรณีทดสอบ ผ่านทั้งหมด 100%
>
> ส่วนที่สอง Automated Tests ด้วย Jest มี 179 tests ผ่านทั้งหมด ครอบคลุม unit tests สำหรับ trust score calculation, risk level computation และ integration tests สำหรับ API endpoints
>
> นอกจากนี้ยังมี Playwright สำหรับ E2E testing บน browser จริงครับ/ค่ะ"

---

### สไลด์ 17 — ข้อจำกัด (30 วินาที)

> "ข้อจำกัดหลักมี 5 ข้อ
>
> หนึ่ง GPS accuracy ขึ้นกับ device ในอาคารอาจผิดพลาดได้ สอง Real-time ขึ้นกับ internet connection สาม Payment ยังใช้ Mock Provider สี่ ยังเป็น single-instance ไม่รองรับ horizontal scaling และห้า Chat ยังไม่รองรับ file preview สมบูรณ์ครับ/ค่ะ"

---

### สไลด์ 18 — ข้อเสนอแนะ (30 วินาที)

> "ข้อเสนอแนะเรียงตามลำดับ
>
> ความสำคัญสูง คือ integrate Payment Gateway จริง เช่น Omise หรือ 2C2P เพราะ architecture รองรับแล้ว กับ Background Check สำหรับผู้ดูแล
>
> ความสำคัญกลาง คือ Advanced Review System และ Horizontal Scaling
>
> ระยะยาว คือ Mobile App, AI Matching, GPS Anti-spoofing ครับ/ค่ะ"

---

### สไลด์ 19 — สรุป (1 นาที)

> "สรุป ระบบ CareConnect ได้รับการพัฒนาสำเร็จครบตามวัตถุประสงค์ทั้ง 5 ข้อ
>
> จุดเด่น 5 ประการ
> หนึ่ง สถาปัตยกรรม 3-Tier พร้อม Immutable Financial Ledger
> สอง Trust Level System 4 ระดับ คำนวณจาก 9 factors
> สาม Escrow Payment รับประกันเงินทั้ง 2 ฝ่าย
> สี่ Real-time Chat และ Notification พร้อม fallback
> ห้า ผ่านมาตรฐาน Accessibility WCAG 2.1 AA
>
> ทดสอบ 71 กรณีทดสอบ ผ่าน 100% Automated Tests 179 ผ่านทั้งหมด
>
> ขอบคุณครับ/ค่ะ"

---

### สไลด์ 20 — Q&A

> "ขอบคุณครับ/ค่ะ ยินดีตอบคำถามครับ/ค่ะ"
>
> *[รอคำถาม — ดูแนวตอบจาก section ดักคำถามด้านบน]*

---

## เทคนิคการพูดที่ดี

### น้ำเสียง & จังหวะ
- **เปิด**: พูดเสียงดังชัด มั่นใจ สบตาอาจารย์ ไม่ต้องรีบ
- **เนื้อหาเทคนิค**: พูดช้าลงเล็กน้อย เน้นคำสำคัญ เช่น "Escrow", "Immutable", "Policy Gate"
- **Demo**: พูดไป ชี้ไป อย่าเงียบขณะ demo
- **สรุป**: พูดช้า หนักแน่น จบด้วยรอยยิ้ม

### สิ่งที่ควรทำ
- ✅ สบตาอาจารย์ ไม่ใช่จ้องจอ
- ✅ ใช้มือชี้สไลด์เมื่ออธิบายแผนภาพ
- ✅ พูด "ทำไม" ก่อน "อย่างไร" — อาจารย์วิศวะชอบ design decisions
- ✅ ยอมรับข้อจำกัดตรงๆ — แสดงว่าเข้าใจ scope
- ✅ ตอบคำถามให้จบ ไม่ต้องยาว 2-3 ประโยคก็พอ

### สิ่งที่ไม่ควรทำ
- ❌ อ่านสไลด์ทุกตัวอักษร
- ❌ พูดเร็วเกินจนอาจารย์ตามไม่ทัน
- ❌ ตอบ "ไม่รู้" โดยไม่อธิบาย — ให้บอก "ส่วนนี้ยังไม่ได้ทำ แต่ออกแบบไว้ให้รองรับได้"
- ❌ เถียงอาจารย์ — ถ้าอาจารย์แนะนำ ให้รับฟังแล้วบอก "เป็นจุดที่ดีครับ จะนำไปปรับปรุง"
- ❌ Demo สด แล้ว crash — ถ้าไม่มั่นใจ ใช้ screenshot แทน

### ลำดับความสำคัญเมื่อถูกกดเวลา
ถ้าเหลือเวลาน้อย ตัดสไลด์ตามนี้:
1. **ห้ามตัด**: สไลด์ 2, 6, 8, 9, 11-12 (เป็นหัวใจ)
2. **ตัดได้**: สไลด์ 10 (UC Diagram — พูดสั้นๆ), 17-18 (ข้อจำกัด/เสนอแนะ — รวมเป็น 1)
3. **ตัดก่อน**: สไลด์ 13 (Admin demo — โชว์สั้นๆ), 14 (Real-time — พูดรวมกับ demo)

---
---

# รายละเอียดเพิ่มเติม 13 หัวข้อ สำหรับใส่สไลด์

> ข้อมูลทั้งหมดอิงจาก codebase จริง (`SYSTEM.md`, `trustLevelWorker.js`, `jobService.js`, `risk.js`, `caregiverSearchRoutes.js`, `disputeRoutes.js`, `complaintRoutes.js`, `walletRoutes.js`, `notificationRoutes.js`, `adminRoutes.js`)
>
> 📌 หัวข้อที่มี `⚠️ ยังไม่มีใน FinalReport` = ยังไม่พบในไฟล์ .docx ควรเพิ่มเข้าไป

---

## 1. Trust Level

**ระบบ Trust Level 4 ระดับ** — ใช้ร่วมกันทั้ง Hirer และ Caregiver (role-neutral)

| ระดับ | ชื่อ | เงื่อนไข | สิทธิ์ที่ได้เพิ่ม |
|:-----:|------|---------|-----------------|
| L0 | เริ่มต้น | สมัครสมาชิก | สร้าง draft งาน, ดู feed, เติมเงิน |
| L1 | ยืนยันการติดต่อ | ยืนยัน Email + Phone (OTP ทั้งคู่) | publish งาน low_risk, รับงาน, check-in/out |
| L2 | ยืนยันตัวตน | L1 + ผ่าน KYC (บัตรประชาชน + selfie) | publish งาน high_risk, ถอนเงิน |
| L3 | มืออาชีพ | L2 + ยืนยันบัญชีธนาคาร + Trust Score ≥ 80 | สิทธิ์เต็ม |

**การควบคุมสิทธิ์**: ใช้ Policy Gate — function `can()` ใน middleware ตรวจ role + trust_level ก่อนเข้าทุก API route (30+ actions)

**หมายเหตุ**: caregiver_documents (ใบรับรอง/ใบประกอบวิชาชีพ) ไม่ผูกกับ trust level แต่ใช้แยกเป็นเงื่อนไขรับงาน high_risk

---

## 2. หลักการแนะนำผู้ดูแล

**ระบบค้นหาผู้ดูแล** (`/api/caregivers/search`) — ผู้ว่าจ้างค้นหาและกรองได้หลายเงื่อนไข:

| ตัวกรอง | รายละเอียด |
|---------|----------|
| คำค้น (q) | ค้นจากชื่อ, email, เบอร์โทร |
| ทักษะ (skills) | กรองตาม specializations + certifications |
| Trust Level | กรองตามระดับความน่าเชื่อถือ |
| ประสบการณ์ (min_experience_years) | กรองขั้นต่ำปีประสบการณ์ |
| วันที่ว่าง (available_day) | กรองตาม available_days ที่ผู้ดูแลตั้งไว้ |

**การเรียงลำดับ**: ผู้ดูแลที่อยู่ใน Favorites แสดงก่อน → ตามด้วย trust_score สูงสุด → completed_jobs_count มากสุด

**ฟีเจอร์เสริม**:
- กด ❤️ บันทึกผู้ดูแลที่ชอบ (Favorites) เรียกดูทีหลังได้
- กดดูโปรไฟล์เต็ม — เห็น rating, รีวิว, ทักษะ, ใบรับรอง
- Direct Assign — มอบหมายงานตรงให้ผู้ดูแลที่ต้องการโดยไม่ต้องรอสมัคร

**⚠️ ยังไม่มีใน FinalReport**: รายละเอียดลำดับการเรียง (Favorites first → trust_score → completed_jobs)

---

## 3. แนะนำงาน (Job Feed)

**ระบบ Job Feed** (`/api/jobs/feed`) — แสดงงานที่เหมาะสมกับผู้ดูแลแต่ละคน:

**การกรองอัตโนมัติ** (ผู้ดูแลไม่เห็นงานเหล่านี้):
1. งานที่ `min_trust_level` สูงกว่า trust level ของตัวเอง → ซ่อน
2. งานที่ทับซ้อนเวลากับงานที่รับแล้ว → ซ่อน
3. งานที่ตัวเองสร้าง (กรณีมี 2 roles) → ซ่อน
4. งานที่ reserve ให้ผู้ดูแลคนอื่น (preferred_caregiver_id ≠ ตัวเอง) → ซ่อน

**ตัวกรองที่ผู้ดูแลเลือกเอง**:
- ประเภทงาน (job_type): companionship, personal_care, medical_monitoring, dementia_care, post_surgery, emergency
- ระดับความเสี่ยง (risk_level): low_risk, high_risk
- งานเร่งด่วน (is_urgent)

**⚠️ ยังไม่มีใน FinalReport**: รายละเอียด 4 เงื่อนไขกรองอัตโนมัติ

---

## 4. การคิดคะแนน (Trust Score)

**Trust Score** คำนวณจาก **9 ปัจจัย** ด้วย weighted sum (คะแนนฐาน 50 จากเต็ม 100):

| ปัจจัย | น้ำหนัก | ขอบเขต | รายละเอียด |
|--------|:-------:|:------:|----------|
| งานเสร็จ | +5 ต่องาน | สูงสุด +30 | นับจาก job_assignments status=completed |
| รีวิวดี (4-5 ดาว) | +3 ต่อรีวิว | สูงสุด +20 | จาก caregiver_reviews |
| รีวิวปานกลาง (3 ดาว) | +1 ต่อรีวิว | สูงสุด +20 | รวมกับข้อบน |
| รีวิวแย่ (1-2 ดาว) | -5 ต่อรีวิว | ต่ำสุด -20 | ลดคะแนนถ้าบริการไม่ดี |
| ยกเลิกงาน | -10 ต่อครั้ง | ต่ำสุด -30 | นับจาก assignments cancelled |
| GPS violation | -3 ต่อครั้ง | ต่ำสุด -15 | check-in/out มี fraud indicators |
| Check-in ตรงเวลา | +2 ต่อครั้ง | สูงสุด +20 | check-in ภายใน 15 นาทีจากเวลานัด |
| โปรไฟล์ครบ | +10 | ครั้งเดียว | มีชื่อ + bio + ประสบการณ์ |
| ตอบกลับเร็ว | +5 | ครั้งเดียว | response time bonus |

**สูตร**: `Trust Score = max(0, min(100, 50 + ผลรวมทุกปัจจัย))`

**Hysteresis**: ป้องกัน level ขึ้น-ลงถี่เกินไป — L3→L2 จะลงก็ต่อเมื่อ score < 75 (ไม่ใช่ < 80)

---

## 5. การคิดเงิน (Payment & Fee Model)

### Fee Model
- **Platform fee = 10%** ของค่าจ้าง — `Math.floor(total_amount * 0.10)`
- **หักจากค่าจ้างผู้ดูแล** — Hirer จ่ายตามราคาที่ตั้ง ไม่บวก fee เพิ่ม
- Caregiver ได้รับ `total_amount - platform_fee`
- Fee รับรู้เมื่อ job completed เท่านั้น

### Hirer Deposit (มัดจำ)
| ค่าจ้างรวม | มัดจำ |
|-----------|:-----:|
| ≤ 500 บาท | 100 |
| 501–2,000 | 200 |
| 2,001–5,000 | 500 |
| 5,001–10,000 | 1,000 |
| > 10,000 | 2,000 |

### Money Flow (5 ขั้นตอน)

1. **Top-up**: Hirer เติมเงินผ่าน QR Code (Stripe Checkout) → credit wallet
2. **Publish**: hold ค่าจ้าง + มัดจำ จาก available → held balance
3. **Accept**: ย้ายจาก held → escrow wallet (สร้างใหม่ต่องาน)
4. **Checkout (Settlement)**: escrow → caregiver (ค่าจ้าง - fee) + platform (fee) + คืนมัดจำให้ hirer
5. **Cancel**: คืนเงินตามเงื่อนไข (ก่อน/หลัง accept, ล่วงหน้า/ล่าช้า)

### การยกเลิกและการคืนเงิน
| สถานการณ์ | การคืนเงิน |
|----------|----------|
| ยกเลิกก่อน accept | คืนค่าจ้าง + มัดจำ ให้ hirer ทั้งหมด |
| ยกเลิกหลัง accept ≥24 ชม. | คืนค่าจ้าง + คืนมัดจำ ให้ hirer |
| ยกเลิกหลัง accept <24 ชม. (late) | คืนค่าจ้าง + ริบมัดจำ 50% (70% ชดเชย CG, 30% platform) |
| CG ยกเลิก | เงินค้างใน escrow, fault_party=unresolved → Admin settle |

**⚠️ ยังไม่มีใน FinalReport**: Deposit tier table, รายละเอียด late cancel penalty split

---

## 6. การดำเนินงานฝั่งผู้ดูแล (Caregiver Flow)

**ขั้นตอนทำงานทั้งหมด**:

1. **สมัครสมาชิก** → เลือกบทบาท "ผู้ดูแล" → ยอมรับนโยบาย
2. **ยืนยันตัวตน** → OTP (Email + Phone) → KYC (บัตรประชาชน + selfie)
3. **กรอกโปรไฟล์** → ทักษะ, ประสบการณ์, วันที่ว่าง, ใบรับรอง
4. **ดู Job Feed** → กรองงานที่เหมาะสม → ดูรายละเอียด
5. **รับงาน (Accept)** → ระบบสร้าง escrow + chat อัตโนมัติ
6. **แชทกับผู้ว่าจ้าง** → นัดหมาย สอบถามรายละเอียด
7. **Check-in** → กดเช็คอิน ระบบบันทึก GPS → สถานะ "กำลังดำเนินการ"
8. **ทำงาน** → ดูแลผู้สูงอายุตามที่ตกลง
9. **Check-out** → เขียน evidence note สรุปงาน → ระบบจ่ายเงินอัตโนมัติ
10. **ถอนเงิน** → (ต้อง L2+) เลือกบัญชีธนาคาร → รอ Admin อนุมัติ

**กรณีพิเศษ**:
- **Early Checkout**: ส่งงานก่อนเวลา → เขียนเหตุผล → รอ hirer อนุมัติ/ปฏิเสธ
- **ปฏิเสธงาน Direct Assign**: กด Reject พร้อมเหตุผล → งานกลับไปเปิดรับสมัคร
- **Auto-complete**: ถ้าเลย scheduled_end_at + 10 นาที ระบบ checkout อัตโนมัติ

---

## 7. การดำเนินงานฝั่งผู้ว่าจ้าง (Hirer Flow)

**ขั้นตอนทำงานทั้งหมด**:

1. **สมัครสมาชิก** → เลือกบทบาท "ผู้ว่าจ้าง" → ยอมรับนโยบาย
2. **เพิ่มผู้รับการดูแล** → กรอกข้อมูลผู้สูงอายุ (ชื่อ, อายุ, โรคประจำตัว, อุปกรณ์การแพทย์)
3. **สร้างงาน (wizard form)**:
   - เลือกผู้รับการดูแล
   - กรอก: ชื่องาน, ประเภท (6 ประเภท), คำอธิบาย
   - เลือกวันเวลา → ระบบคำนวณจำนวนชั่วโมงอัตโนมัติ
   - กรอกที่อยู่ + ตั้งค่าจ้าง/ชม.
   - เลือก job tasks, required skills, equipment, precautions
   - ระบบคำนวณ **risk level อัตโนมัติ** จากข้อมูลผู้ป่วย + ประเภทงาน + tasks
4. **เติมเงิน** → QR Code → เงินเข้า wallet
5. **เผยแพร่งาน** → ระบบ hold เงิน (ค่าจ้าง + มัดจำ) → งานปรากฏใน feed
6. **หรือ Direct Assign** → ค้นหาผู้ดูแล → เลือก → มอบหมายตรง
7. **ติดตามงาน** → ได้รับ notification ทุกขั้นตอน (accept, check-in, check-out)
8. **อนุมัติ/ปฏิเสธ Early Checkout** → ดูหลักฐาน → ตัดสินใจ
9. **เขียนรีวิว** → หลังงานเสร็จ ให้คะแนน 1-5 ดาว + ความคิดเห็น

---

## 8. การแจ้งข้อพิพาท (Dispute)

**ขั้นตอน**:
1. ผู้ว่าจ้างหรือผู้ดูแล **กดเปิดข้อพิพาท** จากหน้ารายละเอียดงาน
2. กรอก **เหตุผลและรายละเอียด** ปัญหา
3. ระบบ **แจ้งเตือน Admin + อีกฝ่าย** ทันที
4. ทั้ง 2 ฝ่าย **ส่งหลักฐานเพิ่มเติม** ผ่าน dispute messages
5. Admin **รับมอบหมาย** → สถานะเปลี่ยนเป็น in_review
6. Admin **อ่านหลักฐาน** แล้ว **ตัดสิน (settle)**:
   - กำหนด refund_amount (คืน hirer)
   - กำหนด payout_amount (จ่าย caregiver)
   - กำหนด fee/penalty/deposit/compensation
   - validation: ยอดรวมต้อง ≤ escrow balance, ป้องกัน double-settle
7. ระบบ **โอนเงินจาก escrow** ตามที่ Admin กำหนด + **แจ้งเตือนทั้ง 2 ฝ่าย**

**สถานะ dispute**: open → in_review → resolved / rejected

---

## 9. การร้องเรียน (Complaint)

**⚠️ ยังไม่มีใน FinalReport**: ระบบร้องเรียนแยกต่างหากจาก dispute

**ความแตกต่างจาก Dispute**:
- Dispute = ปัญหาเกี่ยวกับงานเฉพาะ มีเงินเกี่ยวข้อง
- Complaint = ร้องเรียนทั่วไป ไม่จำเป็นต้องผูกกับงาน

**หมวดหมู่ร้องเรียน**: inappropriate_name, scam_fraud, harassment, safety_concern, payment_issue, other

**ขั้นตอน**:
1. ผู้ใช้กดเมนู "ร้องเรียน"
2. เลือกหมวดหมู่ + กรอกรายละเอียด + แนบไฟล์ (สูงสุด 5 ไฟล์, 10MB/ไฟล์)
3. ระบบบันทึก → Admin ดูรายการทั้งหมดได้
4. Admin อัปเดตสถานะ + เขียน admin_note

**สถานะ**: open → in_review → resolved / dismissed

---

## 10. แอดมินจัดการอะไรได้บ้าง

| ฟังก์ชัน | รายละเอียด |
|---------|----------|
| **จัดการผู้ใช้** | ค้นหา, ดูรายละเอียด, เปลี่ยนสถานะ (active/suspended), แก้ไข trust level, แก้ไข trust score |
| **Ban ผู้ใช้** | ban_login (ห้าม login), ban_job_create (ห้ามสร้างงาน), ban_job_accept (ห้ามรับงาน), ban_withdraw (ห้ามถอนเงิน) |
| **ตรวจสอบ KYC** | ดูเอกสาร (บัตรประชาชน + selfie), approve/reject พร้อมเหตุผล |
| **จัดการงาน** | ดูงานทั้งหมด, กรองตามสถานะ/ประเภท/ความเสี่ยง, ยกเลิกงานที่มีปัญหา (refund อัตโนมัติ) |
| **ตัดสิน Dispute** | รับมอบหมาย, อ่านหลักฐาน, settle เงินจาก escrow (กำหนด refund/payout/fee/penalty) |
| **จัดการ Complaint** | ดูรายการร้องเรียน, อัปเดตสถานะ, เขียน admin_note |
| **อนุมัติถอนเงิน** | review → approve → mark-paid / reject พร้อมเหตุผล |
| **ดูการเงิน** | Dashboard สถิติ, ledger transactions ทั้งหมด, รายงานสรุปรายได้ |
| **คำนวณ Trust ใหม่** | recalculate ทั้งระบบ หรือ รายคน |
| **ดูสุขภาพระบบ** | health check (DB connection, uptime) |

---

## 11. ระบบแจ้งเตือนทำได้ขนาดไหน

**4 ช่องทาง**:

| ช่องทาง | เทคโนโลยี | รายละเอียด |
|---------|----------|----------|
| **In-App (Real-time)** | Socket.IO | ส่ง event ทันทีเมื่อเกิดเหตุการณ์ → badge +1 + toast popup |
| **In-App (Polling)** | HTTP GET ทุก 15 วิ | fallback กรณี socket หลุด + refresh เมื่อ focus/online/reconnect |
| **Push Notification** | PWA Service Worker + Web Push | แจ้งเตือนแม้ไม่เปิด browser (ต้อง allow permission) |
| **Email** | Nodemailer | ส่ง email เมื่อเกิด event สำคัญ |

**เหตุการณ์ที่แจ้งเตือน**:
- ผู้ดูแลรับงาน → แจ้ง hirer
- Check-in → แจ้ง hirer "ผู้ดูแลเริ่มงานแล้ว"
- Check-out → แจ้ง hirer "งานเสร็จสมบูรณ์"
- งานถูกยกเลิก → แจ้งอีกฝ่าย
- มีคำขอ Early Checkout → แจ้ง hirer
- มอบหมายงานตรง → แจ้ง caregiver
- Dispute เปิด → แจ้ง Admin + อีกฝ่าย
- KYC อนุมัติ/ปฏิเสธ → แจ้งผู้ใช้

**ฟีเจอร์เสริม**:
- ผู้ใช้ตั้งค่า preferences ได้ (เปิด/ปิด email, push)
- กดอ่านทีละรายการ / อ่านทั้งหมด
- badge count แสดงที่ TopBar ตลอด

---

## 12. แอปทำรายได้ยังไง (Revenue Model)

**⚠️ ยังไม่มีใน FinalReport**: Revenue Model โดยละเอียด

**แหล่งรายได้หลัก**:

| แหล่ง | วิธีคิด | เมื่อไร |
|-------|--------|--------|
| **Platform Service Fee** | 10% ของค่าจ้าง (หักจากส่วน caregiver) | เมื่อ job completed |
| **Late Cancel Penalty** | 30% ของมัดจำที่ริบ (กรณี hirer ยกเลิก <24 ชม.) | เมื่อ late cancel |

**ตัวอย่าง**:
- งานค่าจ้าง 1,000 บาท → Platform ได้ fee 100 บาท, Caregiver ได้ 900 บาท
- Hirer จ่ายทั้งหมด 1,000 + มัดจำ 200 = 1,200 บาท (มัดจำคืนเมื่องานเสร็จ)

**Wallet Types**:
| ประเภท | เจ้าของ | หน้าที่ |
|--------|--------|--------|
| hirer | ผู้ว่าจ้าง | เก็บเงินเติม ใช้จ่ายค่าจ้าง |
| caregiver | ผู้ดูแล | รับเงินจากงานเสร็จ ถอนได้ |
| escrow | ต่องาน | พักเงินระหว่างทำงาน ไม่มีใครเข้าถึง |
| platform | ระบบ | เก็บ service fee |
| platform_replacement | ระบบ | เก็บ replacement fee |

---

## 13. Tech Stack

| เทคโนโลยี | คืออะไร | ทำไมต้องใช้ |
|----------|--------|-----------|
| **React 18** | JavaScript UI library แบบ component-based | Hooks, Concurrent rendering, ecosystem ใหญ่ |
| **TypeScript** | superset ของ JS เพิ่มระบบ type | ป้องกัน bug ตอน compile, refactor ปลอดภัย |
| **Tailwind CSS** | utility-first CSS framework | พัฒนา UI เร็ว, bundle size เล็ก (purge unused) |
| **Vite** | frontend build tool (ESBuild + Rollup) | HMR เร็วมาก, build เร็วกว่า Webpack 10-100x |
| **Node.js** | JavaScript runtime บน server (V8 engine) | ภาษาเดียว frontend+backend, non-blocking I/O |
| **Express.js** | web framework สำหรับ Node.js | เบา, middleware architecture, ecosystem ใหญ่ |
| **Socket.IO** | real-time bidirectional communication | auto-reconnect, room management, polling fallback |
| **PostgreSQL 15** | relational database (SQL) | ACID สำหรับ financial, SELECT FOR UPDATE lock row |
| **JWT** | JSON Web Token (stateless auth) | ไม่ต้อง store session, ใช้กับ Socket.IO auth ได้ |
| **Google OAuth 2.0** | login ผ่านบัญชี Google | ไม่ต้องจำ password, verified email ทันที |
| **Joi** | schema validation library | validate ทุก API input, ป้องกัน injection |
| **bcrypt** | password hashing (one-way + salt) | ปลอดภัยกว่า SHA/MD5, industry standard |
| **Docker Compose** | multi-container orchestration | ทุก environment เหมือนกัน, reproducible setup |
| **Jest** | JavaScript testing framework | 179 tests, unit + integration, mock system |
| **Playwright** | E2E browser testing | ทดสอบบน Chromium จริง, จำลอง user interaction |
| **Stripe** | payment gateway | Checkout Session, webhook-driven, secure |
| **SMSOK** | SMS OTP provider (ไทย) | ส่ง OTP ผ่าน SMS เบอร์ไทย |
| **Nodemailer** | email sending library | password reset, email OTP, notifications |

**ตัวเลขสำคัญ**:
- 40 Use Cases / 128 API Endpoints / 16 Controllers
- 40 Database Tables / 1,391 lines schema
- 179 Automated Tests (Jest + Playwright)
- 50+ Frontend Pages
