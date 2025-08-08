# EV Solar Charging Management System

ระบบจัดการสถานีชาร์จรถยนต์ไฟฟ้าพลังงานแสงอาทิตย์ที่สมบูรณ์แบบ พร้อมการรองรับ OCPP 1.6 และการเชื่อมต่อ Inverter

## 🌟 คุณสมบัติหลัก

### 📱 แอปพลิเคชันผู้ใช้
- **ระบบล็อกอิน/สมัครสมาชิก** - ปลอดภัยด้วย JWT
- **แผนที่สถานีชาร์จ** - แสดงตำแหน่งและสถานะแบบเรียลไทม์
- **จัดการรถยนต์** - เพิ่ม/ลบ/แก้ไข ข้อมูลรถยนต์
- **กระเป๋าเงินดิจิทัล** - เติมเงิน/ตัดเงิน/ประวัติการทำธุรกรรม
- **การชาร์จแบบเรียลไทม์** - ติดตามสถานะและค่าใช้จ่าย
- **PromptPay Integration** - ระบบชำระเงินที่สะดวก

### 🖥️ ระบบจัดการแอดมิน
1. **Dashboard Manager** - ภาพรวมระบบ, สถิติ, การแจ้งเตือน
2. **Payment Manager** - จัดการ PromptPay, ราคาพลังงาน, ธุรกรรม
3. **Charger Manager** - จัดการหัวชาร์จ Delta AC Mini Plus 7.4kW
4. **Energy Manager** - ควบคุม SUN2000-(2KTL-6KTL)-L1 Inverter
5. **User Manager** - จัดการผู้ใช้งาน, ยอดเงิน, สิทธิ์
6. **Overview/Logs** - บันทึกการทำงาน, ข้อผิดพลาด

### ⚡ การรองรับฮาร์ดแวร์
- **OCPP 1.6 WebSocket** - Delta AC Mini Plus 7.4kW
- **Modbus TCP/IP** - SUN2000-(2KTL-6KTL)-L1 Inverter
- **Real-time Monitoring** - ข้อมูลพลังงานแบบเรียลไทม์

## 🚀 การติดตั้งและใช้งาน

### ข้อกำหนดระบบ
- Node.js 16+ 
- MySQL 8.0+
- npm หรือ yarn

### 1. ติดตั้ง Dependencies
```bash
# ติดตั้ง dependencies หลัก
npm install

# ติดตั้ง dependencies สำหรับ client และ admin
npm run setup
```

### 2. ตั้งค่าฐานข้อมูล
```bash
# สร้างฐานข้อมูล MySQL
mysql -u root -p < database/schema.sql

# หรือใช้ไฟล์ .env เพื่อกำหนดค่า
cp .env.example .env
# แก้ไขค่าใน .env ตามสภาพแวดล้อมของคุณ
```

### 3. เริ่มต้นข้อมูล
```bash
# สร้างผู้ใช้เริ่มต้นและข้อมูลตัวอย่าง
node database/init.js
```

### 4. เริ่มการทำงาน
```bash
# Development mode
npm run dev

# Production mode
npm start

# เริ่ม client และ admin แยกต่างหาก
npm run client  # http://localhost:3001
npm run admin   # http://localhost:3002
```

## 👥 ผู้ใช้เริ่มต้น

| Username | Password | Role | Description |
|----------|----------|------|-------------|
| admin1 | 123456 | admin | ผู้ดูแลระบบหลัก |
| admin2 | 123456 | admin | ผู้ดูแลระบบสำรอง |
| service1 | 123456 | service | เจ้าหน้าที่บริการ |
| service2 | 123456 | service | เจ้าหน้าที่บริการ |
| user1 | 123456 | user | ผู้ใช้ทั่วไป (ยอดเงิน: ฿1,000) |
| user2 | 123456 | user | ผู้ใช้ทั่วไป (ยอดเงิน: ฿500) |
| user3 | 123456 | user | ผู้ใช้ทั่วไป (ยอดเงิน: ฿750) |

## 🔧 การกำหนดค่า

### Environment Variables (.env)
```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=ev_solar_charging
DB_USER=root
DB_PASSWORD=your_password

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your_secret_key
JWT_EXPIRES_IN=24h

# OCPP
OCPP_PORT=8080
OCPP_HOST=0.0.0.0

# Inverter
INVERTER_HOST=192.168.1.100
INVERTER_PORT=502
INVERTER_SLAVE_ID=1

# Payment
PROMPTPAY_ID=0123456789
```

### การเชื่อมต่อฮาร์ดแวร์

#### Delta AC Mini Plus 7.4kW
- เชื่อมต่อผ่าน OCPP 1.6 WebSocket
- URL: `ws://your-server:8080/DELTA_001`
- รองรับ: BootNotification, Heartbeat, StartTransaction, StopTransaction

#### SUN2000 Inverter
- เชื่อมต่อผ่าน Modbus TCP/IP
- Port: 502 (default)
- Slave ID: 1 (default)
- ตั้งค่า WiFi ของ Inverter ให้ชี้มาที่ Server IP

## 📊 API Endpoints

### Authentication
- `POST /api/auth/login` - เข้าสู่ระบบ
- `POST /api/auth/register` - สมัครสมาชิก
- `POST /api/auth/verify` - ตรวจสอบ Token

### User Management
- `GET /api/users/profile` - ข้อมูลผู้ใช้
- `PUT /api/users/profile` - อัปเดตข้อมูล
- `GET /api/users/vehicles` - รถยนต์ของผู้ใช้

### Charging
- `GET /api/stations` - รายการสถานีชาร์จ
- `POST /api/charging/start` - เริ่มการชาร์จ
- `POST /api/charging/stop` - หยุดการชาร์จ
- `GET /api/charging/sessions` - ประวัติการชาร์จ

### Payments
- `POST /api/payments/topup` - เติมเงิน
- `GET /api/payments/transactions` - ประวัติธุรกรรม

### Admin APIs
- `GET /api/admin/dashboard` - ข้อมูล Dashboard
- `GET /api/admin/users` - จัดการผู้ใช้
- `GET /api/admin/stations` - จัดการสถานีชาร์จ
- `GET /api/admin/energy` - ข้อมูลพลังงาน

## 🏗️ โครงสร้างโปรเจกต์

```
evsolar/
├── server/                 # Backend Server
│   ├── app.js             # Main application
│   ├── models/            # Database models
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   └── utils/             # Utilities
├── client/                # User Mobile App
│   └── src/
├── admin/                 # Admin Panel
│   └── src/
├── database/              # Database files
│   ├── schema.sql         # Database schema
│   └── init.js           # Initialization script
├── uploads/               # File uploads
├── logs/                  # Application logs
└── README.md
```

## 🔒 ความปลอดภัย

- **JWT Authentication** - การยืนยันตัวตนที่ปลอดภัย
- **Password Hashing** - bcrypt สำหรับเข้ารหัสรหัสผ่าน
- **Rate Limiting** - จำกัดการเรียก API
- **Input Validation** - ตรวจสอบข้อมูลนำเข้า
- **SQL Injection Protection** - ป้องกันการโจมตี SQL
- **CORS Configuration** - ควบคุมการเข้าถึงข้าม Domain

## 📈 การตรวจสอบและบันทึก

- **Winston Logger** - ระบบบันทึกที่ครอบคลุม
- **System Logs** - บันทึกการทำงานของระบบ
- **OCPP Message Logs** - บันทึกข้อความ OCPP
- **Transaction Logs** - บันทึกธุรกรรมทั้งหมด
- **Error Tracking** - ติดตามข้อผิดพลาด

## 🚀 การใช้งานจริง (Production)

### การติดตั้งบน Server
1. ติดตั้ง PM2 สำหรับจัดการ Process
2. ตั้งค่า Nginx เป็น Reverse Proxy
3. ใช้ SSL Certificate สำหรับ HTTPS
4. ตั้งค่า Database Backup
5. ตั้งค่า Log Rotation

### การตรวจสอบระบบ
```bash
# ตรวจสอบสถานะ Server
curl http://localhost:3000/health

# ตรวจสอบการเชื่อมต่อ OCPP
# ดูที่ logs/combined.log

# ตรวจสอบ Inverter
# เข้าไปที่ Admin Panel > Energy Manager
```

## 🤝 การสนับสนุน

สำหรับการสนับสนุนและคำถาม:
- Email: support@evsolar.com
- Documentation: [Wiki](https://github.com/your-repo/wiki)
- Issues: [GitHub Issues](https://github.com/your-repo/issues)

## 📄 License

MIT License - ดูไฟล์ LICENSE สำหรับรายละเอียด

---

**EV Solar Charging System** - ระบบจัดการสถานีชาร์จรถยนต์ไฟฟ้าพลังงานแสงอาทิตย์ที่สมบูรณ์แบบสำหรับประเทศไทย 🇹🇭
