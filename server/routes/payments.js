const express = require('express');
const multer = require('multer');
const path = require('path');
const QRCode = require('qrcode');
const { User, PaymentTransaction, SystemSetting } = require('../models');
const { authenticateToken } = require('../middleware/auth');
const { createLogger } = require('../utils/logger');

const router = express.Router();
const logger = createLogger('payments');

// Configure multer for slip uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/slips/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'slip-' + uniqueSuffix + path.extname(file.originalname));
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

// Generate PromptPay QR Code
router.post('/promptpay/qr', async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                error: 'Invalid amount'
            });
        }

        // Get PromptPay ID from settings
        const promptPaySetting = await SystemSetting.findOne({
            where: { setting_key: 'promptpay_id' }
        });

        const promptPayId = promptPaySetting?.setting_value || process.env.PROMPTPAY_ID || '0123456789';

        // Generate PromptPay payload
        const payload = generatePromptPayPayload(promptPayId, parseFloat(amount));
        
        // Generate QR code
        const qrCodeDataURL = await QRCode.toDataURL(payload, {
            width: 300,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#FFFFFF'
            }
        });

        // Create pending transaction
        const transaction = await PaymentTransaction.create({
            transaction_code: `TOP${Date.now()}`,
            user_id: req.user.id,
            type: 'topup',
            amount: parseFloat(amount),
            balance_before: parseFloat(req.user.balance),
            balance_after: parseFloat(req.user.balance), // Will be updated when verified
            payment_method: 'promptpay',
            status: 'pending'
        });

        res.json({
            qr_code: qrCodeDataURL,
            payload: payload,
            amount: parseFloat(amount),
            promptpay_id: promptPayId,
            transaction: {
                id: transaction.id,
                transaction_code: transaction.transaction_code,
                status: transaction.status
            }
        });

    } catch (error) {
        logger.error('Generate PromptPay QR error:', error);
        res.status(500).json({
            error: 'Failed to generate PromptPay QR code'
        });
    }
});

// Upload payment slip
router.post('/slip/upload', upload.single('slip_image'), async (req, res) => {
    try {
        const { transaction_id, amount, reference_number } = req.body;

        if (!req.file) {
            return res.status(400).json({
                error: 'No slip image provided'
            });
        }

        const slipUrl = `/uploads/slips/${req.file.filename}`;

        // Create or update transaction
        let transaction;
        if (transaction_id) {
            transaction = await PaymentTransaction.findOne({
                where: {
                    id: transaction_id,
                    user_id: req.user.id,
                    status: 'pending'
                }
            });

            if (!transaction) {
                return res.status(404).json({
                    error: 'Transaction not found or already processed'
                });
            }

            await transaction.update({
                slip_image: slipUrl,
                reference_number: reference_number
            });
        } else {
            // Create new transaction
            transaction = await PaymentTransaction.create({
                transaction_code: `TOP${Date.now()}`,
                user_id: req.user.id,
                type: 'topup',
                amount: parseFloat(amount),
                balance_before: parseFloat(req.user.balance),
                balance_after: parseFloat(req.user.balance),
                payment_method: 'bank_transfer',
                reference_number: reference_number,
                slip_image: slipUrl,
                status: 'pending'
            });
        }

        logger.info(`Payment slip uploaded: ${transaction.transaction_code} by user ${req.user.username}`);

        res.json({
            message: 'Payment slip uploaded successfully',
            transaction: {
                id: transaction.id,
                transaction_code: transaction.transaction_code,
                status: transaction.status,
                slip_image: slipUrl
            }
        });

    } catch (error) {
        logger.error('Upload slip error:', error);
        res.status(500).json({
            error: 'Failed to upload payment slip'
        });
    }
});

// Verify payment (admin only)
router.post('/verify/:id', async (req, res) => {
    try {
        // Check if user has admin or service role
        if (!['admin', 'service'].includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions'
            });
        }

        const { id } = req.params;
        const { status, notes } = req.body; // status: 'completed' or 'failed'

        const transaction = await PaymentTransaction.findByPk(id, {
            include: [
                { model: User, as: 'user' }
            ]
        });

        if (!transaction) {
            return res.status(404).json({
                error: 'Transaction not found'
            });
        }

        if (transaction.status !== 'pending') {
            return res.status(400).json({
                error: 'Transaction already processed'
            });
        }

        if (status === 'completed') {
            // Update user balance
            const newBalance = parseFloat(transaction.user.balance) + parseFloat(transaction.amount);
            await transaction.user.update({ balance: newBalance });

            // Update transaction
            await transaction.update({
                status: 'completed',
                balance_after: newBalance,
                verified_by: req.user.id,
                verified_at: new Date(),
                notes: notes
            });

            logger.info(`Payment verified: ${transaction.transaction_code}, amount: ${transaction.amount} THB`);
        } else {
            // Mark as failed
            await transaction.update({
                status: 'failed',
                verified_by: req.user.id,
                verified_at: new Date(),
                notes: notes
            });

            logger.info(`Payment rejected: ${transaction.transaction_code}`);
        }

        res.json({
            message: `Payment ${status === 'completed' ? 'verified' : 'rejected'} successfully`,
            transaction: {
                id: transaction.id,
                transaction_code: transaction.transaction_code,
                status: transaction.status,
                amount: transaction.amount
            }
        });

    } catch (error) {
        logger.error('Verify payment error:', error);
        res.status(500).json({
            error: 'Failed to verify payment'
        });
    }
});

// Get payment transactions
router.get('/transactions', async (req, res) => {
    try {
        const { page = 1, limit = 20, type, status } = req.query;
        const offset = (page - 1) * limit;

        const whereClause = { user_id: req.user.id };
        if (type) whereClause.type = type;
        if (status) whereClause.status = status;

        const { count, rows } = await PaymentTransaction.findAndCountAll({
            where: whereClause,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['created_at', 'DESC']],
            include: [
                {
                    model: User,
                    as: 'verifier',
                    attributes: ['username'],
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

// Get pending transactions (admin/service only)
router.get('/pending', async (req, res) => {
    try {
        if (!['admin', 'service'].includes(req.user.role)) {
            return res.status(403).json({
                error: 'Insufficient permissions'
            });
        }

        const transactions = await PaymentTransaction.findAll({
            where: { status: 'pending' },
            order: [['created_at', 'ASC']],
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['username', 'first_name', 'last_name', 'email']
                }
            ]
        });

        res.json({ transactions });

    } catch (error) {
        logger.error('Get pending transactions error:', error);
        res.status(500).json({
            error: 'Failed to fetch pending transactions'
        });
    }
});

// Get wallet summary
router.get('/wallet/summary', async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // Get transaction summary
        const transactions = await PaymentTransaction.findAll({
            where: {
                user_id: req.user.id,
                status: 'completed',
                created_at: { [require('sequelize').Op.gte]: startDate }
            },
            attributes: ['type', 'amount', 'created_at']
        });

        const summary = {
            current_balance: parseFloat(req.user.balance),
            total_topups: 0,
            total_charges: 0,
            transaction_count: transactions.length,
            transactions_by_type: {
                topup: 0,
                charge: 0,
                refund: 0,
                adjustment: 0
            }
        };

        transactions.forEach(tx => {
            const amount = parseFloat(tx.amount);
            if (tx.type === 'topup' || tx.type === 'refund') {
                summary.total_topups += amount;
            } else if (tx.type === 'charge') {
                summary.total_charges += Math.abs(amount);
            }
            summary.transactions_by_type[tx.type] += 1;
        });

        res.json({ summary });

    } catch (error) {
        logger.error('Get wallet summary error:', error);
        res.status(500).json({
            error: 'Failed to fetch wallet summary'
        });
    }
});

// Helper function to generate PromptPay payload
function generatePromptPayPayload(promptPayId, amount) {
    // This is a simplified PromptPay payload generator
    // In production, use a proper PromptPay library
    
    const formatAmount = amount.toFixed(2);
    
    // Basic PromptPay QR payload structure
    let payload = '';
    payload += '000201'; // Payload Format Indicator
    payload += '010212'; // Point of Initiation Method
    payload += '2937'; // Merchant Account Information
    payload += '0016'; // GUI
    payload += 'A000000677010111'; // PromptPay ID
    payload += '01'; // Length of PromptPay ID
    payload += ('0' + promptPayId.length).slice(-2) + promptPayId;
    payload += '5303764'; // Transaction Currency (THB)
    payload += '54' + ('0' + formatAmount.length).slice(-2) + formatAmount;
    payload += '5802TH'; // Country Code
    payload += '6304'; // CRC placeholder
    
    // Calculate CRC16
    const crc = calculateCRC16(payload);
    payload += crc.toString(16).toUpperCase().padStart(4, '0');
    
    return payload;
}

// Simple CRC16 calculation for PromptPay
function calculateCRC16(data) {
    let crc = 0xFFFF;
    for (let i = 0; i < data.length; i++) {
        crc ^= data.charCodeAt(i) << 8;
        for (let j = 0; j < 8; j++) {
            if (crc & 0x8000) {
                crc = (crc << 1) ^ 0x1021;
            } else {
                crc = crc << 1;
            }
        }
    }
    return crc & 0xFFFF;
}

module.exports = router;
