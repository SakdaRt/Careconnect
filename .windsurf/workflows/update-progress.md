---
description: อัพเดท PROGRESS.md และ SYSTEM.md หลังทำงานเสร็จ (ทำทุกครั้งโดยอัตโนมัติ)
---

## หมายเหตุ
- Workflow นี้ต้องทำ **ทุกครั้ง** หลังทำงานเสร็จ ไม่ต้องรอให้ user สั่ง
- ถูกเรียกจาก workflow `/commit` อัตโนมัติ
- ถ้าอัพเดท docs แล้วมีไฟล์เปลี่ยนเพิ่ม ให้ใช้:
  `git add -A && git commit --amend --no-edit`
- `SYSTEM.md` เป็น architectural reference หลัก แต่ถ้าเอกสารขัดกับ source code ให้ถือ source code เป็น source of truth
- ห้ามอัพเดทเอกสารจากการคาดเดา ต้องอิงสิ่งที่ `verified from code` เท่านั้น
- ถ้ามีเรื่องที่น่าจะจริงแต่ยังไม่ยืนยัน ให้เขียนแยกเป็น `likely but unverified` หรือยังไม่ใส่ลงเอกสารจนกว่าจะตรวจครบ

---

## ส่วนที่ 1 — อัพเดท PROGRESS.md (ทำทุกครั้ง)

1. อ่าน `PROGRESS.md` ปัจจุบัน

2. อัพเดท **วันที่** บรรทัดแรก:
   `> อัพเดทล่าสุด: YYYY-MM-DD`

3. อัพเดทส่วน **Git Log** — เพิ่ม entry ใหม่ **ด้านบนสุด** ของ section:


4. อัพเดทส่วน **ระบบหลักที่ Implement แล้ว**
- tick `[x]` ฟีเจอร์ที่ implement ใหม่
- เพิ่ม bullet ใหม่ถ้าเป็นฟีเจอร์ที่ยังไม่มีในลิสต์
- ถ้าเป็นแค่ refactor / bug fix / internal improvement ที่ไม่ได้เพิ่ม capability ใหม่ ไม่ต้องฝืนเพิ่มหัวข้อฟีเจอร์ใหม่

5. อัพเดทส่วน **สิ่งที่ยังค้างอยู่ / TODO**
- tick `[x]` งานที่เสร็จแล้ว
- เพิ่ม `[ ]` งานใหม่ที่ค้นพบระหว่างทำ
- ถ้าเจอ tech debt, regression risk, หรือ follow-up task ให้เพิ่มไว้แบบสั้นและชัด

6. อัพเดทส่วน **ไฟล์สำคัญที่ต้องรู้จัก**
- เพิ่มเมื่อมีไฟล์ใหม่ที่สำคัญจริง
- ไม่ต้องเพิ่มทุกไฟล์ที่แตะ
- เพิ่มเฉพาะไฟล์ที่เป็น entry point, shared core logic, schema, route map, guard, service สำคัญ หรือไฟล์ที่คนทำงานต่อควรรู้จัก

---

## ส่วนที่ 2 — อัพเดท SYSTEM.md (ทำเมื่อมีการเปลี่ยนแปลงที่มีผลต่อความเข้าใจระบบ)

### หลักการก่อนอัพเดท
- อัพเดทเฉพาะสิ่งที่เปลี่ยน **สถาปัตยกรรม, schema, route, flow, policy, guard, contract, หรือ design decision**
- ถ้าเป็นแค่ implementation detail ย่อยที่ไม่เปลี่ยนภาพรวมระบบ อาจไม่จำเป็นต้องแก้ `SYSTEM.md`
- ทุกการอัพเดทต้องอิงจากโค้ดจริงที่ตรวจแล้ว
- ถ้าพบว่า `SYSTEM.md` เดิมไม่ตรงกับโค้ด ให้แก้ให้ตรงกับโค้ด พร้อมหลีกเลี่ยงการทับข้อมูลที่ยังไม่ได้ตรวจ

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

อัพเดทเพิ่มเติมเมื่อเกี่ยวข้อง:
- indexes / constraints / triggers ที่สำคัญ
- migration impact
- table relationship ที่เปลี่ยนไป

### Trigger: เพิ่ม/แก้ API Route
อัพเดท section ต่อไปนี้:
- **Section 7. API Routes Overview** — เพิ่ม/แก้ endpoint ใน group ที่เกี่ยวข้อง
- **Section 11. Middleware Chain & Policy Gate System** — เพิ่ม policy action ใน `can()` matrix ถ้ามี action ใหม่จริง

ข้อควรระวัง:
- อย่าระบุว่า route ต้องมี `requireAuth` เสมอ ถ้าโค้ดจริงเป็น public/auth/webhook route
- ให้ระบุ middleware ตาม design จริงของ route group

### Trigger: เพิ่มหน้า Frontend ใหม่ หรือแก้ routing/guards สำคัญ
อัพเดท section ต่อไปนี้:
- **Section 8. Frontend Page Map** — เพิ่ม route + component + guards
- ถ้าเกี่ยวกับ navigation flow หรือ access control ให้เช็กความสอดคล้องกับ backend policy ด้วยก่อนอัพเดท

### Trigger: เพิ่ม/แก้ Business Flow
อัพเดท section ต่อไปนี้:
- **Section 6. Sequence Diagrams** — เพิ่ม/แก้ diagram
- **Section 3. Job Lifecycle** — ถ้าเกี่ยวกับ job flow
- **Section 4. Payment Flow** — ถ้าเกี่ยวกับการเงิน

ข้อควรระวัง:
- เพิ่มเฉพาะ flow ที่ยืนยันจาก implementation จริง
- ถ้ายัง trace flow ไม่ครบ อย่าเขียน diagram แบบเดา

### Trigger: แก้ Middleware / Auth / Error handling
อัพเดท section ต่อไปนี้:
- **Section 11. Middleware Chain & Policy Gate System**
- **Section 13. Error Response Format** — ถ้าเพิ่ม error class/code ใหม่
- **Section 7. API Routes Overview** — ถ้า behavior ของ middleware chain ต่อ endpoint เปลี่ยนจริง

### Trigger: แก้ Trust Level / Risk Level
อัพเดท section ต่อไปนี้:
- **Section 2. Trust Level System** — ถ้าเปลี่ยน permissions table หรือ trust requirements
- **Section 14. Trust Score Calculation** — ถ้าเปลี่ยน weights / formula / trigger
- **Section 15. Risk Level Auto-compute** — ถ้าเปลี่ยน criteria หรือ logic ที่ใช้จริง

### Trigger: แก้ Socket.IO / Real-time
อัพเดท section ต่อไปนี้:
- **Section 12. Socket.IO Real-time Events**
- ระบุ event, room structure, และ trigger ที่เปลี่ยนจริงจากโค้ด

### Trigger: เปลี่ยน Architecture / Design Decision
อัพเดท section ต่อไปนี้:
- **Section 1. ภาพรวมระบบ (System Overview)**
- **Section 10. Key Design Decisions**
- **Section 9. Environment Variables** — ถ้าเพิ่ม env var ใหม่
- **Section 7 / 8 / 11** เพิ่มเติมถ้าการเปลี่ยน architecture กระทบ route, page, guard, หรือ middleware

---

## เกณฑ์ตัดสินว่า “ควรอัพเดท SYSTEM.md ไหม”
ให้อัพเดทเมื่อมีอย่างน้อยหนึ่งข้อ:
- มี schema หรือ relationship เปลี่ยน
- มี route / contract / middleware / policy เปลี่ยน
- มี page / guard / routing behavior เปลี่ยน
- มี business flow สำคัญเปลี่ยน
- มี error class / response format / env var / socket event เปลี่ยน
- มี design decision หรือ architecture view เปลี่ยน

ไม่จำเป็นต้องอัพเดทเมื่อ:
- แก้ typo
- refactor ภายในที่ไม่เปลี่ยน behavior ภายนอก
- rename ตัวแปรภายใน
- ปรับโค้ดภายในโดยไม่เปลี่ยน contract หรือ flow ที่คนอื่นต้องรู้

---

## วิธีเขียนให้อ่านต่อได้ง่าย
- ใช้ถ้อยคำสั้น ชัด และสอดคล้องกับโครง section เดิม
- อย่าเขียนรายละเอียด implementation ยิบย่อยเกินจำเป็นใน `SYSTEM.md`
- เน้นสิ่งที่คนทำงานต่อ “ต้องรู้” เพื่อเข้าใจระบบ
- ถ้ามีข้อมูลเดิมที่คลาดเคลื่อน ให้แก้ให้ตรงกับโค้ดแทนการซ้อนข้อมูลใหม่จนสับสน

---

## หลังอัพเดทเอกสาร
1. ตรวจ diff ของ `PROGRESS.md` และ `SYSTEM.md`
2. ยืนยันว่าเนื้อหาที่เพิ่มเป็นสิ่งที่ `verified from code`
3. ถ้า `/commit` ถูกเรียกไปแล้วและ docs เปลี่ยนเพิ่ม:
`git add -A && git commit --amend --no-edit`

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