# CareConnect Deployment Guide

## 🚀 Quick Deployment

### Step 1: Connect to Server
```powershell
ssh ssh.kmitl.site
```

### Step 2: Navigate to Project
```bash
cd /home/careconnect
```

### Step 3: Deploy Latest Changes
```bash
# Option A: Use deployment script
chmod +x deploy.sh
./deploy.sh

# Option B: Manual commands
git pull origin main
docker-compose down
docker-compose up -d --build
```

### Step 4: Verify Deployment
```bash
# Check container status
docker-compose ps

# Check logs if needed
docker-compose logs -f
```

## 🌐 Access Points
- **Frontend**: http://your-server-ip:5173
- **Backend API**: http://your-server-ip:3000
- **Database Admin**: http://your-server-ip:5050

## 🔧 Troubleshooting
```bash
# View logs
docker-compose logs backend
docker-compose logs frontend

# Restart specific service
docker-compose restart backend
docker-compose restart frontend

# Rebuild specific service
docker-compose up -d --build backend
```
