const express = require('express');
const { Op } = require('sequelize');
const { 
    User, 
    ChargingStation, 
    ChargingSession, 
    PaymentTransaction, 
    SolarInverter, 
    EnergyMonitoring,
    SystemLog,
    OCPPMessage 
} = require('../models');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const logger = createLogger('admin');

// Apply authentication and admin role check to all routes
router.use(authenticateToken);
router.use(authorizeRole('admin', 'service'));

// Dashboard data endpoint
router.get('/dashboard', async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // Get basic statistics
        const [
            totalStations,
            activeStations,
            totalUsers,
            activeSessions,
            todayRevenue,
            recentSessions,
            alerts
        ] = await Promise.all([
            ChargingStation.count(),
            ChargingStation.count({ where: { status: ['available', 'occupied'] } }),
            User.count({ where: { role: 'user' } }),
            ChargingSession.count({ where: { status: ['preparing', 'charging'] } }),
            PaymentTransaction.sum('amount', {
                where: {
                    type: 'charge',
                    status: 'completed',
                    created_at: { [Op.gte]: today, [Op.lt]: tomorrow }
                }
            }),
            ChargingSession.findAll({
                limit: 10,
                order: [['created_at', 'DESC']],
                include: [
                    { model: User, as: 'user', attributes: ['username', 'first_name', 'last_name'] },
                    { model: ChargingStation, as: 'station', attributes: ['name', 'station_code'] }
                ]
            }),
            SystemLog.findAll({
                where: { level: ['warning', 'error', 'critical'] },
                limit: 5,
                order: [['created_at', 'DESC']]
            })
        ]);

        // Get solar production data
        const solarProduction = await SolarInverter.sum('current_power') || 0;

        // Get energy data for the last 24 hours
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        
        const energyData = await EnergyMonitoring.findAll({
            where: {
                timestamp: { [Op.gte]: yesterday }
            },
            attributes: [
                'timestamp',
                [require('sequelize').fn('SUM', require('sequelize').col('power_output')), 'solar_power']
            ],
            group: [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('timestamp'), '%Y-%m-%d %H:00:00')],
            order: [['timestamp', 'ASC']],
            raw: true
        });

        // Add consumption data (mock for now)
        const energyDataWithConsumption = energyData.map(item => ({
            ...item,
            consumption: parseFloat(item.solar_power) * 0.8 // Mock consumption as 80% of production
        }));

        // Get station status distribution
        const stationStatus = await ChargingStation.findAll({
            attributes: ['status', 'name', 'station_code']
        });

        // Format alerts
        const formattedAlerts = alerts.map(alert => ({
            title: `${alert.category.toUpperCase()}: ${alert.message}`,
            description: alert.details ? JSON.stringify(alert.details) : '',
            type: alert.level === 'critical' ? 'error' : alert.level === 'error' ? 'error' : 'warning'
        }));

        res.json({
            stats: {
                totalStations,
                activeStations,
                totalUsers,
                activeSessions,
                todayRevenue: parseFloat(todayRevenue || 0),
                solarProduction: parseFloat(solarProduction)
            },
            alerts: formattedAlerts,
            recentSessions,
            energyData: energyDataWithConsumption,
            stationStatus
        });

    } catch (error) {
        logger.error('Dashboard data error:', error);
        res.status(500).json({
            error: 'Failed to fetch dashboard data'
        });
    }
});

// User management endpoints
router.get('/users', async (req, res) => {
    try {
        const { page = 1, limit = 10, search, role, status } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        if (search) {
            whereClause[Op.or] = [
                { username: { [Op.like]: `%${search}%` } },
                { email: { [Op.like]: `%${search}%` } },
                { first_name: { [Op.like]: `%${search}%` } },
                { last_name: { [Op.like]: `%${search}%` } }
            ];
        }
        if (role) whereClause.role = role;
        if (status) whereClause.status = status;

        const { count, rows } = await User.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']],
            attributes: { exclude: ['password_hash'] }
        });

        res.json({
            users: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        logger.error('Get users error:', error);
        res.status(500).json({
            error: 'Failed to fetch users'
        });
    }
});

// Update user balance (admin only)
router.put('/users/:id/balance', authorizeRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, notes } = req.body;

        const user = await User.findByPk(id);
        if (!user) {
            return res.status(404).json({
                error: 'User not found'
            });
        }

        const oldBalance = parseFloat(user.balance);
        const newBalance = oldBalance + parseFloat(amount);

        await user.update({ balance: newBalance });

        // Create transaction record
        await PaymentTransaction.create({
            transaction_code: `ADJ${Date.now()}`,
            user_id: id,
            type: 'adjustment',
            amount: parseFloat(amount),
            balance_before: oldBalance,
            balance_after: newBalance,
            payment_method: 'admin',
            status: 'completed',
            verified_by: req.user.id,
            verified_at: new Date(),
            notes: notes || `Balance adjustment by admin ${req.user.username}`
        });

        logger.info(`Admin ${req.user.username} adjusted balance for user ${user.username}: ${amount}`);

        res.json({
            message: 'Balance updated successfully',
            user: {
                id: user.id,
                username: user.username,
                balance: newBalance
            }
        });

    } catch (error) {
        logger.error('Update balance error:', error);
        res.status(500).json({
            error: 'Failed to update balance'
        });
    }
});

// Charging stations management
router.get('/stations', async (req, res) => {
    try {
        const stations = await ChargingStation.findAll({
            include: [
                {
                    model: ChargingSession,
                    as: 'sessions',
                    where: { status: ['preparing', 'charging'] },
                    required: false,
                    include: [
                        { model: User, as: 'user', attributes: ['username', 'first_name', 'last_name'] }
                    ]
                }
            ],
            order: [['created_at', 'ASC']]
        });

        res.json({ stations });

    } catch (error) {
        logger.error('Get stations error:', error);
        res.status(500).json({
            error: 'Failed to fetch stations'
        });
    }
});

// Energy management
router.get('/energy/inverters', async (req, res) => {
    try {
        const inverters = await SolarInverter.findAll({
            include: [
                {
                    model: EnergyMonitoring,
                    as: 'monitoring',
                    limit: 1,
                    order: [['timestamp', 'DESC']]
                }
            ]
        });

        res.json({ inverters });

    } catch (error) {
        logger.error('Get inverters error:', error);
        res.status(500).json({
            error: 'Failed to fetch inverters'
        });
    }
});

// Get energy monitoring data
router.get('/energy/monitoring', async (req, res) => {
    try {
        const { inverter_id, start_date, end_date, interval = 'hour' } = req.query;

        const whereClause = {};
        if (inverter_id) whereClause.inverter_id = inverter_id;
        if (start_date) whereClause.timestamp = { [Op.gte]: new Date(start_date) };
        if (end_date) {
            whereClause.timestamp = {
                ...whereClause.timestamp,
                [Op.lte]: new Date(end_date)
            };
        }

        // Default to last 24 hours if no date range specified
        if (!start_date && !end_date) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            whereClause.timestamp = { [Op.gte]: yesterday };
        }

        const data = await EnergyMonitoring.findAll({
            where: whereClause,
            order: [['timestamp', 'ASC']],
            limit: 1000
        });

        res.json({ data });

    } catch (error) {
        logger.error('Get monitoring data error:', error);
        res.status(500).json({
            error: 'Failed to fetch monitoring data'
        });
    }
});

// Payment transactions
router.get('/payments/transactions', async (req, res) => {
    try {
        const { page = 1, limit = 20, type, status, user_id } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        if (type) whereClause.type = type;
        if (status) whereClause.status = status;
        if (user_id) whereClause.user_id = user_id;

        const { count, rows } = await PaymentTransaction.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']],
            include: [
                { model: User, as: 'user', attributes: ['username', 'first_name', 'last_name'] },
                { model: User, as: 'verifier', attributes: ['username'], required: false }
            ]
        });

        res.json({
            transactions: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        logger.error('Get transactions error:', error);
        res.status(500).json({
            error: 'Failed to fetch transactions'
        });
    }
});

// System logs
router.get('/logs', async (req, res) => {
    try {
        const { page = 1, limit = 50, level, category, start_date, end_date } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        if (level) whereClause.level = level;
        if (category) whereClause.category = category;
        if (start_date) whereClause.created_at = { [Op.gte]: new Date(start_date) };
        if (end_date) {
            whereClause.created_at = {
                ...whereClause.created_at,
                [Op.lte]: new Date(end_date)
            };
        }

        const { count, rows } = await SystemLog.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']],
            include: [
                { model: User, as: 'user', attributes: ['username'], required: false }
            ]
        });

        res.json({
            logs: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        logger.error('Get logs error:', error);
        res.status(500).json({
            error: 'Failed to fetch logs'
        });
    }
});

// OCPP messages
router.get('/ocpp/messages', async (req, res) => {
    try {
        const { page = 1, limit = 50, station_id, action } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = {};
        if (station_id) whereClause.station_id = station_id;
        if (action) whereClause.action = action;

        const { count, rows } = await OCPPMessage.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']],
            include: [
                { model: ChargingStation, as: 'station', attributes: ['name', 'station_code'] }
            ]
        });

        res.json({
            messages: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        logger.error('Get OCPP messages error:', error);
        res.status(500).json({
            error: 'Failed to fetch OCPP messages'
        });
    }
});

module.exports = router;
