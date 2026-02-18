# CareConnect — Test Plan

## 1. Testing Strategy Overview

| Layer | Framework | ตำแหน่ง | Coverage เป้าหมาย |
|-------|-----------|---------|-------------------|
| **Backend Unit** | Jest 29 | `backend/src/services/__tests__/` | Service logic, business rules |
| **Backend Integration** | Jest + Supertest | `backend/tests/integration/` | API endpoints, DB operations |
| **Frontend Unit** | Vitest + Testing Library | `frontend/src/__tests__/` | Components, guards, context |
| **End-to-End** | Manual (Docker) | — | Full user flows |

## 2. Backend Tests (Existing)

### 2.1 Unit Tests (`backend/src/services/__tests__/`)

| Test File | ทดสอบอะไร | Status |
|-----------|-----------|--------|
| `policyService.test.js` | Policy acceptance logic | ✅ |
| `jobService.money.test.js` | Job payment calculations | ✅ |
| `jobService.createJob.requirements.test.js` | Job creation validation | ✅ |
| `jobService.checkOut.idempotent.test.js` | Check-out idempotency | ✅ |
| `jobService.accessControl.test.js` | Job access control rules | ✅ |
| `disputeService.settle.test.js` | Dispute settlement logic | ✅ |
| `walletService.safety.test.js` | Wallet balance safety | ✅ |
| `otpService.recompute.test.js` | OTP recompute | ✅ |
| `chatService.notification.test.js` | Chat notification triggers | ✅ |

### 2.2 Integration Tests (`backend/tests/integration/`)

| Test File | ทดสอบอะไร | Status |
|-----------|-----------|--------|
| Auth flow | Register → Login → Token refresh | ✅ |
| Job lifecycle | Create → Publish → Accept → Complete | ✅ |
| Wallet operations | Top-up → Escrow → Payout | ✅ |
| Dispute flow | Open → Review → Resolve | ✅ |

### 2.3 Route Tests (`backend/src/routes/__tests__/`)

| Test File | ทดสอบอะไร | Status |
|-----------|-----------|--------|
| `jobRoutes.queryValidation.test.js` | Job query parameter validation | ✅ |
| `caregiverSearchRoutes.assignConflict.test.js` | Caregiver assignment conflict | ✅ |

### 2.4 Middleware Tests (`backend/src/middleware/__tests__/`)

| Test File | ทดสอบอะไร | Status |
|-----------|-----------|--------|
| `policyGate.test.js` | Role-based policy gate | ✅ |

## 3. Frontend Tests (Existing)

### 3.1 Unit/Component Tests (`frontend/src/__tests__/`)

| Test File | ทดสอบอะไร | Status |
|-----------|-----------|--------|
| `AuthContext.test.tsx` | Auth context: login, logout, token management | ✅ |
| `routerGuards.test.tsx` | Route guards: RequireAuth, RequireRole, RequireProfile | ✅ |
| `api.interceptor.test.ts` | API client: request, error handling, token refresh | ✅ |
| `navigation.webNavigation.test.tsx` | Navigation: TopBar, BottomBar, routing | ✅ |
| `pages.CareRecipientFormPage.test.tsx` | Care recipient form validation | ✅ |
| `pages.ChatRoomPage.test.tsx` | Chat room rendering | ✅ |
| `policy.flow.test.tsx` | Policy acceptance flow | ✅ |
| `ErrorBoundary.test.tsx` | Error boundary rendering | ✅ |
| `ui.Modal.test.tsx` | Modal component | ✅ |

## 4. Running Tests

### 4.1 Backend

```bash
cd backend

# Run all tests
npm test

# Run with coverage
npm test -- --coverage

# Run specific test
npm test -- --testPathPattern="walletService"

# Integration tests only
npm run test:integration

# Smoke tests (Tier-0)
npm run test:smoke
```

### 4.2 Frontend

```bash
cd frontend

# Run all tests (watch mode)
npm test

# Run once (CI mode)
npm run test:run

# With coverage
npm run test:coverage

# Core logic tests only
npm run test:logic

# Run specific test
npx vitest run src/__tests__/AuthContext.test.tsx
```

## 5. Critical Test Cases (Manual)

### 5.1 Authentication Flow

| # | Step | Expected Result | Priority |
|---|------|-----------------|----------|
| 1 | เปิด localhost:5173 | Landing page แสดง | High |
| 2 | กด "สมัครสมาชิก" → เลือก Guest | Guest register form | High |
| 3 | กรอก email + password → สมัคร | สำเร็จ, redirect to role selection | High |
| 4 | เลือก Role "ผู้ว่าจ้าง" | Redirect to consent page | High |
| 5 | ยอมรับ Policy | Redirect to profile page | High |
| 6 | กรอกชื่อ → บันทึก | Redirect to hirer home | High |
| 7 | Logout → Login ด้วย email/password | สำเร็จ, กลับ hirer home | High |

### 5.2 Job Lifecycle (Hirer)

| # | Step | Expected Result | Priority |
|---|------|-----------------|----------|
| 1 | สร้างผู้รับการดูแล (Care Recipient) | บันทึกสำเร็จ | High |
| 2 | สร้างงานใหม่ (Draft) | Draft ปรากฏใน "งานของฉัน" | High |
| 3 | เผยแพร่งาน | Status เปลี่ยนเป็น "posted" | High |
| 4 | ดูรายละเอียดงาน | แสดงข้อมูลครบ | High |

### 5.3 Job Lifecycle (Caregiver)

| # | Step | Expected Result | Priority |
|---|------|-----------------|----------|
| 1 | เปิด Job Feed | แสดงงานที่ posted | High |
| 2 | สมัครงาน | สำเร็จ | High |
| 3 | Check-in (เริ่มงาน) | Status เปลี่ยนเป็น in_progress | High |
| 4 | Check-out (จบงาน) | Status เปลี่ยนเป็น completed | High |

### 5.4 Wallet & Payment

| # | Step | Expected Result | Priority |
|---|------|-----------------|----------|
| 1 | เปิด Wallet page | แสดงยอดเงิน | High |
| 2 | เติมเงิน (Top-up) | Mock payment → webhook → ยอดเพิ่ม | High |
| 3 | เผยแพร่งาน → Escrow lock | ยอด available ลดลง | High |

### 5.5 Chat

| # | Step | Expected Result | Priority |
|---|------|-----------------|----------|
| 1 | เปิด Chat จาก Job Detail | Chat thread สร้าง/เปิด | Medium |
| 2 | ส่งข้อความ | ข้อความแสดงใน chat | Medium |

### 5.6 Admin

| # | Step | Expected Result | Priority |
|---|------|-----------------|----------|
| 1 | Login admin@careconnect.com | Admin dashboard | Medium |
| 2 | ดูรายชื่อผู้ใช้ | แสดง list | Medium |
| 3 | ดูรายชื่องาน | แสดง list | Medium |

## 6. Test Coverage Goals

| Area | Current | Target (M1) | Target (M2) |
|------|---------|-------------|-------------|
| Backend Services | ~60% | 60% | 80% |
| Frontend Guards/Context | ~70% | 70% | 80% |
| Frontend Pages | ~10% | 10% | 30% |
| Integration (Manual) | — | Full flow | Full flow |

## 7. Known Limitations

1. **Mock Provider**: ทุก external service เป็น mock — ไม่ทดสอบกับ provider จริง
2. **GPS**: ไม่มี real GPS testing (ใช้ mock coordinates)
3. **WebSocket**: Test เฉพาะ unit level, ไม่มี E2E WebSocket test
4. **Photo Evidence**: Upload ทดสอบผ่าน multer mock เท่านั้น
5. **Trust Score Recompute**: Worker ยังเป็น placeholder
