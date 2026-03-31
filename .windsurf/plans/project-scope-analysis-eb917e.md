# CareConnect — วิเคราะห์ขอบเขตโครงงานจากโค้ดจริง (Full Audit)

สรุปผลการตรวจสอบระบบ CareConnect ทั้ง end-to-end จากโค้ดจริง เพื่อใช้เขียนหัวข้อ "1.3 ขอบเขตของโครงงาน" ในรายงานวิชาการ

---

## ส่วนที่ 1: สรุปผลการตรวจจากโค้ด (Audit Results)

### 1. ผู้ใช้ในระบบ — 3 ประเภท (verified from code)

| Role | คำอธิบาย | หลักฐาน |
|------|---------|---------|
| **Hirer** (ผู้ว่าจ้าง) | สร้างงาน, ค้นหาผู้ดูแล, จ่ายเงิน, รีวิว | `role ENUM('hirer','caregiver','admin')` ใน schema.sql, BottomBar แยก UI ตาม role, 10 หน้า hirer |
| **Caregiver** (ผู้ดูแล) | รับงาน, check-in/out, รับเงิน | 7 หน้า caregiver, job feed/my-jobs routes, wallet/earnings pages |
| **Admin** (ผู้ดูแลระบบ) | จัดการ users, KYC, disputes, financial | 8 หน้า admin, AdminLayout แยกจาก MainLayout, adminRoutes.js (20+ endpoints) |

Account types เพิ่มเติม: **Guest** (สมัครด้วย email) และ **Member** (สมัครด้วยเบอร์โทร) — ทั้งสอง type เป็นได้ทั้ง hirer หรือ caregiver

### 2. Flow หลักของแต่ละ Role

**Hirer:**
สมัคร → เลือก role → ยืนยันตัวตน (OTP) → สร้างผู้รับการดูแล → สร้างงาน (5-step wizard) → เผยแพร่งาน → รอผู้ดูแลรับงาน → ติดตามงาน → อนุมัติ early checkout / รอ checkout → รีวิว → ดูใบเสร็จ

**Caregiver:**
สมัคร → เลือก role → ยืนยันตัวตน (OTP) → อัปโหลดเอกสาร/KYC → ค้นหางานจาก feed → รับงาน → check-in (GPS) → ปฏิบัติงาน → check-out (GPS) → รับเงิน

**Admin:**
Login แยก → Dashboard → จัดการ users (ban/edit/wallet) → Review KYC → จัดการ disputes (settle) → Financial dashboard (transactions/withdrawals/settlements) → Reports

### 3. โมดูลหลักของระบบ (17 route files, 41 DB tables, 49+ frontend pages)

| โมดูล | Backend Routes | Frontend Pages | DB Tables หลัก |
|-------|---------------|---------------|----------------|
| Auth & User | authRoutes.js (20 endpoints) | 11 auth pages + ProfilePage | users, auth_sessions, user_policy_acceptances |
| OTP | otpRoutes.js (4 endpoints) | ใน RegisterPages + ProfilePage | otp_codes |
| Job System | jobRoutes.js (15 endpoints) | CreateJobPage, JobDetailPage, HirerHomePage, CaregiverJobFeedPage, CaregiverMyJobsPage | job_posts, jobs, job_assignments |
| Care Recipients | careRecipientRoutes.js (5 endpoints) | CareRecipientsPage, CareRecipientFormPage | patient_profiles |
| Caregiver Search | caregiverSearchRoutes.js (4 endpoints) | SearchCaregiversPage, CaregiverPublicProfilePage | caregiver_profiles |
| Caregiver Documents | caregiverDocumentRoutes.js (4 endpoints) | ใน ProfilePage + AdminUsersPage | caregiver_documents |
| KYC | kycRoutes.js (3 endpoints) | KycPage | user_kyc_info |
| Wallet & Payment | walletRoutes.js (16 endpoints) + paymentRoutes.js (3 endpoints) | HirerWalletPage, CaregiverWalletPage, BankAccountsPage | wallets, ledger_transactions, topup_intents, bank_accounts, withdrawal_requests, job_deposits |
| Chat | chatRoutes.js (9 endpoints) + chatSocket.js | ChatRoomPage | chat_threads, chat_messages |
| Disputes | disputeRoutes.js (5 endpoints) | DisputeChatPage | disputes, dispute_messages, dispute_events |
| Reviews & Favorites | reviewRoutes.js (3 endpoints) + favoritesRoutes.js (3 endpoints) | ใน JobDetailPage + FavoritesPage | caregiver_reviews, caregiver_favorites |
| Notifications | notificationRoutes.js (8 endpoints) | NotificationsPage, SettingsPage | notifications, notification_preferences, push_subscriptions |
| Complaints | complaintRoutes.js (5 endpoints) | ComplaintFormPage | complaints, complaint_attachments |
| Webhooks | webhookRoutes.js (4 endpoints) | — | provider_webhooks |
| Admin | adminRoutes.js (20+ endpoints) | 8 admin pages | audit_events |
| Trust System | trustLevelWorker.js + risk.js | TrustLevelCard, trust level indicators | trust_score_history |

### 4. Third-party Services ที่ใช้จริง (verified from code)

| Service | Provider | สถานะ | หลักฐาน |
|---------|----------|-------|---------|
| **Payment** | Stripe (sandbox) | ใช้งานจริงในโหมด test | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY` ใน env, `stripe.webhooks.constructEvent()` ใน webhookRoutes.js, Stripe Checkout Session ใน walletService.js |
| **SMS OTP** | SMSOK | ใช้งานจริง | `SMSOK_API_URL=https://api.smsok.co/s` ใน otpService.js, มีหลักฐาน API call สำเร็จ (message_id, balance) |
| **Google OAuth** | Google (Authorization Code flow) | ใช้งานจริง | `google-auth-library` ใน authController.js, OAuth2Client, `verifyIdToken()`, state cookie, CSRF protection |
| **Email** | SMTP (nodemailer) | รองรับ SMTP จริง + fallback mock | `sendEmailNotification()` ใน notificationService.js รองรับ provider `smtp` ผ่าน nodemailer, แต่ config default เป็น `mock` |
| **Push Notification** | Web Push API (PWA) | มี frontend + service worker | `sw.js` รองรับ push event, `SettingsPage.tsx` subscribe/unsubscribe, `push_subscriptions` table — แต่ backend ยังไม่มี web-push library ส่ง push จริง |

### 5. Third-party Services ที่เป็น Sandbox / Mock / Plan only

| Service | สถานะ | หลักฐาน |
|---------|-------|---------|
| **Stripe** | **Sandbox** — ใช้ test keys (`pk_test_xxx`, `sk_test_xxx`) | env ชัดเจนว่าเป็น test keys, ไม่ใช้เงินจริง |
| **KYC** | **Mock** — auto-approve ทันที | `kycService.js` → `submitKyc()` เรียก `submitMockKyc()` ที่ INSERT status='approved' ทันที, `KYC_PROVIDER=mock` ใน docker-compose, ไม่มี integration กับ SCBX หรือ provider จริงใดๆ |
| **Bank Transfer** | **Mock** — `BANK_TRANSFER_PROVIDER=mock` | ไม่มี integration กับธนาคารจริง, withdrawal ผ่าน admin manual mark-paid |
| **Email** | **Mock เป็น default** — `EMAIL_PROVIDER=mock` | ส่งได้จริงถ้า config SMTP, แต่ default คือ mock (log to console) |
| **Push Notification** | **โครงสร้างพร้อม แต่ยังส่ง push จริงไม่ได้** | มี service worker + frontend subscribe + DB table, แต่ backend ใช้ Socket.IO emit แทน web-push library |
| **KYC (SCBX)** | **วางแผนไว้แต่ยังไม่ implement** | ไม่พบ SCBX code ใดๆ ในทั้ง codebase |
| **Mock Provider** | **Dev-only service** | Container แยกที่ port 4000, จำลอง payment/SMS/KYC สำหรับ development |

### 6. ฟีเจอร์ที่มี UI แต่ Backend ยังไม่ครบ

| ฟีเจอร์ | สถานะ | รายละเอียด |
|---------|-------|-----------|
| **Push Notification** | UI ครบ, backend ส่งจริงไม่ได้ | SettingsPage มี toggle เปิด/ปิด, sw.js รับ push event, แต่ backend ไม่มี web-push library ส่ง push message จริง — ใช้ Socket.IO `notification:push` event แทน |
| **Google Maps** | UI มี GooglePlacesInput component | `VITE_GOOGLE_MAPS_API_KEY` ว่างอยู่ใน config, อาจใช้ได้ถ้า set key |
| **Photo Evidence** | มี DB schema (job_photo_evidence) | ไม่พบ UI upload photo evidence ใน frontend, schema พร้อมแต่ไม่ถูกใช้ |

### 7. ฟีเจอร์ที่มี Backend/Schema แต่ Frontend ใช้ไม่ครบ

| ฟีเจอร์ | สถานะ | รายละเอียด |
|---------|-------|-----------|
| **GPS Fraud Detection** | Schema มี `fraud_indicators[]`, `confidence_score` | Backend เก็บ GPS data ตอน check-in/out จริง แต่ fraud detection logic ยังเป็น placeholder |
| **job_photo_evidence** | Table มีอยู่ใน schema | ไม่มี frontend UI อัปโหลดรูป, ไม่มี backend endpoint รับรูป |
| **Job Patient Sensitive Data** | Table `job_patient_sensitive_data` มีอยู่ | ไม่พบ UI กรอก sensitive data แยก |
| **Payment records** | Table `payments` + paymentRoutes.js | Frontend ใช้งานบางส่วน (HirerPaymentHistoryPage) |

### 8. ฟีเจอร์ที่มีครบทั้ง Flow (End-to-End)

| ฟีเจอร์ | Frontend | Backend | DB | E2E Test |
|---------|----------|---------|-----|---------|
| ✅ Auth (Email/Phone/Google) | ครบ | ครบ | ครบ | ✅ |
| ✅ OTP (Email + SMS via SMSOK) | ครบ | ครบ | ครบ | ✅ |
| ✅ Job Lifecycle (draft→posted→assigned→in_progress→completed/cancelled) | ครบ | ครบ | ครบ | ✅ |
| ✅ Wallet Top-up (Stripe sandbox) | ครบ | ครบ | ครบ | ✅ |
| ✅ Wallet Withdraw (admin manual) | ครบ | ครบ | ครบ | — |
| ✅ Escrow + Fee + Deposit | ครบ | ครบ | ครบ | — |
| ✅ Chat (realtime Socket.IO) | ครบ | ครบ | ครบ | — |
| ✅ Review/Rating | ครบ | ครบ | ครบ | — |
| ✅ Dispute (open→message→admin settle) | ครบ | ครบ | ครบ | ✅ |
| ✅ KYC (mock auto-approve) | ครบ | ครบ | ครบ | — |
| ✅ Trust Level (L0→L1→L2→L3) | ครบ | ครบ | ครบ | — |
| ✅ Risk Classification (auto-compute) | ครบ | ครบ | ครบ | — |
| ✅ Check-in/Check-out (GPS) | ครบ | ครบ | ครบ | ✅ |
| ✅ Early Checkout Request | ครบ | ครบ | ครบ | — |
| ✅ In-app Notifications | ครบ | ครบ | ครบ | — |
| ✅ Complaint System | ครบ | ครบ | ครบ | — |
| ✅ Forgot/Reset Password | ครบ | ครบ | ครบ | — |
| ✅ Caregiver Documents | ครบ | ครบ | ครบ | — |
| ✅ Favorites | ครบ | ครบ | ครบ | — |
| ✅ Admin: Users/KYC/Disputes/Financial/Reports/Jobs/Settings | ครบ | ครบ | ครบ | — |
| ✅ Caregiver Availability Calendar | ครบ | ครบ | ครบ | — |
| ✅ Avatar Upload/Crop | ครบ | ครบ | ครบ | — |
| ✅ Care Recipients Management | ครบ | ครบ | ครบ | — |
| ✅ Bank Account Management | ครบ | ครบ | ครบ | — |

### 9. Mobile-first / Responsive Design

**หลักฐานที่พบ (verified from code):**
- `<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">` ใน index.html
- **BottomBar** (fixed bottom navigation) แยกตาม role — ลักษณะ mobile app
- **iOS Safe Area** support: `safe-area-bottom` CSS class, `env(safe-area-inset-bottom)`
- **PWA manifest**: `manifest.webmanifest` กำหนด `display: standalone`
- **Service Worker** registered ใน main.tsx
- Tailwind responsive breakpoints (`sm:`, `md:`, `lg:`) ใช้ใน 48 files (221 matches)
- **Thai fonts**: Sarabun + Noto Sans Thai
- **Sticky navigation** ใน CreateJobPage wizard
- **Large touch targets** ในปุ่มต่างๆ (h-16, min-h-[56px])
- **z-index layering scheme** จัดการอย่างเป็นระบบ (zIndex.ts)

**สรุป**: ระบบออกแบบแบบ **mobile-first** อย่างชัดเจน มี BottomBar, PWA manifest, safe area support, และ responsive breakpoints ทั่วทั้งระบบ

### 10. ข้อจำกัดที่เห็นได้จากโค้ด/config/architecture

1. **Single database** — dev/test ใช้ DB ตัวเดียวกัน ไม่มี test DB แยก
2. **No Redis/cache** — ไม่มี caching layer
3. **Notification ใช้ polling 15 วินาที** — ไม่ใช้ WebSocket สำหรับ notification count
4. **File storage อยู่บน local disk** (`UPLOAD_DIR=/app/uploads`) — ไม่ใช้ cloud storage
5. **KYC เป็น mock** — auto-approve ทันที ไม่มีการตรวจสอบเอกสารจริง
6. **Stripe sandbox** — ไม่มีการชำระเงินจริง
7. **No horizontal scaling** — single backend instance, ไม่มี load balancer
8. **No monitoring/alerting** — ไม่มี APM, error tracking, health monitoring
9. **Dev auto-topup** — ใน development mode ระบบเติมเงินอัตโนมัติเมื่อยอดไม่พอ
10. **CORS_ORIGIN=*** — เปิดกว้างสำหรับ development
11. **JWT token lifetime ยาว** — access 7 วัน, refresh 30 วัน (ไม่เหมาะ production)
12. **Docker Compose deployment** — ไม่มี Kubernetes/orchestration

---

## ส่วนที่ 2: คำตอบ 10 ข้อจากหลักฐานในโค้ด

### 1) ผู้ใช้ครบ 3 บทบาท?

**ครบ — verified from code**

- DB: `role ENUM('hirer', 'caregiver', 'admin')` ใน `database/schema.sql`
- Backend: `requireRole('admin')`, `requireRole('hirer')`, `requireRole('caregiver')` ใน middleware/auth.js
- Frontend: `BottomBar.tsx` แยก UI ตาม role, `routerGuards.tsx` มี RequireRole, RequireAdmin
- หน้า: hirer 10 หน้า, caregiver 7 หน้า, admin 8 หน้า, shared 9 หน้า, auth 11 หน้า, public 4 หน้า = **49 หน้า**
- Admin มีระบบ login แยก (`AdminLoginPage.tsx`), layout แยก (`AdminLayout.tsx`)

### 2) ระบบแชท realtime จริงหรือไม่?

**จริง — ใช้ Socket.IO — verified from code**

- `backend/src/sockets/chatSocket.js` (214 บรรทัด) — 6 client→server events, 7 server→client events
- JWT authentication ผ่าน socket handshake
- Room-based: `user:{userId}` (personal), `thread:{threadId}` (chat)
- Events: `message:send`, `message:new`, `typing:start/stop`, `message:read`, `thread:join/leave`
- `backend/src/services/chatService.js` (10,219 bytes) — business logic
- `backend/src/models/Chat.js` — DB model
- `chat_threads`, `chat_messages` tables ใน schema
- `ChatRoomPage.tsx` (27,743 bytes) frontend ใช้ socket.io-client
- **Dispute chat** (`DisputeChatPage.tsx`) — admin เข้าร่วมได้

### 3) รีวิว/เรตติ้ง ใช้งานได้ครบ flow?

**ครบ — verified from code**

- `reviewRoutes.js` (208 บรรทัด): POST create review, GET reviews by caregiver, GET review by job
- Validation: job ต้อง completed, เฉพาะ hirer รีวิวได้, ป้องกันรีวิวซ้ำ (409 Conflict)
- Rating 1-5 stars + comment
- After review: อัปเดต trust_score ของ caregiver + trigger trust level recalculation
- `caregiver_reviews` table มี UNIQUE(job_id, reviewer_id)
- Frontend: review form ใน JobDetailPage หลังงาน completed, แสดง reviews ใน CaregiverPublicProfilePage

### 4) ระบบข้อพิพาท (dispute) ทำได้ถึงระดับไหน?

**ครบ flow — verified from code**

- **User side**: เปิด dispute (POST /disputes), ส่งข้อความ (POST /disputes/:id/messages), ขอปิด (POST /disputes/:id/request-close)
- **Admin side**: ดู disputes list, ดู detail, อัปเดตสถานะ (open→in_review→resolved/rejected), settle (refund/payout/fee/penalty/deposit)
- `disputeService.js` (10,217 bytes): deposit release + jobs final settlement on resolve
- `dispute_messages`, `dispute_events` tables — timeline tracking
- **Settlement ระดับ financial**: admin กำหนด refund_amount, payout_amount, fee, penalty, deposit, compensation — validate total ≤ escrow
- DisputeChatPage (frontend): admin เข้าร่วมแชท dispute ได้
- Cancel logic: 4 sub-cases (before accept, after accept ≥24h, <24h penalty, CG cancel → admin settle)

### 5) Check-in/Check-out ใช้ GPS จริง?

**ใช้จริง — verified from code**

- Frontend `CaregiverMyJobsPage.tsx` บรรทัด 73-86: `navigator.geolocation.getCurrentPosition()` เรียก browser Geolocation API จริง
- ส่ง `lat`, `lng`, `accuracy_m` ไป backend
- Backend `jobRoutes.js`: POST `/jobs/:jobId/checkin` + `/jobs/:jobId/checkout` รับ GPS coordinates
- DB: `job_gps_events` table เก็บ event_type (check_in, check_out, ping), lat, lng, accuracy_m, confidence_score, fraud_indicators[]
- Schema มี `geofence_radius_m` ใน job_posts สำหรับ geofencing
- **ข้อจำกัด**: GPS fraud detection logic (confidence_score, fraud_indicators) มี schema พร้อมแต่ logic ยังเป็น basic level

### 6) Escrow / Wallet / Payment flow ทำได้ถึงระดับใด?

**ครบ flow ในระดับ functional — sandbox payment — verified from code**

- **5 wallet types**: hirer, caregiver, escrow (per job), platform, platform_replacement
- **Immutable ledger**: `ledger_transactions` — append-only, from_wallet_id → to_wallet_id, idempotency_key
- **DB constraints**: balance ≥ 0 (CHECK), ledger trigger ป้องกัน UPDATE/DELETE
- **Top-up**: Stripe Checkout Session → webhook → credit wallet → ledger entry
- **Publish**: hold total_amount + hirer_deposit จาก hirer wallet
- **Accept**: ย้ายจาก hirer held → escrow, สร้าง job_deposits record
- **Checkout**: escrow → caregiver (total - 10% fee), escrow → platform (fee), escrow → hirer (deposit refund)
- **Cancel**: 4 sub-cases พร้อม penalty logic
- **Admin settlement**: manual settle with breakdown
- **Stripe เป็น sandbox**: `pk_test_xxx`, `sk_test_xxx` — ไม่มีเงินจริง
- **Withdrawal**: admin manual process (queued→review→approved→paid/rejected)

### 7) Notification ทำจริงแบบใดบ้าง?

| ช่องทาง | สถานะ | หลักฐาน |
|---------|-------|---------|
| **In-app** | ✅ ใช้งานจริง | `notifications` table, polling 15 วินาที, Socket.IO realtime push, TopBar badge count, NotificationsPage |
| **Email** | ✅ โครงสร้างพร้อม รองรับ SMTP จริง | `sendEmailNotification()` ใน notificationService.js, nodemailer dynamic import, แต่ default config เป็น `EMAIL_PROVIDER=mock` |
| **Push (PWA)** | ⚠️ มี frontend + SW แต่ backend ยังไม่ส่งจริง | `sw.js` รับ push event, SettingsPage toggle, `push_subscriptions` table, แต่ backend ใช้ Socket.IO emit แทน web-push library |
| **SMS** | ❌ ไม่มี SMS notification | SMS ใช้เฉพาะ OTP เท่านั้น ไม่มี notification ผ่าน SMS |

Notification triggers: job_accepted, check_in, check_out, job_assigned, early_checkout_request/approved/rejected, job_cancelled, chat_message — **8 trigger events**

### 8) Google login ใช้ได้จริง?

**ใช้ได้จริง — verified from code**

- `authController.js` (1,590+ บรรทัด): `googleLogin()` + `googleCallback()` — full Authorization Code flow
- `google-auth-library` — OAuth2Client, `generateAuthUrl()`, `getToken()`, `verifyIdToken()`
- CSRF protection: state cookie + verification
- User lookup: google_id → email → create new
- Link existing account: ถ้ามี email อยู่แล้ว link google_id เข้า
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` ใน env
- Frontend: LoginEntryPage มีปุ่ม Google login, AuthCallbackPage รับ token
- **มีหลักฐานว่าทดสอบจริง**: PROGRESS.md บันทึก manual verification + bug fixes หลายรอบ

### 9) KYC mockup ทำได้ถึงระดับไหน?

**เป็น mock — auto-approve ทันที — verified from code**

- `kycService.js` (54 บรรทัด): `submitKyc()` → `submitMockKyc()` ที่ INSERT `status='approved'` ทันที
- `provider_name='mock'` hardcode
- `KYC_PROVIDER=mock` ใน docker-compose.yml
- Frontend `KycPage.tsx` (29,182 bytes): มี UI สมบูรณ์ — 3-step indicator, อัปโหลดเอกสารหน้า/หลัง + selfie
- Admin review: AdminUsersPage มีส่วน KYC review
- **ไม่มี** SCBX integration หรือ real KYC provider code ใดๆ ในทั้ง codebase
- Schema `user_kyc_info` มี fields สำหรับ provider จริง (provider_session_id, provider_reference_id, national_id_hash)
- Webhook endpoint `/api/webhooks/kyc` มีอยู่แต่ใช้กับ mock provider เท่านั้น

### 10) ระบบนี้ควรอธิบายอย่างไร?

**"ระบบต้นแบบที่พัฒนาครบถ้วนในระดับการใช้งานจริงเชิงสาธิต (functional prototype)" — verified from code**

เหตุผล:
- ✅ ครบทุก role, ครบทุก flow หลัก, มี test 179 tests
- ✅ มี financial system ที่ซับซ้อน (escrow, ledger, deposit, penalty)
- ✅ มี realtime chat, GPS check-in/out, trust level system
- ✅ มี security: JWT, policy gates, audit events, rate limiting, CSRF protection
- ✅ Deploy บน Docker Compose ได้จริง
- ❌ Payment เป็น sandbox (ไม่ใช้เงินจริง)
- ❌ KYC เป็น mock (ไม่ตรวจสอบตัวตนจริง)
- ❌ ไม่มี monitoring, scaling, production-grade security config
- ❌ Dev-only features ยังเปิดอยู่ (auto-topup, dev OTP code, CORS=*)
- ❌ JWT lifetime ยาวเกินไปสำหรับ production (7d/30d)

---

## ส่วนที่ 3: 1.3 ขอบเขตของโครงงาน

### 1.3 ขอบเขตของโครงงาน

โครงงานนี้เป็นการพัฒนาระบบเว็บแอปพลิเคชันต้นแบบสำหรับบริการจ้างงานดูแลผู้สูงอายุในประเทศไทย ในลักษณะ Two-sided Marketplace โดยมีขอบเขตการพัฒนาดังต่อไปนี้

#### 1.3.1 ขอบเขตด้านผู้ใช้งาน

1. ระบบรองรับผู้ใช้งาน 3 บทบาท ได้แก่ ผู้ว่าจ้าง (Hirer) ผู้ดูแล (Caregiver) และผู้ดูแลระบบ (Admin) โดยผู้ว่าจ้างและผู้ดูแลสามารถลงทะเบียนได้ 2 รูปแบบ คือ Guest (สมัครด้วยอีเมล) และ Member (สมัครด้วยเบอร์โทรศัพท์) รวมถึงรองรับการเข้าสู่ระบบผ่าน Google OAuth
2. ผู้ใช้แต่ละคนมีระดับความน่าเชื่อถือ (Trust Level) 4 ระดับ ตั้งแต่ L0 ถึง L3 ซึ่งคำนวณจากการยืนยันตัวตน (OTP, KYC) และประวัติการใช้งาน (คะแนนรีวิว จำนวนงานที่สำเร็จ เป็นต้น) โดยระดับความน่าเชื่อถือส่งผลต่อสิทธิ์การเข้าถึงฟังก์ชันต่าง ๆ ของระบบ
3. ผู้ดูแลระบบมีหน้าจอแยกเฉพาะสำหรับบริหารจัดการข้อมูลผู้ใช้ ตรวจสอบ KYC ระงับบัญชี จัดการข้อพิพาท และดูแลธุรกรรมทางการเงินของแพลตฟอร์ม

#### 1.3.2 ขอบเขตด้านฟังก์ชันหลัก

ระบบพัฒนาครอบคลุมฟังก์ชันหลักดังนี้

1. **ระบบยืนยันตัวตนและจัดการบัญชี**: รองรับการลงทะเบียนด้วยอีเมลหรือเบอร์โทรศัพท์ การเข้าสู่ระบบผ่าน Google OAuth การยืนยัน OTP ผ่านอีเมลและ SMS (ใช้ SMSOK เป็นผู้ให้บริการ) การลืมรหัสผ่าน การจัดการโปรไฟล์ และการอัปโหลดรูปโปรไฟล์พร้อมครอปรูป
2. **ระบบการจ้างงาน**: ผู้ว่าจ้างสามารถสร้างงานผ่านแบบฟอร์มแบบ 5 ขั้นตอน (Guided Wizard) โดยระบบคำนวณระดับความเสี่ยงของงานอัตโนมัติ (low_risk/high_risk) จากประเภทงาน ภาวะของผู้ป่วย และลักษณะงานที่ต้องทำ ผู้ดูแลสามารถค้นหาและรับงานจาก Job Feed โดยมีระบบกรองและจัดอันดับความเหมาะสม รองรับการมอบหมายงานโดยตรง (Direct Assignment) และการ Re-post งานได้สูงสุด 3 ครั้ง (Replacement Chain)
3. **ระบบลงเวลาและติดตามงาน**: ผู้ดูแลลงเวลาเข้า-ออกงาน (Check-in/Check-out) ผ่าน GPS ของเบราว์เซอร์ โดยระบบบันทึกพิกัด ค่าความแม่นยำ และเวลาลงฐานข้อมูล รองรับการส่งงานก่อนเวลา (Early Checkout) โดยต้องได้รับการอนุมัติจากผู้ว่าจ้าง และมีระบบทำงานอัตโนมัติเมื่อเลยเวลาสิ้นสุดงาน 10 นาที
4. **ระบบการเงิน**: ใช้รูปแบบบัญชีคู่ (Double-entry Ledger) พร้อม Immutable Audit Trail ประกอบด้วยกระเป๋าเงิน 5 ประเภท (ผู้ว่าจ้าง ผู้ดูแล Escrow แพลตฟอร์ม และแพลตฟอร์มทดแทน) รองรับการเติมเงินผ่าน Stripe Checkout ระบบ Escrow สำหรับพักเงินระหว่างงาน ค่าธรรมเนียมแพลตฟอร์ม 10% (หักจากค่าจ้าง) ระบบเงินมัดจำผู้ว่าจ้างแบบขั้นบันได (Tiered Deposit) และการจัดการการยกเลิกงานพร้อมค่าปรับ (Late Cancel Penalty)
5. **ระบบแชทแบบเรียลไทม์**: ใช้ Socket.IO สำหรับการสนทนาระหว่างผู้ว่าจ้างและผู้ดูแล แบบ 1 ห้องสนทนาต่อ 1 งาน รองรับสถานะ typing indicator และ read receipts
6. **ระบบการแจ้งเตือน**: แจ้งเตือนภายในแอปพลิเคชัน (In-app) แบบเรียลไทม์ผ่าน Socket.IO โดยมี 8 เหตุการณ์ที่สร้างการแจ้งเตือน (เช่น มีผู้รับงาน ลงเวลาเข้างาน งานเสร็จ เป็นต้น) รองรับโครงสร้างการแจ้งเตือนผ่านอีเมล (SMTP) และ Push Notification (PWA) แต่การใช้งานจริงอยู่ในระดับต้นแบบ
7. **ระบบรีวิวและเรตติ้ง**: ผู้ว่าจ้างรีวิวผู้ดูแลได้หลังงานเสร็จ ด้วยคะแนน 1-5 ดาว พร้อมความคิดเห็น ป้องกันการรีวิวซ้ำระดับฐานข้อมูล คะแนนรีวิวส่งผลต่อ Trust Score
8. **ระบบข้อพิพาท**: ผู้ใช้เปิดข้อพิพาทพร้อมส่งข้อความโต้ตอบ ผู้ดูแลระบบตรวจสอบและจัดการ Settlement ทางการเงิน (คืนเงิน จ่ายค่าตอบแทน หักค่าปรับ) พร้อมบันทึก Audit Trail
9. **ระบบร้องเรียน**: ผู้ใช้ส่งเรื่องร้องเรียนพร้อมไฟล์แนบ ผู้ดูแลระบบตรวจสอบและจัดการผ่านหน้า Admin
10. **ระบบจัดการผู้รับการดูแล**: ผู้ว่าจ้างสร้างโปรไฟล์ผู้รับการดูแลพร้อมข้อมูลสุขภาพ ภาวะเรื้อรัง อุปกรณ์ทางการแพทย์ และข้อจำกัดต่าง ๆ เพื่อใช้ประกอบการสร้างงาน
11. **หน้าผู้ดูแลระบบ**: ประกอบด้วย Dashboard สรุปสถิติ จัดการผู้ใช้ (ดู/แก้ไข/ระงับ) ตรวจสอบ KYC จัดการข้อพิพาท จัดการงาน รายงานการเงิน (ธุรกรรม การถอนเงิน Settlement CSV Export) และรายงานสรุป

#### 1.3.3 ขอบเขตด้านการเชื่อมต่อบริการภายนอก

1. **การชำระเงิน**: เชื่อมต่อกับ Stripe ในโหมด Sandbox (Test Mode) สำหรับการเติมเงินผ่าน Checkout Session รับ Webhook แจ้งผลการชำระเงิน ไม่มีการใช้เงินจริง
2. **การส่ง SMS OTP**: เชื่อมต่อกับ SMSOK สำหรับส่งรหัส OTP ยืนยันเบอร์โทรศัพท์ โดยเป็นการใช้งานจริงผ่าน API ของ SMSOK
3. **การเข้าสู่ระบบผ่าน Google**: เชื่อมต่อกับ Google OAuth 2.0 (Authorization Code Flow) สำหรับการเข้าสู่ระบบ โดยเป็นการใช้งานจริง
4. **การยืนยันตัวตน (KYC)**: จำลองการทำงานในระบบต้นแบบ (Mock) โดย auto-approve ทันทีหลังส่งเอกสาร หน้า UI รองรับการอัปโหลดเอกสาร 3 รายการ (บัตรหน้า-หลัง และเซลฟี) แต่ยังไม่เชื่อมต่อผู้ให้บริการ KYC จริง
5. **การส่งอีเมล**: รองรับโครงสร้างการส่งผ่าน SMTP (nodemailer) แต่ค่าเริ่มต้นในการพัฒนาใช้โหมดจำลอง (Mock)
6. **Push Notification**: รองรับโครงสร้าง PWA (Service Worker, Web Push API, manifest) และมีหน้า UI ตั้งค่าเปิด/ปิด แต่ฝั่งเซิร์ฟเวอร์ยังไม่ได้ส่ง Push Message จริง ใช้ Socket.IO แทน

#### 1.3.4 ขอบเขตด้านการออกแบบและอุปกรณ์ที่รองรับ

1. ระบบออกแบบแบบ Mobile-first โดยใช้ Tailwind CSS กำหนด Responsive Breakpoints มี Bottom Navigation Bar สำหรับผู้ใช้มือถือ และรองรับ iOS Safe Area
2. รองรับเบราว์เซอร์สมัยใหม่ที่รองรับ ES Module, Geolocation API, Web Push API และ Service Worker
3. ส่วนติดต่อผู้ใช้แสดงผลเป็นภาษาไทย ใช้แบบอักษร Sarabun และ Noto Sans Thai
4. มีการตรวจสอบความสามารถในการเข้าถึง (WCAG 2.1 AA) ประกอบด้วย Focus Trap ใน Modal, Skip Navigation, aria-label, คอนทราสต์สีผ่านเกณฑ์มาตรฐาน
5. ระบบรองรับการติดตั้งเป็น Progressive Web App (PWA) ผ่าน Web App Manifest

#### 1.3.5 ขอบเขตด้านเทคโนโลยีที่ใช้

1. **ฝั่งหน้าบ้าน (Frontend)**: React 18, TypeScript, Tailwind CSS, Vite, Lucide Icons, Socket.IO Client, react-hot-toast
2. **ฝั่งหลังบ้าน (Backend)**: Node.js (ESM), Express.js, PostgreSQL 15, Socket.IO, Joi Validation, JWT Authentication, Multer (File Upload), Sharp (Image Processing)
3. **ฐานข้อมูล**: PostgreSQL 15 จำนวน 41 ตาราง รวม 20 migration files
4. **การทดสอบ**: Jest + Supertest (Backend — 179 tests), Playwright (Frontend E2E — baseline)
5. **การ Deploy**: Docker Compose (5 services: PostgreSQL, Backend, Frontend, Mock Provider, pgAdmin)

#### 1.3.6 ขอบเขตด้านข้อจำกัดของระบบ

1. ระบบเป็นต้นแบบเพื่อการศึกษา (Academic Prototype) ไม่มีผู้ใช้จริงเชิงพาณิชย์ Deploy บนเซิร์ฟเวอร์มหาวิทยาลัยที่มีทรัพยากรจำกัด
2. การชำระเงินใช้ Stripe ในโหมด Sandbox ไม่มีการชำระเงินจริง การถอนเงินเป็นกระบวนการ Manual โดยผู้ดูแลระบบ
3. การยืนยันตัวตน (KYC) เป็นการจำลองการทำงาน (Mock) ที่อนุมัติทันทีเมื่อส่งเอกสาร ไม่มีการตรวจสอบความถูกต้องของเอกสารจริง ผู้ให้บริการ KYC ที่วางแผนไว้ (SCBX) ยังไม่ได้เชื่อมต่อ
4. ไม่มีระบบ Caching (Redis), Load Balancing หรือ Horizontal Scaling เนื่องจากเป็นระบบต้นแบบที่ทำงานบน Docker Compose แบบ Single Instance
5. ไม่มีระบบ Monitoring, Alerting หรือ Error Tracking สำหรับ Production
6. ไฟล์ที่อัปโหลดเก็บบน Local Disk ของเซิร์ฟเวอร์ ไม่ได้ใช้ Cloud Storage
7. Dev-only features บางส่วนยังเปิดอยู่ในระบบ (เช่น การเติมเงินอัตโนมัติเมื่อยอดไม่เพียงพอ, OTP สำหรับทดสอบ)
8. ระบบตรวจจับการทุจริตทาง GPS (Fraud Detection) มีโครงสร้างฐานข้อมูลพร้อม แต่ Logic การตรวจจับยังอยู่ในระดับพื้นฐาน
9. ระบบถ่ายภาพเป็นหลักฐาน (Photo Evidence) มีตารางฐานข้อมูลรองรับ แต่ยังไม่มีหน้าจอสำหรับใช้งาน

---

## ส่วนที่ 4: ข้อควรระวังในการเขียนรายงาน

### A) สิ่งที่ Claim ได้อย่างมั่นใจ

1. ระบบเป็น **Two-sided Marketplace** ครบ 3 บทบาท (Hirer, Caregiver, Admin) มีหน้าจอ 49+ หน้า
2. ระบบจัดการงานแบบ **Two-table Pattern** (job_posts + jobs) ครบ lifecycle ตั้งแต่ draft ถึง completed/cancelled
3. **ระบบการเงินแบบ Double-entry Ledger** พร้อม Escrow, Platform Fee 10%, Tiered Deposit, Cancel Penalty
4. **แชทแบบ Realtime** ผ่าน Socket.IO มี typing indicator และ read receipts
5. **GPS Check-in/Check-out** ผ่าน Browser Geolocation API เก็บลงฐานข้อมูลจริง
6. **Trust Level System** 4 ระดับ คำนวณอัตโนมัติจาก 8 ปัจจัย
7. **Risk Classification** คำนวณอัตโนมัติจากประเภทงาน ภาวะผู้ป่วย และลักษณะงาน
8. **Google OAuth** ใช้งานจริง (Authorization Code Flow)
9. **SMS OTP** ส่งจริงผ่าน SMSOK
10. **ฐานข้อมูล 41 ตาราง** พร้อม 20 migration files, constraints, triggers
11. **ทดสอบ**: 179 tests (Jest + Supertest), Playwright E2E baseline
12. **Mobile-first design** พร้อม PWA manifest, Service Worker, Bottom Navigation, iOS Safe Area
13. **Accessibility**: WCAG 2.1 AA audit (focus trap, skip nav, aria-label, contrast)
14. **ระบบข้อพิพาท** ครบ flow พร้อม financial settlement
15. **ระบบรีวิว/เรตติ้ง** ครบ flow ส่งผลต่อ Trust Score
16. **Docker Compose** deployment (5 services)

### B) สิ่งที่ควรระบุว่าเป็น Mock / Sandbox / แผนในอนาคต

1. **Stripe = Sandbox** — ต้องระบุชัดว่าใช้ test keys ไม่มีเงินจริง
2. **KYC = Mock** — auto-approve ทันที ไม่มีการตรวจสอบเอกสารจริง
3. **KYC Provider (SCBX) = วางแผนไว้แต่ยังไม่ implement** — ไม่พบ code ใดๆ
4. **Email notification = โครงสร้างพร้อม แต่ default เป็น mock** — ต้องตั้งค่า SMTP ถึงจะส่งจริง
5. **Push notification = มีโครงสร้าง PWA พร้อม แต่ backend ยังไม่ส่งจริง** — ใช้ Socket.IO แทน
6. **Bank transfer = mock** — withdrawal เป็น admin manual process
7. **GPS fraud detection = โครงสร้างพร้อม แต่ logic ยังเป็นพื้นฐาน**
8. **Photo evidence = มี schema แต่ยังไม่มี UI**
9. **Dev auto-topup** — ระบบเติมเงินอัตโนมัติในโหมดพัฒนา
10. **Mock Provider** — service แยกที่จำลอง payment/SMS/KYC สำหรับ development

### C) ข้อความที่ไม่ควรเขียนในรายงาน

1. ❌ "ระบบพร้อมใช้งานจริงเชิงพาณิชย์" — ไม่จริง เป็นต้นแบบเพื่อการศึกษา
2. ❌ "รองรับการชำระเงินจริง" — Stripe เป็น sandbox
3. ❌ "ตรวจสอบตัวตนผ่าน SCBX" — ยังไม่ได้ implement, KYC เป็น mock
4. ❌ "รองรับผู้ใช้จำนวนมาก" — single instance, ไม่มี scaling
5. ❌ "ระบบป้องกันการทุจริต GPS ขั้นสูง" — มี schema แต่ logic ยังเป็นพื้นฐาน
6. ❌ "ส่ง Push Notification ถึงผู้ใช้" — มีโครงสร้าง แต่ backend ยังไม่ส่งจริง
7. ❌ "ส่งอีเมลแจ้งเตือนอัตโนมัติ" — default เป็น mock, ต้องตั้งค่า SMTP เอง
8. ❌ "ตรวจสอบเอกสาร KYC อย่างแท้จริง" — auto-approve ทันที
9. ❌ "ระบบมีความปลอดภัยระดับ Production" — JWT lifetime ยาว, CORS เปิดกว้าง, dev features ยังเปิดอยู่
10. ❌ "มีระบบถ่ายรูปเป็นหลักฐาน" — มี schema แต่ไม่มี UI ใช้งาน
