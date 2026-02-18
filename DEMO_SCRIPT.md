# CareConnect — Demo Script (5–10 นาที)

## ก่อนเริ่มเดโม

### เตรียมระบบ
```bash
docker-compose up -d
# รอ ~30 วินาที
# เปิด browser: http://localhost:5173
```

### เตรียม accounts
- **Admin**: admin@careconnect.com / Admin1234!
- **Mock Caregivers**: caregiver.mock1@careconnect.local / DemoCare123!
- จะสมัคร Hirer account ใหม่ตอน demo

---

## Part 1: แนะนำระบบ (1 นาที)

**พูด**: "CareConnect เป็น Web Platform สำหรับเชื่อมต่อผู้ว่าจ้างกับผู้ดูแลผู้สูงอายุ ระบบมี 3 roles: ผู้ว่าจ้าง, ผู้ดูแล, และ Admin"

**โชว์**: หน้า Landing Page → ชี้ให้เห็น:
- Hero section อธิบายระบบ
- ปุ่ม "เริ่มต้นใช้งาน"
- เมนู About, FAQ, Contact

---

## Part 2: สมัครสมาชิก & Login (2 นาที)

### 2.1 สมัคร Hirer (ผู้ว่าจ้าง)
1. กด **"สมัครสมาชิก"**
2. เลือก **"สมัครแบบ Guest (Email)"**
3. กรอก: `demo.hirer@test.com` / password: `Demo1234!`
4. กด **สมัคร**

**พูด**: "ระบบรองรับ 2 แบบ: Guest (email) สำหรับทดลองใช้ และ Member (เบอร์โทร+OTP) สำหรับใช้งานจริง"

### 2.2 เลือก Role
1. เลือก **"ผู้ว่าจ้าง (Hirer)"**

**พูด**: "ผู้ใช้เลือก role ได้ตอนสมัคร แต่ละ role มีสิทธิ์ต่างกัน"

### 2.3 ยอมรับ Policy
1. อ่าน Policy → กดยอมรับ

**พูด**: "ทุก role ต้องยอมรับข้อกำหนดก่อนใช้งาน เก็บ record ไว้ใน database"

### 2.4 สร้าง Profile
1. กรอกชื่อที่แสดง เช่น "คุณสมชาย ผู้ว่าจ้าง"
2. กด **บันทึก**

**พูด**: "ระบบบังคับให้ตั้งชื่อก่อนใช้งาน เพื่อความปลอดภัย ไม่แสดง email/phone ให้ผู้อื่นเห็น"

---

## Part 3: ฟีเจอร์ผู้ว่าจ้าง (3 นาที)

### 3.1 หน้าหลัก Hirer
- **โชว์**: Dashboard แสดงสรุปงาน + Quick Actions
- **ชี้**: สถานะงาน (Draft, Posted, In Progress, Completed)

### 3.2 สร้างผู้รับการดูแล (Care Recipient)
1. ไปที่ **"ผู้รับการดูแล"**
2. กด **"เพิ่ม"**
3. กรอก: ชื่อ "คุณยาย", อายุ 75, เพศหญิง
4. เลือก: mobility = needs_assistance, โรคเรื้อรัง = ความดันสูง
5. กด **บันทึก**

**พูด**: "ข้อมูลผู้ป่วยเก็บแบบ persistent ไม่ต้องกรอกซ้ำ และระบบจะคำนวณความเสี่ยงอัตโนมัติ"

### 3.3 สร้างงาน (Job)
1. ไปที่ **"สร้างงานใหม่"**
2. เลือกผู้รับการดูแล → ระบบแนะนำงานที่เกี่ยวข้อง
3. กรอก: ชื่องาน "ดูแลคุณยาย ช่วงเช้า", รายละเอียด, ประเภท "personal_care"
4. กรอกเวลา, สถานที่, ค่าจ้าง
5. **โชว์**: Risk Level คำนวณอัตโนมัติ (สูง/ต่ำ)
6. กด **สร้างแบบร่าง**

**พูด**: "ระบบคำนวณ Risk Level จากข้อมูลผู้ป่วย + ประเภทงาน เพื่อกำหนดระดับ Trust ที่ต้องการ"

### 3.4 Wallet & Top-up
1. ไปที่ **"กระเป๋าเงิน"**
2. กด **"เติมเงิน"** → ใส่จำนวน 5000
3. ระบบสร้าง QR → Mock Payment auto-success หลัง 3 วินาที
4. **โชว์**: ยอดเงินเพิ่มขึ้น

**พูด**: "ระบบ Wallet ใช้ Escrow model — เงินถูกล็อคเมื่อเผยแพร่งาน และปล่อยเมื่องานเสร็จ ใช้ Immutable Ledger สำหรับ audit trail"

### 3.5 ค้นหาผู้ดูแล
1. ไปที่ **"ค้นหาผู้ดูแล"**
2. **โชว์**: รายชื่อผู้ดูแล พร้อม Trust Level, ประสบการณ์, specialization
3. **โชว์**: Filter ตาม specialization

**พูด**: "ผู้ว่าจ้างสามารถค้นหาผู้ดูแลที่เหมาะสม ดู Trust Level และประสบการณ์"

---

## Part 4: ฟีเจอร์ผู้ดูแล (2 นาที)

### 4.1 Login เป็น Caregiver
1. Logout จาก Hirer
2. Login ด้วย `caregiver.mock1@careconnect.local` / `DemoCare123!`

### 4.2 Job Feed
1. **โชว์**: รายการงานที่เผยแพร่ (ถ้ามี)
2. **ชี้**: Filter ตาม job type, location, rate

**พูด**: "ผู้ดูแลเห็นเฉพาะงานที่ตรงกับ Trust Level ของตัวเอง"

### 4.3 My Jobs
1. ไปที่ **"งานของฉัน"**
2. **โชว์**: สถานะงาน (Assigned, In Progress, Completed)

### 4.4 Caregiver Wallet
1. ไปที่ **"กระเป๋าเงิน"**
2. **โชว์**: รายได้, ประวัติธุรกรรม

---

## Part 5: Admin Panel (1 นาที)

### 5.1 Login Admin
1. ไปที่ `/admin/login`
2. Login: `admin@careconnect.com` / `Admin1234!`

### 5.2 Dashboard & Management
- **โชว์**: Admin Dashboard — สรุปจำนวนผู้ใช้, งาน, ธุรกรรม
- **โชว์**: User Management — รายชื่อผู้ใช้ทั้งหมด
- **โชว์**: Job Management — รายชื่องานทั้งหมด
- **โชว์**: Dispute Management — ข้อพิพาท
- **โชว์**: Financial Reports

**พูด**: "Admin สามารถจัดการผู้ใช้, ตรวจสอบงาน, แก้ข้อพิพาท, และดูรายงานการเงินทั้งหมด"

---

## Part 6: สรุปสถาปัตยกรรม (1 นาที)

**โชว์**: เปิด `ARCHITECTURE.md` หรือ slides

**พูด**: 
- "ระบบใช้ React + Express + PostgreSQL ทั้งหมดรันใน Docker Compose"
- "Database ใช้ Immutable Ledger สำหรับธุรกรรมการเงิน ป้องกัน UPDATE/DELETE"
- "Chat ใช้ WebSocket (Socket.IO) สำหรับ real-time messaging"
- "ทุก external service ใช้ Mock Provider — พร้อม swap เป็น provider จริงได้"
- "มี Trust Level system (L0–L3) สำหรับจัดระดับความน่าเชื่อถือ"

---

## Q&A Tips

**คำถามที่อาจถูกถาม:**

| คำถาม | คำตอบ |
|-------|-------|
| "Payment ใช้อะไร?" | "ปัจจุบันใช้ Mock Payment Gateway จำลอง QR Payment แต่สถาปัตยกรรมรองรับ swap เป็น PromptPay/Omise ได้" |
| "GPS ป้องกันโกงยังไง?" | "เก็บ confidence_score, cell tower comparison, fraud_indicators flags ใน database" |
| "ทำไมต้อง Escrow?" | "เพื่อป้องกันทั้ง 2 ฝ่าย — hirer ไม่จ่ายเงิน หรือ caregiver ไม่ทำงาน เงินล็อคจนกว่างานจะเสร็จ" |
| "Immutable Ledger คืออะไร?" | "ตาราง ledger_transactions ห้าม UPDATE/DELETE มี DB trigger ป้องกัน ใช้ reversal transaction แทน" |
| "Test มีอะไรบ้าง?" | "Backend 9 unit tests + 4 integration tests, Frontend 11 test files ครอบคลุม Auth, Guards, API client" |
