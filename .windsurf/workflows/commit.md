---
description: Commit งานขึ้น main อย่างปลอดภัย (ไม่ push อัตโนมัติ — user push เอง)
---

## หมายเหตุสำคัญ
- Workflow นี้ใช้หลังจาก implement และ verify งานเสร็จแล้ว
- ถ้ายังไม่ได้ trace current behavior จากโค้ดจริง, ยังไม่ได้ประเมินผลกระทบ, หรือยังไม่ได้ verify งานที่แก้ ห้าม commit
- ไม่ push อัตโนมัติ — user จะเป็นคน push เองเมื่อพร้อม

## Pre-commit Verification

1. ตรวจไฟล์ที่เปลี่ยนแปลงก่อน
// turbo
   `git diff --stat`
// turbo
   `git status`

2. ตรวจ TypeScript errors (frontend) เมื่อมีการแก้ frontend:
// turbo
   `cd frontend && npx tsc --noEmit`

3. รัน frontend tests ที่เกี่ยวข้อง (ถ้ามี):
// turbo
   `cd frontend && npx vitest run --passWithNoTests`

4. รัน backend tests ที่เกี่ยวข้อง (ถ้ามี):
// turbo
   `cd backend && npm test`

5. ตรวจว่าไม่มี hardcoded secrets แบบ obvious quick check:
   - คำสั่งนี้เป็นแค่ quick check ไม่ใช่ security guarantee
// turbo
   `cd backend && grep -rn "password\|secret\|api_key\|token" src/ --include="*.js" | grep -v "process.env\|\.example\|test\|mock\|SCORE_WEIGHTS\|password_hash\|JWT_SECRET\|your_\|GOOGLE_"`

6. ทบทวน diff ก่อน commit
// turbo
   `git diff --cached`
// turbo
   `git diff`

## Checklist ก่อน Commit (ตรวจตามประเภทงาน)

### ตรวจทุกงาน
- [ ] งานนี้ trace implementation ปัจจุบันจาก source code จริงแล้ว
- [ ] สรุป current behavior, relevant files, call flow, risks, และ minimal patch plan แล้ว
- [ ] ไม่มี hardcoded secrets
- [ ] ไม่มีไฟล์หลุด, debug code, console log, หรือ temporary code ที่ไม่ควร commit
- [ ] งานใน high-risk domains ได้ตรวจ side effects แล้ว
- [ ] ถ้ามีข้อมูลที่ยังไม่ชัวร์ ได้แยกเป็น `likely but unverified`

### ถ้าแก้ Frontend
- [ ] ไม่มี TypeScript errors
- [ ] Routes ใหม่หรือ route ที่แก้ มี guards ตาม role / policy / profile ที่เกี่ยวข้อง
- [ ] Component ใหม่มี TypeScript types ครบ
- [ ] ใช้ Tailwind only (ไม่มี inline style)
- [ ] Icon-only buttons มี `aria-label`
- [ ] Decorative icons มี `aria-hidden="true"`
- [ ] ไม่ใช้ `text-gray-400` สำหรับ readable text
- [ ] ถ้าแก้ API contract หรือ response handling ได้ตรวจ backend endpoint ที่เกี่ยวข้องแล้ว

### ถ้าแก้ Backend
- [ ] Protected routes ใช้ middleware ที่เหมาะสมตาม design จริงของ route group เช่น `requireAuth` และ/หรือ `requirePolicy(action)`
- [ ] Public/auth/bootstrap/webhook routes ถูกปล่อย public ตาม design จริง ไม่ถูกบังคับ auth โดยไม่จำเป็น
- [ ] Body/query/params มี Joi validation schema เมื่อ endpoint นั้นรับข้อมูลดังกล่าว
- [ ] ใช้ custom error classes จาก `utils/errors.js`
- [ ] ใช้ ESM (`import/export`)
- [ ] เพิ่ม policy action ใน `can()` function ถ้ามี action ใหม่จริง
- [ ] ถ้าแก้ auth / OTP / wallet / webhook / policy / trust level ได้ตรวจ side effects และ regression risks แล้ว

### ถ้าแก้ Database
- [ ] เพิ่ม migration file ใน `backend/database/migrations/`
- [ ] อัพเดท `database/schema.sql` (master schema)
- [ ] อัพเดท `backend/MIGRATIONS.md`
- [ ] ตรวจ migration impact, constraints, indexes, และ transaction effects แล้ว
- [ ] ถ้าแตะ financial tables หรือ ledger ได้ตรวจ transaction boundary และ side effects แล้ว

## Commit Flow

7. Stage ทุกไฟล์ที่ต้องการ commit
// turbo
   `git add -A`

8. ตรวจ staged changes อีกรอบ
// turbo
   `git diff --cached --stat`
// turbo
   `git diff --cached`

9. Commit ด้วย format: `type(scope): description`
   - **Types**: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `test`
   - **Scope**: module ที่แก้ เช่น `auth`, `job`, `wallet`, `chat`, `admin`, `ui`, `system`, `docs`
   - **Description**: สรุปสั้นๆ สิ่งที่ทำ (ภาษาไทยได้)
   - ตัวอย่าง: `feat(job): เพิ่ม auto-complete overdue jobs`
// turbo
   `git commit -m "type(scope): description"`

## Post-commit (บังคับ — ทำทุกครั้ง)

10. รัน workflow `/update-progress` เพื่ออัพเดท `PROGRESS.md` + `SYSTEM.md`

11. ถ้า `/update-progress` ทำให้มีไฟล์เปลี่ยนเพิ่ม:
   - stage ไฟล์ที่เปลี่ยน
   - amend commit เดิมแทนการสร้าง commit ใหม่
// turbo
   `git add -A`
// turbo
   `git commit --amend --no-edit`

12. ตรวจสถานะสุดท้าย
// turbo
   `git status`

13. แจ้ง user สรุปสั้นๆ:
   - ไฟล์ที่แก้
   - สิ่งที่เปลี่ยนแปลง
   - ผลการ verify ที่สำคัญ
   - ยังไม่ได้ push อัตโนมัติ
   - user สามารถรัน `git push origin main` ได้เมื่อพร้อม