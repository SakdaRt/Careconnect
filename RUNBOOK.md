# CareConnect — Runbook

## 1. Prerequisites

| Tool | Version | ตรวจสอบ |
|------|---------|---------|
| Docker | 20+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |
| Node.js | 20+ | `node --version` |
| npm | 10+ | `npm --version` |
| Git | 2.30+ | `git --version` |

## 2. Quick Start (Docker — แนะนำ)

```bash
# 1. Clone repo
git clone https://github.com/SakdaRt/Careconnect.git
cd Careconnect

# 2. Start ทุก service
docker-compose up -d

# 3. รอ ~30 วินาทีให้ postgres + backend พร้อม แล้วเปิด
#    Frontend: http://localhost:5173
#    Backend:  http://localhost:3000/health
#    pgAdmin:  http://localhost:5050
```

## 3. Makefile Shortcuts

```bash
make dev            # Start development environment
make dev-stop       # Stop development environment
make dev-restart    # Restart all services
make migrate-dev    # Run database migrations
make logs           # Tail logs from all services
make clean          # Remove all containers + volumes (DESTRUCTIVE)
make build-dev      # Rebuild Docker images
```

## 4. Environment Variables

### 4.1 Backend (set in docker-compose.yml)

| Variable | Default | คำอธิบาย |
|----------|---------|----------|
| `NODE_ENV` | development | Environment mode |
| `PORT` | 3000 | Server port |
| `DATABASE_HOST` | postgres | DB hostname (Docker service name) |
| `DATABASE_PORT` | 5432 | DB port |
| `DATABASE_NAME` | careconnect | DB name |
| `DATABASE_USER` | careconnect | DB user |
| `DATABASE_PASSWORD` | careconnect_dev_password | DB password |
| `JWT_SECRET` | careconnect_jwt_secret_dev_only | JWT signing secret |
| `JWT_EXPIRES_IN` | 7d | Access token TTL |
| `JWT_REFRESH_EXPIRES_IN` | 30d | Refresh token TTL |
| `MOCK_PROVIDER_BASE_URL` | http://mock-provider:4000 | Mock provider URL |
| `WEBHOOK_BASE_URL` | http://backend:3000 | Webhook callback URL |
| `ADMIN_EMAIL` | admin@careconnect.com | Bootstrap admin email |
| `ADMIN_PASSWORD` | Admin1234! | Bootstrap admin password |

### 4.2 Frontend

| Variable | Default | คำอธิบาย |
|----------|---------|----------|
| `VITE_API_URL` | (empty = use proxy) | API base URL |
| `VITE_PUBLIC_HOST` | (empty) | Public hostname for Vite HMR |

### 4.3 Mock Provider

| Variable | Default | คำอธิบาย |
|----------|---------|----------|
| `MOCK_PAYMENT_AUTO_SUCCESS` | true | Auto-complete payments |
| `MOCK_PAYMENT_SUCCESS_DELAY_MS` | 3000 | Delay before auto-success webhook |
| `MOCK_SMS_OTP_CODE` | 123456 | OTP code for mock verification |
| `MOCK_KYC_AUTO_APPROVE` | true | Auto-approve KYC submissions |

## 5. Run Without Docker (Local Development)

### 5.1 Database

```bash
# ติดตั้ง PostgreSQL 15 locally หรือใช้ Docker เฉพาะ DB:
docker run -d --name careconnect-db \
  -e POSTGRES_DB=careconnect \
  -e POSTGRES_USER=careconnect \
  -e POSTGRES_PASSWORD=careconnect_dev_password \
  -p 5432:5432 \
  -v ./database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro \
  postgres:15-alpine
```

### 5.2 Backend

```bash
cd backend
cp .env.example .env
# แก้ .env: DATABASE_HOST=localhost
npm install
npm run dev          # Start with nodemon (hot reload)
```

### 5.3 Frontend

```bash
cd frontend
# ไม่ต้อง .env (ใช้ Vite proxy)
npm install
npm run dev          # Start Vite dev server
```

### 5.4 Mock Provider

```bash
cd mock-provider
npm install
npm run dev
```

## 6. Database Migrations

```bash
# ผ่าน Docker
make migrate-dev

# หรือรัน manual
cd backend
npm run migrate           # Run pending migrations
npm run migrate:status    # Check migration status
```

Migration files อยู่ที่:
- `database/migrations/` — Schema-level migrations
- `backend/database/migrations/` — Backend-specific migrations

## 7. Running Tests

### 7.1 Backend Tests

```bash
cd backend
npm test                  # Run all tests with coverage
npm run test:integration  # Integration tests only
npm run test:smoke        # Smoke tests (Tier-0)
```

### 7.2 Frontend Tests

```bash
cd frontend
npm test                  # Run all tests (watch mode)
npm run test:run          # Run once
npm run test:coverage     # With coverage report
npm run test:logic        # Core logic tests only
```

## 8. Building for Production

### 8.1 Frontend Build

```bash
cd frontend
npm run build             # tsc + vite build → dist/
```

### 8.2 Docker Production

```bash
docker-compose -f docker-compose.prod.yml up -d
# หรือ
make prod
```

## 9. Default Accounts

| Role | Email | Password | หมายเหตุ |
|------|-------|----------|----------|
| Admin | admin@careconnect.com | Admin1234! | Auto-created on startup |
| Mock Caregiver 1 | caregiver.mock1@careconnect.local | DemoCare123! | Dev mode only |
| Mock Caregiver 2 | caregiver.mock2@careconnect.local | DemoCare123! | Dev mode only |
| Mock Caregiver 3-5 | caregiver.mock3-5@careconnect.local | DemoCare123! | Dev mode only |

## 10. Troubleshooting

### ปัญหา: Backend ไม่ connect database
```bash
# ตรวจสอบว่า postgres container healthy
docker-compose ps
docker-compose logs postgres
# ถ้า container ไม่ขึ้น ลอง restart
docker-compose restart postgres
```

### ปัญหา: Frontend แสดง "Blocked request"
- เพิ่ม hostname ใน `frontend/vite.config.ts` → `allowedHosts`
- ปัจจุบัน allow: `careconnect.kmitl.site`

### ปัญหา: Port conflict
```bash
# ตรวจสอบ port ที่ใช้
# Windows:
netstat -ano | findstr :3000
netstat -ano | findstr :5173
# Linux/Mac:
lsof -i :3000
```

### ปัญหา: Migration ไม่รัน
```bash
# ตรวจสอบ migration status
cd backend && npm run migrate:status
# รัน manual
npm run migrate
```

### ปัญหา: Mock OTP ไม่ผ่าน
- ใช้ OTP code: `123456` (default ของ mock provider)

### ปัญหา: TypeScript build errors
```bash
cd frontend
npx tsc --noEmit    # ตรวจสอบ type errors โดยไม่ build
npm run build       # Full build (tsc + vite)
```

## 11. Useful Commands

```bash
# ดู logs ของ service เฉพาะ
docker-compose logs -f backend
docker-compose logs -f frontend

# เข้า container
docker exec -it careconnect-backend sh
docker exec -it careconnect-postgres psql -U careconnect

# Reset database (DESTRUCTIVE)
docker-compose down -v
docker-compose up -d

# Rebuild specific service
docker-compose build backend
docker-compose up -d backend
```
