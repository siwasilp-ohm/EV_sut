# Makefile for EV Solar Charging System Docker Operations

.PHONY: help setup build start stop restart logs status clean dev prod

# Default target
help:
	@echo "EV Solar Charging System - Docker Commands"
	@echo "=========================================="
	@echo ""
	@echo "Available commands:"
	@echo "  make setup     - Initial Docker setup"
	@echo "  make build     - Build Docker images"
	@echo "  make dev       - Start development environment"
	@echo "  make prod      - Start production environment"
	@echo "  make start     - Start services (production)"
	@echo "  make stop      - Stop all services"
	@echo "  make restart   - Restart services"
	@echo "  make logs      - Show application logs"
	@echo "  make status    - Show service status"
	@echo "  make clean     - Clean up Docker resources"
	@echo "  make db-shell  - Connect to database shell"
	@echo "  make app-shell - Connect to application shell"
	@echo ""

# Initial setup
setup:
	@echo "🚀 Setting up EV Solar Charging System..."
	@mkdir -p docker/nginx docker/ssl docker/prometheus docker/grafana/dashboards docker/grafana/datasources
	@mkdir -p logs uploads/profiles uploads/payment-slips uploads/documents
	@if [ ! -f .env ]; then cp .env.docker .env; fi
	@echo "✅ Setup completed!"

# Build Docker images
build:
	@echo "🔨 Building Docker images..."
	@docker-compose build --no-cache
	@docker-compose -f docker-compose.dev.yml build --no-cache
	@echo "✅ Images built successfully!"

# Start development environment
dev:
	@echo "🚀 Starting development environment..."
	@docker-compose -f docker-compose.dev.yml up -d
	@echo "✅ Development environment started!"
	@echo ""
	@echo "📱 Client App: http://localhost:3001"
	@echo "🔧 Admin Panel: http://localhost:3002"
	@echo "🌐 API Server: http://localhost:3000"
	@echo "⚡ OCPP WebSocket: ws://localhost:8080"

# Start production environment
prod:
	@echo "🚀 Starting production environment..."
	@docker-compose up -d
	@echo "✅ Production environment started!"
	@echo ""
	@echo "🌐 Application: http://localhost"
	@echo "⚡ OCPP WebSocket: ws://localhost:8080"

# Start services (default to production)
start: prod

# Stop all services
stop:
	@echo "🛑 Stopping all services..."
	@docker-compose down
	@docker-compose -f docker-compose.dev.yml down
	@echo "✅ All services stopped!"

# Restart services
restart:
	@echo "🔄 Restarting services..."
	@make stop
	@make start
	@echo "✅ Services restarted!"

# Show logs
logs:
	@echo "📋 Showing application logs..."
	@docker-compose logs -f app

# Show logs for specific service
logs-%:
	@echo "📋 Showing logs for $*..."
	@docker-compose logs -f $*

# Show service status
status:
	@echo "📊 Service Status:"
	@docker-compose ps
	@echo ""
	@docker-compose -f docker-compose.dev.yml ps

# Clean up Docker resources
clean:
	@echo "🧹 Cleaning up Docker resources..."
	@docker-compose down -v --remove-orphans
	@docker-compose -f docker-compose.dev.yml down -v --remove-orphans
	@docker system prune -f
	@docker volume prune -f
	@echo "✅ Cleanup completed!"

# Database shell
db-shell:
	@echo "🗄️ Connecting to database..."
	@docker-compose exec mysql mysql -u root -p

# Application shell
app-shell:
	@echo "🖥️ Connecting to application container..."
	@docker-compose exec app sh

# Development application shell
app-shell-dev:
	@echo "🖥️ Connecting to development application container..."
	@docker-compose -f docker-compose.dev.yml exec backend-dev sh

# Run tests
test:
	@echo "🧪 Running tests..."
	@docker-compose exec app npm test

# Run tests in development
test-dev:
	@echo "🧪 Running tests in development..."
	@docker-compose -f docker-compose.dev.yml exec backend-dev npm test

# Database backup
backup:
	@echo "💾 Creating database backup..."
	@mkdir -p backups
	@docker-compose exec mysql mysqldump -u root -p ev_solar_charging > backups/backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "✅ Backup created in backups/ directory"

# Database restore
restore:
	@echo "🔄 Restoring database..."
	@if [ -z "$(FILE)" ]; then echo "Usage: make restore FILE=backup_file.sql"; exit 1; fi
	@docker-compose exec -T mysql mysql -u root -p ev_solar_charging < $(FILE)
	@echo "✅ Database restored from $(FILE)"

# Monitor services
monitor:
	@echo "📊 Monitoring services..."
	@watch -n 2 'docker-compose ps && echo "" && docker stats --no-stream'

# View application URLs
urls:
	@echo "🌐 Application URLs:"
	@echo "================================"
	@echo "🏠 Main Application: http://localhost"
	@echo "📱 Client App (Dev): http://localhost:3001"
	@echo "🔧 Admin Panel (Dev): http://localhost:3002"
	@echo "🌐 API Server: http://localhost:3000"
	@echo "⚡ OCPP WebSocket: ws://localhost:8080"
	@echo "🗄️ Database Admin: http://localhost:8080 (adminer profile)"
	@echo "📧 Mail Testing: http://localhost:8025 (mail profile)"
	@echo "📊 Monitoring: http://localhost:3001 (monitoring profile)"

# Install development dependencies
install:
	@echo "📦 Installing dependencies..."
	@docker-compose -f docker-compose.dev.yml exec backend-dev npm install
	@docker-compose -f docker-compose.dev.yml exec client-dev npm install
	@docker-compose -f docker-compose.dev.yml exec admin-dev npm install
	@echo "✅ Dependencies installed!"

# Update dependencies
update:
	@echo "🔄 Updating dependencies..."
	@docker-compose -f docker-compose.dev.yml exec backend-dev npm update
	@docker-compose -f docker-compose.dev.yml exec client-dev npm update
	@docker-compose -f docker-compose.dev.yml exec admin-dev npm update
	@echo "✅ Dependencies updated!"
