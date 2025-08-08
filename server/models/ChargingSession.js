const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ChargingSession = sequelize.define('ChargingSession', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        session_code: {
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
        vehicle_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'user_vehicles',
                key: 'id'
            }
        },
        station_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'charging_stations',
                key: 'id'
            }
        },
        start_time: {
            type: DataTypes.DATE,
            allowNull: false
        },
        end_time: {
            type: DataTypes.DATE
        },
        duration_minutes: {
            type: DataTypes.INTEGER,
            defaultValue: 0
        },
        energy_delivered: {
            type: DataTypes.DECIMAL(8, 3),
            defaultValue: 0.000
        },
        energy_from_solar: {
            type: DataTypes.DECIMAL(8, 3),
            defaultValue: 0.000
        },
        energy_from_grid: {
            type: DataTypes.DECIMAL(8, 3),
            defaultValue: 0.000
        },
        cost_total: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00
        },
        cost_energy: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00
        },
        cost_service: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00
        },
        status: {
            type: DataTypes.ENUM('preparing', 'charging', 'suspended', 'finishing', 'completed', 'faulted'),
            defaultValue: 'preparing'
        },
        stop_reason: {
            type: DataTypes.ENUM('user', 'complete', 'emergency', 'fault', 'timeout')
        },
        meter_start: {
            type: DataTypes.DECIMAL(10, 3),
            defaultValue: 0.000
        },
        meter_stop: {
            type: DataTypes.DECIMAL(10, 3),
            defaultValue: 0.000
        }
    }, {
        tableName: 'charging_sessions',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['session_code']
            },
            {
                fields: ['user_id']
            },
            {
                fields: ['station_id']
            },
            {
                fields: ['status']
            },
            {
                fields: ['start_time']
            }
        ]
    });

    return ChargingSession;
};
