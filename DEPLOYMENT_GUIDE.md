# 🚀 EV Solar Charging System - Production Deployment Guide

## 📋 Pre-Deployment Checklist

### ✅ **System Requirements**
- **Node.js**: v18.0.0 or higher
- **MySQL**: v8.0 or higher
- **RAM**: Minimum 4GB (Recommended 8GB+)
- **Storage**: Minimum 20GB free space
- **Network**: Stable internet connection
- **OS**: Ubuntu 20.04+ / CentOS 8+ / Windows Server 2019+

### ✅ **Hardware Requirements**
- **Delta AC Mini Plus 7.4kW** chargers with OCPP 1.6 support
- **SUN2000-(2KTL-6KTL)-L1** solar inverters
- **Network switch** for device connectivity
- **UPS** for power backup (recommended)

---

## 🔧 **Step 1: Server Setup**

### **1.1 Install Dependencies**
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MySQL 8.0
sudo apt install mysql-server-8.0 -y
sudo mysql_secure_installation

# Install PM2 for process management
sudo npm install -g pm2

# Install Nginx for reverse proxy
sudo apt install nginx -y
```

### **1.2 Create Application User**
```bash
sudo useradd -m -s /bin/bash evsolar
sudo usermod -aG sudo evsolar
sudo su - evsolar
```

---

## 📁 **Step 2: Application Deployment**

### **2.1 Clone and Setup**
```bash
# Navigate to application directory
cd /home/evsolar

# Copy application files (upload your project)
# Ensure all files are in /home/evsolar/evsolar/

# Set permissions
sudo chown -R evsolar:evsolar /home/evsolar/evsolar
chmod +x /home/evsolar/evsolar/scripts/*.js

# Install dependencies
cd /home/evsolar/evsolar
npm run setup
```

### **2.2 Environment Configuration**
```bash
# Copy environment template
cp .env.example .env

# Edit environment variables
nano .env
```

**Production .env Configuration:**
```env
# Database Configuration
DB_HOST=localhost
DB_USER=evsolar_user
DB_PASSWORD=your_secure_password_here
DB_NAME=ev_solar_charging
DB_PORT=3306

# Server Configuration
NODE_ENV=production
PORT=3000
OCPP_PORT=8080

# JWT Configuration
JWT_SECRET=your_super_secure_jwt_secret_key_here
JWT_EXPIRES_IN=24h

# Hardware Configuration
INVERTER_IP=192.168.1.100
INVERTER_PORT=502
INVERTER_SLAVE_ID=1

# Payment Configuration
PROMPTPAY_ID=0123456789
PROMPTPAY_NAME=EV Solar Charging

# File Upload Configuration
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=10485760

# Admin Configuration
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PHONE=+66812345678

# Rate Limiting
RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

# Logging Configuration
LOG_LEVEL=info
LOG_FILE=./logs/app.log

# CORS Configuration
ALLOWED_ORIGINS=https://yourdomain.com,https://admin.yourdomain.com
```

---

## 🗄️ **Step 3: Database Setup**

### **3.1 Create Database and User**
```sql
-- Login to MySQL as root
mysql -u root -p

-- Create database
CREATE DATABASE ev_solar_charging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create user
CREATE USER 'evsolar_user'@'localhost' IDENTIFIED BY 'your_secure_password_here';

-- Grant permissions
GRANT ALL PRIVILEGES ON ev_solar_charging.* TO 'evsolar_user'@'localhost';
FLUSH PRIVILEGES;

-- Exit MySQL
EXIT;
```

### **3.2 Initialize Database**
```bash
# Run database initialization
cd /home/evsolar/evsolar
node scripts/deploy.js
```

---

## 🌐 **Step 4: Nginx Configuration**

### **4.1 Create Nginx Configuration**
```bash
sudo nano /etc/nginx/sites-available/evsolar
```

**Nginx Configuration:**
```nginx
# Main Application
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload";

    # Client App
    location / {
        root /home/evsolar/evsolar/client/build;
        try_files $uri $uri/ /index.html;
    }

    # API Routes
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # File Uploads
    location /uploads/ {
        root /home/evsolar/evsolar;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# Admin Panel
server {
    listen 443 ssl http2;
    server_name admin.yourdomain.com;

    # SSL Configuration (same as above)
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;

    # Admin Panel
    location / {
        root /home/evsolar/evsolar/admin/build;
        try_files $uri $uri/ /index.html;
    }

    # API Routes (same as above)
    location /api/ {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# OCPP WebSocket
server {
    listen 8080;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### **4.2 Enable Site**
```bash
sudo ln -s /etc/nginx/sites-available/evsolar /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🔒 **Step 5: SSL Certificate**

### **5.1 Install Certbot**
```bash
sudo apt install certbot python3-certbot-nginx -y
```

### **5.2 Obtain SSL Certificate**
```bash
sudo certbot --nginx -d yourdomain.com -d admin.yourdomain.com
```

---

## 🚀 **Step 6: Application Start**

### **6.1 Build Frontend Applications**
```bash
cd /home/evsolar/evsolar
npm run build
```

### **6.2 Start with PM2**
```bash
# Start backend server
pm2 start server/app.js --name "evsolar-backend"

# Save PM2 configuration
pm2 save
pm2 startup

# Check status
pm2 status
pm2 logs evsolar-backend
```

---

## 🔧 **Step 7: Hardware Configuration**

### **7.1 Delta AC Mini Plus Setup**
1. Connect chargers to network
2. Configure OCPP 1.6 settings:
   - **Central System URL**: `ws://yourdomain.com:8080/{station_id}`
   - **Heartbeat Interval**: 300 seconds
   - **Connection Timeout**: 60 seconds

### **7.2 SUN2000 Inverter Setup**
1. Connect inverters to network
2. Enable Modbus TCP/IP
3. Configure network settings:
   - **IP Address**: 192.168.1.100 (or as configured)
   - **Port**: 502
   - **Slave ID**: 1

---

## 📊 **Step 8: Monitoring Setup**

### **8.1 System Monitoring**
```bash
# Install monitoring tools
sudo apt install htop iotop nethogs -y

# Setup log rotation
sudo nano /etc/logrotate.d/evsolar
```

**Log Rotation Configuration:**
```
/home/evsolar/evsolar/logs/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0644 evsolar evsolar
    postrotate
        pm2 reload evsolar-backend
    endscript
}
```

### **8.2 Health Check Cron**
```bash
# Add health check cron job
crontab -e

# Add this line:
*/5 * * * * cd /home/evsolar/evsolar && node scripts/health-check.js >> logs/health.log 2>&1
```

---

## 🔐 **Step 9: Security Hardening**

### **9.1 Firewall Configuration**
```bash
# Install UFW
sudo apt install ufw -y

# Configure firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 8080/tcp
sudo ufw enable
```

### **9.2 Fail2Ban Setup**
```bash
# Install Fail2Ban
sudo apt install fail2ban -y

# Configure Fail2Ban
sudo nano /etc/fail2ban/jail.local
```

**Fail2Ban Configuration:**
```ini
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[nginx-http-auth]
enabled = true

[nginx-limit-req]
enabled = true
```

---

## 📱 **Step 10: User Accounts Setup**

### **10.1 Default Users**
The system comes with pre-configured users:

| Username | Password | Role | Access |
|----------|----------|------|---------|
| admin1 | 123456 | admin | Full system access |
| admin2 | 123456 | admin | Full system access |
| service1 | 123456 | service | Management access |
| service2 | 123456 | service | Management access |
| user1 | 123456 | user | Client app only |
| user2 | 123456 | user | Client app only |
| user3 | 123456 | user | Client app only |

**⚠️ IMPORTANT: Change all default passwords immediately after deployment!**

---

## 🧪 **Step 11: Production Testing**

### **11.1 Run Health Check**
```bash
cd /home/evsolar/evsolar
node scripts/health-check.js
```

### **11.2 Test All Endpoints**
```bash
# Test API
curl -X GET https://yourdomain.com/api/stations

# Test Admin Panel
curl -X GET https://admin.yourdomain.com

# Test OCPP WebSocket
wscat -c ws://yourdomain.com:8080/station1
```

### **11.3 Load Testing**
```bash
# Install Apache Bench
sudo apt install apache2-utils -y

# Test API performance
ab -n 1000 -c 10 https://yourdomain.com/api/stations
```

---

## 📋 **Step 12: Backup Strategy**

### **12.1 Database Backup**
```bash
# Create backup script
nano /home/evsolar/backup-db.sh
```

**Backup Script:**
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/evsolar/backups"
mkdir -p $BACKUP_DIR

mysqldump -u evsolar_user -p'your_password' ev_solar_charging > $BACKUP_DIR/db_backup_$DATE.sql
gzip $BACKUP_DIR/db_backup_$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "db_backup_*.sql.gz" -mtime +30 -delete
```

### **12.2 Application Backup**
```bash
# Create application backup script
nano /home/evsolar/backup-app.sh
```

**Application Backup Script:**
```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/evsolar/backups"
APP_DIR="/home/evsolar/evsolar"

tar -czf $BACKUP_DIR/app_backup_$DATE.tar.gz -C $APP_DIR .
find $BACKUP_DIR -name "app_backup_*.tar.gz" -mtime +7 -delete
```

---

## 🎯 **Step 13: Go Live!**

### **13.1 Final Checklist**
- ✅ Database initialized and populated
- ✅ All services running (PM2 status green)
- ✅ Nginx configured and SSL working
- ✅ Firewall configured
- ✅ Monitoring setup
- ✅ Backups configured
- ✅ Hardware connected and tested
- ✅ Default passwords changed

### **13.2 Access URLs**
- **Client App**: https://yourdomain.com
- **Admin Panel**: https://admin.yourdomain.com
- **API Documentation**: https://yourdomain.com/api/docs
- **Health Check**: https://yourdomain.com/api/health

---

## 🆘 **Troubleshooting**

### **Common Issues:**

1. **Database Connection Failed**
   ```bash
   # Check MySQL status
   sudo systemctl status mysql
   
   # Check connection
   mysql -u evsolar_user -p ev_solar_charging
   ```

2. **PM2 Process Crashed**
   ```bash
   # Check logs
   pm2 logs evsolar-backend
   
   # Restart process
   pm2 restart evsolar-backend
   ```

3. **OCPP Connection Issues**
   ```bash
   # Check port availability
   netstat -tlnp | grep 8080
   
   # Check firewall
   sudo ufw status
   ```

4. **SSL Certificate Issues**
   ```bash
   # Renew certificate
   sudo certbot renew
   
   # Test certificate
   sudo certbot certificates
   ```

---

## 📞 **Support & Maintenance**

### **Log Locations:**
- Application logs: `/home/evsolar/evsolar/logs/`
- Nginx logs: `/var/log/nginx/`
- MySQL logs: `/var/log/mysql/`
- PM2 logs: `~/.pm2/logs/`

### **Monitoring Commands:**
```bash
# System resources
htop

# Application status
pm2 monit

# Database status
sudo systemctl status mysql

# Nginx status
sudo systemctl status nginx

# Check disk space
df -h

# Check memory usage
free -h
```

---

## 🎉 **Congratulations!**

Your **EV Solar Charging Management System** is now live and ready to serve users!

**System Status: 🟢 PRODUCTION READY**

---

**Deployment Date:** ${new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' })}
**Version:** 1.0.0
**Status:** ✅ **SUCCESSFULLY DEPLOYED**
