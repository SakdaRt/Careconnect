# บทที่ 3 (ส่วนที่ 3: Section 3.5–3.8 Sequence, UI, Database)

> Diagram เป็น Mermaid → https://mermaid.live | PlantUML → https://www.plantuml.com/plantuml/uml | dbdiagram → https://dbdiagram.io

---

## 3.5 Use Case

### 3.5.1 Use Case Diagram

> 📌 **DIAGRAM: Use Case** — PlantUML code (วางที่ plantuml.com):
> Hirer และ Caregiver สืบทอดจาก Guest (หลัง Register/Login → Select Role)

```plantuml
@startuml
left to right direction
skinparam actorStyle awesome
skinparam usecase {
  BackgroundColor #FEFCE8
  BackgroundColor<<sub>> #F1F5F9
  BorderColor<<sub>> #94A3B8
  FontColor<<sub>> #475569
}

actor "Guest\n(ผู้เยี่ยมชม)" as G
actor "Hirer\n(ผู้ว่าจ้าง)" as H
actor "Caregiver\n(ผู้ดูแล)" as CG
actor "Admin\n(ผู้ดูแลระบบ)" as A

G <|-- H
G <|-- CG

rectangle "CareConnect System" {

  ' ============================================================
  ' Authentication — 3 main + 1 sub
  ' ============================================================
  usecase "UC-01\nสมัครสมาชิก" as UC01
  usecase "UC-02\nเข้าสู่ระบบ" as UC02
  usecase "UC-03\nรีเซ็ตรหัสผ่าน" as UC03
  usecase "เข้าสู่ระบบด้วย\nGoogle OAuth" as SUB_OAUTH <<sub>>

  ' ============================================================
  ' Profile — 1 main + 3 sub
  ' ============================================================
  usecase "UC-04\nจัดการโปรไฟล์\nและยืนยันตัวตน" as UC04
  usecase "ยืนยัน OTP" as SUB_OTP <<sub>>
  usecase "ยืนยัน KYC" as SUB_KYC <<sub>>
  usecase "อัปโหลดเอกสาร\nใบรับรอง" as SUB_DOC <<sub>>

  ' ============================================================
  ' Hirer Job — 4 main + 4 sub
  ' ============================================================
  usecase "UC-05\nจัดการผู้รับการดูแล" as UC05
  usecase "UC-06\nสร้างและโพสต์งาน" as UC06
  usecase "UC-07\nค้นหาและเลือกผู้ดูแล" as UC07
  usecase "UC-08\nยกเลิกงาน" as UC08
  usecase "เผยแพร่งาน\n(Publish)" as SUB_PUBLISH <<sub>>
  usecase "มอบหมายงานตรง" as SUB_ASSIGN <<sub>>
  usecase "บันทึกผู้ดูแล\nที่ชอบ" as SUB_FAV <<sub>>
  usecase "อนุมัติ/ปฏิเสธ\nEarly Checkout" as SUB_APPROVE_EC <<sub>>

  ' ============================================================
  ' Hirer Social — 1 main
  ' ============================================================
  usecase "UC-09\nตรวจสอบและ\nประเมินผลงาน" as UC09
  usecase "เขียนรีวิว" as SUB_REVIEW <<sub>>

  ' ============================================================
  ' Caregiver Job — 2 main + 3 sub
  ' ============================================================
  usecase "UC-10\nดูและรับงาน" as UC10
  usecase "UC-11\nปฏิบัติงาน\n(Check-in / Check-out)" as UC11
  usecase "เช็คอิน (GPS)" as SUB_CHECKIN <<sub>>
  usecase "เช็คเอาท์\n(GPS + หลักฐาน)" as SUB_CHECKOUT <<sub>>
  usecase "ขอ Check-out\nก่อนเวลา" as SUB_EARLY <<sub>>

  ' ============================================================
  ' Payment — 1 main + 3 sub
  ' ============================================================
  usecase "UC-12\nจัดการกระเป๋าเงิน" as UC12
  usecase "เติมเงิน\n(QR Code)" as SUB_TOPUP <<sub>>
  usecase "ถอนเงิน" as SUB_WITHDRAW <<sub>>
  usecase "จัดการบัญชี\nธนาคาร" as SUB_BANK <<sub>>

  ' ============================================================
  ' Communication — 2 main
  ' ============================================================
  usecase "UC-13\nแชทเรียลไทม์" as UC13
  usecase "UC-14\nดูการแจ้งเตือน" as UC14

  ' ============================================================
  ' Dispute — 2 main
  ' ============================================================
  usecase "UC-15\nเปิดข้อพิพาท" as UC15
  usecase "UC-16\nร้องเรียน" as UC16

  ' ============================================================
  ' General — 1 main
  ' ============================================================
  usecase "UC-17\nออกจากระบบ" as UC17

  ' ============================================================
  ' Admin — 4 main + 1 sub
  ' ============================================================
  usecase "UC-18\nจัดการผู้ใช้" as UC18
  usecase "UC-19\nจัดการงาน (Admin)" as UC19
  usecase "UC-20\nตัดสินข้อพิพาท" as UC20
  usecase "UC-21\nจัดการการเงิน\nและรายงาน" as UC21
  usecase "ตรวจสอบ KYC" as SUB_KYC_REVIEW <<sub>>
}

' ==============================================================
' Guest → 3 main use cases
' ==============================================================
G --> UC01
G --> UC02
G --> UC03

' ==============================================================
' Authentication — extend
' ==============================================================
UC02 <.. SUB_OAUTH : <<extend>>

' ==============================================================
' Hirer → 12 main use cases
' ==============================================================
H --> UC04
H --> UC05
H --> UC06
H --> UC07
H --> UC08
H --> UC09
H --> UC12
H --> UC13
H --> UC14
H --> UC15
H --> UC16
H --> UC17

' ==============================================================
' Caregiver → 10 main use cases
' ==============================================================
CG --> UC04
CG --> UC08
CG --> UC10
CG --> UC11
CG --> UC12
CG --> UC13
CG --> UC14
CG --> UC15
CG --> UC16
CG --> UC17

' ==============================================================
' Admin → 5 main use cases
' ==============================================================
A --> UC17
A --> UC18
A --> UC19
A --> UC20
A --> UC21

' ==============================================================
' include / extend — Profile & Verification
' ==============================================================
UC04 ..> SUB_OTP : <<include>>
UC04 ..> SUB_KYC : <<include>>
UC04 <.. SUB_DOC : <<extend>>

' ==============================================================
' include / extend — Hirer Job
' ==============================================================
UC06 <.. SUB_PUBLISH : <<extend>>
UC07 <.. SUB_ASSIGN : <<extend>>
UC07 <.. SUB_FAV : <<extend>>
UC09 <.. SUB_APPROVE_EC : <<extend>>
UC09 <.. SUB_REVIEW : <<extend>>

' ==============================================================
' include / extend — Caregiver Job
' ==============================================================
UC11 ..> SUB_CHECKIN : <<include>>
UC11 ..> SUB_CHECKOUT : <<include>>
UC11 <.. SUB_EARLY : <<extend>>

' ==============================================================
' include / extend — Payment
' ==============================================================
UC12 ..> SUB_TOPUP : <<include>>
UC12 <.. SUB_WITHDRAW : <<extend>>
UC12 ..> SUB_BANK : <<include>>

' ==============================================================
' include / extend — Admin
' ==============================================================
UC18 ..> SUB_KYC_REVIEW : <<include>>

@enduml
```

### 3.5.2 Use Case Descriptions

> Use Case Diagram ประกอบด้วย **21 Main Use Cases** (user goals) + **14 Sub-Use Cases** (include/extend) รวม 35 features ที่ครอบคลุมทุกฟังก์ชันของระบบ
> ตาราง Use Case Description ด้านล่างมีทั้งหมด 36 ตาราง (UC-01 ถึง UC-36 ตาม numbering เดิม) — แต่ละ UC สามารถนำไปเขียน Test Case ได้โดยตรง

---

#### กลุ่มที่ 1: Authentication (UC-01 ถึง UC-05)

**ตาราง 3.16** UC-01: สมัครสมาชิก (Register)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-01 |
| **Use Case** | สมัครสมาชิก (Register) |
| **Actor** | Guest |
| **Pre Conditions** | 1. ผู้ใช้ยังไม่มีบัญชีในระบบ<br>2. ผู้ใช้เข้าถึงหน้าเว็บแอปพลิเคชันได้ |
| **Main Flow** | 1. ผู้ใช้เข้าหน้า /register เลือกประเภทสมัคร (Guest หรือ Member)<br>2. Guest: กรอก email + password + role → POST /api/auth/register/guest<br>   Member: กรอก phone + password + role → POST /api/auth/register/member<br>3. ระบบตรวจสอบ Joi validation (email format, password ≥ 8 ตัว, role valid)<br>4. ระบบสร้าง users, profile (hirer_profiles/caregiver_profiles), wallet ใน DB transaction เดียว<br>5. ระบบสร้าง JWT access token + refresh token<br>6. ระบบส่ง token กลับ → frontend redirect ไป /select-role<br>7. ผู้ใช้เลือก role (Hirer/Caregiver) → ยอมรับนโยบาย → POST /api/auth/policy/accept<br>8. redirect ไปหน้าหลักของ role |
| **Exceptional Flow** | 1. Email/Phone ซ้ำในระบบ → 409 Conflict "อีเมลนี้ถูกใช้แล้ว"<br>2. Password น้อยกว่า 8 ตัวอักษร → 400 Validation Error<br>3. Role ไม่ใช่ hirer/caregiver → 400 Validation Error<br>4. Rate limit exceeded (authLimiter) → 429 Too Many Requests |

**ตาราง 3.17** UC-02: เข้าสู่ระบบ (Login)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-02 |
| **Use Case** | เข้าสู่ระบบ (Login) |
| **Actor** | Guest |
| **Pre Conditions** | 1. ผู้ใช้มีบัญชีในระบบแล้ว<br>2. ผู้ใช้ยังไม่ได้เข้าสู่ระบบ |
| **Main Flow** | 1. ผู้ใช้เข้าหน้า /login เลือก Login ด้วย Email หรือ Phone<br>2. Email: กรอก email + password → POST /api/auth/login/email<br>   Phone: กรอก phone + password → POST /api/auth/login/phone<br>3. ระบบตรวจสอบ email/phone ในฐานข้อมูล<br>4. ระบบเปรียบเทียบ password กับ password_hash (bcrypt)<br>5. ระบบสร้าง JWT access token + refresh token<br>6. Frontend บันทึก token ใน sessionStorage → redirect ตาม role |
| **Exceptional Flow** | 1. Email/Phone ไม่มีในระบบ → 401 Unauthorized<br>2. Password ไม่ตรง → 401 Unauthorized<br>3. User ถูก ban (ban_login=true) → 403 Forbidden<br>4. User status=suspended → 403 Forbidden<br>5. Rate limit exceeded → 429 Too Many Requests |

**ตาราง 3.18** UC-03: เข้าสู่ระบบด้วย Google OAuth (Google OAuth Login)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-03 |
| **Use Case** | เข้าสู่ระบบด้วย Google OAuth (Google OAuth 2.0) |
| **Actor** | Guest |
| **Pre Conditions** | 1. ผู้ใช้มีบัญชี Google<br>2. ผู้ใช้อยู่ในหน้า Login |
| **Main Flow** | 1. ผู้ใช้กดปุ่ม "Sign in with Google" → GET /api/auth/google<br>2. ระบบ redirect ไป Google Consent Screen (Authorization Code Flow)<br>3. ผู้ใช้อนุญาต → Google redirect กลับ GET /api/auth/google/callback พร้อม code<br>4. ระบบแลก code เป็น token กับ Google → ได้ email, name, google_id<br>5. ถ้า user มีอยู่แล้ว → login ส่ง JWT กลับ<br>6. ถ้า user ใหม่ → สร้าง user + profile + wallet → redirect /select-role |
| **Exceptional Flow** | 1. ผู้ใช้ปฏิเสธ consent → redirect กลับหน้า login พร้อม error<br>2. Google callback code ไม่ valid → 400 Bad Request<br>3. Email จาก Google ซ้ำกับบัญชี email ที่มีอยู่ → ผูกบัญชีเดิม |

**ตาราง 3.19** UC-04: รีเซ็ตรหัสผ่าน (Forgot & Reset Password)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-04 |
| **Use Case** | รีเซ็ตรหัสผ่าน (Forgot & Reset Password) |
| **Actor** | Guest |
| **Pre Conditions** | 1. ผู้ใช้มีบัญชี email ในระบบ<br>2. ผู้ใช้ไม่สามารถเข้าสู่ระบบด้วยรหัสผ่านเดิมได้ |
| **Main Flow** | 1. ผู้ใช้เข้าหน้า /forgot-password กรอก email<br>2. POST /api/auth/forgot-password → ระบบสร้าง reset token (hex 64 chars)<br>3. ระบบส่ง email พร้อมลิงก์ reset (nodemailer)<br>4. ผู้ใช้คลิกลิงก์ → เข้าหน้า /reset-password?token=xxx&email=xxx<br>5. กรอกรหัสผ่านใหม่ (≥ 8 ตัว) → POST /api/auth/reset-password<br>6. ระบบตรวจสอบ token ถูกต้องและยังไม่หมดอายุ<br>7. อัปเดต password_hash ใหม่ (bcrypt) |
| **Exceptional Flow** | 1. Email ไม่มีในระบบ → ส่ง 200 OK เสมอ (ไม่เปิดเผยว่า email มีหรือไม่)<br>2. Token หมดอายุ → 400 "ลิงก์รีเซ็ตหมดอายุ"<br>3. Token ไม่ถูกต้อง → 400 Bad Request<br>4. Password ใหม่ < 8 ตัว → 400 Validation Error |

**ตาราง 3.20** UC-05: ออกจากระบบ (Logout)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-05 |
| **Use Case** | ออกจากระบบ (Logout) |
| **Actor** | Hirer, Caregiver, Admin |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว |
| **Main Flow** | 1. ผู้ใช้กดปุ่ม "ออกจากระบบ" ที่หน้า /profile<br>2. POST /api/auth/logout<br>3. Frontend ลบ token จาก sessionStorage<br>4. Socket.IO disconnect<br>5. redirect ไป /login |
| **Exceptional Flow** | 1. Token หมดอายุแล้ว → ลบ session แล้ว redirect เหมือนกัน |

---

#### กลุ่มที่ 2: Profile & Verification (UC-06 ถึง UC-09)

**ตาราง 3.21** UC-06: จัดการโปรไฟล์ (Manage Profile)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-06 |
| **Use Case** | จัดการโปรไฟล์ (Manage Profile) |
| **Actor** | Hirer, Caregiver |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องเลือกบทบาทและยอมรับนโยบายแล้ว |
| **Main Flow** | 1. ผู้ใช้เข้าหน้า /profile<br>2. ระบบดึงข้อมูล GET /api/auth/profile → แสดงข้อมูลปัจจุบัน<br>3. ผู้ใช้แก้ไขชื่อ, bio, ประสบการณ์, ความเชี่ยวชาญ, ที่อยู่<br>4. กดบันทึก → PUT /api/auth/profile<br>5. ระบบ validate ด้วย Joi (display_name required)<br>6. อัปเดตข้อมูลใน hirer_profiles/caregiver_profiles<br>7. อัปโหลดรูปโปรไฟล์ → POST /api/auth/avatar (multer + sharp resize)<br>8. เปลี่ยนรหัสผ่าน → POST /api/auth/change-password |
| **Exceptional Flow** | 1. display_name ว่าง → 400 Validation Error<br>2. รูปโปรไฟล์ > 5 MB → 400 "รูปโปรไฟล์ต้องมีขนาดไม่เกิน 5 MB"<br>3. ไฟล์ไม่ใช่ JPEG/PNG/WebP → 400 "อนุญาตเฉพาะไฟล์รูปภาพ"<br>4. รหัสผ่านเดิมไม่ถูกต้อง → 400 "รหัสผ่านปัจจุบันไม่ถูกต้อง" |

**ตาราง 3.22** UC-07: ยืนยัน OTP (Verify OTP)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-07 |
| **Use Case** | ยืนยัน OTP (Verify OTP — Email/Phone) |
| **Actor** | Hirer, Caregiver |
| **Pre Conditions** | 1. ผู้ใช้ต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้ยังไม่ได้ยืนยันเบอร์โทรศัพท์/อีเมล |
| **Main Flow** | 1. ผู้ใช้กดขอ OTP → POST /api/otp/phone/send หรือ /api/otp/email/send<br>2. ระบบสร้าง OTP 6 หลัก + บันทึกลง DB (หมดอายุ 5 นาที)<br>3. ระบบส่ง OTP ทาง SMS (SMSOK) หรือ Email (nodemailer)<br>4. ผู้ใช้กรอก OTP → POST /api/otp/verify<br>5. ระบบตรวจสอบ OTP ตรงกันและยังไม่หมดอายุ<br>6. อัปเดต is_phone_verified=true หรือ is_email_verified=true<br>7. ถ้ายืนยันโทรศัพท์สำเร็จ → Trust Level อัปเกรดจาก L0 เป็น L1 |
| **Exceptional Flow** | 1. OTP ไม่ถูกต้อง → 400 "รหัส OTP ไม่ถูกต้อง"<br>2. OTP หมดอายุ → 400 "รหัส OTP หมดอายุ"<br>3. ส่ง OTP ซ้ำเร็วเกินไป → 429 Rate Limit<br>4. เบอร์โทรศัพท์ format ผิด → 400 Validation Error |

**ตาราง 3.23** UC-08: ยืนยัน KYC (Submit KYC)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-08 |
| **Use Case** | ยืนยัน KYC (Submit KYC — บัตรประชาชน) |
| **Actor** | Hirer, Caregiver |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานมี Trust Level L1 ขึ้นไป (ยืนยัน OTP แล้ว)<br>3. ผู้ใช้งานยังไม่ได้ส่ง KYC หรือ KYC ถูก reject |
| **Main Flow** | 1. ผู้ใช้เข้าหน้า /kyc<br>2. อัปโหลดเอกสาร: บัตรประชาชนด้านหน้า, ด้านหลัง, selfie<br>3. POST /api/kyc/submit (multipart form data)<br>4. ระบบบันทึกไฟล์ + สร้าง record ใน user_kyc_info (status=pending)<br>5. รอ Admin ตรวจสอบ (ดู UC-33)<br>6. เมื่อ Admin approve → trust_level อัปเกรดเป็น L2 |
| **Exceptional Flow** | 1. ขาดไฟล์ selfie → 400 "กรุณาอัปโหลดรูป selfie"<br>2. ไฟล์ไม่ใช่รูปภาพ → 400 Validation Error<br>3. KYC ถูก reject → ผู้ใช้สามารถส่งใหม่ได้ |

**ตาราง 3.24** UC-09: อัปโหลดเอกสาร/ใบรับรอง (Upload Caregiver Documents)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-09 |
| **Use Case** | อัปโหลดเอกสาร/ใบรับรอง (Upload Caregiver Documents) |
| **Actor** | Caregiver |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องมีบทบาท Caregiver |
| **Main Flow** | 1. ผู้ดูแลเข้าหน้าจัดการเอกสาร<br>2. เลือกประเภทเอกสาร (ใบรับรอง, ใบอนุญาต, อื่น ๆ)<br>3. POST /api/caregiver-documents (multipart form data)<br>4. ระบบบันทึกไฟล์ + สร้าง record ใน caregiver_documents<br>5. เอกสารแสดงในโปรไฟล์สาธารณะ<br>6. ลบเอกสาร → DELETE /api/caregiver-documents/:id |
| **Exceptional Flow** | 1. ไฟล์ขนาดเกิน 10 MB → 400 Payload Too Large<br>2. ไฟล์ไม่ใช่ JPEG/PNG/WebP/PDF → 400 "อนุญาตเฉพาะไฟล์รูปภาพหรือ PDF"<br>3. ผู้ใช้ไม่ใช่ Caregiver → 403 Forbidden |

---

#### กลุ่มที่ 3: Hirer — Job Management (UC-10 ถึง UC-18)

**ตาราง 3.25** UC-10: จัดการผู้รับการดูแล (Manage Care Recipients)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-10 |
| **Use Case** | จัดการผู้รับการดูแล (Manage Care Recipients — CRUD) |
| **Actor** | Hirer |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องมีบทบาท Hirer |
| **Main Flow** | 1. ผู้ว่าจ้างเข้าหน้า /hirer/care-recipients<br>2. ระบบดึงรายการ GET /api/care-recipients<br>3. **เพิ่ม**: กด "เพิ่มผู้รับการดูแล" → /hirer/care-recipients/new<br>4. กรอกข้อมูล: ชื่อ, ช่วงอายุ, ระดับการเคลื่อนไหว, โรคประจำตัว, อุปกรณ์การแพทย์, ที่อยู่<br>5. POST /api/care-recipients → ระบบสร้าง patient_profiles record<br>6. **แก้ไข**: กดแก้ไข → /hirer/care-recipients/:id/edit → PUT /api/care-recipients/:id<br>7. **ลบ**: กดลบ → DELETE /api/care-recipients/:id |
| **Exceptional Flow** | 1. ชื่อว่าง → 400 Validation Error<br>2. ลบผู้รับการดูแลที่มีงานอยู่ → 409 Conflict<br>3. แก้ไข/ลบของ hirer อื่น → 403 Forbidden |

**ตาราง 3.26** UC-11: สร้างงาน (Create Job)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-11 |
| **Use Case** | สร้างงาน (Create Job — Draft) |
| **Actor** | Hirer |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องมีบทบาท Hirer<br>3. ผู้ใช้งานต้องมีผู้รับการดูแลอย่างน้อย 1 คน |
| **Main Flow** | 1. ผู้ว่าจ้างเข้าหน้า /hirer/create-job (wizard form)<br>2. เลือกผู้รับการดูแล (patient_profile_id)<br>3. กรอก: ชื่องาน, ประเภทงาน (6 ค่า), คำอธิบาย<br>4. เลือกวันเวลา (scheduled_start_at, scheduled_end_at) → ระบบคำนวณ total_hours อัตโนมัติ<br>5. กรอกที่อยู่ + ระบบดึง GPS coordinates (lat, lng)<br>6. ตั้งค่า hourly_rate → ระบบคำนวณ total_amount + platform_fee (10%)<br>7. เลือก job_tasks, required_skills, equipment, precautions (flags)<br>8. ระบบเรียก computeRiskLevel() คำนวณ risk_level อัตโนมัติ<br>9. POST /api/jobs → สร้าง job_posts (status=draft) |
| **Exceptional Flow** | 1. ขาด required fields → 400 Joi Validation Error<br>2. scheduled_end_at ก่อน scheduled_start_at → 400 Validation Error<br>3. ยังไม่มี care recipient → ต้องสร้างก่อน (UC-10)<br>4. ban_job_create=true → 403 Forbidden |

**ตาราง 3.27** UC-12: เผยแพร่งาน (Publish Job)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-12 |
| **Use Case** | เผยแพร่งาน (Publish Job) |
| **Actor** | Hirer (L1+) |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องมี Trust Level L1+ (low_risk) หรือ L2+ (high_risk)<br>3. มีงาน draft ที่สร้างไว้แล้ว (UC-11)<br>4. มียอดเงินเพียงพอ |
| **Main Flow** | 1. ผู้ว่าจ้างดูงาน draft ที่สร้างไว้<br>2. กด Publish → POST /api/jobs/:id/publish<br>3. ระบบตรวจ Trust Level: low_risk ต้องการ L1+, high_risk ต้องการ L2+<br>4. ระบบตรวจ available_balance ≥ total_amount + platform_fee<br>5. ระบบ hold เงิน: available_balance -= cost, held_balance += cost<br>6. INSERT ledger_transactions (type=hold)<br>7. UPDATE job_posts status=posted<br>8. งานปรากฏใน Job Feed ของ Caregiver |
| **Exceptional Flow** | 1. Trust Level ไม่เพียงพอ → 403 "Trust level ไม่เพียงพอ"<br>2. ยอดเงินไม่พอ → 400 "ยอดเงินไม่เพียงพอ"<br>3. งานไม่ใช่ draft → 400 "สถานะไม่ถูกต้อง"<br>4. ไม่ใช่เจ้าของงาน → 403 Forbidden |

**ตาราง 3.28** UC-13: ยกเลิกงาน (Cancel Job)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-13 |
| **Use Case** | ยกเลิกงาน (Cancel Job) |
| **Actor** | Hirer, Caregiver |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องเป็นผู้เกี่ยวข้องกับงาน (hirer หรือ caregiver ที่รับงาน)<br>3. งานต้องยังไม่เสร็จสมบูรณ์ (status ≠ completed) |
| **Main Flow** | 1. ผู้ใช้เปิดรายละเอียดงาน<br>2. กดยกเลิก → กรอกเหตุผล → POST /api/jobs/:id/cancel<br>3. ระบบตรวจสถานะงาน (ยกเลิกได้ก่อน completed)<br>4. **กรณี posted**: คืนเงิน held → available (release)<br>5. **กรณี assigned/in_progress**: คืนเงิน escrow → hirer available (reversal)<br>6. UPDATE status=cancelled<br>7. ปิด chat thread อัตโนมัติ<br>8. Notify ฝ่ายตรงข้าม |
| **Exceptional Flow** | 1. งาน completed แล้ว → 400 "ไม่สามารถยกเลิกได้"<br>2. เหตุผลว่าง → 400 Validation Error<br>3. ไม่ใช่ผู้เกี่ยวข้องกับงาน → 403 Forbidden |

**ตาราง 3.29** UC-14: ค้นหาผู้ดูแล (Search Caregivers)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-14 |
| **Use Case** | ค้นหาผู้ดูแล (Search Caregivers) |
| **Actor** | Hirer |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องมีบทบาท Hirer |
| **Main Flow** | 1. ผู้ว่าจ้างเข้าหน้า /hirer/search-caregivers<br>2. กรอกตัวกรอง: คำค้น (q), ทักษะ (skills), Trust Level, ประสบการณ์ (experience), วันที่ว่าง (day)<br>3. GET /api/caregivers/search?q=xxx&skills=xxx&...<br>4. ระบบค้นหาจาก caregiver_profiles + users<br>5. แสดงรายการ: ชื่อ, rating, Trust Level, ทักษะ, ปุ่ม "ดูรายละเอียด"<br>6. กดดูรายละเอียด → เปิด modal แสดงโปรไฟล์เต็ม + ปุ่ม "มอบหมายงาน" |
| **Exceptional Flow** | 1. ไม่มีผลลัพธ์ → แสดงข้อความ "ไม่พบผู้ดูแลที่ตรงเงื่อนไข"<br>2. API error → แสดง error toast |

**ตาราง 3.30** UC-15: มอบหมายงานตรง (Direct Assign)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-15 |
| **Use Case** | มอบหมายงานตรง (Direct Assign) |
| **Actor** | Hirer |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องมีงาน draft/posted อย่างน้อย 1 งาน<br>3. ผู้ใช้งานต้องอยู่ในหน้าค้นหาผู้ดูแล |
| **Main Flow** | 1. ผู้ว่าจ้างค้นหาผู้ดูแล (UC-14) แล้วกด "มอบหมายงาน"<br>2. เลือกงาน draft/posted ที่ต้องการ<br>3. POST /api/caregivers/assign { job_post_id, caregiver_id }<br>4. ระบบตั้ง preferred_caregiver_id ใน job_posts<br>5. ระบบ Notify ผู้ดูแลให้ accept/reject<br>6. ผู้ดูแลตัดสินใจ (ดู UC-20) |
| **Exceptional Flow** | 1. ผู้ดูแลมีงานทับซ้อนเวลา → 409 Schedule Conflict<br>2. งานไม่ใช่ draft/posted/completed → 400 "สถานะไม่ถูกต้อง"<br>3. ผู้ดูแลมี Trust Level ต่ำกว่า min_trust_level → 400 |

**ตาราง 3.31** UC-16: บันทึกผู้ดูแลที่ชอบ (Toggle Favorite)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-16 |
| **Use Case** | บันทึกผู้ดูแลที่ชอบ (Toggle Favorite) |
| **Actor** | Hirer |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องมีบทบาท Hirer |
| **Main Flow** | 1. ผู้ว่าจ้างดูรายการผู้ดูแลในหน้าค้นหา<br>2. กดไอคอนหัวใจ → POST /api/favorites/toggle { caregiver_id }<br>3. ระบบ toggle: ถ้ายังไม่มี → INSERT, ถ้ามีแล้ว → DELETE<br>4. ดูรายการ Favorites ที่ /hirer/favorites (GET /api/favorites)<br>5. ตรวจสอบสถานะ Favorite → GET /api/favorites/check/:caregiverId |
| **Exceptional Flow** | 1. caregiver_id ไม่มีในระบบ → 404 Not Found |

**ตาราง 3.32** UC-17: อนุมัติ/ปฏิเสธ Early Checkout (Approve/Reject Early Checkout)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-17 |
| **Use Case** | อนุมัติ/ปฏิเสธ Early Checkout (Approve/Reject Early Checkout) |
| **Actor** | Hirer |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องเป็นเจ้าของงาน<br>3. มีคำขอ Early Checkout จากผู้ดูแล (status=pending) |
| **Main Flow** | 1. ผู้ว่าจ้างได้รับ notification ว่ามีคำขอ early checkout<br>2. เข้าหน้ารายละเอียดงาน → เห็น Early Checkout Card<br>3. ดู evidence_note จากผู้ดูแล<br>4. **อนุมัติ**: POST /api/jobs/:jobId/early-checkout-respond { action: "approve" }<br>   → ระบบ checkout + settlement ทันที<br>5. **ปฏิเสธ**: POST /api/jobs/:jobId/early-checkout-respond { action: "reject", reason }<br>   → ผู้ดูแลทำงานต่อจนถึงเวลา |
| **Exceptional Flow** | 1. Request หมดอายุ (auto-complete) → 400 "คำขอหมดอายุแล้ว"<br>2. ไม่ใช่ hirer ของงาน → 403 Forbidden |

**ตาราง 3.33** UC-18: เขียนรีวิว (Write Review)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-18 |
| **Use Case** | เขียนรีวิว (Write Review) |
| **Actor** | Hirer |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องเป็นเจ้าของงาน<br>3. งานต้องมีสถานะ completed<br>4. ผู้ใช้งานยังไม่เคยรีวิวงานนี้ |
| **Main Flow** | 1. หลังงานเสร็จ (completed) ผู้ว่าจ้างเข้าหน้ารายละเอียดงาน<br>2. แสดงฟอร์มรีวิว: rating 1-5 ดาว + comment<br>3. POST /api/reviews { job_id, caregiver_id, rating, comment }<br>4. ระบบ INSERT caregiver_reviews<br>5. อัปเดต average_rating + Trust Score ของผู้ดูแล<br>6. ดูรีวิวของผู้ดูแล → GET /api/reviews/caregiver/:id |
| **Exceptional Flow** | 1. งานยังไม่เสร็จ → 400 "ยังไม่สามารถรีวิวได้"<br>2. รีวิวซ้ำ (1 งาน = 1 รีวิว) → 409 Conflict<br>3. rating นอกช่วง 1-5 → 400 Validation Error |

---

#### กลุ่มที่ 4: Caregiver — Job Execution (UC-19 ถึง UC-23)

**ตาราง 3.34** UC-19: ดูประกาศงาน (View Job Feed)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-19 |
| **Use Case** | ดูประกาศงาน (View Job Feed) |
| **Actor** | Caregiver |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องมีบทบาท Caregiver |
| **Main Flow** | 1. ผู้ดูแลเข้าหน้า /caregiver/jobs/feed<br>2. GET /api/jobs/feed → ระบบกรอง 3 เงื่อนไขอัตโนมัติ:<br>   - แสดงเฉพาะ min_trust_level ≤ ระดับผู้ดูแล<br>   - กรองงานที่ทับซ้อนเวลากับงานที่รับแล้ว<br>   - ไม่แสดงงานที่ผู้ดูแลสร้างเอง (hirer_id ≠ user_id)<br>3. กรองเพิ่มเติมด้วย job_type, risk_level, is_urgent<br>4. แสดงรายการงาน: ชื่อ, ประเภท, วันเวลา, ค่าจ้าง, risk level<br>5. กดดูรายละเอียด → /caregiver/jobs/:id/preview |
| **Exceptional Flow** | 1. ไม่มีงานที่เหมาะสม → แสดง "ไม่มีงานในขณะนี้"<br>2. ban_job_accept=true → ไม่เห็นปุ่ม Accept |

**ตาราง 3.35** UC-20: รับงาน / ปฏิเสธงาน (Accept / Reject Job)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-20 |
| **Use Case** | รับงาน / ปฏิเสธงาน (Accept / Reject Job) |
| **Actor** | Caregiver (≥ min_trust_level) |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องมี Trust Level ≥ min_trust_level ของงาน<br>3. งานต้องมีสถานะ posted<br>4. ไม่มีงานทับซ้อนเวลา |
| **Main Flow** | 1. ผู้ดูแลดูรายละเอียดงาน → กด Accept<br>2. POST /api/jobs/:id/accept<br>3. ระบบ SELECT job_posts FOR UPDATE (lock row)<br>4. ตรวจ Trust Level ≥ min_trust_level + ไม่มีงานทับซ้อนเวลา<br>5. หัก held_balance จาก hirer → โอนเข้า escrow wallet<br>6. INSERT jobs (instance) + job_assignments + chat_thread<br>7. INSERT ledger_transactions (type=hold: held→escrow)<br>8. UPDATE job_posts status=assigned<br>9. Notify ผู้ว่าจ้าง + ส่ง system message ใน chat<br>**กรณี Direct Assign — ปฏิเสธ:**<br>10. ผู้ดูแลกด Reject → กรอกเหตุผล → POST /api/jobs/:id/reject<br>11. ระบบลบ preferred_caregiver_id → งานกลับเป็น posted<br>12. Notify ผู้ว่าจ้าง |
| **Exceptional Flow** | 1. Trust Level ไม่ถึง → 403 "Trust level ไม่เพียงพอ"<br>2. งานถูกรับไปแล้ว → 409 "งานนี้ถูกรับไปแล้ว"<br>3. มีงานทับซ้อนเวลา → 409 Schedule Conflict<br>4. ban_job_accept=true → 403 Forbidden<br>5. ไม่ใช่ preferred_caregiver (reject) → 403 Forbidden |

**ตาราง 3.36** UC-21: เช็คอิน (Check-in)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-21 |
| **Use Case** | เช็คอิน (Check-in — GPS) |
| **Actor** | Caregiver |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องรับงานแล้ว (status=assigned) |
| **Main Flow** | 1. ผู้ดูแลเข้าหน้างานที่รับ /caregiver/jobs/my-jobs<br>2. กด Check-in → browser ขอ Geolocation<br>3. POST /api/jobs/:jobId/checkin { lat, lng, accuracy_m }<br>4. ระบบ INSERT gps_events (type=check_in)<br>5. ตรวจระยะห่างจาก geofence (default 100 ม.)<br>6. UPDATE jobs + job_posts status=in_progress<br>7. Notify ผู้ว่าจ้าง "ผู้ดูแลเริ่มงานแล้ว" |
| **Exceptional Flow** | 1. GPS อยู่นอก geofence → log warning แต่ไม่ block check-in<br>2. Browser ปฏิเสธ Geolocation → ใช้ค่าที่ส่งมา (อาจเป็น null)<br>3. ไม่ใช่ caregiver ของงานนี้ → 403 Forbidden<br>4. สถานะไม่ใช่ assigned → 400 "สถานะไม่ถูกต้อง" |

**ตาราง 3.37** UC-22: เช็คเอาท์ (Check-out)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-22 |
| **Use Case** | เช็คเอาท์ (Check-out — GPS + หลักฐาน) |
| **Actor** | Caregiver |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้อง Check-in แล้ว (status=in_progress)<br>3. ถึงเวลาสิ้นสุดงานหรือได้รับอนุมัติ Early Checkout |
| **Main Flow** | 1. ผู้ดูแลกด Check-out → ระบบแสดง modal ให้เขียน evidence note<br>2. กรอก evidence_note (สรุปการทำงาน) → ต้องไม่ว่าง<br>3. POST /api/jobs/:jobId/checkout { lat, lng, evidence_note }<br>4. ระบบ INSERT gps_events (type=check_out)<br>5. UPDATE jobs + job_posts status=completed<br>6. **Settlement**: escrow → caregiver wallet (ค่าจ้าง) + platform wallet (fee 10%)<br>7. INSERT ledger_transactions (release + debit)<br>8. Notify ผู้ว่าจ้าง "งานเสร็จสมบูรณ์"<br>9. Background: triggerTrustUpdate() คำนวณ Trust Score ใหม่ |
| **Exceptional Flow** | 1. evidence_note ว่าง → 400 "กรุณากรอกบันทึกการทำงาน"<br>2. ยัง check-in ไม่ได้ (status≠in_progress) → 400<br>3. ก่อน scheduled_end_at → redirect ไป Early Checkout (UC-23) |

**ตาราง 3.38** UC-23: ขอเช็คเอาท์ก่อนเวลา (Request Early Checkout)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-23 |
| **Use Case** | ขอเช็คเอาท์ก่อนเวลา (Request Early Checkout) |
| **Actor** | Caregiver |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้อง Check-in แล้ว (status=in_progress)<br>3. ยังไม่ถึงเวลาสิ้นสุดงาน |
| **Main Flow** | 1. ผู้ดูแลต้องการส่งงานก่อน scheduled_end_at<br>2. กรอก evidence_note อธิบายเหตุผล<br>3. POST /api/jobs/:jobId/early-checkout-request { evidence_note }<br>4. ระบบสร้าง early_checkout_requests record (status=pending)<br>5. Notify ผู้ว่าจ้างเพื่ออนุมัติ (UC-17)<br>6. รอผู้ว่าจ้างตอบกลับ |
| **Exceptional Flow** | 1. มี request ค้างอยู่แล้ว → 409 "มีคำขอรออนุมัติอยู่"<br>2. evidence_note ว่าง → 400 Validation Error<br>3. Auto-complete เมื่อเลย scheduled_end_at + 10 นาที → checkout อัตโนมัติ |

---

#### กลุ่มที่ 5: Payment & Wallet (UC-24 ถึง UC-27)

**ตาราง 3.39** UC-24: เติมเงิน (Top-up Wallet)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-24 |
| **Use Case** | เติมเงิน (Top-up Wallet — QR Code) |
| **Actor** | Hirer, Caregiver |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว |
| **Main Flow** | 1. ผู้ใช้เข้าหน้า wallet (/hirer/wallet หรือ /caregiver/wallet)<br>2. กดเติมเงิน → ระบุจำนวนเงิน<br>3. POST /api/wallet/topup { amount } → ระบบส่ง request ไป Payment Provider<br>4. Provider สร้าง QR code → ส่งกลับ qr_payload<br>5. แสดง QR popup ให้ scan<br>6. ผู้ใช้ scan QR จ่ายเงิน → Provider ส่ง webhook<br>7. ระบบตรวจ HMAC signature → CREDIT available_balance<br>8. INSERT ledger_transactions (type=credit)<br>9. ผู้ใช้กด Confirm → ตรวจสถานะ → แสดงสำเร็จ |
| **Exceptional Flow** | 1. จำนวนเงิน ≤ 0 → 400 Validation Error<br>2. Webhook signature ไม่ valid → 400 "Invalid signature"<br>3. Duplicate webhook (idempotency_key ซ้ำ) → ไม่ credit ซ้ำ<br>4. QR หมดอายุ → ผู้ใช้ต้องสร้าง QR ใหม่ |

**ตาราง 3.40** UC-25: ดูยอดเงินและประวัติธุรกรรม (View Wallet & History)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-25 |
| **Use Case** | ดูยอดเงินและประวัติธุรกรรม (View Wallet & Transaction History) |
| **Actor** | Hirer, Caregiver |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว |
| **Main Flow** | 1. ผู้ใช้เข้าหน้า wallet (/hirer/wallet หรือ /caregiver/wallet)<br>2. GET /api/wallet/balance → แสดง available_balance + held_balance<br>3. GET /api/wallet/transactions → รายการ transactions<br>4. กดรายการ → ดูรายละเอียด<br>5. Hirer: /hirer/wallet/receipt/:jobId แสดงใบเสร็จ<br>6. Caregiver: /caregiver/wallet/earning/:jobId แสดงรายได้ |
| **Exceptional Flow** | 1. ยังไม่มี transactions → แสดง "ยังไม่มีรายการ" |

**ตาราง 3.41** UC-26: ถอนเงิน (Withdraw)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-26 |
| **Use Case** | ถอนเงิน (Withdraw to Bank Account) |
| **Actor** | Caregiver (L2+) |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องมี Trust Level L2 ขึ้นไป<br>3. ผู้ใช้งานต้องมีบัญชีธนาคารอย่างน้อย 1 บัญชี<br>4. ผู้ใช้งานต้องมียอดเงินเพียงพอ |
| **Main Flow** | 1. ผู้ดูแลเข้าหน้า wallet → กดถอนเงิน<br>2. เลือกบัญชีธนาคารปลายทาง + ระบุจำนวน<br>3. POST /api/wallet/withdraw { amount, bank_account_id }<br>4. ระบบตรวจ Trust Level ≥ L2<br>5. ตรวจ available_balance ≥ amount<br>6. สร้าง withdrawal_requests record (status=pending)<br>7. Admin review → approve → mark paid (ดู UC-36) |
| **Exceptional Flow** | 1. Trust Level < L2 → 403 "ต้อง KYC ก่อนถอนเงิน"<br>2. ยอดไม่พอ → 400 "ยอดเงินไม่เพียงพอ"<br>3. ไม่มีบัญชีธนาคาร → ต้องเพิ่มก่อน (UC-27)<br>4. ban_withdraw=true → 403 Forbidden |

**ตาราง 3.42** UC-27: จัดการบัญชีธนาคาร (Manage Bank Accounts)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-27 |
| **Use Case** | จัดการบัญชีธนาคาร (Manage Bank Accounts) |
| **Actor** | Hirer, Caregiver |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว |
| **Main Flow** | 1. ผู้ใช้เข้าหน้า /wallet/bank-accounts<br>2. GET /api/wallet/bank-accounts → แสดงรายการบัญชี<br>3. **เพิ่ม**: กรอกธนาคาร + เลขบัญชี + ชื่อ → POST /api/wallet/bank-accounts<br>4. **ลบ**: DELETE /api/wallet/bank-accounts/:id |
| **Exceptional Flow** | 1. Caregiver L0 เพิ่มบัญชี → 403 "ต้อง L1 ขึ้นไป"<br>2. Hirer L0 เพิ่มบัญชี → อนุญาต (ไม่จำกัด) |

---

#### กลุ่มที่ 6: Communication (UC-28 ถึง UC-29)

**ตาราง 3.43** UC-28: แชทเรียลไทม์ (Real-time Chat)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-28 |
| **Use Case** | แชทเรียลไทม์ (Real-time Chat) |
| **Actor** | Hirer, Caregiver |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ต้องมี chat thread ที่สร้างจากการ Accept งาน (UC-20)<br>3. ผู้ใช้งานต้องเป็นสมาชิกของ thread |
| **Main Flow** | 1. หลัง Accept งาน → ระบบสร้าง chat_thread อัตโนมัติ<br>2. ผู้ใช้เข้าหน้า /chat/:jobId<br>3. GET /api/chat/threads/:threadId/messages → โหลดข้อความเก่า<br>4. Socket.IO: emit thread:join → server join room<br>5. พิมพ์ข้อความ → emit message:send → server broadcast message:new<br>6. Typing indicator: emit typing:start/stop<br>7. อ่านข้อความ → emit message:read → อัปเดต read status |
| **Exceptional Flow** | 1. ไม่ใช่สมาชิกของ thread → 403 Forbidden<br>2. Thread ถูกปิด (งานยกเลิก) → disable input + แสดง "ห้องแชทปิดแล้ว"<br>3. Socket หลุด → reconnect อัตโนมัติ + sync ข้อความที่พลาด |

**ตาราง 3.44** UC-29: ดูการแจ้งเตือน (View Notifications)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-29 |
| **Use Case** | ดูการแจ้งเตือน (View Notifications) |
| **Actor** | Hirer, Caregiver |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว |
| **Main Flow** | 1. ระบบส่ง notification ผ่าน 2 ช่องทาง:<br>   - Real-time: Socket.IO emit ไป room user:{userId}<br>   - Polling: GET /api/notifications/unread-count ทุก 5 วินาที<br>2. TopBar แสดง badge จำนวน unread<br>3. ผู้ใช้กดดู → /notifications → GET /api/notifications<br>4. กดแต่ละรายการ → PATCH /api/notifications/:id/read → badge ลด<br>5. กด "อ่านทั้งหมด" → PATCH /api/notifications/read-all |
| **Exceptional Flow** | 1. Socket หลุด → polling fallback + fetchUnread เมื่อ reconnect/focus/online<br>2. API error → cache-busting timestamp retry |

---

#### กลุ่มที่ 7: Dispute & Complaint (UC-30 ถึง UC-31)

**ตาราง 3.45** UC-30: เปิดข้อพิพาท (Open Dispute)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-30 |
| **Use Case** | เปิดข้อพิพาท (Open Dispute) |
| **Actor** | Hirer, Caregiver |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องเป็นผู้เกี่ยวข้องกับงาน<br>3. ยังไม่มี dispute เปิดอยู่สำหรับงานเดียวกัน |
| **Main Flow** | 1. ผู้ใช้เข้าหน้ารายละเอียดงาน → กดเปิด Dispute<br>2. กรอกเหตุผล + รายละเอียดปัญหา<br>3. POST /api/disputes { job_id, reason }<br>4. ระบบสร้าง disputes record (status=open)<br>5. ผู้ใช้เข้าหน้า /dispute/:disputeId → ส่งหลักฐานเพิ่ม<br>6. POST /api/disputes/:id/messages { content }<br>7. Notify Admin + ฝ่ายตรงข้าม |
| **Exceptional Flow** | 1. งานไม่มีอยู่ → 404 Not Found<br>2. มี dispute เปิดอยู่แล้ว → 409 Conflict<br>3. Dispute ถูก resolve แล้ว → 400 "ข้อพิพาทปิดแล้ว" (ส่งหลักฐานไม่ได้) |

**ตาราง 3.46** UC-31: ร้องเรียน (Submit Complaint)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-31 |
| **Use Case** | ร้องเรียน (Submit Complaint) |
| **Actor** | Hirer, Caregiver |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว |
| **Main Flow** | 1. ผู้ใช้เข้าหน้า /complaint<br>2. เลือกหมวดหมู่ปัญหา + กรอกรายละเอียด<br>3. แนบไฟล์หลักฐาน (รูปภาพ/PDF สูงสุด 5 ไฟล์)<br>4. POST /api/complaints (multipart form data)<br>5. ระบบสร้าง complaints record (status=pending)<br>6. ดูรายการร้องเรียนของตัวเอง → GET /api/complaints<br>7. Admin ตรวจสอบ + อัปเดตสถานะ |
| **Exceptional Flow** | 1. ไฟล์เกิน 10 MB ต่อไฟล์ → 400 Payload Too Large<br>2. ไฟล์เกิน 5 ไฟล์ → 400 "จำนวนไฟล์เกินกำหนด"<br>3. ไฟล์ไม่ใช่ JPEG/PNG/GIF/WebP/PDF → 400 "ประเภทไฟล์ไม่ถูกต้อง" |

---

#### กลุ่มที่ 8: Admin (UC-32 ถึง UC-36)

**ตาราง 3.47** UC-32: จัดการผู้ใช้และ Ban (Admin — Manage Users)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-32 |
| **Use Case** | จัดการผู้ใช้และ Ban (Admin — Manage Users & Ban) |
| **Actor** | Admin |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องมีบทบาท Admin |
| **Main Flow** | 1. Admin เข้าหน้า /admin/users<br>2. GET /api/admin/users?q=xxx&role=xxx&status=xxx → รายการผู้ใช้<br>3. กดดูรายละเอียด → GET /api/admin/users/:id<br>4. **เปลี่ยนสถานะ**: POST /api/admin/users/:id/status { status, reason }<br>5. **แก้ไขข้อมูล**: PATCH /api/admin/users/:id/edit { trust_level, trust_score, ... }<br>6. **Ban**: POST /api/admin/users/:id/ban { ban_type, value, reason }<br>7. **ดู Wallet**: GET /api/admin/users/:id/wallet |
| **Exceptional Flow** | 1. ไม่ใช่ Admin → 403 Forbidden<br>2. User ID ไม่มี → 404 Not Found |

**ตาราง 3.48** UC-33: ตรวจสอบ KYC (Admin — KYC Review)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-33 |
| **Use Case** | ตรวจสอบ KYC (Admin — KYC Review) |
| **Actor** | Admin |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องมีบทบาท Admin<br>3. มีผู้ใช้ที่ส่ง KYC แล้ว (status=pending) |
| **Main Flow** | 1. Admin เข้าหน้า /admin/users กรองผู้ใช้ที่มี KYC pending<br>2. ดูเอกสาร: บัตรประชาชน + selfie<br>3. **Approve**: อัปเดต kyc_status=approved → trust_level เป็น L2<br>4. Notify ผู้ใช้ "KYC อนุมัติแล้ว"<br>5. **Reject**: ตั้ง kyc_status=rejected + reason → Notify ผู้ใช้ |
| **Exceptional Flow** | 1. เอกสารไม่ชัด → Reject พร้อมเหตุผล<br>2. User ไม่มี KYC submission → ไม่มีข้อมูลให้ review |

**ตาราง 3.49** UC-34: จัดการงาน (Admin — Manage Jobs)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-34 |
| **Use Case** | จัดการงาน (Admin — Manage Jobs) |
| **Actor** | Admin |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องมีบทบาท Admin |
| **Main Flow** | 1. Admin เข้าหน้า /admin/jobs<br>2. GET /api/admin/jobs?q=xxx&status=xxx&risk_level=xxx → รายการงาน<br>3. กดดูรายละเอียด → GET /api/admin/jobs/:id<br>4. **ยกเลิกงาน**: POST /api/admin/jobs/:id/cancel { reason }<br>5. ระบบ refund เงินตามสถานะ (hold/escrow → hirer)<br>6. Notify ทั้ง 2 ฝ่าย |
| **Exceptional Flow** | 1. งาน completed แล้ว → 400 "ไม่สามารถยกเลิกได้"<br>2. เหตุผลว่าง → 400 Validation Error |

**ตาราง 3.50** UC-35: ตัดสินข้อพิพาท (Admin — Settle Dispute)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-35 |
| **Use Case** | ตัดสินข้อพิพาท (Admin — Settle Dispute) |
| **Actor** | Admin |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องมีบทบาท Admin<br>3. มี dispute ที่ยังไม่ได้ resolve |
| **Main Flow** | 1. Admin เข้าหน้า /admin/disputes<br>2. GET /api/admin/disputes → รายการ disputes<br>3. กดรับมอบหมาย → POST /api/admin/disputes/:id { assign_to_me: true }<br>4. อ่านหลักฐานทั้ง 2 ฝ่าย<br>5. ตัดสิน → POST /api/admin/disputes/:id/settle { refund_amount, payout_amount, resolution }<br>6. **Refund**: escrow → hirer wallet<br>7. **Payout**: escrow → caregiver wallet<br>8. UPDATE dispute status=resolved<br>9. Notify ทั้ง 2 ฝ่าย |
| **Exceptional Flow** | 1. Dispute ถูก resolve แล้ว → 400 "ข้อพิพาทปิดแล้ว"<br>2. refund + payout > escrow balance → 400 "จำนวนเงินเกิน escrow"<br>3. idempotency_key ซ้ำ → ไม่ดำเนินการซ้ำ |

**ตาราง 3.51** UC-36: จัดการการเงินและรายงาน (Admin — Finance & Reports)

| รายการ | รายละเอียด |
|--------|-----------|
| **Use Case ID** | UC-36 |
| **Use Case** | จัดการการเงินและรายงาน (Admin — Finance, Withdrawal Review, Reports) |
| **Actor** | Admin |
| **Pre Conditions** | 1. ผู้ใช้งานต้องทำการเข้าสู่ระบบแล้ว<br>2. ผู้ใช้งานต้องมีบทบาท Admin |
| **Main Flow** | 1. Admin เข้าหน้า /admin/financial<br>2. **ดู Ledger**: GET /api/admin/ledger/transactions → ดูธุรกรรมทั้งหมด<br>3. **ดู Dashboard**: GET /api/admin/stats → สถิติ users, jobs, wallets<br>4. **ดู Reports**: GET /api/admin/reports/summary → รายได้ platform<br>5. **อนุมัติถอนเงิน**: GET /api/wallet/admin/withdrawals → รายการรอตรวจ<br>6. Review → POST /api/wallet/admin/withdrawals/:id/review<br>7. Approve → POST /api/wallet/admin/withdrawals/:id/approve<br>8. Mark Paid → POST /api/wallet/admin/withdrawals/:id/mark-paid<br>9. Reject → POST /api/wallet/admin/withdrawals/:id/reject { reason } |
| **Exceptional Flow** | 1. คำขอถอนถูกยกเลิกแล้ว → 400<br>2. Withdrawal ID ไม่มี → 404 Not Found<br>3. ช่วงวันที่ไม่ valid → 400 Validation Error |

---

## 3.6 Sequence Diagram

> 📌 นำ Mermaid code ไปวางที่ https://mermaid.live แล้ว export รูปใส่วิทยานิพนธ์

### 3.6.1 การสมัครสมาชิก (Registration)

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant BE as Backend
    participant DB as Database
    User->>FE: เข้าหน้า /register เลือกประเภทสมัคร
    FE->>FE: แสดงฟอร์มสมัคร (Guest/Member)
    User->>FE: กรอก email/phone + password + role
    FE->>BE: POST /api/auth/register/guest หรือ /member
    BE->>BE: Joi validation
    BE->>DB: BEGIN TRANSACTION
    BE->>DB: INSERT users
    BE->>DB: INSERT hirer_profiles / caregiver_profiles
    BE->>DB: INSERT wallets
    BE->>DB: COMMIT
    BE->>BE: สร้าง JWT access + refresh token
    BE-->>FE: { token, refresh_token, user }
    FE->>FE: บันทึก token ใน sessionStorage
    FE-->>User: redirect /select-role
    User->>FE: เลือก role + ยอมรับ policy
    FE->>BE: POST /api/auth/policy/accept
    BE->>DB: UPDATE user_policy_acceptances
    BE-->>FE: 200 OK
    FE-->>User: redirect /hirer/home หรือ /caregiver/jobs/feed
```

### 3.6.2 การเข้าสู่ระบบ (Login)

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant BE as Backend
    participant DB as Database
    User->>FE: เข้าหน้า /login เลือก Email หรือ Phone
    User->>FE: กรอก email/phone + password
    FE->>BE: POST /api/auth/login/email หรือ /login/phone
    BE->>BE: Joi validation + rate limit check
    BE->>DB: SELECT users WHERE email/phone
    BE->>BE: bcrypt.compare(password, hash)
    alt รหัสผ่านถูกต้อง
        BE->>BE: ตรวจ ban_login + status
        BE->>BE: สร้าง JWT access + refresh token
        BE-->>FE: { token, refresh_token, user }
        FE->>FE: บันทึก token ใน sessionStorage
        FE-->>User: redirect ตาม role
    else รหัสผ่านผิด
        BE-->>FE: 401 Unauthorized
        FE-->>User: แสดง error message
    end
```

### 3.6.3 การเข้าสู่ระบบด้วย Google OAuth 2.0

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant BE as Backend
    participant Google as Google OAuth
    participant DB as Database
    User->>FE: กดปุ่ม "Sign in with Google"
    FE->>BE: GET /api/auth/google
    BE-->>FE: redirect → Google Consent Screen
    User->>Google: อนุญาต (grant consent)
    Google-->>BE: GET /api/auth/google/callback?code=xxx
    BE->>Google: แลก code → access_token
    Google-->>BE: { email, name, google_id }
    BE->>DB: SELECT users WHERE email/google_id
    alt ผู้ใช้มีอยู่แล้ว
        BE->>BE: สร้าง JWT
        BE-->>FE: redirect + token
    else ผู้ใช้ใหม่
        BE->>DB: INSERT users + profile + wallet
        BE->>BE: สร้าง JWT
        BE-->>FE: redirect /select-role + token
    end
    FE->>FE: บันทึก token ใน sessionStorage
    FE-->>User: redirect ตาม role
```

### 3.6.4 การยืนยัน OTP

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant BE as Backend
    participant SMS as SMSOK / Nodemailer
    participant DB as Database
    User->>FE: กดขอ OTP (เบอร์โทร/อีเมล)
    FE->>BE: POST /api/otp/phone/send หรือ /email/send
    BE->>BE: สร้าง OTP 6 หลัก (หมดอายุ 5 นาที)
    BE->>DB: INSERT otp record
    BE->>SMS: ส่ง OTP ทาง SMS หรือ Email
    BE-->>FE: 200 OK
    User->>FE: กรอก OTP 6 หลัก
    FE->>BE: POST /api/otp/verify
    BE->>DB: SELECT otp WHERE code + not expired
    alt OTP ถูกต้อง
        BE->>DB: UPDATE is_phone_verified = true
        BE->>DB: UPDATE trust_level = L1 (ถ้ายืนยันโทรศัพท์)
        BE-->>FE: { success: true, trust_level: "L1" }
        FE-->>User: แสดงสำเร็จ + อัปเดต UI
    else OTP ผิด/หมดอายุ
        BE-->>FE: 400 "รหัส OTP ไม่ถูกต้อง"
        FE-->>User: แสดง error
    end
```

### 3.6.5 การสร้างและเผยแพร่งาน (Job Creation & Publishing)

```mermaid
sequenceDiagram
    actor Hirer
    participant FE as Frontend
    participant BE as Backend
    participant DB as Database
    Hirer->>FE: กรอกข้อมูลงาน (wizard form)
    FE->>FE: คำนวณ total_hours จาก start/end
    FE->>BE: POST /api/jobs
    BE->>BE: Joi validation
    BE->>BE: computeRiskLevel()
    BE->>DB: INSERT job_posts (status=draft)
    BE-->>FE: { job_post_id, risk_level }
    FE-->>Hirer: แสดง draft + review summary
    Hirer->>FE: กด Publish
    FE->>BE: POST /api/jobs/:id/publish
    BE->>DB: SELECT trust_level FROM users
    BE->>BE: ตรวจ L1+ (low_risk) หรือ L2+ (high_risk)
    BE->>DB: SELECT available_balance FROM wallets
    BE->>BE: ตรวจ balance ≥ total_amount
    BE->>DB: UPDATE available_balance -= total_amount
    BE->>DB: UPDATE held_balance += total_amount
    BE->>DB: INSERT ledger_transactions (type=hold)
    BE->>DB: UPDATE job_posts status=posted
    BE-->>FE: 200 OK
    FE-->>Hirer: แสดง "เผยแพร่งานสำเร็จ"
```

### 3.6.6 การมอบหมายงานตรง (Direct Assign)

```mermaid
sequenceDiagram
    actor Hirer
    participant FE as Frontend
    participant BE as Backend
    participant DB as Database
    actor CG as Caregiver
    Hirer->>FE: ค้นหาผู้ดูแล → กด "มอบหมายงาน"
    FE->>FE: เลือกงาน draft/posted
    FE->>BE: POST /api/caregivers/assign { job_post_id, caregiver_id }
    BE->>DB: SELECT job_posts (ตรวจเจ้าของ + สถานะ)
    BE->>DB: SELECT users (ตรวจ caregiver active)
    BE->>DB: SELECT job_assignments (ตรวจทับซ้อนเวลา)
    BE->>DB: UPDATE job_posts SET preferred_caregiver_id
    BE->>BE: notifyJobAssigned(caregiver_id)
    BE-->>FE: 200 OK
    FE-->>Hirer: แสดง "มอบหมายสำเร็จ"
    Note over CG: ได้รับ Notification
    CG->>FE: ดูรายละเอียดงาน
    alt ผู้ดูแลรับงาน
        CG->>FE: กด Accept
        FE->>BE: POST /api/jobs/:id/accept
        Note over BE,DB: (ดู Sequence 3.6.7)
    else ผู้ดูแลปฏิเสธ
        CG->>FE: กด Reject + เหตุผล
        FE->>BE: POST /api/jobs/:id/reject
        BE->>DB: UPDATE preferred_caregiver_id = NULL
        BE->>BE: notify hirer
        BE-->>FE: 200 OK
    end
```

### 3.6.7 การรับงาน เช็คอิน และเช็คเอาท์ (Accept, Check-in, Check-out)

```mermaid
sequenceDiagram
    actor CG as Caregiver
    participant FE as Frontend
    participant BE as Backend
    participant DB as Database
    CG->>FE: กด Accept
    FE->>BE: POST /api/jobs/:id/accept
    BE->>DB: SELECT job_posts FOR UPDATE (lock row)
    BE->>BE: ตรวจ trust_level ≥ min_trust_level
    BE->>BE: ตรวจไม่มีงานทับซ้อนเวลา
    BE->>DB: DEDUCT held_balance → CREATE escrow wallet
    BE->>DB: INSERT jobs (instance จริง)
    BE->>DB: INSERT job_assignments (status=active)
    BE->>DB: INSERT chat_threads
    BE->>DB: INSERT ledger_transactions (hold → escrow)
    BE->>BE: notify hirer "ผู้ดูแลรับงานแล้ว"
    BE-->>FE: 200 OK
    Note over CG,DB: ─── ถึงเวลาเริ่มงาน ───
    CG->>FE: กด Check-in
    FE->>FE: ขอ Geolocation จาก Browser
    FE->>BE: POST /api/jobs/:jobId/checkin { lat, lng }
    BE->>DB: INSERT job_gps_events (type=check_in)
    BE->>BE: ตรวจระยะ geofence (100 ม.)
    BE->>DB: UPDATE jobs + job_posts status=in_progress
    BE->>BE: notify hirer "ผู้ดูแลเริ่มงานแล้ว"
    BE-->>FE: 200 OK
    Note over CG,DB: ─── ทำงานจนถึงเวลาสิ้นสุด ───
    CG->>FE: กด Check-out
    FE->>FE: แสดง modal ให้เขียน evidence note
    CG->>FE: กรอก evidence_note
    FE->>BE: POST /api/jobs/:jobId/checkout { lat, lng, evidence_note }
    BE->>DB: INSERT job_gps_events (type=check_out)
    BE->>DB: UPDATE jobs + job_posts status=completed
    BE->>DB: escrow → caregiver wallet (release 90%)
    BE->>DB: escrow → platform wallet (debit 10%)
    BE->>DB: INSERT ledger_transactions (release + debit)
    BE->>BE: notify hirer "งานเสร็จสมบูรณ์"
    BE-->>FE: 200 OK
    BE->>BE: triggerTrustUpdate() [background worker]
```

### 3.6.8 การขอเช็คเอาท์ก่อนเวลา (Early Checkout)

```mermaid
sequenceDiagram
    actor CG as Caregiver
    participant FE as Frontend
    participant BE as Backend
    participant DB as Database
    actor Hirer
    Note over CG: ต้องการส่งงานก่อน scheduled_end_at
    CG->>FE: กด "ส่งงานก่อนเวลา"
    FE->>FE: แสดง modal ให้กรอกเหตุผล
    CG->>FE: กรอก evidence_note
    FE->>BE: POST /api/jobs/:jobId/early-checkout-request
    BE->>DB: INSERT early_checkout_requests (status=pending)
    BE->>BE: notify hirer "มีคำขอส่งงานก่อนเวลา"
    BE-->>FE: 200 OK
    FE-->>CG: แสดง "รอการอนุมัติ"
    Note over Hirer: ได้รับ Notification
    Hirer->>FE: เข้าหน้ารายละเอียดงาน
    FE->>FE: แสดง Early Checkout Card + evidence_note
    alt อนุมัติ
        Hirer->>FE: กด "อนุมัติ"
        FE->>BE: POST /api/jobs/:jobId/early-checkout-respond { action: "approve" }
        BE->>DB: UPDATE status=completed
        BE->>DB: Settlement (escrow → CG + platform)
        BE->>BE: notify caregiver "อนุมัติแล้ว"
        BE-->>FE: 200 OK
    else ปฏิเสธ
        Hirer->>FE: กด "ปฏิเสธ" + เหตุผล
        FE->>BE: POST /api/jobs/:jobId/early-checkout-respond { action: "reject" }
        BE->>DB: UPDATE early_checkout_requests status=rejected
        BE->>BE: notify caregiver "ถูกปฏิเสธ"
        BE-->>FE: 200 OK
    end
    Note over BE: เลย scheduled_end_at + 10 นาที → Auto-complete
```

### 3.6.9 การยกเลิกงาน (Cancel Job)

```mermaid
sequenceDiagram
    actor Hirer
    participant FE as Frontend
    participant BE as Backend
    participant DB as Database
    Hirer->>FE: กด "ยกเลิกงาน"
    FE->>FE: แสดง modal ให้กรอกเหตุผล
    Hirer->>FE: กรอกเหตุผล
    FE->>BE: POST /api/jobs/:id/cancel { reason }
    BE->>DB: SELECT job_posts + jobs (ตรวจสถานะ)
    alt สถานะ = posted (ยังไม่มีผู้รับ)
        BE->>DB: UPDATE held_balance → available_balance
        BE->>DB: INSERT ledger_transactions (type=release)
    else สถานะ = assigned / in_progress (มีผู้รับแล้ว)
        BE->>DB: UPDATE escrow → hirer available_balance
        BE->>DB: INSERT ledger_transactions (type=reversal)
        BE->>DB: UPDATE job_assignments status=cancelled
        BE->>DB: UPDATE chat_threads status=closed
        BE->>BE: notify caregiver "งานถูกยกเลิก"
    end
    BE->>DB: UPDATE job_posts + jobs status=cancelled
    BE-->>FE: 200 OK
    FE-->>Hirer: แสดง "ยกเลิกสำเร็จ เงินคืนแล้ว"
```

### 3.6.10 การเติมเงิน (Top-up Wallet)

```mermaid
sequenceDiagram
    actor Hirer
    participant FE as Frontend
    participant BE as Backend
    participant MP as Mock Provider
    participant DB as Database
    Hirer->>FE: เข้าหน้า Wallet → กดเติมเงิน
    Hirer->>FE: ระบุจำนวนเงิน
    FE->>BE: POST /api/wallet/topup { amount }
    BE->>MP: POST /create-qr { amount, ref }
    MP-->>BE: { qr_payload, ref_id }
    BE->>DB: INSERT topup_intents (status=pending)
    BE-->>FE: { qr_payload }
    FE-->>Hirer: แสดง QR popup
    Hirer->>MP: สแกน QR จ่ายเงิน
    MP->>BE: POST /api/webhooks/payment { ref_id, signature }
    BE->>BE: ตรวจ HMAC-SHA256 signature
    BE->>DB: UPDATE topup_intents status=completed
    BE->>DB: UPDATE wallets available_balance += amount
    BE->>DB: INSERT ledger_transactions (type=credit)
    Hirer->>FE: กด Confirm
    FE->>BE: POST /api/wallet/topup/:topupId/confirm
    BE->>DB: SELECT topup_intents (ตรวจสถานะ)
    BE-->>FE: { status: "completed" }
    FE-->>Hirer: แสดง "เติมเงินสำเร็จ"
```

### 3.6.11 การถอนเงิน (Withdrawal)

```mermaid
sequenceDiagram
    actor CG as Caregiver
    participant FE as Frontend
    participant BE as Backend
    participant DB as Database
    actor Admin
    CG->>FE: เข้าหน้า Wallet → กดถอนเงิน
    CG->>FE: เลือกบัญชีธนาคาร + ระบุจำนวน
    FE->>BE: POST /api/wallet/withdraw { amount, bank_account_id }
    BE->>BE: ตรวจ trust_level ≥ L2
    BE->>DB: SELECT available_balance (ตรวจยอด)
    BE->>DB: UPDATE available_balance -= amount
    BE->>DB: INSERT withdrawal_requests (status=pending)
    BE-->>FE: 200 OK
    FE-->>CG: แสดง "รอ Admin อนุมัติ"
    Note over Admin: Admin ดูรายการถอนเงิน
    Admin->>BE: POST /api/wallet/admin/withdrawals/:id/approve
    BE->>DB: UPDATE withdrawal_requests status=approved
    Admin->>BE: POST /api/wallet/admin/withdrawals/:id/mark-paid
    BE->>DB: UPDATE withdrawal_requests status=paid
    BE->>DB: INSERT ledger_transactions (type=debit)
    BE->>BE: notify caregiver "ถอนเงินสำเร็จ"
```

### 3.6.12 การแชทแบบเรียลไทม์ (Real-time Chat)

```mermaid
sequenceDiagram
    participant H as Hirer
    participant S as Socket.IO Server
    participant DB as Database
    participant CG as Caregiver
    H->>S: connect (JWT auth)
    CG->>S: connect (JWT auth)
    S->>S: verify JWT → join user room
    H->>S: thread:join { threadId }
    CG->>S: thread:join { threadId }
    S-->>H: thread:joined
    S-->>CG: thread:joined
    H->>S: typing:start
    S-->>CG: typing:started
    H->>S: typing:stop
    S-->>CG: typing:stopped
    H->>S: message:send { content }
    S->>DB: INSERT chat_messages
    S-->>H: message:new { id, content, sender }
    S-->>CG: message:new { id, content, sender }
    CG->>S: message:read { messageId }
    S->>DB: UPDATE read_at
    S-->>H: message:read { messageId }
```

### 3.6.13 การแจ้งเตือน (Notification — Dual Channel)

```mermaid
sequenceDiagram
    participant BE as Backend
    participant DB as Database
    participant SIO as Socket.IO
    participant FE as Frontend
    actor User
    Note over BE: เหตุการณ์สำคัญเกิดขึ้น (เช่น CG รับงาน)
    BE->>DB: INSERT notifications (status=queued)
    BE->>SIO: emitToUserRoom(userId, "notification:new")
    alt ผู้ใช้ออนไลน์ (Socket connected)
        SIO-->>FE: notification:new { data }
        FE->>FE: Badge +1 + Toast
    else ผู้ใช้ออฟไลน์
        Note over FE: Polling ทุก 15 วินาที
        FE->>BE: GET /api/notifications/unread-count
        BE->>DB: SELECT COUNT(*) WHERE read_at IS NULL
        BE-->>FE: { count }
        FE->>FE: อัปเดต Badge
    end
    Note over FE: เมื่อ Socket reconnect / focus / online
    FE->>BE: GET /api/notifications/unread-count
    BE-->>FE: { count }
    User->>FE: เปิดหน้า /notifications
    FE->>BE: GET /api/notifications
    BE-->>FE: [ notification list ]
    User->>FE: กดอ่าน
    FE->>BE: POST /api/notifications/:id/read
    BE->>DB: UPDATE read_at = NOW()
    FE->>FE: Badge -1
```

### 3.6.14 การยืนยัน KYC (KYC Verification)

```mermaid
sequenceDiagram
    actor User
    participant FE as Frontend
    participant BE as Backend
    participant DB as Database
    actor Admin
    User->>FE: เข้าหน้า /kyc
    User->>FE: อัปโหลดบัตรประชาชน (หน้า+หลัง) + selfie
    FE->>BE: POST /api/kyc/submit (multipart form)
    BE->>BE: บันทึกไฟล์ (multer)
    BE->>DB: INSERT user_kyc_info (status=pending)
    BE-->>FE: 200 OK
    FE-->>User: แสดง "รอ Admin ตรวจสอบ"
    Note over Admin: Admin ดูรายการ KYC pending
    Admin->>BE: GET /api/admin/users?kyc=pending
    BE-->>Admin: รายการผู้ใช้ที่รอ KYC
    Admin->>Admin: ตรวจสอบเอกสาร
    alt อนุมัติ
        Admin->>BE: POST /api/admin/users/:id/status { status: "active" }
        BE->>DB: UPDATE kyc_status = approved
        BE->>DB: UPDATE trust_level = L2
        BE->>BE: notify user "KYC อนุมัติแล้ว"
    else ปฏิเสธ
        Admin->>BE: POST /api/admin/users/:id/status { kyc: "rejected", reason }
        BE->>DB: UPDATE kyc_status = rejected
        BE->>BE: notify user "KYC ถูกปฏิเสธ" + เหตุผล
    end
```

### 3.6.15 การเปิดและตัดสินข้อพิพาท (Dispute Flow)

```mermaid
sequenceDiagram
    actor Opener as ผู้เปิด (Hirer/CG)
    participant FE as Frontend
    participant BE as Backend
    participant DB as Database
    actor Admin
    actor Other as อีกฝ่าย
    Opener->>FE: กด "เปิดข้อพิพาท"
    Opener->>FE: กรอกเหตุผล
    FE->>BE: POST /api/disputes { job_id, reason }
    BE->>DB: INSERT disputes (status=open)
    BE->>BE: notify Admin + อีกฝ่าย
    BE-->>FE: { dispute_id }
    FE-->>Opener: redirect /dispute/:disputeId
    Note over Opener,Other: ทั้ง 2 ฝ่ายส่งหลักฐาน
    Opener->>BE: POST /api/disputes/:id/messages { content }
    BE->>DB: INSERT dispute_messages
    Other->>BE: POST /api/disputes/:id/messages { content }
    BE->>DB: INSERT dispute_messages
    Note over Admin: Admin รับมอบหมาย
    Admin->>BE: POST /api/admin/disputes/:id { assign_to_me: true }
    BE->>DB: UPDATE assigned_admin_id, status=in_review
    Note over Admin: Admin อ่านหลักฐาน แล้วตัดสิน
    Admin->>BE: POST /api/admin/disputes/:id/settle
    BE->>DB: escrow → hirer (refund) และ/หรือ escrow → CG (payout)
    BE->>DB: INSERT ledger_transactions
    BE->>DB: UPDATE disputes status=resolved
    BE->>BE: notify ทั้ง 2 ฝ่าย "ข้อพิพาทได้รับการตัดสินแล้ว"
```

---

## 3.7 การออกแบบส่วนติดต่อผู้ใช้ (UI Design)

> 📌 **NOTE**: ในรูปเล่มจริงควรแทรก screenshot หน้าจอจริงประกอบแต่ละกลุ่ม

**ตาราง 3.17** หน้าจอ Public

| URL | หน้าจอ | คำอธิบาย |
|-----|-------|---------|
| / | LandingPage | แนะนำระบบ, featured caregivers |
| /about | AboutPage | เกี่ยวกับแพลตฟอร์ม |
| /faq | FAQPage | คำถามที่พบบ่อย |
| /contact | ContactPage | ติดต่อเรา |

**ตาราง 3.18** หน้าจอ Authentication (11 หน้า)

| URL | หน้าจอ | คำอธิบาย |
|-----|-------|---------|
| /login | LoginEntryPage | เลือก email/phone/google |
| /login/email | LoginEmailPage | login ด้วย email |
| /login/phone | LoginPhonePage | login ด้วยเบอร์โทร |
| /auth/callback | AuthCallbackPage | Google OAuth callback |
| /register | RegisterTypePage | เลือกประเภทสมัคร |
| /register/guest | GuestRegisterPage | สมัครด้วย email |
| /register/member | MemberRegisterPage | สมัครด้วยเบอร์โทร |
| /select-role | RoleSelectionPage | เลือก Hirer/Caregiver |
| /register/consent | ConsentPage | ยอมรับ policy |
| /forgot-password | ForgotPasswordPage | ขอลิงก์ reset |
| /reset-password | ResetPasswordPage | ตั้งรหัสผ่านใหม่ |

**ตาราง 3.19** หน้าจอ Hirer (11 หน้า)

| URL | หน้าจอ | คำอธิบาย |
|-----|-------|---------|
| /hirer/home | HirerHomePage | รายการงาน, ปฏิทิน, สถิติ |
| /hirer/create-job | CreateJobPage | สร้างงาน (wizard form) |
| /hirer/search-caregivers | SearchCaregiversPage | ค้นหา + Direct Assign |
| /hirer/caregiver/:id | CaregiverPublicProfilePage | โปรไฟล์ผู้ดูแล |
| /hirer/care-recipients | CareRecipientsPage | จัดการผู้รับการดูแล |
| /hirer/care-recipients/new | CareRecipientFormPage | เพิ่มผู้รับการดูแล |
| /hirer/care-recipients/:id/edit | CareRecipientFormPage | แก้ไขผู้รับการดูแล |
| /hirer/wallet | HirerWalletPage | กระเป๋าเงิน |
| /hirer/wallet/receipt/:jobId | JobReceiptPage | ใบเสร็จต่องาน |
| /hirer/wallet/history | HirerPaymentHistoryPage | ประวัติชำระเงิน |
| /hirer/favorites | FavoritesPage | caregiver ที่บันทึก |

**ตาราง 3.20** หน้าจอ Caregiver (7 หน้า)

| URL | หน้าจอ | คำอธิบาย |
|-----|-------|---------|
| /caregiver/jobs/feed | CaregiverJobFeedPage | ดูประกาศงาน |
| /caregiver/jobs/my-jobs | CaregiverMyJobsPage | งานที่รับ, check-in/out |
| /caregiver/jobs/:id/preview | JobPreviewPage | ดูงานก่อนรับ |
| /caregiver/profile | ProfilePage | โปรไฟล์ |
| /caregiver/wallet | CaregiverWalletPage | กระเป๋าเงิน |
| /caregiver/wallet/earning/:jobId | JobEarningDetailPage | รายได้ต่องาน |
| /caregiver/wallet/history | EarningsHistoryPage | ประวัติรายได้ |

**ตาราง 3.21** หน้าจอ Shared (8 หน้า)

| URL | หน้าจอ | คำอธิบาย |
|-----|-------|---------|
| /jobs/:id | JobDetailPage | รายละเอียดงาน |
| /chat/:jobId | ChatRoomPage | ห้องแชท |
| /dispute/:disputeId | DisputeChatPage | ห้องข้อพิพาท |
| /notifications | NotificationsPage | ประวัติแจ้งเตือน |
| /profile | ProfilePage | โปรไฟล์ส่วนตัว |
| /settings | SettingsPage | ตั้งค่าบัญชี |
| /kyc | KycPage | KYC verification |
| /wallet/bank-accounts | BankAccountsPage | จัดการบัญชีธนาคาร |

**ตาราง 3.22** หน้าจอ Admin (8 หน้า)

| URL | หน้าจอ | คำอธิบาย |
|-----|-------|---------|
| /admin/login | AdminLoginPage | Login Admin |
| /admin/dashboard | AdminDashboardPage | ภาพรวม, สถิติ |
| /admin/users | AdminUsersPage | จัดการ user, KYC |
| /admin/jobs | AdminJobsPage | ดู/ยกเลิกงาน |
| /admin/financial | AdminFinancialPage | ledger transactions |
| /admin/disputes | AdminDisputesPage | settle disputes |
| /admin/reports | AdminReportsPage | รายงานสรุป |
| /admin/settings | AdminSettingsPage | ตั้งค่าระบบ |

---

## 3.8 การออกแบบฐานข้อมูล (Database Design)

### 3.8.1 ER Diagram

> 📌 **DIAGRAM: ER Diagram** — นำโค้ดนี้ไปวางที่ https://dbdiagram.io/d

```dbml
Table users {
  id UUID [pk]
  email VARCHAR [unique]
  phone_number VARCHAR [unique]
  role user_role [not null]
  trust_level trust_level [default: 'L0']
  trust_score INT [default: 0]
  status user_status [default: 'active']
}
Table hirer_profiles {
  id UUID [pk]
  user_id UUID [ref: - users.id, unique]
  display_name VARCHAR
}
Table caregiver_profiles {
  id UUID [pk]
  user_id UUID [ref: - users.id, unique]
  display_name VARCHAR
  average_rating NUMERIC
}
Table patient_profiles {
  id UUID [pk]
  hirer_id UUID [ref: > users.id]
  patient_display_name VARCHAR
}
Table job_posts {
  id UUID [pk]
  hirer_id UUID [ref: > users.id]
  patient_profile_id UUID [ref: > patient_profiles.id]
  preferred_caregiver_id UUID [ref: > users.id]
  status job_status
  risk_level risk_level
}
Table jobs {
  id UUID [pk]
  job_post_id UUID [ref: > job_posts.id]
  hirer_id UUID [ref: > users.id]
  status job_status
}
Table job_assignments {
  id UUID [pk]
  job_id UUID [ref: > jobs.id]
  caregiver_id UUID [ref: > users.id]
  status assignment_status
}
Table wallets {
  id UUID [pk]
  user_id UUID [ref: > users.id]
  job_id UUID [ref: > jobs.id]
  wallet_type VARCHAR
  available_balance BIGINT
  held_balance BIGINT
}
Table ledger_transactions {
  id UUID [pk]
  from_wallet_id UUID [ref: > wallets.id]
  to_wallet_id UUID [ref: > wallets.id]
  amount BIGINT
  type transaction_type
  idempotency_key VARCHAR [unique]
}
Table chat_threads {
  id UUID [pk]
  job_id UUID [ref: - jobs.id]
  status VARCHAR
}
Table chat_messages {
  id UUID [pk]
  thread_id UUID [ref: > chat_threads.id]
  sender_id UUID [ref: > users.id]
  type chat_message_type
}
Table disputes {
  id UUID [pk]
  job_post_id UUID [ref: > job_posts.id]
  opened_by_user_id UUID [ref: > users.id]
  assigned_admin_id UUID [ref: > users.id]
  status dispute_status
}
Table notifications {
  id UUID [pk]
  user_id UUID [ref: > users.id]
  status notification_status
}
Table caregiver_reviews {
  id UUID [pk]
  job_id UUID [ref: > jobs.id]
  reviewer_id UUID [ref: > users.id]
  caregiver_id UUID [ref: > users.id]
  rating INT
}
```

### 3.8.2 รายละเอียดตารางหลัก

ตารางหลักของระบบประกอบด้วย users ซึ่งเก็บข้อมูลผู้ใช้ทุกคน มี UUID primary key, email (UNIQUE, nullable), phone_number (UNIQUE, nullable), password_hash (bcrypt), account_type (guest/member), role (hirer/caregiver/admin), trust_level (L0-L3 เป็น derived state), trust_score (0-100) และ ban flags 4 ตัว (ban_login, ban_job_create, ban_job_accept, ban_withdraw)

ตาราง job_posts เก็บประกาศงานเป็นตารางแรกใน two-table pattern มี job_type (6 ค่า), risk_level (auto-computed), schedule, GPS coordinates, geofence_radius_m (default 100), hourly_rate, total_amount, platform_fee_amount (default 10%), min_trust_level, task flags และ replacement_chain_count (max 3) ตาราง jobs เก็บ instance จริงสร้างเมื่อ Accept การแยก 2 ตารางรองรับ replacement chain สูงสุด 3 ครั้งต่อประกาศ

ตาราง wallets มี available_balance และ held_balance (BIGINT, CHECK ≥ 0) แยก 5 ประเภท ตาราง ledger_transactions เป็น immutable (DB trigger ห้าม UPDATE/DELETE) มี idempotency_key (UNIQUE)

### 3.8.3 Database Enums

**ตาราง 3.23** Database Enums

| ENUM Type | Values |
|-----------|--------|
| user_role | hirer, caregiver, admin |
| user_status | active, suspended, deleted |
| trust_level | L0, L1, L2, L3 |
| job_status | draft, posted, assigned, in_progress, completed, cancelled, expired |
| job_type | companionship, personal_care, medical_monitoring, dementia_care, post_surgery, emergency |
| risk_level | low_risk, high_risk |
| assignment_status | active, replaced, completed, cancelled |
| transaction_type | credit, debit, hold, release, reversal |
| kyc_status | pending, approved, rejected, expired |
| dispute_status | open, in_review, resolved, rejected |
| notification_status | queued, sent, delivered, read, failed |
| chat_message_type | text, image, file, system |
| gps_event_type | check_in, check_out, ping |
