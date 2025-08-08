# 🐳 Docker Configuration for EV Solar Charging System

This document provides comprehensive instructions for running the EV Solar Charging System using Docker containers.

## 📋 Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+
- 4GB+ RAM available
- 10GB+ disk space

## 🚀 Quick Start

### 1. Clone and Setup
```bash
# Navigate to project directory
cd evsolar

# Run initial setup
make setup
```

### 2. Start Development Environment
```bash
# Start all development services
make dev

# Or use docker-compose directly
docker-compose -f docker-compose.dev.yml up -d
```

### 3. Start Production Environment
```bash
# Start production services
make prod

# Or use docker-compose directly
docker-compose up -d
```

## 🏗️ Architecture

### Services Overview

| Service | Port | Description |
|---------|------|-------------|
| **app** | 3000 | Main Node.js application |
| **mysql** | 3306 | MySQL 8.0 database |
| **redis** | 6379 | Redis cache & sessions |
| **nginx** | 80, 443 | Reverse proxy & load balancer |
| **client-dev** | 3001 | React client (development) |
| **admin-dev** | 3002 | React admin panel (development) |

### Development vs Production

#### Development Environment
- Hot reloading enabled
- Source code mounted as volumes
- Debug ports exposed
- Separate containers for client/admin
- Additional tools (Adminer, Mailhog)

#### Production Environment
- Optimized multi-stage builds
- Built assets served by Nginx
- Security hardened
- Resource limits applied
- Health checks enabled

## 🛠️ Available Commands

### Using Makefile (Recommended)
```bash
make help          # Show all available commands
make setup         # Initial setup
make dev           # Start development environment
make prod          # Start production environment
make stop          # Stop all services
make restart       # Restart services
make logs          # Show application logs
make status        # Show service status
make clean         # Clean up Docker resources
make db-shell      # Connect to database
make app-shell     # Connect to app container
make test          # Run tests
make backup        # Backup database
make urls          # Show all service URLs
```

### Using Docker Compose Directly
```bash
# Development
docker-compose -f docker-compose.dev.yml up -d
docker-compose -f docker-compose.dev.yml down

# Production
docker-compose up -d
docker-compose down

# View logs
docker-compose logs -f app
docker-compose logs -f mysql

# Execute commands in containers
docker-compose exec app sh
docker-compose exec mysql mysql -u root -p
```

## 🌐 Service URLs

### Development Environment
- **Client App**: http://localhost:3001
- **Admin Panel**: http://localhost:3002
- **API Server**: http://localhost:3000
- **OCPP WebSocket**: ws://localhost:8080
- **Database Admin**: http://localhost:8080 (Adminer)
- **Mail Testing**: http://localhost:8025 (Mailhog)

### Production Environment
- **Main Application**: http://localhost
- **API Server**: http://localhost:3000
- **OCPP WebSocket**: ws://localhost:8080
- **Monitoring**: http://localhost:3001 (Grafana)

## ⚙️ Configuration

### Environment Variables

Copy `.env.docker` to `.env` and customize:

```bash
# Database
DB_HOST=mysql
DB_NAME=ev_solar_charging
DB_USER=evsolar_user
DB_PASSWORD=your_secure_password

# Application
JWT_SECRET=your_jwt_secret
OCPP_PORT=8080
INVERTER_IP=192.168.1.100

# Monitoring
GRAFANA_PASSWORD=admin123
```

### Volume Mounts

#### Development
- Source code mounted for hot reloading
- Database data persisted
- Logs and uploads persisted

#### Production
- Only data volumes mounted
- Built assets copied into image
- Optimized for security and performance

## 🔧 Development Workflow

### 1. Start Development Environment
```bash
make dev
```

### 2. Make Code Changes
- Backend: Edit files in `server/` directory
- Client: Edit files in `client/src/` directory
- Admin: Edit files in `admin/src/` directory

### 3. View Changes
Changes are automatically reflected due to hot reloading:
- Backend: Nodemon restarts server
- Client/Admin: React dev server reloads

### 4. Run Tests
```bash
make test-dev
```

### 5. View Logs
```bash
make logs
make logs-mysql
make logs-client-dev
```

## 🚀 Production Deployment

### 1. Build Production Images
```bash
make build
```

### 2. Configure Environment
```bash
cp .env.docker .env
# Edit .env with production values
```

### 3. Start Production Services
```bash
make prod
```

### 4. Setup SSL (Optional)
```bash
# Place SSL certificates in docker/ssl/
# Uncomment HTTPS server block in nginx config
# Restart nginx service
docker-compose restart nginx
```

## 📊 Monitoring & Logging

### Health Checks
All services include health checks:
```bash
docker-compose ps  # Shows health status
```

### Logs
```bash
# Application logs
make logs

# Database logs
make logs-mysql

# Nginx logs
make logs-nginx

# All logs
docker-compose logs -f
```

### Monitoring Stack (Optional)
Enable monitoring with profiles:
```bash
docker-compose --profile monitoring up -d
```

Access:
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001

## 🗄️ Database Management

### Access Database
```bash
make db-shell
```

### Backup Database
```bash
make backup
```

### Restore Database
```bash
make restore FILE=backups/backup_20250109_001500.sql
```

### Database Admin UI
```bash
docker-compose --profile db-admin up -d
# Access: http://localhost:8080
```

## 🧪 Testing

### Run All Tests
```bash
make test
```

### Run Specific Test Suite
```bash
docker-compose exec app npm run test:unit
docker-compose exec app npm run test:integration
```

### Load Testing
```bash
docker-compose exec app npm run test:load
```

## 🔒 Security Considerations

### Production Security
- Change default passwords
- Use strong JWT secrets
- Enable SSL/TLS
- Configure firewall rules
- Regular security updates

### Network Security
- Services communicate via internal network
- Only necessary ports exposed
- Nginx acts as reverse proxy
- Rate limiting enabled

## 🐛 Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Check port usage
netstat -tulpn | grep :3000

# Stop conflicting services
sudo systemctl stop apache2
sudo systemctl stop nginx
```

#### Permission Issues
```bash
# Fix file permissions
sudo chown -R $USER:$USER .
chmod +x docker/scripts/*.sh
```

#### Database Connection Issues
```bash
# Check MySQL logs
make logs-mysql

# Restart database
docker-compose restart mysql
```

#### Memory Issues
```bash
# Check container resources
docker stats

# Increase Docker memory limit
# Docker Desktop: Settings > Resources > Memory
```

### Reset Everything
```bash
make clean
make setup
make dev
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
- [Node.js Docker Best Practices](https://nodejs.org/en/docs/guides/nodejs-docker-webapp/)
- [MySQL Docker Hub](https://hub.docker.com/_/mysql)
- [Nginx Docker Hub](https://hub.docker.com/_/nginx)

## 🆘 Support

If you encounter issues:

1. Check service logs: `make logs`
2. Verify service status: `make status`
3. Review configuration files
4. Check Docker resources
5. Restart services: `make restart`

For persistent issues, clean and rebuild:
```bash
make clean
make setup
make build
make dev
```
