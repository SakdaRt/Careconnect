# คู่มือการติดตั้งระบบ CareConnect

> เอกสารฉบับนี้อธิบายขั้นตอนการติดตั้งระบบ CareConnect ตั้งแต่ความต้องการของระบบ การดาวน์โหลดซอร์สโค้ด การตั้งค่า จนถึงการรันระบบให้พร้อมใช้งาน

---

## สารบัญ

1. [ภาพรวมระบบ](#1-ภาพรวมระบบ)
2. [ความต้องการของระบบ](#2-ความต้องการของระบบ)
3. [การดาวน์โหลดซอร์สโค้ด](#3-การดาวน์โหลดซอร์สโค้ด)
4. [โครงสร้างโปรเจค](#4-โครงสร้างโปรเจค)
5. [การติดตั้งแบบ Docker (แนะนำ)](#5-การติดตั้งแบบ-docker-แนะนำ)
6. [การติดตั้งแบบ Manual (ไม่ใช้ Docker)](#6-การติดตั้งแบบ-manual-ไม่ใช้-docker)
7. [การกำหนดค่าตัวแปรสภาพแวดล้อม (Environment Variables)](#7-การกำหนดค่าตัวแปรสภาพแวดล้อม-environment-variables)
8. [การตั้งค่าฐานข้อมูล](#8-การตั้งค่าฐานข้อมูล)
9. [การรันระบบสำหรับพัฒนา (Development)](#9-การรันระบบสำหรับพัฒนา-development)
10. [การรันระบบสำหรับ Production](#10-การรันระบบสำหรับ-production)
11. [การทดสอบระบบ](#11-การทดสอบระบบ)
12. [การแก้ไขปัญหาที่พบบ่อย](#12-การแก้ไขปัญหาที่พบบ่อย)
13. [ภาคผนวก — รายการ Port ที่ใช้งาน](#13-ภาคผนวก--รายการ-port-ที่ใช้งาน)

---

## 1. ภาพรวมระบบ

CareConnect เป็นเว็บแอปพลิเคชันแบบ Two-sided Marketplace สำหรับเชื่อมต่อผู้ว่าจ้างกับผู้ดูแลผู้สูงอายุในประเทศไทย ระบบประกอบด้วย 4 ส่วนหลัก:

```
┌─────────────────────────────────────────────────────────────────┐
│                      Client (Web Browser)                       │
│               Hirer  /  Caregiver  /  Admin                     │
└──────────┬──────────────────────────────────────┬───────────────┘
           │ HTTPS                                │ WSS (Socket.IO)
           ▼                                      ▼
┌─────────────────────────┐      ┌────────────────────────────────┐
│   Frontend Container    │      │      Backend Container         │
│   React 18 + Vite       │─────▶│      Express.js + Socket.IO    │
│   TailwindCSS           │proxy │      JWT Auth + Joi Validation │
│   Port 5173 (dev)       │/api  │      Port 3000                 │
│   Port 80   (prod)      │      │                                │
└─────────────────────────┘      └───────┬──────────┬─────────────┘
                                         │          │
                           ┌─────────────┘          └──────────────┐
                           ▼                                       ▼
               ┌───────────────────┐               ┌───────────────────────┐
               │  PostgreSQL 15    │               │  Mock Provider        │
               │  Port 5432        │               │  (Payment/SMS/KYC)    │
               └───────────────────┘               │  Port 4000            │
                                                   └───────────────────────┘
```

| ส่วนประกอบ | เทคโนโลยี | หน้าที่ |
|---|---|---|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Vite | ส่วนติดต่อผู้ใช้ (UI) |
| **Backend** | Node.js (ESM), Express, Socket.IO | API Server, Business Logic, Real-time Chat |
| **Database** | PostgreSQL 15 | จัดเก็บข้อมูลทั้งหมด (41 tables) |
| **Mock Provider** | Node.js, Express | จำลอง Third-party Services (Payment, SMS, KYC) |

---

## 2. ความต้องการของระบบ

### 2.1 ความต้องการด้านฮาร์ดแวร์

#### สำหรับการพัฒนา (Development)

| รายการ | ข้อกำหนดขั้นต่ำ | ข้อกำหนดที่แนะนำ |
|---|---|---|
| **CPU** | 2 Cores (x86_64 / ARM64) | 4 Cores ขึ้นไป |
| **RAM** | 4 GB | 8 GB ขึ้นไป |
| **พื้นที่ดิสก์** | 10 GB ว่าง | 20 GB ว่าง (รวม Docker images) |
| **เครือข่าย** | อินเทอร์เน็ตสำหรับดาวน์โหลด dependencies | Broadband |

#### สำหรับ Production

| รายการ | ข้อกำหนดขั้นต่ำ | ข้อกำหนดที่แนะนำ |
|---|---|---|
| **CPU** | 2 vCPU | 4 vCPU ขึ้นไป |
| **RAM** | 4 GB | 8 GB ขึ้นไป |
| **พื้นที่ดิสก์** | 20 GB SSD | 50 GB SSD (รองรับ uploads + DB growth) |
| **เครือข่าย** | Static IP หรือ Domain Name | HTTPS Certificate + Reverse Proxy |

> **หมายเหตุ**: จากผลการทดสอบ Load Test ระบบรองรับได้ถึง 1,000 concurrent users โดยไม่มี HTTP error และทำงานได้ดีที่สุดที่ ≤ 200 concurrent users (p95 < 1s)

### 2.2 ความต้องการด้านซอฟต์แวร์

#### วิธีที่ 1: ติดตั้งผ่าน Docker (แนะนำ)

| ซอฟต์แวร์ | เวอร์ชันขั้นต่ำ | หมายเหตุ |
|---|---|---|
| **Docker Engine** | 24.0+ | [ดาวน์โหลด](https://docs.docker.com/get-docker/) |
| **Docker Compose** | v2.20+ | มาพร้อมกับ Docker Desktop |
| **Git** | 2.30+ | สำหรับ clone repository |

> **สำหรับ Windows**: ติดตั้ง [Docker Desktop for Windows](https://docs.docker.com/desktop/install/windows-install/) ซึ่งรวม Docker Engine + Docker Compose + WSL2 ไว้ในชุดเดียว

> **สำหรับ macOS**: ติดตั้ง [Docker Desktop for Mac](https://docs.docker.com/desktop/install/mac-install/)

> **สำหรับ Linux**: ติดตั้ง [Docker Engine](https://docs.docker.com/engine/install/) + [Docker Compose Plugin](https://docs.docker.com/compose/install/linux/)

#### วิธีที่ 2: ติดตั้งแบบ Manual (ไม่ใช้ Docker)

| ซอฟต์แวร์ | เวอร์ชันขั้นต่ำ | หมายเหตุ |
|---|---|---|
| **Node.js** | 20.0.0+ (LTS) | [ดาวน์โหลด](https://nodejs.org/) |
| **npm** | 10.0.0+ | มาพร้อมกับ Node.js |
| **PostgreSQL** | 15+ | [ดาวน์โหลด](https://www.postgresql.org/download/) |
| **Git** | 2.30+ | สำหรับ clone repository |

#### ซอฟต์แวร์เสริม (ไม่บังคับ)

| ซอฟต์แวร์ | หน้าที่ |
|---|---|
| **pgAdmin 4** | เครื่องมือจัดการฐานข้อมูล (มาพร้อม Docker Compose) |
| **VS Code** | Code Editor แนะนำ |
| **Postman / Insomnia** | ทดสอบ API |

### 2.3 ระบบปฏิบัติการที่รองรับ

| ระบบปฏิบัติการ | สถานะ |
|---|---|
| **Windows 10/11** (64-bit) + WSL2 | ✅ รองรับเต็มรูปแบบ |
| **macOS** (Intel / Apple Silicon) | ✅ รองรับเต็มรูปแบบ |
| **Ubuntu 20.04+** / Debian 11+ | ✅ รองรับเต็มรูปแบบ |
| **CentOS / RHEL 8+** | ✅ รองรับ |

---

## 3. การดาวน์โหลดซอร์สโค้ด

### วิธีที่ 1: Clone จาก Git Repository (แนะนำ)

```bash
# Clone repository
git clone https://github.com/SakdaRt/Careconnect.git

# เข้าสู่โฟลเดอร์โปรเจค
cd Careconnect
```

### วิธีที่ 2: ดาวน์โหลดเป็นไฟล์ ZIP

1. เข้าไปที่หน้า Repository บน GitHub
2. กดปุ่ม **Code** → **Download ZIP**
3. แตกไฟล์ ZIP ไปยังตำแหน่งที่ต้องการ
4. เปิด Terminal / Command Prompt แล้วเข้าสู่โฟลเดอร์ที่แตกไฟล์

```bash
cd path/to/careconnect
```

### วิธีที่ 3: Upload Source Code (กรณีได้รับไฟล์โดยตรง)

1. คัดลอกโฟลเดอร์ซอร์สโค้ดทั้งหมดไปยัง Server หรือเครื่องที่ต้องการติดตั้ง
2. ตรวจสอบให้แน่ใจว่าโครงสร้างไฟล์ครบถ้วน (ดูหัวข้อที่ 4)

---

## 4. โครงสร้างโปรเจค

ตรวจสอบว่าโฟลเดอร์โปรเจคมีโครงสร้างดังนี้:

```
careconnect/
├── frontend/                    # React 18 + TypeScript + Tailwind CSS + Vite
│   ├── src/                     # ซอร์สโค้ด Frontend
│   │   ├── pages/               # หน้าต่างๆ แบ่งตาม role
│   │   ├── components/          # UI components
│   │   ├── layouts/             # MainLayout, AdminLayout
│   │   ├── contexts/            # AuthContext
│   │   ├── services/            # api.ts, appApi.ts
│   │   └── router.tsx           # Route definitions
│   ├── package.json             # Frontend dependencies
│   ├── vite.config.ts           # Vite configuration
│   ├── Dockerfile               # Production Dockerfile
│   ├── Dockerfile.dev           # Development Dockerfile
│   ├── nginx.conf               # Nginx config (production)
│   └── tsconfig.json            # TypeScript config
│
├── backend/                     # Node.js + Express + PostgreSQL
│   ├── src/
│   │   ├── controllers/         # Request handlers
│   │   ├── services/            # Business logic
│   │   ├── models/              # Database queries
│   │   ├── routes/              # API route definitions (17 files)
│   │   ├── middleware/          # auth.js (JWT + policy gates)
│   │   ├── utils/               # errors.js, risk.js, db.js, validation.js
│   │   ├── workers/             # trustLevelWorker.js, noShowWorker.js
│   │   ├── sockets/             # chatSocket.js, realtimeHub.js
│   │   ├── seeds/               # mockData.js, demoSeed.js
│   │   └── server.js            # Entry point
│   ├── database/
│   │   └── migrations/          # SQL migration files (21 files)
│   ├── scripts/
│   │   └── migrate.js           # Migration runner
│   ├── tests/                   # Jest test files
│   ├── package.json             # Backend dependencies
│   ├── Dockerfile               # Production Dockerfile
│   └── Dockerfile.dev           # Development Dockerfile
│
├── mock-provider/               # Mock third-party services
│   ├── src/
│   │   └── server.js            # Mock Payment/SMS/KYC server
│   ├── package.json
│   └── Dockerfile.dev
│
├── database/
│   └── schema.sql               # Master DB schema (41 tables, ~1,470 lines)
│
├── docker-compose.yml           # Development environment (หลัก)
├── docker-compose.override.yml  # Development overrides (hot-reload)
├── docker-compose.prod.yml      # Production environment
├── docker-compose.test.yml      # Test environment
├── SYSTEM.md                    # System documentation
├── PROGRESS.md                  # Progress log
└── INSTALLATION.md              # คู่มือนี้
```

---

## 5. การติดตั้งแบบ Docker (แนะนำ)

วิธีนี้เป็นวิธีที่ง่ายและรวดเร็วที่สุด เพราะ Docker จะจัดการ dependencies ทั้งหมดให้โดยอัตโนมัติ

### ขั้นตอนที่ 1: ตรวจสอบ Docker

```bash
# ตรวจสอบว่า Docker ติดตั้งแล้ว
docker --version
# ตัวอย่างผลลัพธ์: Docker version 24.0.7, build afdd53b

# ตรวจสอบ Docker Compose
docker compose version
# ตัวอย่างผลลัพธ์: Docker Compose version v2.23.3
```

### ขั้นตอนที่ 2: Build Docker Images

```bash
# เข้าสู่โฟลเดอร์โปรเจค
cd careconnect

# Build images ทั้งหมด (ครั้งแรกจะใช้เวลาประมาณ 3-5 นาที)
docker compose build
```

### ขั้นตอนที่ 3: เริ่มระบบ

```bash
# เริ่มทุก service (รันใน background)
docker compose up -d
```

Docker Compose จะสร้างและเริ่ม services ต่อไปนี้โดยอัตโนมัติ:

| Service | Container Name | Port | หน้าที่ |
|---|---|---|---|
| **postgres** | careconnect-postgres | 5432 | ฐานข้อมูล PostgreSQL 15 |
| **backend** | careconnect-backend | 3000 | API Server (Express.js) |
| **frontend** | careconnect-frontend | 5173 | Web UI (Vite dev server) |
| **mock-provider** | careconnect-mock-provider | 4000 | Mock Payment/SMS/KYC |
| **pgadmin** | careconnect-pgadmin | 5050 | เครื่องมือจัดการ DB (Optional) |

### ขั้นตอนที่ 4: ตรวจสอบสถานะ

```bash
# ดูสถานะ containers ทั้งหมด
docker compose ps

# ดู logs (ทุก service)
docker compose logs -f

# ดู logs เฉพาะ backend
docker compose logs -f backend
```

### ขั้นตอนที่ 5: รัน Database Migrations

```bash
# รัน migrations เพื่ออัพเดท schema เพิ่มเติม
docker compose run --rm migrate
```

### ขั้นตอนที่ 6: สร้างข้อมูลตัวอย่าง (ไม่บังคับ)

```bash
# สร้างข้อมูล demo สำหรับทดสอบ
docker compose exec backend node src/seeds/demoSeed.js

# ถ้าต้องการล้างข้อมูล demo แล้วสร้างใหม่
docker compose exec backend node src/seeds/demoSeed.js --reset
```

### ขั้นตอนที่ 7: เปิดใช้งาน

เปิดเว็บเบราว์เซอร์แล้วเข้าที่:

| URL | หน้าที่ |
|---|---|
| **http://localhost:5173** | หน้าเว็บ CareConnect |
| **http://localhost:3000/health** | ตรวจสอบสถานะ Backend API |
| **http://localhost:5050** | pgAdmin (จัดการฐานข้อมูล) |
| **http://localhost:4000** | Mock Provider Dashboard |

#### บัญชีผู้ดูแลระบบเริ่มต้น (Admin)

| รายการ | ค่า |
|---|---|
| **Email** | admin@careconnect.com |
| **Password** | Admin1234! |

#### บัญชี pgAdmin เริ่มต้น

| รายการ | ค่า |
|---|---|
| **Email** | admin@careconnect.com |
| **Password** | admin |

เมื่อเข้า pgAdmin ให้เพิ่ม Server Connection ด้วยค่าดังนี้:

| รายการ | ค่า |
|---|---|
| Host | postgres (ชื่อ Docker container) |
| Port | 5432 |
| Database | careconnect |
| Username | careconnect |
| Password | careconnect_dev_password |

### การหยุดระบบ

```bash
# หยุดทุก service
docker compose down

# หยุดทุก service พร้อมลบข้อมูล (volumes)
docker compose down -v
```

---

## 6. การติดตั้งแบบ Manual (ไม่ใช้ Docker)

### ขั้นตอนที่ 1: ตรวจสอบ Prerequisites

```bash
# ตรวจสอบ Node.js (ต้อง v20+)
node --version
# ตัวอย่างผลลัพธ์: v20.11.0

# ตรวจสอบ npm (ต้อง v10+)
npm --version
# ตัวอย่างผลลัพธ์: 10.2.4

# ตรวจสอบ PostgreSQL
psql --version
# ตัวอย่างผลลัพธ์: psql (PostgreSQL) 15.5
```

### ขั้นตอนที่ 2: ติดตั้ง PostgreSQL

#### Windows

1. ดาวน์โหลด PostgreSQL 15+ จาก https://www.postgresql.org/download/windows/
2. รัน installer และทำตามขั้นตอน
3. ตั้ง password สำหรับ user `postgres`
4. จดจำ port (ค่าเริ่มต้น: 5432)

#### macOS

```bash
# ผ่าน Homebrew
brew install postgresql@15
brew services start postgresql@15
```

#### Ubuntu/Debian

```bash
sudo apt update
sudo apt install postgresql-15 postgresql-client-15
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### ขั้นตอนที่ 3: สร้างฐานข้อมูล

```bash
# เข้าสู่ PostgreSQL shell
sudo -u postgres psql    # Linux/macOS
# หรือ
psql -U postgres         # Windows

# สร้างฐานข้อมูลและ user
CREATE USER careconnect WITH PASSWORD 'careconnect_dev_password';
CREATE DATABASE careconnect OWNER careconnect;
GRANT ALL PRIVILEGES ON DATABASE careconnect TO careconnect;

# ออกจาก psql
\q
```

### ขั้นตอนที่ 4: นำเข้า Schema

```bash
# นำเข้า schema หลัก (41 tables)
psql -U careconnect -d careconnect -f database/schema.sql
```

### ขั้นตอนที่ 5: ติดตั้ง Backend Dependencies

```bash
# เข้าโฟลเดอร์ backend
cd backend

# ติดตั้ง dependencies
npm install

# กลับไปโฟลเดอร์หลัก
cd ..
```

> **หมายเหตุ (Windows)**: Package `bcrypt` และ `sharp` ต้องการ build tools เพิ่มเติม หากติดตั้งไม่สำเร็จ ให้รัน:
> ```bash
> npm install --global windows-build-tools
> ```
> หรือติดตั้ง Visual Studio Build Tools จาก https://visualstudio.microsoft.com/visual-cpp-build-tools/

### ขั้นตอนที่ 6: ติดตั้ง Frontend Dependencies

```bash
# เข้าโฟลเดอร์ frontend
cd frontend

# ติดตั้ง dependencies
npm install

# กลับไปโฟลเดอร์หลัก
cd ..
```

### ขั้นตอนที่ 7: ติดตั้ง Mock Provider Dependencies

```bash
# เข้าโฟลเดอร์ mock-provider
cd mock-provider

# ติดตั้ง dependencies
npm install

# กลับไปโฟลเดอร์หลัก
cd ..
```

### ขั้นตอนที่ 8: กำหนดค่า Environment Variables

ดูรายละเอียดเต็มที่ [หัวข้อที่ 7](#7-การกำหนดค่าตัวแปรสภาพแวดล้อม-environment-variables)

สร้างไฟล์ `.env` ที่โฟลเดอร์ root ของโปรเจค:

```bash
# คัดลอกตัวอย่างด้านล่างไปสร้างไฟล์ .env
```

### ขั้นตอนที่ 9: รัน Database Migrations

```bash
cd backend
npm run migrate
cd ..
```

### ขั้นตอนที่ 10: เริ่มระบบ

เปิด 3 Terminal พร้อมกัน:

**Terminal 1 — Mock Provider:**
```bash
cd mock-provider
npm run dev
# Mock Provider จะรันที่ http://localhost:4000
```

**Terminal 2 — Backend:**
```bash
cd backend
npm run dev
# Backend จะรันที่ http://localhost:3000
```

**Terminal 3 — Frontend:**
```bash
cd frontend
npm run dev
# Frontend จะรันที่ http://localhost:5173
```

---

## 7. การกำหนดค่าตัวแปรสภาพแวดล้อม (Environment Variables)

### 7.1 สำหรับ Development (ไม่ใช้ Docker)

สร้างไฟล์ `.env` ที่โฟลเดอร์ root ของโปรเจค (`careconnect/.env`):

```env
# ─── Database ───
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=careconnect
DATABASE_USER=careconnect
DATABASE_PASSWORD=careconnect_dev_password

# ─── JWT Authentication ───
JWT_SECRET=careconnect_jwt_secret_dev_only
JWT_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=30d

# ─── Server ───
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# ─── Mock Providers ───
MOCK_PROVIDER_BASE_URL=http://localhost:4000
PAYMENT_PROVIDER=mock
SMS_PROVIDER=mock
KYC_PROVIDER=mock
BANK_TRANSFER_PROVIDER=mock
EMAIL_PROVIDER=mock
PUSH_PROVIDER=mock

# ─── Webhooks ───
WEBHOOK_BASE_URL=http://localhost:3000
WEBHOOK_SECRET=careconnect_webhook_secret_dev

# ─── File Storage ───
UPLOAD_DIR=./uploads
MAX_FILE_SIZE_MB=10

# ─── Email (mock mode — ไม่ต้องตั้งค่าจริง) ───
EMAIL_FROM=noreply@careconnect.local

# ─── Admin Account (สร้างอัตโนมัติตอน bootstrap) ───
ADMIN_EMAIL=admin@careconnect.com
ADMIN_PASSWORD=Admin1234!

# ─── Timezone ───
TZ=Asia/Bangkok

# ─── Frontend (Vite) ───
VITE_API_TARGET=http://localhost:3000
```

> **หมายเหตุ**: เมื่อใช้ Docker Compose ไม่จำเป็นต้องสร้างไฟล์ `.env` เพราะค่าทั้งหมดถูกกำหนดไว้ใน `docker-compose.yml` แล้ว แต่สามารถสร้างไฟล์ `.env` เพื่อ override ค่าบางตัวได้

### 7.2 ตัวแปรเพิ่มเติม (Optional)

#### Google OAuth 2.0 (สำหรับ Sign in with Google)

```env
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
```

วิธีรับ Google OAuth Credentials:
1. เข้า [Google Cloud Console](https://console.cloud.google.com/)
2. สร้างโปรเจคใหม่ หรือเลือกโปรเจคที่มีอยู่
3. เปิดใช้ Google+ API
4. ไปที่ **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth 2.0 Client IDs**
5. เลือก Application type: **Web application**
6. เพิ่ม Authorized redirect URIs: `http://localhost:3000/api/auth/google/callback`
7. คัดลอก Client ID และ Client Secret

#### Stripe Payment (สำหรับการเติมเงินจริง)

```env
PAYMENT_PROVIDER=stripe
STRIPE_PUBLISHABLE_KEY=pk_test_xxxx
STRIPE_SECRET_KEY=sk_test_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx
```

#### SMS จริง (SMSOK Provider)

```env
SMS_PROVIDER=smsok
SMSOK_API_URL=https://api.smsok.co/s
SMSOK_API_KEY=your_api_key
SMSOK_API_SECRET=your_api_secret
SMSOK_SENDER=CareConnect
```

#### Email จริง (SMTP)

```env
EMAIL_PROVIDER=smtp
EMAIL_FROM=noreply@yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

### 7.3 สำหรับ Production

สร้างไฟล์ `.env` สำหรับ production:

```env
# ─── Database (เปลี่ยนรหัสผ่านเป็นค่าที่ปลอดภัย!) ───
POSTGRES_DB=careconnect
POSTGRES_USER=careconnect
POSTGRES_PASSWORD=<STRONG_PASSWORD_HERE>

# ─── JWT (ใช้ random string ยาว 64+ ตัวอักษร) ───
JWT_SECRET=<RANDOM_JWT_SECRET_64_CHARS>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ─── Webhooks ───
WEBHOOK_SECRET=<RANDOM_WEBHOOK_SECRET>

# ─── Admin ───
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=<STRONG_ADMIN_PASSWORD>

# ─── CORS ───
CORS_ORIGIN=https://yourdomain.com

# ─── Google OAuth ───
GOOGLE_CLIENT_ID=your_production_client_id
GOOGLE_CLIENT_SECRET=your_production_client_secret
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback
FRONTEND_URL=https://yourdomain.com
BACKEND_URL=https://yourdomain.com

# ─── Port ───
HTTP_PORT=80
```

> **⚠️ สำคัญ**: ห้ามใช้ค่า default ใน production! ต้องเปลี่ยนรหัสผ่านและ secret keys ทั้งหมด

---

## 8. การตั้งค่าฐานข้อมูล

### 8.1 Schema เริ่มต้น

ระบบใช้ฐานข้อมูล PostgreSQL 15 ประกอบด้วย 41 tables โดย schema หลักอยู่ที่ `database/schema.sql`

**เมื่อใช้ Docker**: Schema จะถูกนำเข้าโดยอัตโนมัติตอน container เริ่มทำงานครั้งแรก ผ่าน Docker entrypoint initdb:

```yaml
volumes:
  - ./database/schema.sql:/docker-entrypoint-initdb.d/01-schema.sql:ro
```

**เมื่อไม่ใช้ Docker**: นำเข้าด้วยคำสั่ง:

```bash
psql -U careconnect -d careconnect -f database/schema.sql
```

### 8.2 Database Migrations

ระบบมี migration files 21 ไฟล์ อยู่ที่ `backend/database/migrations/` ใช้สำหรับปรับปรุง schema เพิ่มเติมหลังจาก schema หลัก

```bash
# ดูสถานะ migrations
cd backend
npm run migrate:status

# รัน pending migrations
npm run migrate

# Bootstrap schema ใหม่ทั้งหมด (กรณี DB ว่าง)
npm run migrate:bootstrap
```

**เมื่อใช้ Docker**:

```bash
# รัน migrations ผ่าน Docker
docker compose run --rm migrate

# ดูสถานะ migrations
docker compose exec backend node scripts/migrate.js status
```

### 8.3 ข้อมูลตัวอย่าง (Demo Seed)

ระบบมีสคริปต์สร้างข้อมูลสาธิตครบทุก flow:

```bash
# สร้างข้อมูล demo
npm run seed:demo          # Manual
# หรือ
docker compose exec backend npm run seed:demo  # Docker

# ล้างและสร้างใหม่
npm run seed:demo:reset
```

บัญชี demo ใช้ email pattern `*@demo.careconnect.local` รหัสผ่าน: `Demo1234!`

---

## 9. การรันระบบสำหรับพัฒนา (Development)

### 9.1 ด้วย Docker Compose (แนะนำ)

```bash
# เริ่มทุก service
docker compose up -d

# ดู logs แบบ real-time
docker compose logs -f

# รัน migrations
docker compose run --rm migrate
```

**คุณสมบัติ Development Mode:**
- **Hot Reload**: แก้ไขโค้ดแล้วเห็นผลทันที (ทั้ง frontend และ backend)
- **Volume Mounts**: ซอร์สโค้ดถูก mount เข้า container โดยตรง
- **pgAdmin**: เครื่องมือจัดการ DB พร้อมใช้ที่ http://localhost:5050
- **Mock OTP**: OTP code คงที่ = `123456` (ไม่ต้องรับ SMS/Email จริง)
- **Mock Payment**: ชำระเงินสำเร็จโดยอัตโนมัติ
- **Mock KYC**: KYC อนุมัติอัตโนมัติ
- **Auto Top-up**: ถ้ายอดเงินไม่พอตอน publish job ระบบจะเติมให้อัตโนมัติ

### 9.2 แบบ Manual

เปิด 3 Terminal:

```bash
# Terminal 1: Mock Provider
cd mock-provider && npm run dev

# Terminal 2: Backend
cd backend && npm run dev

# Terminal 3: Frontend
cd frontend && npm run dev
```

### 9.3 ทดสอบว่าระบบทำงานได้

1. เปิด http://localhost:5173 — ต้องเห็นหน้า Landing Page
2. เปิด http://localhost:3000/health — ต้องเห็น JSON `{ "status": "ok" }`
3. ลงทะเบียนผู้ใช้ใหม่ผ่านหน้าเว็บ
4. Login ด้วย Admin: `admin@careconnect.com` / `Admin1234!`

---

## 10. การรันระบบสำหรับ Production

### 10.1 เตรียมไฟล์ .env

สร้างไฟล์ `.env` ที่ root ของโปรเจค ดูตัวอย่างที่ [หัวข้อ 7.3](#73-สำหรับ-production)

### 10.2 Build และ Deploy

```bash
# Build production images
docker compose -f docker-compose.prod.yml build

# รัน migrations
docker compose -f docker-compose.prod.yml --profile migrate run --rm migrate

# เริ่มระบบ production
docker compose -f docker-compose.prod.yml up -d
```

### 10.3 ความแตกต่างระหว่าง Development และ Production

| รายการ | Development | Production |
|---|---|---|
| **Frontend** | Vite Dev Server (port 5173) | Nginx + Static Build (port 80) |
| **Backend** | nodemon (hot-reload) | node (production) |
| **JWT Expiry** | 7 วัน | 15 นาที |
| **Mock Provider** | ✅ มี | ❌ ไม่มี |
| **pgAdmin** | ✅ มี | ❌ ไม่มี |
| **Source Volumes** | ✅ Mount (hot-reload) | ❌ Copy into image |
| **DB Password** | ค่า default | **ต้องตั้งค่าเอง** |
| **JWT Secret** | ค่า default | **ต้องตั้งค่าเอง** |

### 10.4 Production Frontend (Nginx)

ใน production frontend จะถูก build เป็น static files แล้ว serve ผ่าน Nginx ซึ่งทำหน้าที่:
- Serve static files (React SPA)
- Reverse proxy `/api/*` → Backend container (port 3000)
- Reverse proxy `/socket.io/*` → Backend container (WebSocket)
- Reverse proxy `/uploads/*` → Backend container (uploaded files)
- Gzip compression
- Cache static assets (1 year)
- Security headers (X-Frame-Options, X-Content-Type-Options, X-XSS-Protection)

### 10.5 SSL/HTTPS (แนะนำสำหรับ Production)

สำหรับ production ควรใช้ reverse proxy ด้านหน้า (เช่น Nginx, Caddy, Traefik) ที่จัดการ SSL certificate:

```bash
# ตัวอย่าง: ใช้ Caddy เป็น reverse proxy
# Caddyfile
yourdomain.com {
    reverse_proxy localhost:80
}
```

หรือใช้บริการ Cloud ที่จัดการ SSL ให้ เช่น AWS ALB, Cloudflare, DigitalOcean App Platform

---

## 11. การทดสอบระบบ

### 11.1 Backend Unit/Integration Tests

```bash
# รันทั้งหมด (พร้อม coverage)
cd backend
npm test

# รันเฉพาะ integration tests
npm run test:integration

# รันเฉพาะ smoke tests
npm run test:smoke

# รันเฉพาะ E2E smoke tests
npm run test:e2e-smoke
```

**ด้วย Docker (Test Environment แยก):**

```bash
# รัน backend integration tests ใน Docker
docker compose -f docker-compose.test.yml up --build --abort-on-container-exit backend-test
```

### 11.2 Frontend Tests

```bash
cd frontend

# Unit tests
npm test

# E2E tests (Playwright)
npm run test:e2e

# E2E tests แบบเห็น browser
npm run test:e2e:headed
```

### 11.3 Load Tests (k6)

```bash
# ติดตั้ง k6 ก่อน: https://k6.io/docs/get-started/installation/

# Smoke test (1-5 VU, 30s)
k6 run load-tests/k6-smoke.js

# Load test (10-100 VU, 6 min)
k6 run load-tests/k6-load.js
```

---

## 12. การแก้ไขปัญหาที่พบบ่อย

### ปัญหา: Docker build ล้มเหลวที่ `sharp` หรือ `bcrypt`

```bash
# ล้าง Docker cache แล้ว build ใหม่
docker compose build --no-cache backend
```

### ปัญหา: Port 5432 ถูกใช้งานอยู่แล้ว (PostgreSQL local)

```bash
# Windows: หยุด PostgreSQL service
net stop postgresql-x64-15

# Linux/macOS:
sudo systemctl stop postgresql

# หรือเปลี่ยน port ใน docker-compose.yml
# ports: "5433:5432" แทน "5432:5432"
```

### ปัญหา: Frontend ไม่สามารถเชื่อมต่อ Backend ได้

ตรวจสอบว่า:
1. Backend container รันอยู่: `docker compose ps`
2. Backend health check ผ่าน: เปิด http://localhost:3000/health
3. Vite proxy ตั้งค่าถูกต้อง (ดู `frontend/vite.config.ts`)

### ปัญหา: Database connection refused

```bash
# ตรวจสอบว่า PostgreSQL container รันอยู่
docker compose ps postgres

# ดู logs ของ PostgreSQL
docker compose logs postgres

# ตรวจสอบ healthcheck
docker inspect careconnect-postgres | grep -A 10 Health
```

### ปัญหา: Hot-reload ไม่ทำงาน (Windows/WSL2)

เพิ่มตัวแปรใน `.env`:

```env
VITE_USE_POLLING=true
```

### ปัญหา: Permission denied ตอน upload ไฟล์

```bash
# สร้างโฟลเดอร์ uploads และตั้ง permissions
mkdir -p backend/uploads/avatars backend/uploads/jobs backend/uploads/chat backend/uploads/disputes
chmod -R 777 backend/uploads  # เฉพาะ development เท่านั้น
```

### ปัญหา: Migrations ไม่ทำงาน

```bash
# ตรวจสอบสถานะ
docker compose exec backend node scripts/migrate.js status

# ตรวจสอบ connection
docker compose exec backend node -e "
  import pg from 'pg';
  const pool = new pg.Pool({host:'postgres',database:'careconnect',user:'careconnect',password:'careconnect_dev_password'});
  pool.query('SELECT NOW()').then(r => { console.log('Connected:', r.rows[0]); pool.end(); });
"
```

### การ Reset ระบบทั้งหมด (ลบข้อมูลทั้งหมด)

```bash
# หยุด containers + ลบ volumes ทั้งหมด
docker compose down -v

# Build และเริ่มใหม่
docker compose up -d --build

# รัน migrations
docker compose run --rm migrate
```

---

## 13. ภาคผนวก — รายการ Port ที่ใช้งาน

| Port | Service | Mode | คำอธิบาย |
|---|---|---|---|
| **5173** | Frontend (Vite) | Development | React Dev Server + HMR |
| **80** | Frontend (Nginx) | Production | Static files + Reverse Proxy |
| **3000** | Backend (Express) | ทั้งสอง | REST API + Socket.IO |
| **5432** | PostgreSQL | ทั้งสอง | ฐานข้อมูล |
| **4000** | Mock Provider | Development | Mock Payment/SMS/KYC |
| **5050** | pgAdmin | Development | Database Management UI |
| **5433** | PostgreSQL (Test) | Test | ฐานข้อมูลทดสอบ |

---

> **จัดทำโดย**: ทีมพัฒนา CareConnect
> **อัพเดทล่าสุด**: 2026-04-04
