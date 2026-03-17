# บทที่ 3 การออกแบบและพัฒนาระบบ (ส่วนที่ 1: Section 3.1–3.3)

> Copy-paste ready สำหรับวิทยานิพนธ์ | Diagram ที่เป็น Mermaid → นำไปวางที่ https://mermaid.live แล้ว export รูป

---

## 3.1 สถาปัตยกรรมระบบ (System Architecture)

ระบบ CareConnect ออกแบบตามแนวคิด 3-Tier Architecture แบ่งการทำงานออกเป็น 3 ชั้นที่แยกหน้าที่กันอย่างชัดเจน ชั้นแรกคือ Presentation Layer ซึ่งเป็นส่วนที่ผู้ใช้โต้ตอบโดยตรง พัฒนาด้วย React 18 ในรูปแบบ Single Page Application (SPA) ใช้ TypeScript เป็นภาษาหลัก Vite เป็น build tool และ TailwindCSS สำหรับ styling ทำงานบน web browser ผ่าน port 5173 สื่อสารกับชั้นถัดไปผ่าน REST API (Axios) และ WebSocket (Socket.IO)

ชั้นที่สองคือ Application Layer ซึ่งเป็น backend ของระบบ พัฒนาด้วย Node.js (ES Modules) ร่วมกับ Express.js ทำหน้าที่ประมวลผล business logic ทั้งหมด ประกอบด้วยระบบ Authentication ด้วย JWT Access Token (อายุ 15 นาทีสำหรับ production) และ Refresh Token (อายุ 7 วัน) ระบบ Authorization ด้วย Policy Gate System ที่ใช้ฟังก์ชัน can() ตรวจสิทธิ์แบบ action-based ระบบ Validation ด้วย Joi Schema สำหรับทุก request ระบบ Real-time ด้วย Socket.IO สำหรับ chat และ notifications และ Background Worker สำหรับคำนวณ Trust Score ทำงานบน port 3000

ชั้นที่สามคือ Data Layer ใช้ PostgreSQL 15 เป็นฐานข้อมูลหลัก ออกแบบด้วยหลักการสำคัญ 4 ประการ ได้แก่ Immutable Ledger ที่ตาราง ledger_transactions เป็น append-only ห้าม UPDATE/DELETE ด้วย database trigger, Derived State ที่ trust_level คำนวณโดย worker เท่านั้น, Constraint Integrity ที่บังคับว่ายอดเงินติดลบไม่ได้และแต่ละงานมี active assignment ได้เพียง 1 รายการ และ UUID Primary Keys สำหรับทุกตาราง นอกจากนี้ยังมี External Services (Mock Provider) บน port 4000 สำหรับจำลอง Payment, SMS และ KYC providers

> 📌 **DIAGRAM: 3-Tier Architecture** — นำไปวางที่ https://mermaid.live

```mermaid
graph TB
    subgraph "TIER 1 — Presentation Layer"
        FE["React 18 + TypeScript + Vite + TailwindCSS<br/>Web Browser (Port 5173)"]
    end
    subgraph "TIER 2 — Application Layer"
        BE["Node.js + Express.js + Socket.IO<br/>JWT Auth + Joi Validation + Policy Gates<br/>API Server (Port 3000)"]
    end
    subgraph "TIER 3 — Data Layer"
        DB["PostgreSQL 15<br/>40 Tables"]
        MOCK["Mock Provider<br/>Payment/SMS/KYC<br/>Port 4000"]
    end
    FE -->|"HTTPS / REST API"| BE
    FE -.->|"WSS (Socket.IO)"| BE
    BE -->|"SQL"| DB
    BE -->|"HTTP"| MOCK
```

**ตาราง 3.1** Docker Containers ของระบบ

| Container | Port | หน้าที่ |
|-----------|------|---------|
| frontend | 5173 | Serve React SPA และ proxy /api ไปยัง backend |
| backend | 3000 | REST API server และ Socket.IO server |
| postgres | 5432 | PostgreSQL 15 database |
| mock-provider | 4000 | จำลอง Payment, SMS, KYC providers |
| pgadmin | 5050 | Database management UI (ทางเลือก) |
| migrate | — | Database migration (on-demand) |

---

## 3.2 ส่วนประกอบของระบบ (System Components)

### 3.2.1 Frontend Application

ส่วน Frontend พัฒนาด้วย React 18 ในรูปแบบ Single Page Application เขียนด้วย TypeScript ใช้ Vite เป็น build tool และ TailwindCSS เป็น utility-first CSS framework โครงสร้างแบ่งออกเป็น pages/ เก็บหน้าจอจัดกลุ่มตาม role, components/ui/ เก็บ UI components ที่ใช้ซ้ำ, contexts/ เก็บ AuthContext, layouts/ เก็บ layout หลัก, services/ เก็บ module เรียก API และ router.tsx กำหนด routing พร้อม Guards

ระบบ Route Guards ประกอบด้วย RequireAuth, RequireRole, RequirePolicy, RequireProfile และ RequireAdmin ใช้ sessionStorage แทน localStorage เพื่อรองรับหลาย tab พร้อมกันในคนละ role

### 3.2.2 Backend API Server

Backend พัฒนาด้วย Node.js 20 LTS ใช้ ES Modules และ Express.js 4 มี 17 route files รวมกว่า 137 endpoints ทุก request ผ่าน middleware chain: requireAuth (JWT) → requirePolicy (action-based) → Joi validation

**ตาราง 3.2** Route Files และจำนวน Endpoints

| Route File | Mount Path | Endpoints |
|-----------|-----------|-----------|
| authRoutes.js | /api/auth | 21 |
| otpRoutes.js | /api/otp | 4 |
| jobRoutes.js | /api/jobs | 15 |
| caregiverSearchRoutes.js | /api/caregivers | 4 |
| careRecipientRoutes.js | /api/care-recipients | 5 |
| caregiverDocumentRoutes.js | /api/caregiver-documents | 4 |
| reviewRoutes.js | /api/reviews | 3 |
| favoritesRoutes.js | /api/favorites | 3 |
| kycRoutes.js | /api/kyc | 3 |
| walletRoutes.js | /api/wallet | 21 |
| paymentRoutes.js | /api/payments | 3 |
| chatRoutes.js | /api/chat | 9 |
| disputeRoutes.js | /api/disputes | 5 |
| notificationRoutes.js | /api/notifications | 9 |
| webhookRoutes.js | /api/webhooks | 4 |
| complaintRoutes.js | /api/complaints | 5 |
| adminRoutes.js | /api/admin | 19 |

### 3.2.3 WebSocket Server

ระบบ real-time ใช้ Socket.IO 4 แบ่ง 2 ส่วน: chatSocket.js จัดการ room thread:{threadId} สำหรับ chat (1 งาน = 1 thread) และ realtimeHub.js จัดการ notification push ผ่าน room user:{userId}

### 3.2.4 ฐานข้อมูล

**ตาราง 3.3** กลุ่มตารางในฐานข้อมูล (40 ตาราง)

| กลุ่ม | ตาราง |
|------|-------|
| Users & Auth | users, hirer_profiles, caregiver_profiles, auth_sessions, user_policy_acceptances, password_reset_tokens |
| KYC & Documents | user_kyc_info, caregiver_documents |
| Job System | job_posts, jobs, job_assignments, patient_profiles, job_patient_requirements, job_patient_sensitive_data |
| Evidence | job_gps_events, job_photo_evidence, early_checkout_requests |
| Financial | wallets, ledger_transactions, topup_intents, withdrawal_requests, bank_accounts, banks |
| Communication | chat_threads, chat_messages |
| Dispute | disputes, dispute_messages, dispute_events |
| Notification | notifications |
| Trust & Audit | trust_score_history, audit_events |
| Social | caregiver_reviews, caregiver_favorites |
| Webhook | provider_webhooks |

### 3.2.5 เทคโนโลยีที่ใช้

**ตาราง 3.4** Frontend Technology Stack

| เทคโนโลยี | เวอร์ชัน | หน้าที่ |
|-----------|---------|---------|
| React | 18.2 | UI Framework (Component-based SPA) |
| TypeScript | 5.3 | Type-safe JavaScript |
| Vite | 5.0 | Build tool และ Dev server |
| TailwindCSS | 3.4 | Utility-first CSS framework |
| React Router DOM | 6.21 | Client-side routing |
| Axios | 1.6 | HTTP client สำหรับ REST API |
| Socket.IO Client | 4.6 | Real-time WebSocket |
| react-hot-toast | 2.4 | Toast notification |
| Lucide React | 0.303 | Icon library |
| Leaflet + React-Leaflet | 1.9/4.2 | แผนที่แสดงตำแหน่งงาน |
| zustand | 4.4 | State management |
| zod | 3.22 | Schema validation |
| clsx | 2.1 | Conditional CSS class |
| date-fns | 3.0 | Date/time formatting |

**ตาราง 3.5** Backend Technology Stack

| เทคโนโลยี | เวอร์ชัน | หน้าที่ |
|-----------|---------|---------|
| Node.js | 20 LTS | JavaScript runtime (ESM) |
| Express.js | 4.18 | Web framework + REST API |
| Socket.IO | 4.6 | WebSocket server |
| jsonwebtoken | 9.0 | JWT generation/verification |
| bcrypt | 5.1 | Password hashing |
| Joi | 17.11 | Request validation |
| pg | 8.11 | PostgreSQL client |
| multer | 1.4 | File upload |
| google-auth-library | 9.15 | Google OAuth 2.0 |
| express-rate-limit | 7.1 | Rate limiting |
| nodemailer | 6.9 | Email sending |
| sharp | 0.33 | Image processing |
| winston | 3.11 | Structured logging |
| stripe | 14.21 | Payment integration |
| PostgreSQL | 15 | Relational database |
| Docker Compose | — | Container orchestration |

---

## 3.3 บทบาทผู้ใช้งาน (User Roles)

### 3.3.1 ประเภทผู้ใช้งาน

ระบบ CareConnect กำหนดผู้ใช้งาน 3 บทบาท ได้แก่ Hirer (ผู้ว่าจ้าง) สร้างงาน ค้นหาและว่าจ้างผู้ดูแล ชำระค่าจ้าง, Caregiver (ผู้ดูแล) รับงาน check-in/out รับค่าตอบแทน และ Admin (ผู้ดูแลระบบ) อนุมัติ KYC ตัดสินข้อพิพาท จัดการผู้ใช้

**ตาราง 3.6** ประเภทผู้ใช้งาน

| บทบาท | ประเภทบัญชี | คำอธิบาย |
|-------|------------|---------|
| Hirer | Guest (email) / Member (phone) | ผู้ว่าจ้าง — สร้างงาน, ว่าจ้าง, จ่ายเงิน |
| Caregiver | Guest (email) / Member (phone) | ผู้ดูแล — รับงาน, check-in/out, รับเงิน |
| Admin | — | จัดการระบบ, approve KYC, resolve dispute |

### 3.3.2 ระบบ Trust Level

ระบบ Trust Level แบ่งเป็น 4 ระดับ: L0 (Unverified) เริ่มต้น → L1 (Basic) หลังยืนยัน Phone OTP → L2 (Verified) หลัง KYC + Admin approve → L3 (Trusted) เมื่อ Bank verified + Trust Score ≥ 80 มี hysteresis คือลดลง L2 เมื่อ score < 75

> 📌 **DIAGRAM: Trust Level Progression** — Mermaid code:

```mermaid
graph TD
    L0["L0 Unverified"] -->|"Phone OTP"| L1["L1 Basic"]
    L1 -->|"KYC approve"| L2["L2 Verified"]
    L2 -->|"Score ≥ 80"| L3["L3 Trusted"]
    L3 -.->|"Score < 75"| L2
    style L0 fill:#fee,stroke:#c00
    style L1 fill:#ffd,stroke:#990
    style L2 fill:#dfd,stroke:#060
    style L3 fill:#ddf,stroke:#006
```

**ตาราง 3.7** ปัจจัยการคำนวณ Trust Score (base=50, clamp 0-100)

| ปัจจัย | คะแนน | เพดาน |
|-------|------:|-------|
| งานที่ทำเสร็จ | +5/งาน | +30 |
| รีวิว 4-5 ดาว | +3/รีวิว | +20 |
| รีวิว 3 ดาว | +1/รีวิว | รวมเพดาน |
| รีวิว 1-2 ดาว | -5/รีวิว | -20 |
| ยกเลิกงาน | -10/ครั้ง | -30 |
| GPS violation | -3/ครั้ง | -15 |
| Check-in ตรงเวลา | +2/ครั้ง | +20 |
| โปรไฟล์ครบ | +10 | ครั้งเดียว |
| Response time bonus | +5 | ครั้งเดียว |

**ตาราง 3.8** สิทธิ์การเข้าถึงตาม Role และ Trust Level

| การกระทำ | บทบาท | L0 | L1 | L2 | L3 |
|---------|-------|:--:|:--:|:--:|:--:|
| สมัคร/Login/ดูโปรไฟล์ | ทุก role | ✓ | ✓ | ✓ | ✓ |
| สร้าง job draft | Hirer | ✓ | ✓ | ✓ | ✓ |
| Top-up wallet | ทุก role | ✓ | ✓ | ✓ | ✓ |
| ยกเลิกงาน | Hirer/CG | ✓ | ✓ | ✓ | ✓ |
| เผยแพร่งาน low_risk | Hirer | ✗ | ✓ | ✓ | ✓ |
| รับงาน/Check-in/out | Caregiver | ✗ | ✓ | ✓ | ✓ |
| เผยแพร่งาน high_risk | Hirer | ✗ | ✗ | ✓ | ✓ |
| ถอนเงิน | Caregiver | ✗ | ✗ | ✓ | ✓ |
| Admin: จัดการทุกอย่าง | Admin | ✓ | ✓ | ✓ | ✓ |

### 3.3.3 รายการความสามารถของผู้ใช้งานแต่ละประเภท

**ตาราง 3.9** รายการความสามารถของผู้ใช้งานประเภท Hirer (ผู้ว่าจ้าง)

| ID | Requirements | Details | Type | Priority |
|----|-------------|---------|------|----------|
| R01 | ลงทะเบียน | ผู้ใช้ต้องสามารถลงทะเบียนเป็นผู้ว่าจ้างได้ผ่าน Email, Phone หรือ Google OAuth | Functional | Must have |
| R02 | เข้าสู่ระบบ/ออกจากระบบ | ผู้ใช้ต้องสามารถเข้าสู่ระบบและออกจากระบบได้ | Functional | Must have |
| R03 | ยืนยันตัวตน OTP | ผู้ใช้ต้องสามารถยืนยันเบอร์โทรศัพท์ด้วย OTP เพื่ออัปเกรด Trust Level เป็น L1 ได้ | Functional | Must have |
| R04 | จัดการโปรไฟล์ | ผู้ใช้ต้องสามารถดูและแก้ไขข้อมูลโปรไฟล์ รวมถึงอัปโหลดรูปประจำตัวได้ | Functional | Must have |
| R05 | ยืนยัน KYC | ผู้ใช้ต้องสามารถส่งเอกสารยืนยันตัวตน (KYC) เพื่ออัปเกรด Trust Level เป็น L2 ได้ | Functional | Must have |
| R06 | จัดการผู้รับการดูแล | ผู้ใช้ต้องสามารถเพิ่ม แก้ไข และลบข้อมูลผู้รับการดูแล (Care Recipient) ได้ | Functional | Must have |
| R07 | สร้างงาน | ผู้ใช้ต้องสามารถสร้างงานดูแลผู้สูงอายุในรูปแบบ Draft ได้ โดยระบบคำนวณ Risk Level อัตโนมัติ | Functional | Must have |
| R08 | เผยแพร่งาน | ผู้ใช้ต้องสามารถเผยแพร่งาน Draft ไปยัง Job Feed ได้ โดยระบบ hold เงินอัตโนมัติ | Functional | Must have |
| R09 | ยกเลิกงาน | ผู้ใช้ต้องสามารถยกเลิกงานที่ยังไม่เสร็จได้ โดยระบบคืนเงินอัตโนมัติ | Functional | Must have |
| R10 | ค้นหาผู้ดูแล | ผู้ใช้ต้องสามารถค้นหาผู้ดูแลตามทักษะ ประสบการณ์ Trust Level และวันที่ว่างได้ | Functional | Must have |
| R11 | มอบหมายงานตรง | ผู้ใช้ต้องสามารถเลือกผู้ดูแลและมอบหมายงานโดยตรง (Direct Assign) ได้ | Functional | Must have |
| R12 | เติมเงิน | ผู้ใช้ต้องสามารถเติมเงินเข้ากระเป๋าเงินผ่าน QR Code ได้ | Functional | Must have |
| R13 | ดูยอดเงินและประวัติ | ผู้ใช้ต้องสามารถดูยอดเงินคงเหลือ ยอดถูกล็อค และประวัติการชำระเงินได้ | Functional | Must have |
| R14 | จัดการบัญชีธนาคาร | ผู้ใช้ต้องสามารถเพิ่ม ลบ และตั้งค่าบัญชีธนาคารหลักได้ | Functional | Must have |
| R15 | แชทกับผู้ดูแล | ผู้ใช้ต้องสามารถส่งข้อความแบบเรียลไทม์กับผู้ดูแลที่รับงานได้ | Functional | Must have |
| R16 | รับแจ้งเตือน | ผู้ใช้ต้องได้รับแจ้งเตือนเมื่อมีเหตุการณ์สำคัญ เช่น ผู้ดูแลรับงาน, Check-in, Check-out | Functional | Must have |
| R17 | อนุมัติ/ปฏิเสธ Early Checkout | ผู้ใช้ต้องสามารถอนุมัติหรือปฏิเสธคำขอ Checkout ก่อนเวลาของผู้ดูแลได้ | Functional | Must have |
| R18 | เปิดข้อพิพาท | ผู้ใช้ต้องสามารถเปิดข้อพิพาทและส่งหลักฐานเมื่อเกิดปัญหากับงานได้ | Functional | Must have |
| R19 | บันทึกผู้ดูแลที่ชอบ | ผู้ใช้ต้องสามารถบันทึกผู้ดูแลลงรายการโปรดเพื่อเรียกใช้ในอนาคตได้ | Functional | Optional |
| R20 | เขียนรีวิว | ผู้ใช้ต้องสามารถให้คะแนนและเขียนรีวิวผู้ดูแลหลังงานเสร็จสมบูรณ์ได้ | Functional | Must have |
| R21 | ลืม/รีเซ็ตรหัสผ่าน | ผู้ใช้ต้องสามารถขอลิงก์รีเซ็ตรหัสผ่านทาง Email ได้ | Functional | Must have |
| R22 | เปลี่ยนรหัสผ่าน | ผู้ใช้ต้องสามารถเปลี่ยนรหัสผ่านขณะเข้าสู่ระบบอยู่ได้ | Functional | Must have |

**ตาราง 3.10** รายการความสามารถของผู้ใช้งานประเภท Caregiver (ผู้ดูแล)

| ID | Requirements | Details | Type | Priority |
|----|-------------|---------|------|----------|
| R01 | ลงทะเบียน | ผู้ใช้ต้องสามารถลงทะเบียนเป็นผู้ดูแลได้ผ่าน Email, Phone หรือ Google OAuth | Functional | Must have |
| R02 | เข้าสู่ระบบ/ออกจากระบบ | ผู้ใช้ต้องสามารถเข้าสู่ระบบและออกจากระบบได้ | Functional | Must have |
| R03 | ยืนยันตัวตน OTP | ผู้ใช้ต้องสามารถยืนยันเบอร์โทรศัพท์ด้วย OTP เพื่ออัปเกรด Trust Level เป็น L1 ได้ | Functional | Must have |
| R04 | จัดการโปรไฟล์ | ผู้ใช้ต้องสามารถดูและแก้ไขข้อมูลโปรไฟล์ รวมถึงอัปโหลดรูปประจำตัวได้ | Functional | Must have |
| R05 | ยืนยัน KYC | ผู้ใช้ต้องสามารถส่งเอกสารยืนยันตัวตน (KYC) เพื่ออัปเกรด Trust Level เป็น L2 ได้ | Functional | Must have |
| R06 | อัปโหลดเอกสาร/ใบรับรอง | ผู้ใช้ต้องสามารถอัปโหลดใบรับรองและเอกสารวิชาชีพเพื่อแสดงในโปรไฟล์สาธารณะได้ | Functional | Must have |
| R07 | ดูประกาศงาน | ผู้ใช้ต้องสามารถดูรายการงานที่เหมาะสมกับ Trust Level ของตนใน Job Feed ได้ | Functional | Must have |
| R08 | รับงาน | ผู้ใช้ต้องสามารถรับงานจาก Job Feed หรือรับงาน Direct Assign ที่ผู้ว่าจ้างมอบหมายได้ | Functional | Must have |
| R09 | ปฏิเสธงาน Direct Assign | ผู้ใช้ต้องสามารถปฏิเสธงานที่ถูกมอบหมายโดยตรงพร้อมเหตุผลได้ | Functional | Must have |
| R10 | เช็คอิน | ผู้ใช้ต้องสามารถ Check-in เมื่อถึงสถานที่ทำงานโดยบันทึก GPS ได้ | Functional | Must have |
| R11 | เช็คเอาท์ | ผู้ใช้ต้องสามารถ Check-out เมื่อทำงานเสร็จ พร้อมบันทึก GPS และ evidence note ได้ | Functional | Must have |
| R12 | ขอ Early Checkout | ผู้ใช้ต้องสามารถขอ Checkout ก่อนเวลาพร้อมเหตุผลเพื่อรอการอนุมัติจากผู้ว่าจ้างได้ | Functional | Must have |
| R13 | ดูยอดเงินและรายได้ | ผู้ใช้ต้องสามารถดูยอดเงินคงเหลือและประวัติรายได้จากงานที่ทำเสร็จได้ | Functional | Must have |
| R14 | ถอนเงิน | ผู้ใช้ต้องสามารถขอถอนเงินไปยังบัญชีธนาคารได้เมื่อมี Trust Level L2 ขึ้นไป | Functional | Must have |
| R15 | จัดการบัญชีธนาคาร | ผู้ใช้ต้องสามารถเพิ่ม ลบ และตั้งค่าบัญชีธนาคารหลักได้ | Functional | Must have |
| R16 | แชทกับผู้ว่าจ้าง | ผู้ใช้ต้องสามารถส่งข้อความแบบเรียลไทม์กับผู้ว่าจ้างของงานที่รับได้ | Functional | Must have |
| R17 | รับแจ้งเตือน | ผู้ใช้ต้องได้รับแจ้งเตือนเมื่อมีเหตุการณ์สำคัญ เช่น ได้รับมอบหมายงาน, งานถูกยกเลิก | Functional | Must have |
| R18 | เปิดข้อพิพาท | ผู้ใช้ต้องสามารถเปิดข้อพิพาทและส่งหลักฐานเมื่อเกิดปัญหากับงานได้ | Functional | Must have |
| R19 | ลืม/รีเซ็ตรหัสผ่าน | ผู้ใช้ต้องสามารถขอลิงก์รีเซ็ตรหัสผ่านทาง Email ได้ | Functional | Must have |
| R20 | เปลี่ยนรหัสผ่าน | ผู้ใช้ต้องสามารถเปลี่ยนรหัสผ่านขณะเข้าสู่ระบบอยู่ได้ | Functional | Must have |

**ตาราง 3.11** รายการความสามารถของผู้ใช้งานประเภท Admin (ผู้ดูแลระบบ)

| ID | Requirements | Details | Type | Priority |
|----|-------------|---------|------|----------|
| R01 | เข้าสู่ระบบ/ออกจากระบบ | ผู้ดูแลระบบต้องสามารถเข้าสู่ระบบและออกจากระบบได้ | Functional | Must have |
| R02 | ดูภาพรวมระบบ | ผู้ดูแลระบบต้องสามารถดูสถิติจำนวนผู้ใช้ งาน และยอดเงินรวมบน Dashboard ได้ | Functional | Must have |
| R03 | จัดการผู้ใช้ | ผู้ดูแลระบบต้องสามารถค้นหา ดูรายละเอียด เปลี่ยนสถานะ และแก้ไขข้อมูลผู้ใช้ได้ | Functional | Must have |
| R04 | Ban ผู้ใช้ | ผู้ดูแลระบบต้องสามารถ Ban ผู้ใช้ในรูปแบบต่าง ๆ ได้ เช่น ban_login, ban_job_create, ban_withdraw | Functional | Must have |
| R05 | อนุมัติ/ปฏิเสธ KYC | ผู้ดูแลระบบต้องสามารถตรวจสอบเอกสาร KYC และอนุมัติหรือปฏิเสธได้ โดยระบบอัปเกรด Trust Level อัตโนมัติ | Functional | Must have |
| R06 | จัดการงาน | ผู้ดูแลระบบต้องสามารถดูรายการงานทั้งหมดและยกเลิกงานที่มีปัญหาได้ โดยระบบคืนเงินอัตโนมัติ | Functional | Must have |
| R07 | ดูรายการเงิน | ผู้ดูแลระบบต้องสามารถดู Ledger Transactions ทั้งหมด กรองตามประเภท วันที่ และ Wallet ได้ | Functional | Must have |
| R08 | ตัดสินข้อพิพาท | ผู้ดูแลระบบต้องสามารถรับมอบหมาย อ่านหลักฐาน และตัดสินข้อพิพาทด้วยการ Refund/Payout/Split เงินจาก Escrow ได้ | Functional | Must have |
| R09 | ดูรายงานสรุป | ผู้ดูแลระบบต้องสามารถดูรายงานสรุปรายได้ จำนวนงาน และข้อพิพาท กรองตามช่วงวันที่ได้ | Functional | Must have |
| R10 | คำนวณ Trust Level ใหม่ | ผู้ดูแลระบบต้องสามารถสั่งคำนวณ Trust Level ใหม่ทั้งระบบหรือเฉพาะรายบุคคลได้ | Functional | Optional |
| R11 | แก้ไข Trust Level/Score | ผู้ดูแลระบบต้องสามารถแก้ไข Trust Level และ Trust Score ของผู้ใช้ได้โดยตรง | Functional | Must have |
| R12 | ดู Wallet ผู้ใช้ | ผู้ดูแลระบบต้องสามารถดูยอดเงินในกระเป๋าเงินของผู้ใช้แต่ละคนได้ | Functional | Must have |
