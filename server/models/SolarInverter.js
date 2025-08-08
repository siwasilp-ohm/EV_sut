const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SolarInverter = sequelize.define('SolarInverter', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        inverter_code: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true
        },
        model: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        serial_number: {
            type: DataTypes.STRING(100),
            unique: true
        },
        ip_address: {
            type: DataTypes.STRING(45),
            allowNull: false,
            validate: {
                isIP: true
            }
        },
        port: {
            type: DataTypes.INTEGER,
            defaultValue: 502,
            validate: {
                min: 1,
                max: 65535
            }
        },
        slave_id: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
            validate: {
                min: 1,
                max: 247
            }
        },
        rated_power: {
            type: DataTypes.DECIMAL(8, 2),
            allowNull: false,
            validate: {
                min: 0.1
            }
        },
        status: {
            type: DataTypes.ENUM('online', 'offline', 'error', 'maintenance'),
            defaultValue: 'offline'
        },
        current_power: {
            type: DataTypes.DECIMAL(8, 2),
            defaultValue: 0.00
        },
        daily_energy: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00
        },
        total_energy: {
            type: DataTypes.DECIMAL(12, 2),
            defaultValue: 0.00
        },
        efficiency: {
            type: DataTypes.DECIMAL(5, 2),
            defaultValue: 0.00
        },
        temperature: {
            type: DataTypes.DECIMAL(5, 2)
        },
        last_update: {
            type: DataTypes.DATE
        }
    }, {
        tableName: 'solar_inverters',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['inverter_code']
            },
            {
                unique: true,
                fields: ['serial_number']
            },
            {
                fields: ['status']
            },
            {
                fields: ['ip_address']
            }
        ]
    });

    return SolarInverter;
};
