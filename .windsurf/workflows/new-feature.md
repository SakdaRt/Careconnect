---
description: เริ่มทำฟีเจอร์ใหม่ตั้งแต่ต้น
---

## ขั้นตอน

1. อ่าน `PROGRESS.md` เพื่อเข้าใจสถานะปัจจุบัน
2. วางแผนงาน — สร้าง todo list ด้วย todo_list tool
3. ตรวจสอบไฟล์ที่เกี่ยวข้องก่อนแก้ไข
4. Implement ทีละ step ตาม todo list
5. ทดสอบว่า TypeScript ไม่มี error: `cd frontend && npx tsc --noEmit`
6. รัน workflow `commit` เพื่อ commit + push
7. รัน workflow `update-progress` เพื่ออัพเดท PROGRESS.md
