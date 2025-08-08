const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const PaymentTransaction = sequelize.define('PaymentTransaction', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        transaction_code: {
            type: DataTypes.STRING(30),
            allowNull: false,
            unique: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        session_id: {
            type: DataTypes.INTEGER,
            references: {
                model: 'charging_sessions',
                key: 'id'
            }
        },
        type: {
            type: DataTypes.ENUM('topup', 'charge', 'refund', 'adjustment'),
            allowNull: false
        },
        amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        balance_before: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        balance_after: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false
        },
        payment_method: {
            type: DataTypes.ENUM('wallet', 'promptpay', 'bank_transfer', 'cash', 'admin'),
            allowNull: false
        },
        reference_number: {
            type: DataTypes.STRING(100)
        },
        slip_image: {
            type: DataTypes.STRING(255)
        },
        status: {
            type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'),
            defaultValue: 'pending'
        },
        verified_by: {
            type: DataTypes.INTEGER,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        verified_at: {
            type: DataTypes.DATE
        },
        notes: {
            type: DataTypes.TEXT
        }
    }, {
        tableName: 'payment_transactions',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['transaction_code']
            },
            {
                fields: ['user_id']
            },
            {
                fields: ['type']
            },
            {
                fields: ['status']
            },
            {
                fields: ['created_at']
            }
        ]
    });

    return PaymentTransaction;
};
