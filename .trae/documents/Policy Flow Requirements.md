# Requirement: Policy Acceptance Flow by Role

## เป้าหมาย
- กำหนดลำดับขั้นตอนหลังสมัครให้สอดคล้องกับบทบาทที่เลือก
- ตรวจสอบการยอมรับ Policy ของบทบาทปัจจุบันทุกครั้งที่ล็อกอินและก่อนเข้าแต่ละหน้าบทบาท
- เก็บข้อมูลการยอมรับ Policy ต่อบทบาทอย่างครบถ้วน
- ลดการเช็กซ้ำซ้อนเพื่อรักษา Performance

## กติกา Flow
1. หลังผู้ใช้กดยอมรับ Policy แล้ว ต้อง redirect ไปหน้า Dashboard/Home ของบทบาทนั้นทันที
2. หน้าเลือกบทบาทแสดงเฉพาะช่วงล็อกอินใหม่เท่านั้น (ใช้เลือก Context)
3. เมื่อผู้ใช้ล็อกอินแล้ว ระบบต้องเช็ก Policy ของบทบาทปัจจุบันเสมอ
   - ถ้ายังไม่ยอมรับ: redirect ไปหน้า Policy ของบทบาทนั้น
   - ถ้ายอมรับแล้ว: เข้า Dashboard/Home ได้ปกติ
4. ทุกหน้าของบทบาทต้องถูกคุมด้วย Guard สำหรับเช็ก Policy

## Data Model
- ตาราง `user_policy_acceptances`
  - `user_id`, `role`, `policy_accepted_at`, `version_policy_accepted`
  - เก็บสถานะการยอมรับต่อบทบาทแบบ per-role

## API
- `POST /api/auth/policy/accept`
  - Body: `{ role, version_policy_accepted }`
  - บันทึกเวลาและเวอร์ชัน Policy ของบทบาทนั้น

## Performance
- Guard ใช้ข้อมูลที่แคชใน AuthContext (`policy_acceptances`) ที่ได้จาก login/refresh ครั้งเดียว
- ไม่ยิง API ซ้ำระหว่างการเข้าหน้าต่าง ๆ ของบทบาท
