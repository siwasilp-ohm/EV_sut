const express = require('express');
const { ChargingSession, ChargingStation, User, UserVehicle, PaymentTransaction } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const logger = createLogger('charging');

// Apply authentication to all routes
router.use(authenticateToken);

// Start charging session
router.post('/start', async (req, res) => {
    try {
        const { station_id, vehicle_id, estimated_energy } = req.body;

        // Validate station
        const station = await ChargingStation.findByPk(station_id);
        if (!station) {
            return res.status(404).json({
                error: 'Charging station not found'
            });
        }

        if (!station.isAvailable()) {
            return res.status(400).json({
                error: 'Charging station is not available'
            });
        }

        // Validate vehicle
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

        // Check connector compatibility
        if (vehicle.connector_type !== station.connector_type) {
            return res.status(400).json({
                error: 'Vehicle connector type is not compatible with this station'
            });
        }

        // Check user balance
        const estimatedCost = parseFloat(estimated_energy || 10) * parseFloat(station.energy_price_solar);
        if (parseFloat(req.user.balance) < estimatedCost) {
            return res.status(400).json({
                error: 'Insufficient balance for estimated charging cost'
            });
        }

        // Check for existing active sessions
        const existingSession = await ChargingSession.findOne({
            where: {
                user_id: req.user.id,
                status: ['preparing', 'charging']
            }
        });

        if (existingSession) {
            return res.status(400).json({
                error: 'You already have an active charging session'
            });
        }

        // Create charging session
        const session = await ChargingSession.create({
            session_code: `CHG${Date.now()}`,
            user_id: req.user.id,
            vehicle_id: vehicle_id,
            station_id: station_id,
            start_time: new Date(),
            status: 'preparing'
        });

        // Update station status
        await station.update({ status: 'occupied' });

        logger.info(`Charging session started: ${session.session_code} by user ${req.user.username}`);

        res.json({
            message: 'Charging session started successfully',
            session: {
                id: session.id,
                session_code: session.session_code,
                status: session.status,
                start_time: session.start_time,
                station: {
                    name: station.name,
                    station_code: station.station_code
                },
                vehicle: {
                    brand: vehicle.brand,
                    model: vehicle.model
                }
            }
        });

    } catch (error) {
        logger.error('Start charging error:', error);
        res.status(500).json({
            error: 'Failed to start charging session'
        });
    }
});

// Stop charging session
router.post('/stop', async (req, res) => {
    try {
        const { session_id, reason = 'user' } = req.body;

        const session = await ChargingSession.findOne({
            where: {
                id: session_id,
                user_id: req.user.id,
                status: ['preparing', 'charging']
            },
            include: [
                { model: ChargingStation, as: 'station' },
                { model: UserVehicle, as: 'vehicle' }
            ]
        });

        if (!session) {
            return res.status(404).json({
                error: 'Active charging session not found'
            });
        }

        const endTime = new Date();
        const durationMinutes = Math.round((endTime - new Date(session.start_time)) / (1000 * 60));
        
        // Calculate energy delivered (mock calculation for now)
        const energyDelivered = Math.min(
            durationMinutes * 0.1, // 0.1 kWh per minute (6 kW rate)
            parseFloat(session.vehicle.battery_capacity || 50) * 0.8 // 80% of battery capacity
        );

        // Calculate costs
        const energyFromSolar = energyDelivered * 0.7; // 70% from solar
        const energyFromGrid = energyDelivered * 0.3; // 30% from grid
        
        const costEnergy = (energyFromSolar * parseFloat(session.station.energy_price_solar)) +
                          (energyFromGrid * parseFloat(session.station.energy_price_pea));
        const costService = energyDelivered * parseFloat(session.station.service_fee);
        const costTotal = costEnergy + costService;

        // Update session
        await session.update({
            end_time: endTime,
            duration_minutes: durationMinutes,
            energy_delivered: energyDelivered,
            energy_from_solar: energyFromSolar,
            energy_from_grid: energyFromGrid,
            cost_energy: costEnergy,
            cost_service: costService,
            cost_total: costTotal,
            status: 'completed',
            stop_reason: reason
        });

        // Update user balance
        const newBalance = parseFloat(req.user.balance) - costTotal;
        await req.user.update({ balance: newBalance });

        // Create payment transaction
        await PaymentTransaction.create({
            transaction_code: `PAY${Date.now()}`,
            user_id: req.user.id,
            session_id: session.id,
            type: 'charge',
            amount: -costTotal,
            balance_before: parseFloat(req.user.balance),
            balance_after: newBalance,
            payment_method: 'wallet',
            status: 'completed'
        });

        // Update station status
        await session.station.update({ status: 'available' });

        logger.info(`Charging session completed: ${session.session_code}, cost: ${costTotal} THB`);

        res.json({
            message: 'Charging session stopped successfully',
            session: {
                id: session.id,
                session_code: session.session_code,
                status: session.status,
                duration_minutes: durationMinutes,
                energy_delivered: energyDelivered,
                cost_total: costTotal,
                energy_breakdown: {
                    solar: energyFromSolar,
                    grid: energyFromGrid
                },
                cost_breakdown: {
                    energy: costEnergy,
                    service: costService,
                    total: costTotal
                }
            }
        });

    } catch (error) {
        logger.error('Stop charging error:', error);
        res.status(500).json({
            error: 'Failed to stop charging session'
        });
    }
});

// Get current active session
router.get('/current', async (req, res) => {
    try {
        const session = await ChargingSession.findOne({
            where: {
                user_id: req.user.id,
                status: ['preparing', 'charging']
            },
            include: [
                {
                    model: ChargingStation,
                    as: 'station',
                    attributes: ['name', 'station_code', 'power_rating', 'energy_price_solar', 'energy_price_pea']
                },
                {
                    model: UserVehicle,
                    as: 'vehicle',
                    attributes: ['brand', 'model', 'battery_capacity']
                }
            ]
        });

        if (!session) {
            return res.json({ session: null });
        }

        // Calculate current duration and estimated cost
        const currentTime = new Date();
        const durationMinutes = Math.round((currentTime - new Date(session.start_time)) / (1000 * 60));
        const estimatedEnergy = Math.min(durationMinutes * 0.1, 50); // Mock calculation
        const estimatedCost = estimatedEnergy * parseFloat(session.station.energy_price_solar);

        res.json({
            session: {
                ...session.toJSON(),
                current_duration: durationMinutes,
                estimated_energy: estimatedEnergy,
                estimated_cost: estimatedCost
            }
        });

    } catch (error) {
        logger.error('Get current session error:', error);
        res.status(500).json({
            error: 'Failed to fetch current session'
        });
    }
});

// Get session history
router.get('/history', async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = { user_id: req.user.id };
        if (status) whereClause.status = status;

        const { count, rows } = await ChargingSession.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']],
            include: [
                {
                    model: ChargingStation,
                    as: 'station',
                    attributes: ['name', 'station_code', 'address']
                },
                {
                    model: UserVehicle,
                    as: 'vehicle',
                    attributes: ['brand', 'model', 'license_plate']
                }
            ]
        });

        res.json({
            sessions: rows,
            pagination: {
                total: count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(count / limit)
            }
        });

    } catch (error) {
        logger.error('Get session history error:', error);
        res.status(500).json({
            error: 'Failed to fetch session history'
        });
    }
});

// Get session details
router.get('/sessions/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const session = await ChargingSession.findOne({
            where: {
                id: id,
                user_id: req.user.id
            },
            include: [
                {
                    model: ChargingStation,
                    as: 'station'
                },
                {
                    model: UserVehicle,
                    as: 'vehicle'
                },
                {
                    model: PaymentTransaction,
                    as: 'transactions'
                }
            ]
        });

        if (!session) {
            return res.status(404).json({
                error: 'Charging session not found'
            });
        }

        res.json({ session });

    } catch (error) {
        logger.error('Get session details error:', error);
        res.status(500).json({
            error: 'Failed to fetch session details'
        });
    }
});

// Estimate charging cost
router.post('/estimate', async (req, res) => {
    try {
        const { station_id, vehicle_id, target_energy } = req.body;

        const station = await ChargingStation.findByPk(station_id);
        if (!station) {
            return res.status(404).json({
                error: 'Charging station not found'
            });
        }

        const vehicle = await UserVehicle.findOne({
            where: {
                id: vehicle_id,
                user_id: req.user.id
            }
        });

        if (!vehicle) {
            return res.status(400).json({
                error: 'Vehicle not found'
            });
        }

        const energy = parseFloat(target_energy || 20);
        const maxChargingPower = Math.min(
            parseFloat(vehicle.max_charging_power || 7.4),
            parseFloat(station.power_rating)
        );

        // Estimate charging time
        const estimatedTime = Math.ceil((energy / maxChargingPower) * 60); // minutes

        // Calculate costs (assuming 70% solar, 30% grid)
        const solarEnergy = energy * 0.7;
        const gridEnergy = energy * 0.3;
        
        const energyCost = (solarEnergy * parseFloat(station.energy_price_solar)) +
                          (gridEnergy * parseFloat(station.energy_price_pea));
        const serviceCost = energy * parseFloat(station.service_fee);
        const totalCost = energyCost + serviceCost;

        res.json({
            estimate: {
                energy_kwh: energy,
                estimated_time_minutes: estimatedTime,
                max_charging_power_kw: maxChargingPower,
                cost_breakdown: {
                    solar_energy: solarEnergy,
                    grid_energy: gridEnergy,
                    energy_cost: energyCost,
                    service_cost: serviceCost,
                    total_cost: totalCost
                },
                pricing: {
                    solar_rate: parseFloat(station.energy_price_solar),
                    grid_rate: parseFloat(station.energy_price_pea),
                    service_rate: parseFloat(station.service_fee)
                }
            }
        });

    } catch (error) {
        logger.error('Estimate charging cost error:', error);
        res.status(500).json({
            error: 'Failed to estimate charging cost'
        });
    }
});

module.exports = router;
