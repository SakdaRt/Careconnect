# Careconnect Docker Commands
.PHONY: help dev prod clean migrate logs

# Default target
help:
	@echo "Careconnect Docker Commands:"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start development environment"
	@echo "  make dev-stop     - Stop development environment"
	@echo "  make dev-restart  - Restart development environment"
	@echo "  make migrate-dev  - Run migrations in development"
	@echo ""
	@echo "Production:"
	@echo "  make prod         - Start production environment"
	@echo "  make prod-stop    - Stop production environment"
	@echo "  make prod-restart - Restart production environment"
	@echo "  make migrate-prod - Run migrations in production"
	@echo ""
	@echo "Utilities:"
	@echo "  make logs         - Show logs from all services"
	@echo "  make logs-dev     - Show development logs"
	@echo "  make logs-prod    - Show production logs"
	@echo "  make clean        - Clean up Docker containers and images"
	@echo ""

# Development environment
dev:
	@echo "Starting development environment..."
	docker-compose up -d
	@echo "Development environment started!"
	@echo "Frontend: http://localhost:5173"
	@echo "Backend: http://localhost:3000"
	@echo "pgAdmin: http://localhost:5050"

dev-stop:
	@echo "Stopping development environment..."
	docker-compose down
	@echo "Development environment stopped!"

dev-restart:
	@echo "Restarting development environment..."
	docker-compose restart
	@echo "Development environment restarted!"

# Production environment
prod:
	@echo "Starting production environment..."
	docker-compose -f docker-compose.prod.yml up -d
	@echo "Production environment started!"
	@echo "Frontend: http://localhost"
	@echo "Backend: http://localhost:3000"

prod-stop:
	@echo "Stopping production environment..."
	docker-compose -f docker-compose.prod.yml down
	@echo "Production environment stopped!"

prod-restart:
	@echo "Restarting production environment..."
	docker-compose -f docker-compose.prod.yml restart
	@echo "Production environment restarted!"

# Migrations
migrate-dev:
	@echo "Running migrations in development..."
	docker-compose --profile migrate up migrate
	@echo "Development migrations completed!"

migrate-prod:
	@echo "Running migrations in production..."
	docker-compose -f docker-compose.prod.yml --profile migrate up migrate
	@echo "Production migrations completed!"

# Logs
logs:
	docker-compose logs -f

logs-dev:
	docker-compose logs -f

logs-prod:
	docker-compose -f docker-compose.prod.yml logs -f

# Cleanup
clean:
	@echo "Cleaning up Docker..."
	docker-compose down -v --remove-orphans
	docker-compose -f docker-compose.prod.yml down -v --remove-orphans
	docker system prune -f
	@echo "Cleanup completed!"

# Build only
build-dev:
	@echo "Building development images..."
	docker-compose build
	@echo "Development build completed!"

build-prod:
	@echo "Building production images..."
	docker-compose -f docker-compose.prod.yml build
	@echo "Production build completed!"
