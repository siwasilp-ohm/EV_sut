const express = require('express');
const multer = require('multer');
const path = require('path');
const { User, UserVehicle, ChargingSession, PaymentTransaction } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const logger = createLogger('users');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/profiles/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'), false);
        }
    }
});

// Apply authentication to all routes
router.use(authenticateToken);

// Get user profile
router.get('/profile', async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: { exclude: ['password_hash'] },
            include: [
                {
                    model: UserVehicle,
                    as: 'vehicles'
                }
            ]
        });

        res.json({ user });

    } catch (error) {
        logger.error('Get profile error:', error);
        res.status(500).json({
            error: 'Failed to fetch profile'
        });
    }
});

// Update user profile
router.put('/profile', async (req, res) => {
    try {
        const { first_name, last_name, phone } = req.body;
        
        await req.user.update({
            first_name,
            last_name,
            phone
        });

        res.json({
            message: 'Profile updated successfully',
            user: {
                id: req.user.id,
                username: req.user.username,
                email: req.user.email,
                first_name: req.user.first_name,
                last_name: req.user.last_name,
                phone: req.user.phone,
                role: req.user.role,
                balance: req.user.balance
            }
        });

    } catch (error) {
        logger.error('Update profile error:', error);
        res.status(500).json({
            error: 'Failed to update profile'
        });
    }
});

// Upload profile image
router.post('/profile/image', upload.single('profile_image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                error: 'No image file provided'
            });
        }

        const imageUrl = `/uploads/profiles/${req.file.filename}`;
        
        await req.user.update({
            profile_image: imageUrl
        });

        res.json({
            message: 'Profile image updated successfully',
            image_url: imageUrl
        });

    } catch (error) {
        logger.error('Upload profile image error:', error);
        res.status(500).json({
            error: 'Failed to upload profile image'
        });
    }
});

// Get user vehicles
router.get('/vehicles', async (req, res) => {
    try {
        const vehicles = await UserVehicle.findAll({
            where: { user_id: req.user.id },
            order: [['is_default', 'DESC'], ['created_at', 'ASC']]
        });

        res.json({ vehicles });

    } catch (error) {
        logger.error('Get vehicles error:', error);
        res.status(500).json({
            error: 'Failed to fetch vehicles'
        });
    }
});

// Add new vehicle
router.post('/vehicles', async (req, res) => {
    try {
        const {
            brand,
            model,
            year,
            battery_capacity,
            max_charging_power,
            connector_type,
            license_plate,
            is_default
        } = req.body;

        // If this is set as default, unset other defaults
        if (is_default) {
            await UserVehicle.update(
                { is_default: false },
                { where: { user_id: req.user.id } }
            );
        }

        const vehicle = await UserVehicle.create({
            user_id: req.user.id,
            brand,
            model,
            year,
            battery_capacity,
            max_charging_power,
            connector_type,
            license_plate,
            is_default: is_default || false
        });

        res.status(201).json({
            message: 'Vehicle added successfully',
            vehicle
        });

    } catch (error) {
        logger.error('Add vehicle error:', error);
        res.status(500).json({
            error: 'Failed to add vehicle'
        });
    }
});

// Update vehicle
router.put('/vehicles/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            brand,
            model,
            year,
            battery_capacity,
            max_charging_power,
            connector_type,
            license_plate,
            is_default
        } = req.body;

        const vehicle = await UserVehicle.findOne({
            where: { id, user_id: req.user.id }
        });

        if (!vehicle) {
            return res.status(404).json({
                error: 'Vehicle not found'
            });
        }

        // If this is set as default, unset other defaults
        if (is_default) {
            await UserVehicle.update(
                { is_default: false },
                { where: { user_id: req.user.id, id: { [require('sequelize').Op.ne]: id } } }
            );
        }

        await vehicle.update({
            brand,
            model,
            year,
            battery_capacity,
            max_charging_power,
            connector_type,
            license_plate,
            is_default: is_default || false
        });

        res.json({
            message: 'Vehicle updated successfully',
            vehicle
        });

    } catch (error) {
        logger.error('Update vehicle error:', error);
        res.status(500).json({
            error: 'Failed to update vehicle'
        });
    }
});

// Delete vehicle
router.delete('/vehicles/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const vehicle = await UserVehicle.findOne({
            where: { id, user_id: req.user.id }
        });

        if (!vehicle) {
            return res.status(404).json({
                error: 'Vehicle not found'
            });
        }

        // Check if vehicle is being used in any active sessions
        const activeSessions = await ChargingSession.count({
            where: {
                vehicle_id: id,
                status: ['preparing', 'charging']
            }
        });

        if (activeSessions > 0) {
            return res.status(400).json({
                error: 'Cannot delete vehicle with active charging sessions'
            });
        }

        await vehicle.destroy();

        res.json({
            message: 'Vehicle deleted successfully'
        });

    } catch (error) {
        logger.error('Delete vehicle error:', error);
        res.status(500).json({
            error: 'Failed to delete vehicle'
        });
    }
});

// Get charging sessions
router.get('/sessions', async (req, res) => {
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
                    model: UserVehicle,
                    as: 'vehicle',
                    attributes: ['brand', 'model', 'license_plate']
                },
                {
                    model: require('../models').ChargingStation,
                    as: 'station',
                    attributes: ['name', 'station_code', 'address']
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
        logger.error('Get sessions error:', error);
        res.status(500).json({
            error: 'Failed to fetch charging sessions'
        });
    }
});

// Get payment transactions
router.get('/transactions', async (req, res) => {
    try {
        const { page = 1, limit = 20, type } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = { user_id: req.user.id };
        if (type) whereClause.type = type;

        const { count, rows } = await PaymentTransaction.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']],
            include: [
                {
                    model: ChargingSession,
                    as: 'session',
                    attributes: ['session_code'],
                    required: false
                }
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

// Get wallet balance
router.get('/wallet', async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: ['id', 'username', 'balance']
        });

        // Get recent transactions
        const recentTransactions = await PaymentTransaction.findAll({
            where: { user_id: req.user.id },
            limit: 5,
            order: [['created_at', 'DESC']],
            attributes: ['id', 'type', 'amount', 'status', 'created_at']
        });

        res.json({
            balance: user.balance,
            recent_transactions: recentTransactions
        });

    } catch (error) {
        logger.error('Get wallet error:', error);
        res.status(500).json({
            error: 'Failed to fetch wallet information'
        });
    }
});

module.exports = router;
