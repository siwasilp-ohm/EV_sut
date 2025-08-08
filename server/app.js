const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

const { sequelize } = require('./models');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const stationRoutes = require('./routes/stations');
const chargingRoutes = require('./routes/charging');
const paymentRoutes = require('./routes/payments');
const energyRoutes = require('./routes/energy');
const adminRoutes = require('./routes/admin');

// Import services
const OCPPServer = require('./services/ocppServer');
const InverterService = require('./services/inverterService');
const { createLogger } = require('./utils/logger');

const app = express();
const logger = createLogger('app');

// Security middleware
app.use(helmet());
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://your-domain.com', 'https://admin.your-domain.com']
        : ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002'],
    credentials: true
}));

// Rate limiting
const limiter = rateLimit({
    windowMs: (process.env.RATE_LIMIT_WINDOW || 15) * 60 * 1000,
    max: process.env.RATE_LIMIT_MAX || 100,
    message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Logging
app.use(morgan('combined', {
    stream: { write: message => logger.info(message.trim()) }
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '1.0.0'
    });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/stations', stationRoutes);
app.use('/api/charging', chargingRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/energy', energyRoutes);
app.use('/api/admin', adminRoutes);

// Serve client applications
if (process.env.NODE_ENV === 'production') {
    // Serve user app
    app.use('/app', express.static(path.join(__dirname, '../client/build')));
    app.get('/app/*', (req, res) => {
        res.sendFile(path.join(__dirname, '../client/build/index.html'));
    });

    // Serve admin app
    app.use('/admin', express.static(path.join(__dirname, '../admin/build')));
    app.get('/admin/*', (req, res) => {
        res.sendFile(path.join(__dirname, '../admin/build/index.html'));
    });

    // Default redirect
    app.get('/', (req, res) => {
        res.redirect('/app');
    });
}

// Error handling middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Validation Error',
            details: err.errors
        });
    }
    
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Invalid token'
        });
    }

    res.status(500).json({
        error: 'Internal Server Error',
        message: process.env.NODE_ENV === 'production' 
            ? 'Something went wrong' 
            : err.message
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        error: 'Not Found',
        message: 'The requested resource was not found'
    });
});

const PORT = process.env.PORT || 3000;
const OCPP_PORT = process.env.OCPP_PORT || 8080;

async function startServer() {
    try {
        // Test database connection
        await sequelize.authenticate();
        logger.info('Database connection established successfully');

        // Sync database models
        if (process.env.NODE_ENV !== 'production') {
            await sequelize.sync({ alter: true });
            logger.info('Database models synchronized');
        }

        // Start HTTP server
        const server = app.listen(PORT, () => {
            logger.info(`Server running on port ${PORT}`);
        });

        // Start OCPP server
        const ocppServer = new OCPPServer(OCPP_PORT);
        await ocppServer.start();
        logger.info(`OCPP server running on port ${OCPP_PORT}`);

        // Start inverter service
        const inverterService = new InverterService();
        await inverterService.start();
        logger.info('Inverter service started');

        // Graceful shutdown
        process.on('SIGTERM', async () => {
            logger.info('SIGTERM received, shutting down gracefully');
            server.close(() => {
                logger.info('HTTP server closed');
            });
            await ocppServer.stop();
            await inverterService.stop();
            await sequelize.close();
            process.exit(0);
        });

        process.on('SIGINT', async () => {
            logger.info('SIGINT received, shutting down gracefully');
            server.close(() => {
                logger.info('HTTP server closed');
            });
            await ocppServer.stop();
            await inverterService.stop();
            await sequelize.close();
            process.exit(0);
        });

    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    startServer();
}

module.exports = app;
