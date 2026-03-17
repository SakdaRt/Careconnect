---
description: เริ่มทำฟีเจอร์ใหม่ตั้งแต่ต้น (sync → analyze → plan → implement → verify → commit)
---

## หมายเหตุสำคัญ
- Workflow นี้ใช้สำหรับ “ฟีเจอร์ใหม่” หรือ “งานที่มีผลหลาย layer”
- ห้ามเริ่ม implement ทันทีจาก `SYSTEM.md` หรือชื่อไฟล์อย่างเดียว
- ต้อง trace implementation ปัจจุบันจาก source code จริงก่อนเสมอ
- ถ้า `SYSTEM.md` ขัดกับ source code ให้ถือ source code เป็น source of truth
- ถ้ามี local changes ใน git working tree ให้รายงานก่อน ไม่ดึงทับทันที

## Phase 0: Sync & Context

// turbo
1. `git status` — ตรวจ working tree ก่อน

2. ถ้า working tree สะอาด ให้ sync โค้ดล่าสุดตามความเหมาะสม เช่น:
// turbo
   `git pull origin main`

3. อ่าน `PROGRESS.md` — ดูสถานะปัจจุบัน, TODO, ฟีเจอร์ที่ implement แล้ว

4. อ่าน `SYSTEM.md` — ดู architecture, ERD, API routes, page map, policy gates ที่เกี่ยวข้อง

## Phase 1: Analyze Current Implementation (บังคับ)

5. ระบุว่าฟีเจอร์นี้กระทบ layer ไหนบ้าง:
   - **Database**: ต้องเพิ่ม/แก้ table, column, index, constraint, migration ไหม?
   - **Backend**: ต้องเพิ่ม/แก้ route, controller, service, model, worker, middleware, webhook หรือไม่?
   - **Frontend**: ต้องเพิ่ม/แก้ page, component, API client, router, guard, state handling หรือไม่?
   - **Policy/Auth**: ต้องเพิ่ม action ใน `can()` function หรือแก้ guard/policy เดิมหรือไม่?

6. เปิดอ่านไฟล์โค้ดจริงที่เกี่ยวข้องก่อนเริ่มแก้ เช่น:
   - `database/schema.sql`
   - `backend/src/routes/`
   - `backend/src/controllers/`
   - `backend/src/services/`
   - `backend/src/models/`
   - `backend/src/middleware/auth.js`
   - `backend/src/server.js`
   - `frontend/src/router.tsx`
   - `frontend/src/routerGuards.tsx`
   - `frontend/src/services/api.ts`
   - `frontend/src/services/appApi.ts`
   - `frontend/src/pages/`

7. สรุปก่อน implement อย่างน้อย:
   - `current behavior`
   - `relevant files`
   - `end-to-end call flow`
   - `side effects / risks`
   - `minimal patch plan`

8. ทุกข้อสรุปต้องแยกว่า:
   - `verified from code`
   - `likely but unverified`

9. ถ้างานเกี่ยว frontend-backend contract, auth, role, policy, validation, response shape, wallet, OTP, webhook, trust level, token refresh หรือ file upload:
   - ต้อง trace ทั้งฝั่ง frontend และ backend
   - ต้องระบุ side effects และ regression risks ให้ชัด

10. สร้าง todo list แบ่งเป็น step ย่อยตาม layer และลำดับ dependency

## Phase 2: Plan

11. ตัดสินใจก่อนว่าจะแก้แบบไหน:
   - **Minimal patch**: แก้เฉพาะจุดที่จำเป็น
   - **Extended patch**: ใช้เฉพาะเมื่อ minimal patch ไม่พอ และต้องอธิบายเหตุผล

12. ถ้ามีหลายทางเลือก:
   - สรุป approach ที่เลือก
   - บอก trade-offs สั้น ๆ
   - เลือกทางที่เสี่ยงต่ำและกระทบระบบน้อยที่สุดก่อน

## Phase 3: Implement (ทำตามลำดับ dependency)

### ถ้าแก้ Database
13. สร้าง migration file: `backend/database/migrations/YYYYMMDD_NN_description.sql`
14. อัพเดท master schema: `database/schema.sql`
15. อัพเดท `backend/MIGRATIONS.md`
16. ตรวจผลกระทบต่อ:
   - constraints
   - indexes
   - foreign keys
   - transaction flow
   - existing queries / models / services

### ถ้าแก้ Backend
17. **Model** (`backend/src/models/`)
   - ใช้ `query()` + `transaction()` จาก `utils/db.js`
   - ตรวจผลกระทบต่อ query เดิมและ data shape

18. **Service** (`backend/src/services/`)
   - business logic ใช้ custom errors จาก `utils/errors.js`
   - เช่น `ValidationError`, `NotFoundError`, `ForbiddenError`, `ConflictError`
   - ถ้าเป็น high-risk domain ต้องระวัง side effects, state transitions, transaction boundaries

19. **Controller** (`backend/src/controllers/`)
   - request/response handling
   - ตรวจ response shape ให้สอดคล้องกับ frontend caller

20. **Route** (`backend/src/routes/`)
   - define endpoints
   - Protected routes ใช้ middleware ที่เหมาะสมตาม design จริงของ route group เช่น `requireAuth` และ/หรือ `requirePolicy(action)`
   - Public/auth/bootstrap/webhook routes อาจไม่ใช้ `requireAuth` ตาม design จริงของระบบ
   - Joi schema อยู่ในไฟล์ route หรือ `utils/validation.js`

21. **Policy**
   - เพิ่ม action ใน `can()` function (`backend/src/middleware/auth.js`) ถ้ามี action ใหม่จริง
   - ตรวจผลกระทบกับ policy ที่มีอยู่แล้ว

22. **Mount route**
   - register ใน `backend/src/server.js` เมื่อมี route group ใหม่จริง
   - เช่น `app.use('/api/xxx', xxxRoutes)`

### ถ้าแก้ Frontend
23. **Page / Component**
   - `frontend/src/pages/{role}/` ใช้ PascalCase FileName
   - เลือกโฟลเดอร์ให้ตรงกับ domain:
     - hirer → `pages/hirer/`
     - caregiver → `pages/caregiver/`
     - shared → `pages/shared/`
     - admin → `pages/admin/`
     - auth → `pages/auth/`
     - public → `pages/public/`

24. **API client**
   - เพิ่ม/แก้ method ใน `frontend/src/services/api.ts` หรือ `appApi.ts`
   - ตรวจ request params, response shape, auth handling, error handling, token refresh behavior เมื่อเกี่ยวข้อง

25. **Router**
   - เพิ่ม route ใน `frontend/src/router.tsx` เมื่อจำเป็น
   - lazy import ตัวอย่าง:
     `const XxxPage = lazy(() => import('./pages/{role}/XxxPage'));`

26. **Guards**
   - ใช้ guards ตาม role / policy / profile requirement ของหน้านั้นจริง
   - ตัวอย่างแนวทาง:
     - `Public`: ไม่มี guard
     - `Auth`: `RequireAuth`
     - `Hirer`: `RequireAuth → RequireRole(['hirer']) → RequirePolicy`
     - `Caregiver`: `RequireAuth → RequireRole(['caregiver']) → RequirePolicy`
     - `Shared`: `RequireAuth` (อาจมี `RequireRole` ถ้าจำกัด)
     - `Admin`: `RequireAdmin`
   - เพิ่ม `RequireProfile` ถ้าหน้านั้นต้องมี display_name หรือ profile state ที่พร้อมใช้งาน

27. **Styling**
   - ใช้ Tailwind utility classes only
   - ใช้ `cn()` สำหรับ conditional classes
   - หลีกเลี่ยง inline style

## Phase 4: Verify

28. ตรวจ TypeScript เมื่อมีการแก้ frontend:
// turbo
   `cd frontend && npx tsc --noEmit`

29. รัน frontend tests ที่เกี่ยวข้อง (ถ้ามี):
// turbo
   `cd frontend && npx vitest run --passWithNoTests`

30. รัน backend tests ที่เกี่ยวข้อง (ถ้ามี):
// turbo
   `cd backend && npm test`

31. ตรวจว่าไม่มี hardcoded secrets แบบ obvious quick check:
// turbo
   `cd backend && grep -rn "password\|secret\|api_key\|token" src/ --include="*.js" | grep -v "process.env\|\.example\|test\|mock\|SCORE_WEIGHTS\|password_hash\|JWT_SECRET\|your_\|GOOGLE_"`

32. ทบทวน diff ก่อน commit:
// turbo
   `git diff --stat`
// turbo
   `git diff`

33. ตรวจ checklist ตามประเภทงาน:
   - Frontend: types, guards, accessibility, API consistency
   - Backend: middleware, validation, custom errors, response shape, policy consistency
   - Database: migration, schema.sql, migration history, constraints, indexes
   - High-risk domains: side effects, regression risks, transaction boundaries

## Phase 5: Commit & Document

34. รัน workflow `/commit` — verify + stage + commit

35. Workflow `/commit` จะเรียก `/update-progress` อัตโนมัติ
   - อัพเดท `PROGRESS.md`
   - อัพเดท `SYSTEM.md` เมื่อมีการเปลี่ยนแปลง schema, API, flow, หรือ architecture

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