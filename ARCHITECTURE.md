# CareConnect — Architecture Document

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client (Web Browser)                        │
│          Hirer  /  Caregiver  /  Admin                          │
└────────────┬────────────────────────────────┬───────────────────┘
             │ HTTPS                          │ WSS (Socket.IO)
             ▼                                ▼
┌────────────────────────┐       ┌────────────────────────────────┐
│   Frontend Container   │       │     Backend Container          │
│   React 18 + Vite      │──────▶│     Express.js + Socket.IO     │
│   TailwindCSS          │proxy  │     JWT Auth + Joi Validation  │
│   Port 5173            │/api   │     Port 3000                  │
└────────────────────────┘       └──────┬──────────┬──────────────┘
                                        │          │
                          ┌─────────────┘          └──────────────┐
                          ▼                                       ▼
               ┌────────────────────┐              ┌──────────────────────┐
               │  PostgreSQL 15     │              │  Mock Provider       │
               │  25+ tables        │              │  Payment Gateway     │
               │  Immutable Ledger  │              │  SMS OTP / KYC       │
               │  Port 5432         │              │  Bank Transfer       │
               └────────────────────┘              │  Port 4000           │
                                                   └──────────────────────┘
```

## 2. Service Topology (Docker Compose)

| Service | Image | Port | Role |
|---------|-------|------|------|
| `postgres` | postgres:15-alpine | 5432 | Primary database |
| `backend` | careconnect-backend | 3000 | REST API + WebSocket |
| `frontend` | careconnect-frontend | 5173 | SPA (Vite dev server) |
| `mock-provider` | careconnect-mock-provider | 4000 | Mock external APIs |
| `pgadmin` | dpage/pgadmin4 | 5050 | Database management UI |
| `migrate` | careconnect-backend | — | Schema migration (on-demand profile) |

**Network**: All services on `careconnect-network` (bridge). Frontend proxies `/api`, `/uploads`, `/socket.io` to `http://backend:3000`.

## 3. Backend Architecture

### 3.1 Layer Structure

```
Request → Route (validation) → Middleware (auth/policy) → Controller → Service → Model → PostgreSQL
                                                                         ↓
                                                                   Notification Service
                                                                         ↓
                                                                   Socket.IO (realtime)
```

### 3.2 Route → Controller → Service → Model Mapping

| Domain | Route File | Controller | Service | Model |
|--------|-----------|------------|---------|-------|
| Auth | `authRoutes.js` | `authController.js` | `authService.js` | `User.js` |
| Jobs | `jobRoutes.js` | `jobController.js` | `jobService.js` | `Job.js` |
| Chat | `chatRoutes.js` | `chatController.js` | `chatService.js` | `Chat.js` |
| Wallet | `walletRoutes.js` | `walletController.js` | `walletService.js` | `Wallet.js` |
| Disputes | `disputeRoutes.js` | `disputeController.js` | `disputeService.js` | — |
| Notifications | `notificationRoutes.js` | `notificationController.js` | `notificationService.js` | `Notification.js` |
| KYC | `kycRoutes.js` | `kycController.js` | `kycService.js` | — |
| Payments | `paymentRoutes.js` | — | `paymentService.js` | `Payment.js` |
| Care Recipients | `careRecipientRoutes.js` | `careRecipientController.js` | — | — |
| Caregiver Search | `caregiverSearchRoutes.js` | — | — | — |
| Admin | `adminRoutes.js` | `admin*Controller.js` | — | — |
| Webhooks | `webhookRoutes.js` | `webhookController.js` | — | — |
| OTP | `otpRoutes.js` | `otpController.js` | `otpService.js` | — |

### 3.3 Middleware Stack

1. **helmet** — Security headers
2. **cors** — Cross-origin resource sharing
3. **express.json** — JSON body parsing
4. **morgan** — Request logging
5. **Cache-Control** — No caching for `/api` routes
6. **auth middleware** — JWT verification per route
7. **policy gate** — Role-based access control

### 3.4 Authentication Flow

```
Register → (Guest: email+password | Member: phone+OTP) → JWT (access + refresh)
    ↓
Role Selection → Policy Acceptance → Profile Creation
    ↓
Login → JWT issued → Stored in localStorage (scoped keys)
    ↓
API calls → Authorization header → auth middleware verifies → Controller
    ↓
Token expired → attemptRefresh() → /api/auth/refresh → New tokens
```

### 3.5 WebSocket (Socket.IO)

- **chatSocket.js**: Handles join/leave rooms, send/receive messages per job thread
- **realtimeHub.js**: Centralized socket server reference for broadcasting notifications from services

## 4. Frontend Architecture

### 4.1 Component Hierarchy

```
App.tsx
├── AuthProvider (Context)
├── ThemeProvider (Context)
└── RouterProvider
    ├── Public Routes (/, /about, /faq, /contact)
    ├── Auth Routes (/login, /register, /consent, /role-selection)
    ├── Hirer Routes (RequireAuth + RequireRole + RequireProfile + RequirePolicy)
    │   ├── /hirer/home — Dashboard + Job List
    │   ├── /hirer/create-job — Job Creation Wizard
    │   ├── /hirer/wallet — Wallet + Top-up
    │   ├── /hirer/care-recipients — Patient Profiles
    │   └── /hirer/search-caregivers — Caregiver Search
    ├── Caregiver Routes (RequireAuth + RequireRole + RequireProfile + RequirePolicy)
    │   ├── /caregiver/jobs/feed — Job Feed
    │   ├── /caregiver/my-jobs — My Jobs
    │   └── /caregiver/wallet — Wallet + Earnings
    ├── Shared Routes (RequireAuth)
    │   ├── /profile — User Profile
    │   ├── /kyc — KYC Verification
    │   ├── /job/:id — Job Detail
    │   ├── /chat/:jobId — Chat Room
    │   ├── /notifications — Notifications
    │   └── /disputes/:id — Dispute Chat
    └── Admin Routes (RequireAdmin)
        ├── /admin/dashboard
        ├── /admin/users, /admin/jobs, /admin/disputes
        └── /admin/financial, /admin/reports, /admin/settings
```

### 4.2 Key Patterns

- **Lazy Loading**: All page components use `React.lazy()` + `Suspense`
- **Route Guards**: `RequireAuth`, `RequireRole`, `RequireProfile`, `RequirePolicy`, `RequireAdmin`
- **API Client**: Singleton `ApiClient` class with automatic token refresh
- **State Management**: React Context (Auth) + component-level state (no Redux/Zustand store used in pages)
- **Styling**: TailwindCSS utility classes + custom `cn()` helper
- **Toast Notifications**: `react-hot-toast`
- **Icons**: `lucide-react`
- **Maps**: `react-leaflet` (Leaflet)

### 4.3 API Communication

```
Frontend (api.ts ApiClient)
    ↓
Vite Proxy (/api → http://backend:3000)
    ↓
Backend Express Routes
```

- `api.ts`: Core HTTP client with `request()`, `requestFormData()`, token refresh
- `appApi.ts`: Wrapper with domain-specific methods (e.g., `appApi.createJob()`)

## 5. Database Architecture

### 5.1 Core Tables & Relationships

```
users ──┬── hirer_profiles
        ├── caregiver_profiles
        ├── user_kyc_info
        ├── user_policy_acceptances
        ├── wallets (hirer/caregiver)
        └── bank_accounts

patient_profiles ←── hirer_id (users)

job_posts ──── jobs ──┬── job_assignments ←── caregiver_id (users)
                      ├── chat_threads ── chat_messages
                      ├── job_gps_events
                      ├── job_photo_evidence
                      ├── job_patient_requirements
                      ├── job_patient_sensitive_data
                      └── wallets (escrow per job)

disputes ──┬── dispute_events
           └── dispute_messages

wallets ── ledger_transactions (IMMUTABLE, append-only)

topup_intents ── provider_webhooks
```

### 5.2 Key Design Decisions

1. **Immutable Ledger**: `ledger_transactions` table has DB triggers to prevent UPDATE/DELETE
2. **Double-Entry Accounting**: Every transaction has `from_wallet_id` and `to_wallet_id`
3. **No Negative Balance**: CHECK constraint on `wallets.available_balance >= 0`
4. **One Active Assignment per Job**: Unique index on `job_assignments(job_id) WHERE status = 'active'`
5. **UUID Primary Keys**: All tables use `uuid_generate_v4()`
6. **Trust Level as Derived State**: Calculated by system, not set directly by users

### 5.3 ENUMs (Type Safety)

`user_role`, `user_status`, `trust_level`, `job_status` (7 states), `job_type` (6 types), `risk_level`, `assignment_status`, `transaction_type`, `transaction_reference_type`, `kyc_status`, `withdrawal_status`, `dispute_status`, `notification_channel`, `notification_status`, `chat_message_type`, `gps_event_type`, `photo_phase`

## 6. Mock Provider Architecture

Mock Provider จำลอง external services ทั้งหมด:

| Endpoint | จำลอง | Behavior |
|----------|-------|----------|
| `POST /payment/initiate` | Payment gateway | สร้าง QR, auto-webhook หลัง 3s |
| `POST /payment/charge` | Direct charge | Return success ทันที |
| `GET /payment/mock/:id` | Payment UI | HTML page กดจ่ายเงิน |
| `POST /sms/send-otp` | SMS provider | Return mock OTP ID |
| `POST /sms/verify-otp` | SMS verification | ตรวจกับ OTP code "123456" |
| `POST /kyc/submit` | KYC provider | Auto-approve |
| `POST /withdrawal/initiate` | Bank transfer | Return processing status |

## 7. Security Measures

- **JWT**: Access token (7d) + Refresh token (30d)
- **bcrypt**: Password hashing (10 rounds)
- **Helmet**: Security headers
- **Joi**: Input validation on all routes
- **Rate Limiting**: express-rate-limit
- **CORS**: Configurable origin
- **National ID Hash**: For KYC duplicate detection (privacy-preserving)
- **Encrypted Bank Account Numbers**: `account_number_encrypted` field
- **Route Guards**: Frontend + Backend role-based access control
