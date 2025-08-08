const express = require('express');
const { SolarInverter, EnergyMonitoring } = require('../models');
const { authenticateToken, authorizeRole } = require('../middleware/auth');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const logger = createLogger('energy');

// Apply authentication to all routes
router.use(authenticateToken);

// Get all inverters status (admin/service only)
router.get('/inverters', authorizeRole('admin', 'service'), async (req, res) => {
    try {
        const inverters = await SolarInverter.findAll({
            include: [
                {
                    model: EnergyMonitoring,
                    as: 'monitoring',
                    limit: 1,
                    order: [['timestamp', 'DESC']]
                }
            ],
            order: [['created_at', 'ASC']]
        });

        const invertersWithStatus = inverters.map(inverter => ({
            ...inverter.toJSON(),
            is_online: inverter.status === 'online',
            last_reading: inverter.monitoring?.[0] || null
        }));

        res.json({ inverters: invertersWithStatus });

    } catch (error) {
        logger.error('Get inverters error:', error);
        res.status(500).json({
            error: 'Failed to fetch inverters'
        });
    }
});

// Get specific inverter details
router.get('/inverters/:id', authorizeRole('admin', 'service'), async (req, res) => {
    try {
        const { id } = req.params;

        const inverter = await SolarInverter.findByPk(id, {
            include: [
                {
                    model: EnergyMonitoring,
                    as: 'monitoring',
                    limit: 24, // Last 24 readings
                    order: [['timestamp', 'DESC']]
                }
            ]
        });

        if (!inverter) {
            return res.status(404).json({
                error: 'Inverter not found'
            });
        }

        res.json({ inverter });

    } catch (error) {
        logger.error('Get inverter details error:', error);
        res.status(500).json({
            error: 'Failed to fetch inverter details'
        });
    }
});

// Get energy monitoring data
router.get('/monitoring', authorizeRole('admin', 'service'), async (req, res) => {
    try {
        const { 
            inverter_id, 
            start_date, 
            end_date, 
            interval = 'hour',
            limit = 100 
        } = req.query;

        const whereClause = {};
        if (inverter_id) whereClause.inverter_id = inverter_id;
        
        // Default to last 24 hours if no date range specified
        if (!start_date && !end_date) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            whereClause.timestamp = { [require('sequelize').Op.gte]: yesterday };
        } else {
            if (start_date) {
                whereClause.timestamp = { [require('sequelize').Op.gte]: new Date(start_date) };
            }
            if (end_date) {
                whereClause.timestamp = {
                    ...whereClause.timestamp,
                    [require('sequelize').Op.lte]: new Date(end_date)
                };
            }
        }

        let data;
        
        if (interval === 'raw') {
            // Return raw data points
            data = await EnergyMonitoring.findAll({
                where: whereClause,
                order: [['timestamp', 'ASC']],
                limit: parseInt(limit),
                include: [
                    {
                        model: SolarInverter,
                        as: 'inverter',
                        attributes: ['inverter_code', 'model']
                    }
                ]
            });
        } else {
            // Aggregate data by interval
            const groupBy = interval === 'hour' 
                ? require('sequelize').fn('DATE_FORMAT', require('sequelize').col('timestamp'), '%Y-%m-%d %H:00:00')
                : require('sequelize').fn('DATE_FORMAT', require('sequelize').col('timestamp'), '%Y-%m-%d');

            data = await EnergyMonitoring.findAll({
                where: whereClause,
                attributes: [
                    [groupBy, 'period'],
                    [require('sequelize').fn('AVG', require('sequelize').col('power_output')), 'avg_power'],
                    [require('sequelize').fn('MAX', require('sequelize').col('power_output')), 'max_power'],
                    [require('sequelize').fn('MIN', require('sequelize').col('power_output')), 'min_power'],
                    [require('sequelize').fn('AVG', require('sequelize').col('efficiency')), 'avg_efficiency'],
                    [require('sequelize').fn('AVG', require('sequelize').col('temperature')), 'avg_temperature'],
                    [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'data_points']
                ],
                group: [groupBy],
                order: [[require('sequelize').literal('period'), 'ASC']],
                raw: true
            });
        }

        res.json({ 
            data,
            interval,
            total_points: data.length
        });

    } catch (error) {
        logger.error('Get monitoring data error:', error);
        res.status(500).json({
            error: 'Failed to fetch monitoring data'
        });
    }
});

// Get energy production summary
router.get('/production/summary', async (req, res) => {
    try {
        const { days = 7 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // Get total production from all inverters
        const inverters = await SolarInverter.findAll({
            attributes: [
                'id',
                'inverter_code',
                'model',
                'rated_power',
                'current_power',
                'daily_energy',
                'total_energy',
                'status'
            ]
        });

        // Get aggregated monitoring data
        const monitoringData = await EnergyMonitoring.findAll({
            where: {
                timestamp: { [require('sequelize').Op.gte]: startDate }
            },
            attributes: [
                [require('sequelize').fn('DATE', require('sequelize').col('timestamp')), 'date'],
                [require('sequelize').fn('SUM', require('sequelize').col('power_output')), 'total_power'],
                [require('sequelize').fn('AVG', require('sequelize').col('efficiency')), 'avg_efficiency'],
                [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'readings']
            ],
            group: [require('sequelize').fn('DATE', require('sequelize').col('timestamp'))],
            order: [[require('sequelize').literal('date'), 'ASC']],
            raw: true
        });

        // Calculate summary statistics
        const summary = {
            total_inverters: inverters.length,
            online_inverters: inverters.filter(inv => inv.status === 'online').length,
            total_rated_capacity: inverters.reduce((sum, inv) => sum + parseFloat(inv.rated_power || 0), 0),
            current_total_power: inverters.reduce((sum, inv) => sum + parseFloat(inv.current_power || 0), 0),
            today_total_energy: inverters.reduce((sum, inv) => sum + parseFloat(inv.daily_energy || 0), 0),
            lifetime_total_energy: inverters.reduce((sum, inv) => sum + parseFloat(inv.total_energy || 0), 0),
            daily_production: monitoringData,
            average_efficiency: monitoringData.length > 0 
                ? monitoringData.reduce((sum, day) => sum + parseFloat(day.avg_efficiency || 0), 0) / monitoringData.length
                : 0
        };

        // Calculate capacity factor
        if (summary.total_rated_capacity > 0) {
            summary.capacity_factor = (summary.current_total_power / summary.total_rated_capacity) * 100;
        } else {
            summary.capacity_factor = 0;
        }

        res.json({ summary });

    } catch (error) {
        logger.error('Get production summary error:', error);
        res.status(500).json({
            error: 'Failed to fetch production summary'
        });
    }
});

// Get real-time energy data (public endpoint for dashboard)
router.get('/realtime', async (req, res) => {
    try {
        // Get current production from all online inverters
        const inverters = await SolarInverter.findAll({
            where: { status: 'online' },
            attributes: [
                'id',
                'inverter_code',
                'current_power',
                'efficiency',
                'temperature',
                'last_update'
            ]
        });

        const totalCurrentPower = inverters.reduce((sum, inv) => 
            sum + parseFloat(inv.current_power || 0), 0
        );

        const averageEfficiency = inverters.length > 0 
            ? inverters.reduce((sum, inv) => sum + parseFloat(inv.efficiency || 0), 0) / inverters.length
            : 0;

        // Get latest monitoring data
        const latestReading = await EnergyMonitoring.findOne({
            order: [['timestamp', 'DESC']],
            include: [
                {
                    model: SolarInverter,
                    as: 'inverter',
                    attributes: ['inverter_code']
                }
            ]
        });

        res.json({
            realtime: {
                total_power_kw: totalCurrentPower,
                average_efficiency: averageEfficiency,
                online_inverters: inverters.length,
                last_update: latestReading?.timestamp || null,
                inverters: inverters.map(inv => ({
                    code: inv.inverter_code,
                    power: parseFloat(inv.current_power || 0),
                    efficiency: parseFloat(inv.efficiency || 0),
                    temperature: parseFloat(inv.temperature || 0)
                }))
            }
        });

    } catch (error) {
        logger.error('Get realtime data error:', error);
        res.status(500).json({
            error: 'Failed to fetch realtime energy data'
        });
    }
});

// Control inverter (admin only)
router.post('/inverters/:id/control', authorizeRole('admin'), async (req, res) => {
    try {
        const { id } = req.params;
        const { action, parameters } = req.body;

        const inverter = await SolarInverter.findByPk(id);
        if (!inverter) {
            return res.status(404).json({
                error: 'Inverter not found'
            });
        }

        // Get inverter service instance (this would be injected in real app)
        const InverterService = require('../services/inverterService');
        const inverterService = new InverterService();

        let result;
        switch (action) {
            case 'restart':
                result = await inverterService.restartInverter(id);
                break;
            case 'set_parameter':
                if (!parameters || !parameters.name || parameters.value === undefined) {
                    return res.status(400).json({
                        error: 'Parameter name and value are required'
                    });
                }
                result = await inverterService.setInverterParameter(id, parameters.name, parameters.value);
                break;
            default:
                return res.status(400).json({
                    error: 'Invalid action'
                });
        }

        logger.info(`Inverter control action: ${action} on ${inverter.inverter_code} by ${req.user.username}`);

        res.json({
            message: `Inverter ${action} executed successfully`,
            result: result
        });

    } catch (error) {
        logger.error('Inverter control error:', error);
        res.status(500).json({
            error: 'Failed to control inverter'
        });
    }
});

// Get energy statistics for charts
router.get('/statistics', authorizeRole('admin', 'service'), async (req, res) => {
    try {
        const { period = 'week', inverter_id } = req.query;
        
        let startDate = new Date();
        let groupFormat = '%Y-%m-%d %H:00:00';
        
        switch (period) {
            case 'day':
                startDate.setDate(startDate.getDate() - 1);
                groupFormat = '%Y-%m-%d %H:00:00';
                break;
            case 'week':
                startDate.setDate(startDate.getDate() - 7);
                groupFormat = '%Y-%m-%d';
                break;
            case 'month':
                startDate.setMonth(startDate.getMonth() - 1);
                groupFormat = '%Y-%m-%d';
                break;
            case 'year':
                startDate.setFullYear(startDate.getFullYear() - 1);
                groupFormat = '%Y-%m';
                break;
        }

        const whereClause = {
            timestamp: { [require('sequelize').Op.gte]: startDate }
        };
        if (inverter_id) whereClause.inverter_id = inverter_id;

        const statistics = await EnergyMonitoring.findAll({
            where: whereClause,
            attributes: [
                [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('timestamp'), groupFormat), 'period'],
                [require('sequelize').fn('AVG', require('sequelize').col('power_output')), 'avg_power'],
                [require('sequelize').fn('MAX', require('sequelize').col('power_output')), 'max_power'],
                [require('sequelize').fn('SUM', require('sequelize').col('power_output')), 'total_power'],
                [require('sequelize').fn('AVG', require('sequelize').col('efficiency')), 'avg_efficiency'],
                [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'readings']
            ],
            group: [require('sequelize').fn('DATE_FORMAT', require('sequelize').col('timestamp'), groupFormat)],
            order: [[require('sequelize').literal('period'), 'ASC']],
            raw: true
        });

        res.json({
            statistics,
            period,
            total_periods: statistics.length
        });

    } catch (error) {
        logger.error('Get energy statistics error:', error);
        res.status(500).json({
            error: 'Failed to fetch energy statistics'
        });
    }
});

module.exports = router;
