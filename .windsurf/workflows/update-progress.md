---
description: อัพเดท PROGRESS.md และ SYSTEM.md หลังทำงานเสร็จ (ทำทุกครั้งโดยอัตโนมัติ)
---

## หมายเหตุ
- Workflow นี้ต้องทำ **ทุกครั้ง** หลังทำงานเสร็จ ไม่ต้องรอให้ user สั่ง
- ถูกเรียกจาก workflow `/commit` อัตโนมัติ (step 6)
- ถ้าต้อง commit เพิ่มหลังอัพเดท docs → `git add -A && git commit --amend --no-edit`

---

## ส่วนที่ 1 — อัพเดท PROGRESS.md (ทำทุกครั้ง)

1. อ่าน `PROGRESS.md` ปัจจุบัน
2. อัพเดท **วันที่** บรรทัดแรก: `> อัพเดทล่าสุด: YYYY-MM-DD`
3. อัพเดทส่วน **Git Log** — เพิ่ม entry ใหม่ **ด้านบนสุด** ของ section:
   ```
   ### YYYY-MM-DD — ชื่องานสั้นๆ
   - type(scope): รายละเอียดสิ่งที่ทำ
   - type(scope): รายละเอียดเพิ่มเติม (ถ้ามี)
   - ไฟล์ที่แก้: xxx.tsx, xxx.js, ...
   ```
4. อัพเดทส่วน **ระบบหลักที่ Implement แล้ว**:
   - tick `[x]` ฟีเจอร์ที่ implement ใหม่
   - เพิ่ม bullet ใหม่ถ้าเป็นฟีเจอร์ที่ยังไม่มีในลิสต์
5. อัพเดทส่วน **สิ่งที่ยังค้างอยู่ / TODO**:
   - tick `[x]` งานที่เสร็จแล้ว
   - เพิ่ม `[ ]` งานใหม่ที่ค้นพบระหว่างทำ
6. อัพเดทส่วน **ไฟล์สำคัญที่ต้องรู้จัก** — ถ้ามีไฟล์ใหม่ที่สำคัญ

---

## ส่วนที่ 2 — อัพเดท SYSTEM.md (ทำเมื่อมีการเปลี่ยนแปลง)

ตรวจสอบว่างานที่ทำ trigger condition ข้อไหนบ้าง แล้วอัพเดท section ที่เกี่ยวข้อง:

### Trigger: เพิ่ม/แก้ Database Table หรือ Column
อัพเดท section ต่อไปนี้:
- **Section 5. Database Schema (ERD)** — เพิ่ม table/column ใหม่ใน subsection ที่เกี่ยวข้อง:
  - 5.1 Users & Profiles
  - 5.2 Job System (Two-table Pattern)
  - 5.3 Patient & Job Requirements
  - 5.4 GPS & Photo Evidence
  - 5.5 Financial System
  - 5.6 Chat & Disputes
  - 5.7 Other Tables

### Trigger: เพิ่ม/แก้ API Route
อัพเดท section ต่อไปนี้:
- **Section 7. API Routes Overview** — เพิ่ม/แก้ endpoint ใน group ที่เกี่ยวข้อง (15 route groups)
- **Section 11. Middleware Chain & Policy Gate System** — เพิ่ม policy action ใน `can()` matrix ถ้ามี action ใหม่

### Trigger: เพิ่มหน้า Frontend ใหม่
อัพเดท section ต่อไปนี้:
- **Section 8. Frontend Page Map** — เพิ่ม route + component + guards

### Trigger: เพิ่ม/แก้ Business Flow
อัพเดท section ต่อไปนี้:
- **Section 6. Sequence Diagrams** — เพิ่ม/แก้ diagram
- **Section 3. Job Lifecycle** — ถ้าเกี่ยวกับ job flow
- **Section 4. Payment Flow** — ถ้าเกี่ยวกับการเงิน

### Trigger: แก้ Middleware / Auth / Error handling
อัพเดท section ต่อไปนี้:
- **Section 11. Middleware Chain & Policy Gate System**
- **Section 13. Error Response Format** — ถ้าเพิ่ม error class/code ใหม่

### Trigger: แก้ Trust Level / Risk Level
อัพเดท section ต่อไปนี้:
- **Section 2. Trust Level System** — ถ้าเปลี่ยน permissions table
- **Section 14. Trust Score Calculation** — ถ้าเปลี่ยน weights/formula
- **Section 15. Risk Level Auto-compute** — ถ้าเปลี่ยน criteria

### Trigger: แก้ Socket.IO / Real-time
อัพเดท section ต่อไปนี้:
- **Section 12. Socket.IO Real-time Events**

### Trigger: เปลี่ยน Architecture / Design Decision
อัพเดท section ต่อไปนี้:
- **Section 1. ภาพรวมระบบ (System Overview)**
- **Section 10. Key Design Decisions**
- **Section 9. Environment Variables** — ถ้าเพิ่ม env var ใหม่

---

## SYSTEM.md Section Reference (15 sections)

| # | Section | เนื้อหา |
|:-:|---------|---------|
| 1 | ภาพรวมระบบ | Architecture diagram, roles, account types |
| 2 | Trust Level System | L0-L3, permissions table |
| 3 | Job Lifecycle | Two-table pattern, state diagram |
| 4 | Payment Flow | 4 phases (topup→hold→escrow→settlement) |
| 5 | Database Schema (ERD) | 25+ tables, 7 subsections |
| 6 | Sequence Diagrams | 9 diagrams (registration, OTP, job, KYC, OAuth, topup, dispute) |
| 7 | API Routes Overview | 15 route groups, methods, paths, middleware |
| 8 | Frontend Page Map | 50+ routes, guards, components |
| 9 | Environment Variables | Backend + Frontend .env |
| 10 | Key Design Decisions | 15+ architectural decisions |
| 11 | Middleware Chain & Policy Gate | 8 middleware functions, 30+ policy actions |
| 12 | Socket.IO Real-time Events | 12 events, room structure |
| 13 | Error Response Format | 7 error classes, error codes, handler |
| 14 | Trust Score Calculation | 8 factors, weights, formula, triggers |
| 15 | Risk Level Auto-compute | criteria, job types, tasks, skills |
