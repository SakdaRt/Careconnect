---
description: เริ่มทำฟีเจอร์ใหม่ตั้งแต่ต้น (pull → plan → implement → test → commit)
---

## Phase 0: Sync & Context

// turbo
1. `git pull origin main` — ดึงโค้ดล่าสุดก่อนเริ่มงานเสมอ
2. อ่าน `PROGRESS.md` — ดูสถานะปัจจุบัน, TODO, ฟีเจอร์ที่ implement แล้ว
3. อ่าน `SYSTEM.md` — ดู architecture, ERD, API routes, page map, policy gates ที่เกี่ยวข้อง

## Phase 1: Plan

4. วิเคราะห์ว่าฟีเจอร์ต้องแก้ layer ไหนบ้าง:
   - **Database**: ต้องเพิ่ม table/column ใหม่ไหม? → อ่าน `database/schema.sql`
   - **Backend**: ต้องเพิ่ม route/service/model ไหม? → อ่าน `backend/src/routes/`, `services/`, `models/`
   - **Frontend**: ต้องเพิ่มหน้า/component ไหม? → อ่าน `frontend/src/router.tsx`, `pages/`
   - **Middleware**: ต้องเพิ่ม policy action ใหม่ไหม? → อ่าน `backend/src/middleware/auth.js` → `can()` function

5. สร้าง todo list ด้วย `todo_list` tool — แบ่งเป็น step ย่อยตาม layer

## Phase 2: Implement (ทำตาม layer order)

### ถ้าแก้ Database:
6. สร้าง migration file: `backend/database/migrations/YYYYMMDD_NN_description.sql`
7. อัพเดท master schema: `database/schema.sql`
8. อัพเดท `backend/MIGRATIONS.md`

### ถ้าแก้ Backend:
9. **Model** (`backend/src/models/`): สร้าง/แก้ model — ใช้ `query()` + `transaction()` จาก `utils/db.js`
10. **Service** (`backend/src/services/`): business logic — ใช้ custom errors จาก `utils/errors.js`
    - `ValidationError`, `NotFoundError`, `ForbiddenError`, `ConflictError`
11. **Controller** (`backend/src/controllers/`): request/response handling
12. **Route** (`backend/src/routes/`): define endpoints
    - ทุก route ต้องมี: `requireAuth`, `requirePolicy(action)`, Joi validation
    - Joi schema อยู่ในไฟล์ route หรือ `utils/validation.js`
13. **Policy**: เพิ่ม action ใน `can()` function (`backend/src/middleware/auth.js`) ถ้ามี route ใหม่
14. **Mount route**: register ใน `backend/src/server.js` → `app.use('/api/xxx', xxxRoutes)`

### ถ้าแก้ Frontend:
15. **Page** (`frontend/src/pages/{role}/`): PascalCase FileName
    - hirer pages → `pages/hirer/`
    - caregiver pages → `pages/caregiver/`
    - shared pages → `pages/shared/`
    - admin pages → `pages/admin/`
    - auth pages → `pages/auth/`
    - public pages → `pages/public/`
16. **API**: เพิ่ม method ใน `frontend/src/services/api.ts` หรือ `appApi.ts`
17. **Router**: เพิ่ม route ใน `frontend/src/router.tsx`
    - lazy import: `const XxxPage = lazy(() => import('./pages/{role}/XxxPage'));`
    - Guards ตาม role:
      ```
      Public:    ไม่มี guard
      Auth:      RequireAuth
      Hirer:     RequireAuth → RequireRole(['hirer']) → RequirePolicy
      Caregiver: RequireAuth → RequireRole(['caregiver']) → RequirePolicy
      Shared:    RequireAuth (อาจมี RequireRole ถ้าจำกัด)
      Admin:     RequireAdmin
      ```
    - เพิ่ม `RequireProfile` ถ้าหน้านั้นต้องมี display_name (เช่น create-job, search)
18. **Styling**: Tailwind utility classes only, ใช้ `cn()` สำหรับ conditional

## Phase 3: Verify

19. ตรวจ TypeScript:
// turbo
    `cd frontend && npx tsc --noEmit`

20. รัน frontend tests (ถ้ามี test ที่เกี่ยวข้อง):
// turbo
    `cd frontend && npx vitest run --passWithNoTests`

21. รัน backend tests (ถ้ามี test ที่เกี่ยวข้อง):
    `cd backend && npm test`

## Phase 4: Commit & Document

22. รัน workflow `/commit` — verify + stage + commit
23. Workflow `/commit` จะเรียก `/update-progress` อัตโนมัติ (อัพเดท PROGRESS.md + SYSTEM.md)

## Quick Reference: File Naming

| Layer | Convention | ตัวอย่าง |
|-------|-----------|---------|
| Frontend pages | PascalCase | `HirerHomePage.tsx` |
| Frontend components | PascalCase | `JobCard.tsx` |
| Backend routes | camelCase | `jobRoutes.js` |
| Backend services | camelCase | `jobService.js` |
| Backend models | PascalCase | `Job.js` |
| Backend controllers | camelCase | `jobController.js` |
| Database tables | snake_case | `job_posts` |
| API paths | kebab-case | `/api/care-recipients` |
| Migration files | `YYYYMMDD_NN_desc.sql` | `20260222_01_add_xxx.sql` |
