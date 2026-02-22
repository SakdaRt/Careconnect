---
description: Commit งานขึ้น main อย่างปลอดภัย (ไม่ push อัตโนมัติ — user push เอง)
---

## Pre-commit Verification

1. ตรวจ TypeScript errors (frontend):
// turbo
   `cd frontend && npx tsc --noEmit`

2. ตรวจว่าไม่มี hardcoded secrets:
// turbo
   `cd backend && grep -rn "password\|secret\|api_key" src/ --include="*.js" | grep -v "process.env\|\.example\|test\|mock\|SCORE_WEIGHTS\|password_hash\|JWT_SECRET\|your_\|GOOGLE_"`

3. ตรวจไฟล์ที่เปลี่ยนแปลง:
// turbo
   `git diff --stat`
// turbo
   `git status`

## Commit Flow

4. Stage ทุกไฟล์:
// turbo
   `git add -A`

5. Commit ด้วย format: `type(scope): description`
   - **Types**: `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `test`
   - **Scope**: module ที่แก้ เช่น `auth`, `job`, `wallet`, `chat`, `admin`, `ui`, `system`, `docs`
   - **Description**: สรุปสั้นๆ สิ่งที่ทำ (ภาษาไทยได้)
   - ตัวอย่าง: `feat(job): เพิ่ม auto-complete overdue jobs`
   `git commit -m "type(scope): description"`

## Post-commit (บังคับ — ทำทุกครั้ง)

6. รัน workflow `/update-progress` เพื่ออัพเดท PROGRESS.md + SYSTEM.md

7. แจ้ง user สรุปสั้นๆ:
   - ไฟล์ที่แก้
   - สิ่งที่เปลี่ยนแปลง
   - **ไม่ push อัตโนมัติ** — บอก user ว่า `git push origin main` ได้เมื่อพร้อม

## Checklist ก่อน Commit (ตรวจตามประเภทงาน)

### ถ้าแก้ Frontend:
- [ ] ไม่มี TypeScript errors
- [ ] Routes ใหม่มี guards ตาม role (RequireAuth → RequireRole → RequirePolicy → RequireProfile)
- [ ] Component ใหม่มี TypeScript types ครบ
- [ ] ใช้ Tailwind only (ไม่มี inline style)
- [ ] Icon-only buttons มี `aria-label`
- [ ] Decorative icons มี `aria-hidden="true"`
- [ ] ไม่ใช้ `text-gray-400` สำหรับ readable text

### ถ้าแก้ Backend:
- [ ] Routes ใหม่มี `requireAuth` + `requirePolicy(action)` middleware
- [ ] Body/query/params มี Joi validation schema
- [ ] ใช้ custom error classes จาก `utils/errors.js`
- [ ] ใช้ ESM (`import/export`)
- [ ] เพิ่ม policy action ใน `can()` function ถ้ามี route ใหม่

### ถ้าแก้ Database:
- [ ] เพิ่ม migration file ใน `backend/database/migrations/`
- [ ] อัพเดท `database/schema.sql` (master schema)
- [ ] อัพเดท `backend/MIGRATIONS.md`
