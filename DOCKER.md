# Careconnect Docker Setup

## Quick Start

### Development Environment
```bash
# Start all services
make dev

# View logs
make logs

# Stop services
make dev-stop
```

### Production Environment
```bash
# Start production services
make prod

# View logs
make logs-prod

# Stop services
make prod-stop
```

## Available Commands

### Development
- `make dev` - Start development environment with hot reload
- `make dev-stop` - Stop development environment
- `make dev-restart` - Restart development environment
- `make migrate-dev` - Run database migrations in development
- `make logs-dev` - Show development logs

### Production
- `make prod` - Start production environment
- `make prod-stop` - Stop production environment
- `make prod-restart` - Restart production environment
- `make migrate-prod` - Run database migrations in production
- `make logs-prod` - Show production logs

### Utilities
- `make logs` - Show logs from all services
- `make clean` - Clean up Docker containers and images
- `make build-dev` - Build development images
- `make build-prod` - Build production images

## Services

### Development (docker-compose.yml)
- **PostgreSQL**: `localhost:5432`
- **Backend API**: `http://localhost:3000`
- **Frontend**: `http://localhost:5173`
- **Mock Provider**: `http://localhost:4000`
- **pgAdmin**: `http://localhost:5050`

### Production (docker-compose.prod.yml)
- **PostgreSQL**: Internal only
- **Backend API**: `localhost:3000`
- **Frontend**: `http://localhost` (port 80)
- **pgAdmin**: `localhost:5050`

## Environment Setup

1. Copy environment file:
```bash
cp .env.example .env
```

2. Update `.env` with your values:
   - Database credentials
   - JWT secrets
   - Admin account details

## Database Migrations

### Development
```bash
# Run migrations
make migrate-dev

# Check migration status
docker-compose exec backend npm run migrate:status
```

### Production
```bash
# Run migrations
make migrate-prod

# Check migration status
docker-compose -f docker-compose.prod.yml exec backend npm run migrate:status
```

## Manual Docker Commands

### Development
```bash
# Build and start
docker-compose up -d --build

# View specific service logs
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f postgres

# Execute commands in containers
docker-compose exec backend npm run migrate
docker-compose exec postgres psql -U careconnect -d careconnect
```

### Production
```bash
# Build and start
docker-compose -f docker-compose.prod.yml up -d --build

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Execute commands
docker-compose -f docker-compose.prod.yml exec backend npm run migrate
```

## Troubleshooting

### Port Conflicts
If ports are already in use:
```bash
# Check what's using ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :5432

# Kill processes if needed
sudo kill -9 <PID>
```

### Database Issues
```bash
# Reset database (WARNING: This deletes all data)
docker-compose down -v
docker-compose up -d postgres
make migrate-dev
```

### Build Issues
```bash
# Rebuild without cache
docker-compose build --no-cache

# Clean up Docker
make clean
```

### Permission Issues (Linux)
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
sudo chmod -R 755 .
```

## Development Workflow

1. **First time setup**:
   ```bash
   cp .env.example .env
   make dev
   make migrate-dev
   ```

2. **Daily development**:
   ```bash
   make dev
   # Make code changes
   # Hot reload works automatically
   ```

3. **Before committing**:
   ```bash
   make dev-stop
   make clean
   make dev
   make migrate-dev
   ```

## Production Deployment

1. **Setup production environment**:
   ```bash
   cp .env.example .env.production
   # Edit .env.production with production values
   ```

2. **Deploy**:
   ```bash
   make prod
   make migrate-prod
   ```

3. **Monitor**:
   ```bash
   make logs-prod
   ```

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Frontend  │    │   Backend   │    │  Database   │
│  (React)    │◄──►│  (Node.js)  │◄──►│ (PostgreSQL)│
│  Port 5173  │    │  Port 3000  │    │  Port 5432  │
└─────────────┘    └─────────────┘    └─────────────┘
                           │
                   ┌─────────────┐
                   │ Mock Provider│
                   │  (Node.js)  │
                   │  Port 4000   │
                   └─────────────┘
```

## Health Checks

All services include health checks:
- PostgreSQL: `pg_isready`
- Backend: HTTP health endpoint
- Frontend: HTTP check
- Mock Provider: HTTP check

Check service health:
```bash
docker-compose ps
```
