const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SystemLog = sequelize.define('SystemLog', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        level: {
            type: DataTypes.ENUM('info', 'warning', 'error', 'critical'),
            allowNull: false
        },
        category: {
            type: DataTypes.ENUM('system', 'ocpp', 'inverter', 'payment', 'user', 'charging'),
            allowNull: false
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        details: {
            type: DataTypes.JSON
        },
        user_id: {
            type: DataTypes.INTEGER,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        station_id: {
            type: DataTypes.INTEGER,
            references: {
                model: 'charging_stations',
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
        ip_address: {
            type: DataTypes.STRING(45)
        },
        user_agent: {
            type: DataTypes.TEXT
        }
    }, {
        tableName: 'system_logs',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                fields: ['level', 'category']
            },
            {
                fields: ['created_at']
            },
            {
                fields: ['user_id']
            },
            {
                fields: ['category', 'created_at']
            }
        ]
    });

    return SystemLog;
};
