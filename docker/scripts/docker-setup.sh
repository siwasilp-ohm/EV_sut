#!/bin/bash

# Docker Setup Script for EV Solar Charging System
# This script helps set up the Docker environment

set -e

echo "🚀 EV Solar Charging System - Docker Setup"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}$1${NC}"
}

# Check if Docker is installed
check_docker() {
    print_header "Checking Docker installation..."
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_status "Docker and Docker Compose are installed."
}

# Create necessary directories
create_directories() {
    print_header "Creating necessary directories..."
    
    mkdir -p docker/nginx
    mkdir -p docker/ssl
    mkdir -p docker/prometheus
    mkdir -p docker/grafana/dashboards
    mkdir -p docker/grafana/datasources
    mkdir -p logs
    mkdir -p uploads/profiles
    mkdir -p uploads/payment-slips
    mkdir -p uploads/documents
    
    print_status "Directories created successfully."
}

# Setup environment files
setup_environment() {
    print_header "Setting up environment files..."
    
    if [ ! -f .env ]; then
        if [ -f .env.docker ]; then
            cp .env.docker .env
            print_status "Copied .env.docker to .env"
        elif [ -f .env.example ]; then
            cp .env.example .env
            print_status "Copied .env.example to .env"
        else
            print_warning "No environment template found. Creating basic .env file."
            cat > .env << EOF
NODE_ENV=development
DB_HOST=mysql
DB_PORT=3306
DB_NAME=ev_solar_charging
DB_USER=evsolar_user
DB_PASSWORD=evsolar_password
JWT_SECRET=your-jwt-secret-change-in-production
OCPP_PORT=8080
INVERTER_IP=192.168.1.100
TZ=Asia/Bangkok
EOF
        fi
    else
        print_status ".env file already exists."
    fi
}

# Build Docker images
build_images() {
    print_header "Building Docker images..."
    
    print_status "Building production image..."
    docker-compose build --no-cache
    
    print_status "Building development images..."
    docker-compose -f docker-compose.dev.yml build --no-cache
    
    print_status "Docker images built successfully."
}

# Initialize database
init_database() {
    print_header "Initializing database..."
    
    print_status "Starting MySQL container..."
    docker-compose up -d mysql
    
    print_status "Waiting for MySQL to be ready..."
    sleep 30
    
    print_status "Database initialized successfully."
}

# Start services
start_services() {
    print_header "Starting services..."
    
    case ${1:-production} in
        "dev"|"development")
            print_status "Starting development environment..."
            docker-compose -f docker-compose.dev.yml up -d
            ;;
        "prod"|"production")
            print_status "Starting production environment..."
            docker-compose up -d
            ;;
        *)
            print_error "Invalid environment. Use 'dev' or 'prod'."
            exit 1
            ;;
    esac
    
    print_status "Services started successfully."
}

# Show service status
show_status() {
    print_header "Service Status:"
    docker-compose ps
    
    print_header "Service URLs:"
    echo "🌐 Main Application: http://localhost"
    echo "📱 Client App (Dev): http://localhost:3001"
    echo "🔧 Admin Panel (Dev): http://localhost:3002"
    echo "⚡ OCPP WebSocket: ws://localhost:8080"
    echo "🗄️  Database Admin: http://localhost:8080 (with --profile db-admin)"
    echo "📧 Mail Testing: http://localhost:8025 (with --profile mail)"
}

# Main execution
main() {
    case ${1:-setup} in
        "setup")
            check_docker
            create_directories
            setup_environment
            build_images
            init_database
            print_status "Setup completed successfully!"
            ;;
        "start")
            start_services $2
            show_status
            ;;
        "stop")
            print_header "Stopping services..."
            docker-compose down
            docker-compose -f docker-compose.dev.yml down
            print_status "Services stopped."
            ;;
        "restart")
            print_header "Restarting services..."
            docker-compose down
            docker-compose up -d
            show_status
            ;;
        "logs")
            print_header "Showing logs..."
            docker-compose logs -f ${2:-app}
            ;;
        "status")
            show_status
            ;;
        "clean")
            print_header "Cleaning up Docker resources..."
            docker-compose down -v
            docker-compose -f docker-compose.dev.yml down -v
            docker system prune -f
            print_status "Cleanup completed."
            ;;
        "help")
            echo "Usage: $0 [command] [options]"
            echo ""
            echo "Commands:"
            echo "  setup          - Initial setup (default)"
            echo "  start [env]    - Start services (env: dev/prod)"
            echo "  stop           - Stop all services"
            echo "  restart        - Restart services"
            echo "  logs [service] - Show logs for service"
            echo "  status         - Show service status"
            echo "  clean          - Clean up Docker resources"
            echo "  help           - Show this help"
            ;;
        *)
            print_error "Unknown command: $1"
            echo "Use '$0 help' for usage information."
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
