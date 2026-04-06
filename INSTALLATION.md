# คู่มือการติดตั้งระบบ CareConnect

> เอกสารฉบับนี้อธิบายวิธีขึ้นระบบ CareConnect บน server สเปคเดียวกับเครื่องที่ใช้งานอยู่จริงในปัจจุบัน โดยเน้น Docker Compose เป็นหลัก และอธิบายการตั้งค่า `.env` ตาม source of truth จากไฟล์คอนฟิกและโค้ดใน repository

> **Baseline ที่ยืนยันแล้วกับเครื่องจริง (2026-04-06)**
>
> - Ubuntu 22.04.5 LTS
> - Docker 28.4.0
> - Docker Compose v2.39.1
> - 4 vCPU, RAM 3.8 GiB, ดิสก์ 49 GiB
> - stack ที่ใช้อยู่จริงตอนนี้คือ `docker-compose.yml` (development profile)
> - public access ปัจจุบันใช้ Cloudflare Tunnel ชี้เข้า `http://localhost:5173`

> **ข้อสรุปสำคัญ**: ถ้าต้องการขึ้นระบบให้เหมือน server ปัจจุบัน ให้ใช้ Docker Compose ก่อนเป็นอันดับแรก ไม่ควรอิงการติดตั้ง Node.js บน host โดยตรง เพราะ package ของโปรเจคต้องการ `node >= 20` และ `npm >= 10`

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

CareConnect เป็นเว็บแอปพลิเคชันแบบ Two-sided Marketplace สำหรับเชื่อมต่อผู้ว่าจ้างกับผู้ดูแลผู้สูงอายุในประเทศไทย โดยระบบที่ใช้งานอยู่จริงในปัจจุบันรันผ่าน Docker Compose และเปิด public access ด้วย Cloudflare Tunnel

### Topology ที่ใช้อยู่จริงบน server ปัจจุบัน

```
Internet / Browser
        │
        ▼
Cloudflare Tunnel
        │
        ▼
Frontend container (Vite dev server :5173)
        │  proxy /api, /socket.io, /uploads
        ▼
Backend container (Express + Socket.IO :3000)
        │
        ├── PostgreSQL 15 (:5432)
        └── Mock Provider (:4000)

Optional tool:
pgAdmin (:5050)
```

| ส่วนประกอบ | เทคโนโลยี | หน้าที่ |
|---|---|---|
| **Frontend** | React 18, TypeScript, Tailwind CSS, Vite | หน้าเว็บและ Vite proxy สำหรับ `/api`, `/socket.io`, `/uploads` |
| **Backend** | Node.js (ESM), Express, Socket.IO, Joi | REST API, business logic, websocket, env validation |
| **Database** | PostgreSQL 15 | ฐานข้อมูลหลักของระบบ |
| **Mock Provider** | Node.js, Express | จำลอง payment, SMS, KYC และ bank transfer ใน development |
| **Cloudflare Tunnel** | cloudflared systemd service | เปิด public URL มายัง `http://localhost:5173` |

### Service และพอร์ตหลัก

| Service | Compose file ปัจจุบัน | Port | หมายเหตุ |
|---|---|---|---|
| `frontend` | `docker-compose.yml` | `5173` | Vite dev server + HMR |
| `backend` | `docker-compose.yml` | `3000` | API + Socket.IO |
| `postgres` | `docker-compose.yml` | `5432` | DB หลัก |
| `mock-provider` | `docker-compose.yml` | `4000` | mock integrations |
| `pgadmin` | `docker-compose.yml` | `5050` | optional UI สำหรับ DB |
| `frontend` | `docker-compose.prod.yml` | `80` | production image + Nginx |

---

## 2. ความต้องการของระบบ

### 2.1 สเปคที่แนะนำสำหรับ server แบบเดียวกับเครื่องปัจจุบัน

| รายการ | ค่า baseline ที่ยืนยันแล้ว | คำแนะนำ |
|---|---|---|
| **OS** | Ubuntu 22.04.5 LTS | แนะนำ Ubuntu 22.04 LTS หรือใหม่กว่า |
| **CPU** | 4 vCPU | อย่างน้อย 2 vCPU |
| **RAM** | 3.8 GiB | อย่างน้อย 4 GiB |
| **Disk** | 49 GiB (ว่าง ~16 GiB) | ควรเหลืออย่างน้อย 15-20 GiB สำหรับ images, volumes, uploads |
| **Network** | outbound internet | ใช้ pull images, clone repo, และเชื่อม provider ภายนอก |

### 2.2 ซอฟต์แวร์ที่ต้องมี

#### สำหรับ path ที่แนะนำและตรงกับเครื่องจริง

| ซอฟต์แวร์ | เวอร์ชันที่แนะนำ | หมายเหตุ |
|---|---|---|
| **Docker Engine** | 28.x หรือใหม่กว่า | ใช้งานจริงอยู่ที่ `28.4.0` |
| **Docker Compose plugin** | v2.39.x หรือใหม่กว่า | ใช้งานจริงอยู่ที่ `v2.39.1` |
| **Git** | 2.30+ | สำหรับ clone source |

#### สำหรับ path manual เท่านั้น

| ซอฟต์แวร์ | เวอร์ชันขั้นต่ำ | หมายเหตุ |
|---|---|---|
| **Node.js** | `>=20.0.0` | ตรงกับ `package.json` ของ backend/frontend/mock-provider |
| **npm** | `>=10.0.0` | ตรงกับ `package.json` |
| **PostgreSQL** | 15+ | ต้องตั้ง schema/migration เอง |

> **สำคัญ**: host ของ server ปัจจุบันยังเป็น Node.js `v12.22.9` และ npm `8.5.1` จึงไม่ใช่ baseline ที่ควรใช้สำหรับ manual install

### 2.3 ระบบปฏิบัติการที่รองรับ

| ระบบปฏิบัติการ | สถานะ | หมายเหตุ |
|---|---|---|
| **Ubuntu 22.04+ / Debian 12+** | ✅ แนะนำ | ตรงกับ server ปัจจุบันที่สุด |
| **Windows 10/11 + WSL2** | ✅ ใช้ได้ | เหมาะกับ development |
| **macOS (Intel / Apple Silicon)** | ✅ ใช้ได้ | เหมาะกับ development |

### 2.4 ซอฟต์แวร์เสริม

| ซอฟต์แวร์ | หน้าที่ |
|---|---|
| **pgAdmin 4** | จัดการฐานข้อมูลผ่าน browser |
| **Cloudflare Tunnel / cloudflared** | เปิด public access แบบไม่ต้องเปิดพอร์ตตรง |
| **Make** | ใช้ shortcut จาก `Makefile` ได้ แต่ไม่จำเป็น |

---

## 3. การดาวน์โหลดซอร์สโค้ด

### วิธีที่ 1: Clone จาก Git Repository (แนะนำ)

```bash
# Clone repository
git clone https://github.com/SakdaRt/Careconnect.git

# เข้าสู่โฟลเดอร์โปรเจค
cd Careconnect
```

### วิธีที่ 2: คัดลอก source ขึ้น server โดยตรง

กรณีคุณมี source อยู่แล้ว ให้คัดลอกทั้งโฟลเดอร์ขึ้น server แล้วเข้าไปที่ root project

```bash
cd /path/to/Careconnect
```

หลัง clone หรือ copy เสร็จ ให้ตรวจว่าไฟล์สำคัญเหล่านี้มีอยู่จริงก่อนเริ่มติดตั้ง

- `docker-compose.yml`
- `docker-compose.prod.yml`
- `.env.example`
- `.env.production.example`
- `frontend/vite.config.ts`
- `backend/src/config/loadEnv.js`
- `backend/scripts/migrate.js`

---

## 4. โครงสร้างโปรเจค

โฟลเดอร์ทั้งหมดมีขนาดค่อนข้างใหญ่ แต่สำหรับงานติดตั้ง/ตั้งค่า environment ให้โฟกัสไฟล์ต่อไปนี้เป็นหลัก

```
careconnect/
├── docker-compose.yml                # stack หลักที่ server ปัจจุบันใช้งานอยู่
├── docker-compose.override.yml       # dev overrides: volume mounts, npm install + migrate + dev command
├── docker-compose.prod.yml           # production compose แยกอีกชุด
├── Makefile                          # shortcut commands สำหรับ compose
├── .env.example                      # template สำหรับ development/root env
├── .env.production.example           # template สำหรับ production env
├── database/
│   └── schema.sql                    # schema เริ่มต้นที่ postgres import ครั้งแรก
├── backend/
│   ├── src/config/loadEnv.js         # กติกาการโหลด env + default/fallback
│   ├── src/server.js                 # env validation + server bootstrap
│   ├── scripts/migrate.js            # migrate/status/bootstrap
│   ├── Dockerfile.dev                # backend dev image
│   └── Dockerfile                    # backend prod image
├── frontend/
│   ├── vite.config.ts                # dev proxy, HMR, VITE_* env
│   ├── Dockerfile.dev                # frontend dev image
│   ├── Dockerfile                    # frontend prod image
│   └── nginx.conf                    # production reverse proxy ใน container
├── mock-provider/
│   └── Dockerfile.dev                # mock provider dev image
├── SYSTEM.md                         # architectural source of truth
├── DEVELOPER_GUIDE.md                # คู่มือนักพัฒนา
└── INSTALLATION.md                   # คู่มือนี้
```

---

## 5. การติดตั้งแบบ Docker (แนะนำ)

หัวข้อนี้คือ path ที่ตรงกับ server ปัจจุบันที่สุด และเป็นวิธีที่ควรใช้ถ้าต้องการขึ้นระบบให้เหมือนเครื่องจริง

### 5.1 ติดตั้ง Docker บน Ubuntu 22.04

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg git

sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

sudo usermod -aG docker "$USER"
newgrp docker
```

> ถ้า `newgrp docker` ไม่ทำงานตาม shell ที่ใช้อยู่ ให้ logout/login ใหม่หนึ่งครั้งก่อนเริ่มใช้คำสั่ง `docker`

### 5.2 ตรวจสอบเวอร์ชัน

```bash
docker --version
docker compose version
git --version
```

ค่าที่ตรงกับเครื่องจริงปัจจุบันคือ `Docker 28.4.0` และ `Docker Compose v2.39.1`

### 5.3 เตรียม source และ `.env`

```bash
git clone https://github.com/SakdaRt/Careconnect.git
cd Careconnect
```

คุณมี 2 ทางเลือก

- **ขึ้นแบบ mock/default ก่อน**
  - ยังไม่ต้องสร้าง `.env`
  - `docker-compose.yml` และ `loadEnv.js` มีค่า default ให้ครบสำหรับ development

- **ขึ้นแบบใกล้เคียงเครื่องจริงมากขึ้น**
  - คัดลอก `.env.example` เป็น `.env`
  - ใส่ค่าพวก `FRONTEND_URL`, `BACKEND_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, และ credentials ของ provider จริงตามที่ต้องการ

```bash
cp .env.example .env
```

รายละเอียดการกรอกค่าทั้งหมดอยู่ใน [หัวข้อที่ 7](#7-การกำหนดค่าตัวแปรสภาพแวดล้อม-environment-variables)

### 5.4 เริ่มระบบ

```bash
docker compose up -d --build
```

สิ่งที่จะเกิดขึ้นตอน start ครั้งแรก

- `postgres` import `database/schema.sql` อัตโนมัติถ้า volume ของฐานข้อมูลยังว่าง
- `backend` รัน `npm install && npm run migrate && npm run dev` อัตโนมัติ (command จริงมาจาก `docker-compose.override.yml`)
- `frontend` เปิด Vite dev server ที่ port `5173`
- `mock-provider` และ `pgadmin` ถูก start มาด้วย

> ถ้าคุณเคยรัน stack มาก่อนและต้องการฐานข้อมูลใหม่จริง ๆ ให้ใช้ `docker compose down -v` ก่อน แล้วค่อย `docker compose up -d --build` ใหม่ เพราะ `schema.sql` จะไม่ถูก import ซ้ำถ้า volume เดิมยังอยู่

### 5.5 ตรวจสอบสถานะหลัง start

```bash
docker compose ps
docker compose logs -f backend
docker compose logs -f frontend
```

ตรวจสุขภาพหลักที่ควรผ่าน

```bash
curl http://localhost:3000/health
curl http://localhost:4000/health
```

### 5.6 เข้าใช้งานระบบ

| URL | หน้าที่ |
|---|---|
| `http://localhost:5173` | หน้าเว็บ CareConnect |
| `http://localhost:3000/health` | health check ของ backend |
| `http://localhost:4000/health` | health check ของ mock provider |
| `http://localhost:5050` | pgAdmin |

ค่าดีฟอลต์ที่ใช้ได้ทันทีเมื่อไม่ได้ override ใน `.env`

| รายการ | ค่า |
|---|---|
| **Admin Email** | `admin@careconnect.com` |
| **Admin Password** | `Admin1234!` |
| **pgAdmin Email** | `admin@careconnect.com` |
| **pgAdmin Password** | `admin` |

> `PGADMIN_DEFAULT_EMAIL` และ `PGADMIN_DEFAULT_PASSWORD` ใน `.env.example` ยังไม่ถูกนำไปใช้โดย `docker-compose.yml` ปัจจุบัน เพราะ compose dev file hardcode ค่า pgAdmin ไว้ที่ `admin@careconnect.com` / `admin`

ถ้าจะเพิ่ม PostgreSQL server ใน pgAdmin ให้ใช้ค่าต่อไปนี้

| รายการ | ค่า |
|---|---|
| Host | `postgres` |
| Port | `5432` |
| Database | `careconnect` |
| Username | `careconnect` |
| Password | `careconnect_dev_password` |

### 5.7 คำสั่งดูแล stack ที่ใช้บ่อย

```bash
# หยุดทุก service
docker compose down

# หยุดพร้อมลบ volumes (ลบข้อมูล DB ด้วย)
docker compose down -v

# restart เฉพาะ backend
docker compose restart backend

# rebuild หลังมีการเปลี่ยน package/dependency
docker compose up -d --build
```

---

## 6. การติดตั้งแบบ Manual (ไม่ใช้ Docker)

เส้นทางนี้มีไว้สำหรับเครื่องที่พร้อมด้าน Node.js/PostgreSQL อยู่แล้วเท่านั้น และ **ไม่ใช่ path ที่ใช้งานจริงบน server ปัจจุบัน**

### 6.1 เงื่อนไขก่อนเริ่ม

```bash
node --version
npm --version
psql --version
```

ต้องได้อย่างน้อย

- `node >= 20`
- `npm >= 10`
- `PostgreSQL >= 15`

### 6.2 ขั้นตอนแบบย่อ

```bash
cp .env.example .env
```

จากนั้นแก้ค่าอย่างน้อยดังนี้

- `DATABASE_HOST=localhost`
- `MOCK_PROVIDER_BASE_URL=http://localhost:4000`
- `WEBHOOK_BASE_URL=http://localhost:3000`
- `FRONTEND_URL=http://localhost:5173`
- `BACKEND_URL=http://localhost:3000`

นำเข้า schema และรัน migrations

```bash
psql -U careconnect -d careconnect -f database/schema.sql

cd backend && npm install && npm run migrate && cd ..
cd frontend && npm install && cd ..
cd mock-provider && npm install && cd ..
```

เปิด 3 terminal เพื่อรันแต่ละ service

```bash
# Terminal 1
cd mock-provider && npm run dev

# Terminal 2
cd backend && npm run dev

# Terminal 3
cd frontend && npm run dev
```

> ถ้าคุณใช้งานบน host เดียวกับ server ปัจจุบันจริง ๆ ให้กลับไปใช้ Docker Compose แทน เพราะ host Node/npm ยังต่ำกว่า requirement ของโปรเจค

---

## 7. การกำหนดค่าตัวแปรสภาพแวดล้อม (Environment Variables)

### 7.1 ไฟล์ไหนถูกโหลด และลำดับความสำคัญเป็นอย่างไร

**Backend (`backend/src/config/loadEnv.js`)**

1. ค่า env ที่ถูกส่งเข้ามาจาก shell หรือ `docker compose` มาก่อนแล้ว
2. root `.env`
3. `backend/.env` โดยไม่ override ค่าที่มีอยู่แล้ว
4. root `.env.<NODE_ENV>`
5. `backend/.env.<NODE_ENV>`

ความหมายในทางปฏิบัติ

- ถ้าคุณใช้ Docker Compose ให้มองว่าไฟล์ root `.env` เป็นจุดตั้งค่าหลัก
- ค่าใน `environment:` ของ compose จะมี priority สูงกว่าไฟล์ env ที่ backend โหลดภายใน container
- ใน non-production ถ้าค่าไม่ครบ backend จะเติม default และ log เป็น `console.warn`
- ใน production backend จะ validate env เข้มขึ้น และหยุด start ถ้าค่าที่จำเป็นหาย

**Frontend (`frontend/vite.config.ts`)**

- dev server โหลด `VITE_*` จาก root project และโฟลเดอร์ `frontend/`
- เมื่อใช้ Docker Compose dev ค่า `VITE_*` ส่วนใหญ่ถูกส่งมาจาก `docker-compose.yml`
- production frontend อ่าน `VITE_*` ตอน build image ผ่าน `docker-compose.prod.yml` และ `frontend/Dockerfile`

### 7.2 ทางลัดที่ควรรู้ก่อน

#### แบบเร็วที่สุดสำหรับขึ้นเครื่องใหม่

- **ไม่มี `.env` ก็รันได้** ถ้าใช้ `docker-compose.yml` และยอมรับ mock/default ทั้งหมด
- วิธีนี้เหมาะกับการทดสอบ bring-up, ตรวจว่า stack ขึ้นได้, และพัฒนาในเครื่องภายใน

#### แบบที่ใกล้เคียงเครื่องจริงมากขึ้น

```bash
cp .env.example .env
```

จากนั้นค่อยกรอกค่าเฉพาะที่จำเป็น เช่น URL สาธารณะ, secret, และ provider credentials

#### สำหรับ production compose

```bash
cp .env.production.example .env.production
```

### 7.3 ตัวแปรหลักที่ควรรู้ก่อนกรอก `.env`

| Key | ตัวอย่างค่า | ต้องกรอกเมื่อไหร่ | ใช้ทำอะไร | ถ้าไม่กรอก |
|---|---|---|---|---|
| `NODE_ENV` | `development` | manual path หรือ production file | กำหนดโหมดของ backend | non-production fallback เป็นโหมดปัจจุบัน |
| `TZ` | `Asia/Bangkok` | ถ้าต้องการ timezone อื่น | timezone ของ container/process | default `Asia/Bangkok` |
| `PORT` | `3000` | ถ้าจะเปลี่ยนพอร์ต backend | port ที่ backend listen | dev compose default `3000` |
| `CORS_ORIGIN` | `https://careconnect.example.com` | เมื่อเปิดผ่าน public hostname หรือมี frontend คนละ origin | ใช้กับ CORS/Socket.IO | dev compose default `http://localhost:5173`, prod compose default `*` |
| `DATABASE_HOST` | `postgres` | Docker / custom network / manual | hostname ของ PostgreSQL | dev compose inject `postgres`, manual ใช้ `localhost` |
| `DATABASE_PORT` | `5432` | เมื่อ DB ไม่ได้อยู่พอร์ตมาตรฐาน | พอร์ตฐานข้อมูล | default `5432` |
| `DATABASE_NAME` | `careconnect` | ถ้าใช้ชื่อ DB อื่น | ชื่อฐานข้อมูล | default `careconnect` |
| `DATABASE_USER` | `careconnect` | ถ้าใช้ user อื่น | DB username | default `careconnect` |
| `DATABASE_PASSWORD` | `careconnect_dev_password` หรือ strong password | production หรือ custom DB | DB password | dev fallback มี, production ต้องตั้งเอง |
| `JWT_SECRET` | random string ยาว | ถ้าเครื่องเข้าถึงได้จากภายนอก หรือ production | ใช้เซ็น JWT | dev fallback มีแต่ไม่ปลอดภัย |
| `JWT_EXPIRES_IN` | `7d` หรือ `15m` | เมื่อต้องการปรับอายุ access token | อายุ access token | dev default `7d`, prod default `15m` |
| `JWT_REFRESH_EXPIRES_IN` | `30d` หรือ `7d` | เมื่อต้องการปรับอายุ refresh token | อายุ refresh token | dev default `30d`, prod default `7d` |
| `WEBHOOK_SECRET` | random string ยาว | ถ้าใช้ webhook/mock provider/production | ใช้ตรวจ webhook payload | dev fallback มีแต่ไม่ควรใช้บน public server |
| `FRONTEND_URL` | `https://careconnect.example.com` | ถ้ามี public URL, Google OAuth, payment redirect | base URL ฝั่งหน้าเว็บ | default `http://localhost:5173` |
| `BACKEND_URL` | `https://careconnect.example.com` | ถ้ามี public URL หรือ backend อยู่หลัง reverse proxy | base URL ฝั่ง backend และ fallback สำหรับ absolute backend links | default `http://localhost:3000` |
| `ADMIN_EMAIL` | `admin@careconnect.example.com` | ถ้าต้องการเปลี่ยน admin bootstrap | email admin เริ่มต้น | dev default `admin@careconnect.com` |
| `ADMIN_PASSWORD` | strong password | ถ้าเครื่องเข้าถึงได้จากภายนอก หรือ production | รหัสผ่าน admin bootstrap | dev default `Admin1234!` |
| `UPLOAD_DIR` | `/app/uploads` | ถ้าต้องการ path อื่น | เก็บไฟล์ upload | Docker dev default `/app/uploads`, manual fallback `./uploads` |
| `MAX_FILE_SIZE_MB` | `10` | ถ้าต้องการปรับขนาดไฟล์ | จำกัดขนาด upload | default `10` |

> **ข้อควรจำ**: ในเครื่องที่เปิด public access อยู่จริง ควร override อย่างน้อย `JWT_SECRET`, `WEBHOOK_SECRET`, `ADMIN_PASSWORD`, `FRONTEND_URL`, `BACKEND_URL`, และ `CORS_ORIGIN` แม้จะยังใช้ dev compose อยู่ก็ตาม

> **ไม่ต้องตั้ง `GOOGLE_CALLBACK_URL`**: โค้ดปัจจุบันไม่ได้อ่านค่านี้แล้ว โดย callback URL ควรถูกตั้งใน Google Console เป็น `${FRONTEND_URL}/api/auth/google/callback` หรือ public origin ที่ผู้ใช้เข้าเว็บจริงตามด้วย `/api/auth/google/callback`

### 7.4 ตัวแปร provider และพฤติกรรม fallback

#### Payment

- `PAYMENT_PROVIDER=mock` ใช้ mock payment ทันที
- `PAYMENT_PROVIDER=stripe` ต้องมีอย่างน้อย
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PUBLISHABLE_KEY` และ `STRIPE_ACCOUNT_ID` แนะนำให้ตั้งเมื่อใช้ Stripe จริง
- ใน non-production ถ้าตั้ง `PAYMENT_PROVIDER=stripe` แต่คีย์ไม่ครบ backend จะ log `console.warn` และ fallback กลับไป `mock`

#### SMS

- `SMS_PROVIDER=mock` ใช้ OTP mock
- `SMS_PROVIDER=smsok` ต้องมี
  - `SMSOK_API_URL`
  - `SMSOK_API_KEY`
  - `SMSOK_API_SECRET`
- `SMSOK_SENDER` แนะนำให้ตั้งเป็นชื่อผู้ส่งที่ provider รองรับ
- ถ้าค่าไม่ครบใน non-production ระบบจะ fallback กลับไป `mock`

#### Email

- `EMAIL_PROVIDER=mock` ไม่ต้องมี SMTP credential
- `EMAIL_PROVIDER=smtp` ต้องมี
  - `EMAIL_FROM`
  - `SMTP_HOST`
  - `SMTP_PORT`
  - `SMTP_USER`
  - `SMTP_PASS`
- ถ้าค่าไม่ครบใน non-production ระบบจะ fallback กลับไป `mock`

#### Google OAuth

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`

ให้ตั้งเมื่อจะเปิดปุ่ม Sign in with Google จริง และเพิ่ม callback URL ใน Google Console เป็น

```text
<FRONTEND_URL>/api/auth/google/callback
```

#### ตัวแปร provider อื่น ๆ

| Key | ค่าแนะนำสำหรับ dev | หมายเหตุ |
|---|---|---|
| `PUSH_PROVIDER` | `mock` | ถ้ายังไม่เปิด push จริงให้คง mock |
| `KYC_PROVIDER` | `mock` | dev fallback เป็น mock |
| `BANK_TRANSFER_PROVIDER` | `mock` | dev fallback เป็น mock |
| `MOCK_PROVIDER_BASE_URL` | `http://mock-provider:4000` | สำหรับ Docker dev |
| `WEBHOOK_BASE_URL` | `http://backend:3000` | base URL ที่ระบบใช้ประกอบ callback ภายใน network |
| `BACKEND_WEBHOOK_URL` | `http://backend:3000/api/webhooks` | ใช้โดย mock-provider container |
| `MOCK_PAYMENT_CALLBACK_URL` | `http://backend:3000/api/webhooks/payment` | ใช้โดย mock payment flow |

> สำหรับ development หากค่า optional ไม่ครบ ระบบควรแสดงเป็น **backend console warnings** แทนการแจ้งเตือนบนหน้าจอผู้ใช้

### 7.5 `VITE_*` และค่าที่เกี่ยวกับ public/tunnel access

| Key | ค่าแนะนำ | ใช้เมื่อไหร่ | หมายเหตุ |
|---|---|---|---|
| `VITE_API_TARGET` | `http://backend:3000` | Docker dev | ให้ชี้ไป internal hostname ของ backend ใน network เดียวกัน |
| `VITE_DEV_PORT` | `5173` | ถ้าจะเปลี่ยน port dev server | ส่วนใหญ่ไม่ต้องแก้ |
| `VITE_PUBLIC_HOST` | `careconnect.example.com` | เมื่อเปิด dev server ผ่าน public hostname/tunnel | ใช้ตั้งค่า HMR client |
| `VITE_PUBLIC_PROTOCOL` | `wss` | เมื่อ public host อยู่หลัง HTTPS/Cloudflare Tunnel | ใช้กับ HMR websocket ไม่ใช่ URL หน้าเว็บ |
| `VITE_PUBLIC_PORT` | เว้นว่าง หรือ `443` | เมื่อ public port ไม่ใช่ค่าปกติ | โดยทั่วไปใช้ `VITE_PUBLIC_HMR_PORT` แทน |
| `VITE_PUBLIC_HMR_PORT` | `443` | เมื่อใช้ tunnel/HTTPS public host | แนะนำให้ตั้งถ้า browser เข้าเว็บผ่าน HTTPS |
| `VITE_USE_POLLING` | `true` หรือ `false` | แก้ปัญหา hot-reload บน WSL/network filesystem | default `false` |
| `VITE_POLL_INTERVAL` | `300` | เมื่อเปิด polling | หน่วย ms |
| `VITE_API_URL` | เว้นว่างได้ | production build เฉพาะบาง integration | build-time only |
| `VITE_API_BASE_URL` | เว้นว่างได้ | production build | build-time only |
| `VITE_SOCKET_URL` | เว้นว่างได้ | production build | build-time only |
| `VITE_GOOGLE_MAPS_API_KEY` | browser key | เมื่อเปิด Google Maps บน frontend | build-time only |
| `VITE_VAPID_PUBLIC_KEY` | public VAPID key | เมื่อเปิด web push | build-time only |

ตัวอย่าง `.env` สำหรับเครื่องที่ต้องการเปิด public access ผ่าน tunnel แบบเดียวกับ server ปัจจุบัน

```env
FRONTEND_URL=https://careconnect.example.com
BACKEND_URL=https://careconnect.example.com
CORS_ORIGIN=https://careconnect.example.com

VITE_API_TARGET=http://backend:3000
VITE_PUBLIC_HOST=careconnect.example.com
VITE_PUBLIC_PROTOCOL=wss
VITE_PUBLIC_HMR_PORT=443
```

### 7.6 ตัวแปร mock และ seed สำหรับ development

| Key | ค่า default | ใช้ทำอะไร |
|---|---|---|
| `MOCK_PAYMENT_AUTO_SUCCESS` | `true` | ให้ mock payment สำเร็จอัตโนมัติ |
| `MOCK_PAYMENT_SUCCESS_DELAY_MS` | `3000` | delay ก่อน webhook success |
| `MOCK_SMS_OTP_CODE` | `123456` | OTP สำหรับ SMS mock |
| `MOCK_EMAIL_OTP_CODE` | `123456` | OTP สำหรับ email mock |
| `MOCK_KYC_AUTO_APPROVE` | `true` | อนุมัติ KYC mock อัตโนมัติ |
| `MOCK_KYC_APPROVAL_DELAY_MS` | `5000` | delay ก่อน approve KYC |
| `SEED_MOCK_CAREGIVERS` | `true` | สร้าง mock caregivers ตอน backend start |
| `SEED_MOCK_JOBS` | `true` | สร้าง mock hirers/jobs ตอน backend start |

ถ้าไม่ต้องการ auto seed ให้ตั้งค่าเหล่านี้เป็น `false`

### 7.7 `.env.production` ที่ต้องกรอกจริง

```bash
cp .env.production.example .env.production
```

ค่าที่ `docker-compose.prod.yml` และ backend validation ต้องมีแน่ ๆ

- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `WEBHOOK_SECRET`
- `PAYMENT_PROVIDER`
- `SMS_PROVIDER`
- `EMAIL_PROVIDER`
- `PUSH_PROVIDER`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `FRONTEND_URL`
- `BACKEND_URL`

ถ้าคุณเลือก provider จริง ต้องกรอก credential ตาม provider นั้นด้วย เช่น

- `PAYMENT_PROVIDER=stripe` ต้องมี `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `SMS_PROVIDER=smsok` ต้องมี `SMSOK_API_URL`, `SMSOK_API_KEY`, `SMSOK_API_SECRET`
- `EMAIL_PROVIDER=smtp` ต้องมี `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`

ตัวแปร `VITE_*` ใน production เป็น **build-time values** หมายความว่าแก้ `.env.production` แล้วต้อง rebuild frontend image ใหม่ด้วยคำสั่ง `docker compose --env-file .env.production -f docker-compose.prod.yml build frontend`

---

## 8. การตั้งค่าฐานข้อมูล

### 8.1 Schema เริ่มต้นใน stack ปัจจุบัน

ฐานข้อมูลหลักอยู่ที่ `database/schema.sql`

ใน `docker-compose.yml` ปัจจุบัน `postgres` mount ไฟล์นี้เข้า `/docker-entrypoint-initdb.d/01-schema.sql` ทำให้ PostgreSQL import schema อัตโนมัติ **เฉพาะตอนที่ volume `postgres_data` ยังว่าง**

ผลลัพธ์ที่ควรเข้าใจ

- start ครั้งแรกบนเครื่องใหม่: schema ถูก import ให้อัตโนมัติ
- start ครั้งถัดไป: PostgreSQL ใช้ข้อมูลเดิมใน volume และจะไม่ import `schema.sql` ซ้ำ
- ถ้าต้องการเริ่มฐานข้อมูลใหม่จริง ๆ: ใช้ `docker compose down -v` ก่อน

สำหรับ manual path ให้ import เองด้วยคำสั่ง

```bash
psql -U careconnect -d careconnect -f database/schema.sql
```

### 8.2 Migrations ทำงานอย่างไร

Migrations ของ backend อยู่ที่ `backend/database/migrations/` และถูกรันโดย `backend/scripts/migrate.js`

พฤติกรรมในแต่ละโหมด

- **Docker development ปัจจุบัน**: `backend` รัน `npm install && npm run migrate && npm run dev` ทุกครั้งที่ container start (command มาจาก `docker-compose.override.yml` ที่ override ค่าใน `docker-compose.yml`)
- **Production compose**: มี service `migrate` แยก profile ไว้ให้รันเอง
- **Manual**: ต้องรัน `npm run migrate` เอง

คำสั่งที่ใช้บ่อย

```bash
# ดูสถานะ migration จาก backend container
docker compose exec backend node scripts/migrate.js status

# รัน pending migrations ผ่าน migrate profile
docker compose --profile migrate run --rm migrate

# Bootstrap schema ผ่าน backend script (ใช้เมื่อ DB ว่างและไม่ได้พึ่ง initdb)
docker compose exec backend npm run migrate:bootstrap
```

> ใน dev stack ปกติ **ไม่ต้อง** รัน `migrate` แยกหลัง `docker compose up -d --build` เพราะ `docker-compose.override.yml` สั่งให้ backend รัน migrate ให้อัตโนมัติก่อน start dev server
>
> **หมายเหตุ**: ถ้าคุณลบหรือ rename `docker-compose.override.yml` ออก backend จะใช้ command จาก `docker-compose.yml` แทน ซึ่งก็ยังมี `npm run migrate` อยู่เช่นกัน

### 8.3 Mock data และ demo seed

มีข้อมูลตัวอย่างอยู่ 2 ชั้น

#### Auto seed ตอน backend start

- ควบคุมด้วย `SEED_MOCK_CAREGIVERS` และ `SEED_MOCK_JOBS`
- ค่า default ใน dev compose คือ `true`
- ถ้าต้องการปิด ให้ตั้งเป็น `false` ใน `.env`

รหัสผ่าน default ของ auto-seeded mock users ถ้าไม่ได้ override มีดังนี้

- caregivers: `DemoCare123!`
- hirers/jobs: `DemoHirer123!`

#### Demo seed แบบเต็มชุด

```bash
docker compose exec backend npm run seed:demo
docker compose exec backend npm run seed:demo:reset
```

ชุด demo นี้จะสร้างบัญชี pattern `*@demo.careconnect.local` โดยใช้รหัสผ่าน `Demo1234!`

---

## 9. การรันระบบสำหรับพัฒนา (Development)

### 9.1 คำสั่งประจำวันสำหรับ dev stack

```bash
# start ปกติ
docker compose up -d

# start พร้อม rebuild เมื่อ package เปลี่ยน
docker compose up -d --build

# ดู logs รวม
docker compose logs -f

# เข้า shell ใน backend/frontend
docker compose exec backend sh
docker compose exec frontend sh
```

### 9.2 สิ่งที่ควรคาดหวังใน development mode

- frontend และ backend ใช้ volume mount จึง hot-reload ได้
- frontend dev server อยู่ที่ `http://localhost:5173`
- backend health check อยู่ที่ `http://localhost:3000/health`
- mock-provider health check อยู่ที่ `http://localhost:4000/health`
- pgAdmin อยู่ที่ `http://localhost:5050`
- `MOCK_SMS_OTP_CODE` และ `MOCK_EMAIL_OTP_CODE` default เป็น `123456`
- mock payment auto success default หลังประมาณ `3000ms`
- mock KYC auto approve default หลังประมาณ `5000ms`

### 9.3 เช็กว่าระบบพร้อมใช้งาน

1. เปิด `http://localhost:5173`
2. เปิด `http://localhost:3000/health`
3. เปิด `http://localhost:4000/health`
4. login ด้วย `admin@careconnect.com` / `Admin1234!` หรือค่าที่คุณ override เอง

### 9.4 Public access แบบเดียวกับ server ปัจจุบันด้วย Cloudflare Tunnel

หัวข้อนี้เป็น **optional** แต่ตรงกับวิธีที่ server ปัจจุบันใช้งานอยู่จริง

#### ขั้นที่ 1: ตั้งค่า `.env` ให้รองรับ public hostname

```env
FRONTEND_URL=https://careconnect.example.com
BACKEND_URL=https://careconnect.example.com
CORS_ORIGIN=https://careconnect.example.com

VITE_API_TARGET=http://backend:3000
VITE_PUBLIC_HOST=careconnect.example.com
VITE_PUBLIC_PROTOCOL=wss
VITE_PUBLIC_HMR_PORT=443
```

จากนั้น restart frontend และ backend

```bash
docker compose up -d --build frontend backend
```

#### ขั้นที่ 2: ติดตั้ง `cloudflared`

```bash
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
sudo dpkg -i cloudflared-linux-amd64.deb
```

#### ขั้นที่ 3: สร้าง tunnel ใน Cloudflare

- สร้าง tunnel ผ่าน Cloudflare Dashboard
- ตั้ง public hostname ของคุณให้ชี้เข้า service URL `http://localhost:5173`
- คัดลอก tunnel token ที่ได้จาก dashboard

> ถ้าคุณใช้ production compose แทน dev compose ให้เปลี่ยน target เป็น `http://localhost:80`

#### ขั้นที่ 4: สร้าง systemd service

```bash
sudo tee /etc/systemd/system/cloudflared.service >/dev/null <<'EOF'
[Unit]
Description=Cloudflare Tunnel for CareConnect
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/cloudflared --no-autoupdate tunnel run --token <CLOUDFLARE_TUNNEL_TOKEN>
Restart=always
RestartSec=5s

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager
```

> ตรวจสอบให้แน่ใจว่า `Restart=always` สะกดถูกต้อง และกำหนด `RestartSec=5s` เพื่อให้ service ฟื้นตัวเองได้เมื่อ network มีปัญหาชั่วคราว

#### ขั้นที่ 5: ตรวจสอบ logs

```bash
journalctl -u cloudflared -n 50 --no-pager
```

เมื่อทุกอย่างถูกต้อง browser ภายนอกจะเข้า public hostname ของคุณได้ และ traffic จะถูก tunnel ไปยัง `http://localhost:5173`

---

## 10. การรันระบบสำหรับ Production

### 10.1 สิ่งที่ควรเข้าใจก่อน

`docker-compose.prod.yml` เป็นเส้นทาง production ที่โปรเจครองรับ แต่ **ไม่ใช่ compose file ที่ server ปัจจุบันเปิด public อยู่ตอนนี้**

จุดต่างหลักคือ

- frontend ใช้ production image และ serve ผ่าน Nginx ที่ port `80`
- ไม่มี `mock-provider` และ `pgadmin`
- backend ใช้ production Dockerfile
- ค่า env หลายตัวถูกบังคับให้ต้องมีจริง

### 10.2 เตรียม `.env.production`

```bash
cp .env.production.example .env.production
```

จากนั้นกรอกค่าตามหัวข้อ `7.7`

### 10.3 Deploy ครั้งแรกบนเครื่องใหม่หรือฐานข้อมูลว่าง

```bash
# 1) build images
docker compose --env-file .env.production -f docker-compose.prod.yml build

# 2) start เฉพาะ postgres ก่อน
docker compose --env-file .env.production -f docker-compose.prod.yml up -d postgres

# 3) bootstrap schema ครั้งแรก
docker compose --env-file .env.production -f docker-compose.prod.yml run --rm backend npm run migrate:bootstrap

# 4) apply pending migrations
docker compose --env-file .env.production -f docker-compose.prod.yml --profile migrate run --rm migrate

# 5) start application services
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### 10.4 Deploy ครั้งถัดไป

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml build
docker compose --env-file .env.production -f docker-compose.prod.yml --profile migrate run --rm migrate
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

### 10.5 สิ่งที่ frontend production image ทำให้โดยอัตโนมัติ

`frontend/nginx.conf` จะ

- serve React static files
- proxy `/api/` ไป `backend:3000`
- proxy `/health` ไป `backend:3000/health`
- proxy `/uploads/` ไป backend
- proxy `/socket.io/` แบบ websocket
- เปิด gzip, cache assets, และ security headers พื้นฐาน

### 10.6 ความแตกต่างระหว่าง Development และ Production

| รายการ | Development (`docker-compose.yml`) | Production (`docker-compose.prod.yml`) |
|---|---|---|
| Frontend | Vite dev server `:5173` | Nginx static site `:80` |
| Backend | `Dockerfile.dev` + `npm run dev` | `Dockerfile` + `node src/server.js` |
| PostgreSQL schema | import `database/schema.sql` ครั้งแรกผ่าน initdb | ต้อง bootstrap/migrate เอง |
| Mock Provider | ✅ มี | ❌ ไม่มี |
| pgAdmin | ✅ มี | ❌ ไม่มี |
| Source mount | ✅ มี | ❌ ไม่มี |
| `VITE_*` | ใช้ runtime/dev server | ใช้ตอน build image |
| Public access แบบเดียวกับเครื่องจริง | เหมาะกับ Cloudflare Tunnel → `localhost:5173` | ถ้าจะใช้ tunnel ให้ชี้ไป `localhost:80` |

### 10.7 HTTPS/Reverse Proxy

ถ้าจะเปิด production จริง ควรมี HTTPS ด้านหน้าเสมอ เช่น

- Cloudflare Tunnel
- Nginx
- Caddy
- Traefik

ถ้าใช้ reverse proxy ภายนอก ให้ชี้ไป `http://localhost:80`

---

## 11. การทดสอบระบบ

### 11.1 Backend Unit/Integration Tests

บน server ปัจจุบัน host Node.js ยังเป็น `v12` จึงควรใช้ container หรือเครื่องที่มี `node >= 20` สำหรับการ verify

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

หรือถ้าคุณต้องการใช้ dev container ที่รันอยู่แล้ว:

```bash
docker compose exec backend npm test
docker compose exec backend npm run test:integration
```

### 11.2 Frontend Tests (Vitest + Playwright)

```bash
cd frontend

# Unit tests (Vitest)
npm test

# Unit tests พร้อม coverage
npm run test:coverage

# E2E tests (Playwright)
npm run test:e2e

# E2E tests แบบเห็น browser
npm run test:e2e:headed

# E2E tests ผ่าน Docker
npm run test:e2e:docker
```

ถ้า host ยังไม่ใช่ Node.js 20+ ให้ใช้ container สำหรับ frontend unit tests ก่อน:

```bash
docker compose exec frontend npm test
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

ถ้าเข้าเว็บผ่าน public hostname/tunnel แล้ว HMR หลุด ให้เพิ่มด้วย:

```env
VITE_PUBLIC_HOST=careconnect.example.com
VITE_PUBLIC_PROTOCOL=wss
VITE_PUBLIC_HMR_PORT=443
```

### ปัญหา: Permission denied ตอน upload ไฟล์

```bash
# ตรวจสิทธิ์ใน volume ที่ backend ใช้อยู่จริง
docker compose exec backend sh -c 'ls -ld /app/uploads && ls -l /app'

# ถ้าจำเป็นให้ปรับ owner/permission ภายใน container
docker compose exec backend sh -c 'mkdir -p /app/uploads && chmod -R 775 /app/uploads'
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

### ปัญหา: เปิด public URL ผ่าน Cloudflare Tunnel ไม่ได้

```bash
# ตรวจสถานะ service
sudo systemctl status cloudflared --no-pager

# ดู logs ล่าสุด
journalctl -u cloudflared -n 50 --no-pager

# ตรวจว่าชุด service มี Restart=always และ RestartSec=5s
sudo systemctl cat cloudflared
```

ถ้า service file ถูกแก้ไขแล้ว อย่าลืม reload

```bash
sudo systemctl daemon-reload
sudo systemctl restart cloudflared
```

### การ Reset ระบบทั้งหมด (ลบข้อมูลทั้งหมด)

```bash
# หยุด containers + ลบ volumes ทั้งหมด
docker compose down -v

# Build และเริ่มใหม่ (migrations รันอัตโนมัติตอน backend start)
docker compose up -d --build
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
> **อัพเดทล่าสุด**: 2026-04-06
