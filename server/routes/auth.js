const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, SystemLog } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { validateUserRegistration, validateUserLogin } = require('../middleware/validation');
const logger = require('../utils/logger').createLogger('auth');
const router = express.Router();

// Login endpoint
router.post('/login', validateUserLogin, async (req, res) => {
    try {

        const { username, password } = req.body;
        const clientIP = req.ip || req.connection.remoteAddress;

        // Find user
        const user = await User.findOne({
            where: { username: username.toLowerCase() }
        });

        if (!user) {
            await SystemLog.create({
                level: 'warning',
                category: 'user',
                message: 'Login attempt with invalid username',
                details: { username, ip: clientIP },
                ip_address: clientIP
            });

            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        // Check password
        const isValidPassword = await bcrypt.compare(password, user.password_hash);
        if (!isValidPassword) {
            await SystemLog.create({
                level: 'warning',
                category: 'user',
                message: 'Login attempt with invalid password',
                details: { username, ip: clientIP },
                user_id: user.id,
                ip_address: clientIP
            });

            return res.status(401).json({
                error: 'Invalid credentials'
            });
        }

        // Check user status
        if (user.status !== 'active') {
            await SystemLog.create({
                level: 'warning',
                category: 'user',
                message: 'Login attempt with inactive account',
                details: { username, status: user.status, ip: clientIP },
                user_id: user.id,
                ip_address: clientIP
            });

            return res.status(403).json({
                error: 'Account is not active'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user.id, 
                username: user.username, 
                role: user.role 
            },
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // Update last login
        await user.update({ last_login: new Date() });

        // Log successful login
        await SystemLog.create({
            level: 'info',
            category: 'user',
            message: 'User logged in successfully',
            details: { username, role: user.role, ip: clientIP },
            user_id: user.id,
            ip_address: clientIP
        });

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role,
                balance: user.balance,
                profile_image: user.profile_image
            }
        });

    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// Register endpoint
router.post('/register', validateUserRegistration, async (req, res) => {
    try {
        const { username, email, password, full_name, phone, role = 'user' } = req.body;
        const clientIP = req.ip || req.connection.remoteAddress;

        // Check if user already exists
        const existingUser = await User.findOne({
            where: {
                [require('sequelize').Op.or]: [
                    { username: username.toLowerCase() },
                    { email: email.toLowerCase() }
                ]
            }
        });

        if (existingUser) {
            return res.status(409).json({
                error: 'User already exists with this username or email'
            });
        }

        // Hash password
        const saltRounds = 10;
        const password_hash = await bcrypt.hash(password, saltRounds);

        // Create user
        const user = await User.create({
            username: username.toLowerCase(),
            email: email.toLowerCase(),
            password_hash,
            first_name,
            last_name,
            phone,
            role
        });

        // Log user creation
        await SystemLog.create({
            level: 'info',
            category: 'user',
            message: 'New user registered',
            details: { username, email, role, ip: clientIP },
            user_id: user.id,
            ip_address: clientIP
        });

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role
            }
        });

    } catch (error) {
        logger.error('Registration error:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// Token verification endpoint
router.post('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
            return res.status(401).json({
                error: 'No token provided'
            });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findByPk(decoded.userId);

        if (!user || user.status !== 'active') {
            return res.status(401).json({
                error: 'Invalid token or user not active'
            });
        }

        res.json({
            valid: true,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                first_name: user.first_name,
                last_name: user.last_name,
                role: user.role,
                balance: user.balance,
                profile_image: user.profile_image
            }
        });

    } catch (error) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
            return res.status(401).json({
                error: 'Invalid or expired token'
            });
        }

        logger.error('Token verification error:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// Logout endpoint (optional - mainly for logging)
router.post('/logout', async (req, res) => {
    try {
        const token = req.headers.authorization?.replace('Bearer ', '');
        const clientIP = req.ip || req.connection.remoteAddress;
        
        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                await SystemLog.create({
                    level: 'info',
                    category: 'user',
                    message: 'User logged out',
                    details: { username: decoded.username, ip: clientIP },
                    user_id: decoded.userId,
                    ip_address: clientIP
                });
            } catch (error) {
                // Token might be expired, but we still want to log the logout attempt
            }
        }

        res.json({
            message: 'Logged out successfully'
        });

    } catch (error) {
        logger.error('Logout error:', error);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

module.exports = router;
