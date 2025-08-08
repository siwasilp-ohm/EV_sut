const express = require('express');
const { ChargingStation, ChargingSession, User, UserVehicle } = require('../models');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const logger = createLogger('stations');

// Get all charging stations (public endpoint with optional auth)
router.get('/', optionalAuth, async (req, res) => {
    try {
        const { lat, lng, radius = 50 } = req.query; // radius in km

        let stations = await ChargingStation.findAll({
            attributes: [
                'id', 'station_code', 'name', 'description', 
                'latitude', 'longitude', 'address', 'power_rating',
                'connector_type', 'status', 'energy_price_pea',
                'energy_price_solar', 'service_fee', 'image_url'
            ],
            include: [
                {
                    model: ChargingSession,
                    as: 'sessions',
                    where: { status: ['preparing', 'charging'] },
                    required: false,
                    attributes: ['id', 'status', 'start_time']
                }
            ]
        });

        // Calculate distance if coordinates provided
        if (lat && lng) {
            stations = stations.map(station => {
                const distance = station.calculateDistance(parseFloat(lat), parseFloat(lng));
                return {
                    ...station.toJSON(),
                    distance: parseFloat(distance.toFixed(2)),
                    available: station.isAvailable() && station.sessions.length === 0
                };
            }).filter(station => station.distance <= radius)
              .sort((a, b) => a.distance - b.distance);
        } else {
            stations = stations.map(station => ({
                ...station.toJSON(),
                available: station.isAvailable() && station.sessions.length === 0
            }));
        }

        res.json({ stations });

    } catch (error) {
        logger.error('Get stations error:', error);
        res.status(500).json({
            error: 'Failed to fetch charging stations'
        });
    }
});

// Get specific station details
router.get('/:id', optionalAuth, async (req, res) => {
    try {
        const { id } = req.params;

        const station = await ChargingStation.findByPk(id, {
            include: [
                {
                    model: ChargingSession,
                    as: 'sessions',
                    where: { status: ['preparing', 'charging'] },
                    required: false,
                    include: [
                        {
                            model: User,
                            as: 'user',
                            attributes: ['username', 'first_name', 'last_name']
                        }
                    ]
                }
            ]
        });

        if (!station) {
            return res.status(404).json({
                error: 'Charging station not found'
            });
        }

        const stationData = {
            ...station.toJSON(),
            available: station.isAvailable() && station.sessions.length === 0,
            online: station.isOnline()
        };

        res.json({ station: stationData });

    } catch (error) {
        logger.error('Get station details error:', error);
        res.status(500).json({
            error: 'Failed to fetch station details'
        });
    }
});

// Check station availability
router.get('/:id/availability', async (req, res) => {
    try {
        const { id } = req.params;

        const station = await ChargingStation.findByPk(id, {
            include: [
                {
                    model: ChargingSession,
                    as: 'sessions',
                    where: { status: ['preparing', 'charging'] },
                    required: false
                }
            ]
        });

        if (!station) {
            return res.status(404).json({
                error: 'Charging station not found'
            });
        }

        const availability = {
            station_id: station.id,
            station_code: station.station_code,
            name: station.name,
            status: station.status,
            available: station.isAvailable() && station.sessions.length === 0,
            online: station.isOnline(),
            current_session: station.sessions.length > 0 ? station.sessions[0] : null,
            last_heartbeat: station.last_heartbeat
        };

        res.json({ availability });

    } catch (error) {
        logger.error('Check availability error:', error);
        res.status(500).json({
            error: 'Failed to check station availability'
        });
    }
});

// Reserve a charging station (authenticated users only)
router.post('/:id/reserve', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { vehicle_id, estimated_duration } = req.body;

        const station = await ChargingStation.findByPk(id);
        if (!station) {
            return res.status(404).json({
                error: 'Charging station not found'
            });
        }

        // Check if station is available
        if (!station.isAvailable()) {
            return res.status(400).json({
                error: 'Charging station is not available'
            });
        }

        // Check if station is online
        if (!station.isOnline()) {
            return res.status(400).json({
                error: 'Charging station is offline'
            });
        }

        // Check if there's already an active session
        const existingSession = await ChargingSession.findOne({
            where: {
                station_id: id,
                status: ['preparing', 'charging']
            }
        });

        if (existingSession) {
            return res.status(400).json({
                error: 'Station is currently occupied'
            });
        }

        // Verify vehicle belongs to user
        const vehicle = await UserVehicle.findOne({
            where: {
                id: vehicle_id,
                user_id: req.user.id
            }
        });

        if (!vehicle) {
            return res.status(400).json({
                error: 'Vehicle not found or does not belong to user'
            });
        }

        // Check vehicle compatibility
        if (vehicle.connector_type !== station.connector_type) {
            return res.status(400).json({
                error: 'Vehicle connector type is not compatible with this station'
            });
        }

        // Create reservation (preparing session)
        const session = await ChargingSession.create({
            session_code: `CHG${Date.now()}`,
            user_id: req.user.id,
            vehicle_id: vehicle_id,
            station_id: id,
            start_time: new Date(),
            status: 'preparing',
            duration_minutes: estimated_duration || 60
        });

        // Update station status
        await station.update({ status: 'occupied' });

        logger.info(`User ${req.user.username} reserved station ${station.station_code}`);

        res.json({
            message: 'Station reserved successfully',
            session: {
                id: session.id,
                session_code: session.session_code,
                status: session.status,
                estimated_duration: estimated_duration || 60
            }
        });

    } catch (error) {
        logger.error('Reserve station error:', error);
        res.status(500).json({
            error: 'Failed to reserve charging station'
        });
    }
});

// Get station statistics
router.get('/:id/stats', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { days = 30 } = req.query;

        const station = await ChargingStation.findByPk(id);
        if (!station) {
            return res.status(404).json({
                error: 'Charging station not found'
            });
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // Get session statistics
        const sessions = await ChargingSession.findAll({
            where: {
                station_id: id,
                created_at: { [require('sequelize').Op.gte]: startDate }
            },
            attributes: [
                'status',
                'energy_delivered',
                'cost_total',
                'duration_minutes',
                'created_at'
            ]
        });

        const stats = {
            total_sessions: sessions.length,
            completed_sessions: sessions.filter(s => s.status === 'completed').length,
            total_energy_delivered: sessions.reduce((sum, s) => sum + parseFloat(s.energy_delivered || 0), 0),
            total_revenue: sessions.reduce((sum, s) => sum + parseFloat(s.cost_total || 0), 0),
            average_session_duration: sessions.length > 0 
                ? sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0) / sessions.length 
                : 0,
            utilization_rate: 0 // Calculate based on available time vs used time
        };

        // Calculate utilization rate (simplified)
        const totalMinutesInPeriod = parseInt(days) * 24 * 60;
        const usedMinutes = sessions.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
        stats.utilization_rate = totalMinutesInPeriod > 0 ? (usedMinutes / totalMinutesInPeriod) * 100 : 0;

        res.json({ stats });

    } catch (error) {
        logger.error('Get station stats error:', error);
        res.status(500).json({
            error: 'Failed to fetch station statistics'
        });
    }
});

module.exports = router;
