# บทที่ 1 บทนำ (บางส่วน)

---

## 1.5 แผนการดำเนินงาน

การพัฒนาระบบ CareConnect ดำเนินการตั้งแต่เดือนกรกฎาคม พ.ศ. 2568 ถึงเดือนมีนาคม พ.ศ. 2569 รวมระยะเวลา 9 เดือน โดยแบ่งการดำเนินงานออกเป็น 15 กิจกรรมหลัก ครอบคลุมตั้งแต่การศึกษาค้นคว้าข้อมูล การออกแบบระบบ การพัฒนา การทดสอบ จนถึงการจัดทำเอกสารวิทยานิพนธ์ รายละเอียดดังตาราง 1.1

**ตาราง 1.1** แผนการดำเนินงานโครงงาน CareConnect

| ลำดับ | กิจกรรม | ก.ค. 68 | ส.ค. 68 | ก.ย. 68 | ต.ค. 68 | พ.ย. 68 | ธ.ค. 68 | ม.ค. 69 | ก.พ. 69 | มี.ค. 69 |
|:-----:|---------|:-------:|:-------:|:-------:|:-------:|:-------:|:-------:|:-------:|:-------:|:--------:|
| 1 | ศึกษาปัญหาและความต้องการของตลาดบริการดูแลผู้สูงอายุ | ★ | ★ | | | | | | | |
| 2 | ศึกษาเทคโนโลยีและเครื่องมือที่ใช้ในการพัฒนา | ★ | ★ | ★ | | | | | | |
| 3 | วิเคราะห์ความต้องการเชิงฟังก์ชันและกำหนด Use Cases | | ★ | ★ | | | | | | |
| 4 | ออกแบบสถาปัตยกรรมระบบ (3-Tier Architecture) | | | ★ | ★ | | | | | |
| 5 | ออกแบบฐานข้อมูล (ERD, Schema 25+ tables) | | | ★ | ★ | | | | | |
| 6 | ออกแบบ UI/UX (Wireframe, Mobile-first 360×800) | | | ★ | ★ | | | | | |
| 7 | พัฒนา Backend — Authentication, Profile, Trust Level | | | | ★ | ★ | | | | |
| 8 | พัฒนา Backend — Job System, Escrow Payment, Wallet | | | | | ★ | ★ | | | |
| 9 | พัฒนา Backend — Chat, Notification, Dispute, Admin | | | | | | ★ | ★ | | |
| 10 | พัฒนา Frontend — Authentication, Profile, KYC | | | | ★ | ★ | | | | |
| 11 | พัฒนา Frontend — Job Management, Search, Favorites | | | | | ★ | ★ | | | |
| 12 | พัฒนา Frontend — Chat, Wallet, Notification, Admin | | | | | | ★ | ★ | | |
| 13 | ทดสอบระบบ (Functional, API, Unit Testing) | | | | | | ★ | ★ | ★ | |
| 14 | แก้ไขข้อบกพร่องและปรับปรุงระบบ | | | | | | | ★ | ★ | ★ |
| 15 | จัดทำเอกสารวิทยานิพนธ์และนำเสนอโครงงาน | | | | | | | | ★ | ★ |

**หมายเหตุ:** ★ = ช่วงเวลาที่ดำเนินกิจกรรม

### คำอธิบายกิจกรรม

**กิจกรรมที่ 1 — ศึกษาปัญหาและความต้องการของตลาดบริการดูแลผู้สูงอายุ**
ศึกษาสถานการณ์ผู้สูงอายุในประเทศไทย ปัญหาการเข้าถึงบริการดูแล วิเคราะห์แพลตฟอร์มที่มีอยู่ เช่น Care.com, HomeCare.com และ Kiidu รวมถึงงานวิจัยที่เกี่ยวข้องกับ Two-sided Marketplace สำหรับบริการสุขภาพ

**กิจกรรมที่ 2 — ศึกษาเทคโนโลยีและเครื่องมือที่ใช้ในการพัฒนา**
ศึกษา React 18, TypeScript, Vite, TailwindCSS สำหรับ Frontend และ Node.js, Express.js, PostgreSQL, Socket.IO, JWT สำหรับ Backend รวมถึง Docker Compose สำหรับจัดการสภาพแวดล้อมการพัฒนา

**กิจกรรมที่ 3 — วิเคราะห์ความต้องการเชิงฟังก์ชันและกำหนด Use Cases**
กำหนด Functional Requirements ของระบบครอบคลุม 8 โมดูล (Authentication, Profile, Job Management, Job Execution, Payment, Communication, Dispute, Admin) และออกแบบ Use Case Diagram รวม 36 Use Cases สำหรับ 4 บทบาท (Guest, Hirer, Caregiver, Admin)

**กิจกรรมที่ 4 — ออกแบบสถาปัตยกรรมระบบ**
ออกแบบระบบตามแนวคิด 3-Tier Architecture แบ่งเป็น Presentation Layer (React SPA), Application Layer (Express.js + Socket.IO) และ Data Layer (PostgreSQL) รวมถึงออกแบบ Trust Level System, Policy Gate, Payment Flow (Double-entry Ledger) และ Job Lifecycle (Two-table Pattern)

**กิจกรรมที่ 5 — ออกแบบฐานข้อมูล**
ออกแบบ Entity-Relationship Diagram และ Database Schema จำนวน 40 ตาราง ครอบคลุม Users, Profiles, Jobs, Wallets, Ledger Transactions, Chat, Notifications, Disputes, KYC, Reviews และ Favorites โดยใช้หลักการ Immutable Ledger, Derived State และ Constraint Integrity

**กิจกรรมที่ 6 — ออกแบบ UI/UX**
ออกแบบ Wireframe และ User Interface แบบ Mobile-first สำหรับหน้าจอขนาด 360×800 พิกเซล ครอบคลุมหน้าจอสำหรับทั้ง 3 บทบาท (Hirer, Caregiver, Admin) โดยใช้ TailwindCSS Utility Classes และ Lucide Icons

**กิจกรรมที่ 7 — พัฒนา Backend ส่วน Authentication, Profile, Trust Level**
พัฒนาระบบสมัครสมาชิก 3 ช่องทาง (Email, Phone, Google OAuth), JWT + Refresh Token, OTP Verification, KYC Document Upload, Trust Level L0-L3 พร้อม Trust Score Worker และ Policy Gate System

**กิจกรรมที่ 8 — พัฒนา Backend ส่วน Job System, Escrow Payment, Wallet**
พัฒนาระบบจัดการงาน (Create, Publish, Accept, Check-in/out, Early Checkout, Cancel), ระบบ Escrow Payment (Hold, Release, Refund), Wallet (Top-up, Withdrawal), Bank Account Management และ Double-entry Ledger

**กิจกรรมที่ 9 — พัฒนา Backend ส่วน Chat, Notification, Dispute, Admin**
พัฒนาระบบ Real-time Chat ด้วย Socket.IO แบบ Thread-based, ระบบแจ้งเตือนแบบ 2 ชั้น (Socket.IO + Polling Fallback), ระบบจัดการข้อพิพาท และระบบ Admin สำหรับจัดการ Users, KYC Review, Dispute Settlement และ Reports

**กิจกรรมที่ 10 — พัฒนา Frontend ส่วน Authentication, Profile, KYC**
พัฒนาหน้า Register, Login, Select Role, Profile Management, OTP Verification, KYC Document Upload, Care Recipients Management และ Caregiver Documents

**กิจกรรมที่ 11 — พัฒนา Frontend ส่วน Job Management, Search, Favorites**
พัฒนาหน้าสร้างงาน (Wizard Form), Job Feed, Job Detail, Direct Assign, Caregiver Search (Multi-filter), Caregiver Detail Modal และ Favorites System

**กิจกรรมที่ 12 — พัฒนา Frontend ส่วน Chat, Wallet, Notification, Admin**
พัฒนาหน้า Chat Room, QR Code Top-up, Wallet Dashboard, Withdrawal, Notification Center, Admin Dashboard, User Management, KYC Review และ Dispute Management

**กิจกรรมที่ 13 — ทดสอบระบบ**
ทดสอบ Functional Testing ครอบคลุม 8 โมดูล ด้วย Manual Testing (Multi-tab Multi-role), API Testing และ Unit Testing (Jest) ตรวจสอบ Trust Level Policy Gate, Payment Flow, Real-time Features และ Accessibility (WCAG 2.1 AA)

**กิจกรรมที่ 14 — แก้ไขข้อบกพร่องและปรับปรุงระบบ**
แก้ไข Bug ที่พบจากการทดสอบ ปรับปรุง UI/UX ตาม Feedback เพิ่มประสิทธิภาพระบบ เช่น Trust Score Background Worker, Notification Fallback Polling, Session Isolation (sessionStorage) และ Idempotency Key สำหรับ Payment

**กิจกรรมที่ 15 — จัดทำเอกสารวิทยานิพนธ์และนำเสนอโครงงาน**
จัดทำเอกสารวิทยานิพนธ์ 5 บท เตรียมสไลด์นำเสนอ และนำเสนอโครงงานต่อคณะกรรมการ
