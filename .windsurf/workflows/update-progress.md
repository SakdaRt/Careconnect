---
description: อัพเดท PROGRESS.md และ SYSTEM.md หลังทำงานเสร็จ (ทำทุกครั้งโดยอัตโนมัติ)
---

## หมายเหตุ
workflow นี้ต้องทำ **ทุกครั้ง** หลังทำงานเสร็จ ไม่ต้องรอให้ user สั่ง

---

## ส่วนที่ 1 — อัพเดท PROGRESS.md (ทำทุกครั้ง)

1. อ่าน `PROGRESS.md` ปัจจุบัน
2. อัพเดทส่วน **Git Log** — เพิ่ม entry ใหม่ด้านบนสุด format:
   ```
   ### YYYY-MM-DD — ชื่องาน
   - type(scope): สิ่งที่ทำ
   - ไฟล์ที่แก้ไข: xxx.tsx, xxx.js
   ```
3. อัพเดทส่วน **สิ่งที่ยังค้างอยู่ / TODO**:
   - tick `[x]` งานที่เสร็จแล้ว
   - เพิ่ม `[ ]` งานใหม่ที่ค้นพบระหว่างทำ
4. อัพเดทส่วน **ระบบหลักที่ Implement แล้ว** — ถ้ามีฟีเจอร์ใหม่ tick `[x]`
5. อัพเดทวันที่บรรทัดแรก `> อัพเดทล่าสุด: YYYY-MM-DD`

---

## ส่วนที่ 2 — อัพเดท SYSTEM.md (ทำเมื่อมีการเปลี่ยนแปลง)

ทำเมื่อมีสิ่งต่อไปนี้เกิดขึ้น:

### เพิ่ม/แก้ Database Table
- อัพเดทส่วน **5. Database Schema (ERD)** — เพิ่ม table ใหม่พร้อม columns และ FK

### เพิ่ม/แก้ API Route
- อัพเดทส่วน **7. API Routes Overview** — เพิ่ม/แก้ endpoint ในหมวดที่เกี่ยวข้อง

### เพิ่ม Flow ใหม่
- อัพเดทส่วน **6. Sequence Diagrams** — เพิ่ม sequence diagram ใหม่

### เพิ่มหน้าใหม่ใน Frontend
- อัพเดทส่วน **8. Frontend Page Map** — เพิ่ม route + guard

### เปลี่ยน Architecture หรือ Design Decision
- อัพเดทส่วน **1. ภาพรวมระบบ** หรือ **10. Key Design Decisions**
