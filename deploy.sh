#!/bin/bash
# CareConnect Deployment Script
# Run this on the server after SSH connection

echo "🚀 Starting CareConnect deployment..."

# Navigate to project directory
cd /home/careconnect

# Pull latest changes
echo "📥 Pulling latest changes..."
git pull origin main

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

# Build and start containers
echo "🔨 Building and starting containers..."
docker-compose up -d --build

# Show status
echo "📊 Container status:"
docker-compose ps

echo "✅ Deployment complete!"
echo "🌐 Frontend: http://your-server-ip:5173"
echo "🔧 Backend API: http://your-server-ip:3000"
echo "🗄️ Admin: http://your-server-ip:5050"
