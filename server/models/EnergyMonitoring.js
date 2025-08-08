const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const EnergyMonitoring = sequelize.define('EnergyMonitoring', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        inverter_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'solar_inverters',
                key: 'id'
            }
        },
        timestamp: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        power_output: {
            type: DataTypes.DECIMAL(8, 2),
            allowNull: false
        },
        voltage_dc: {
            type: DataTypes.DECIMAL(6, 2)
        },
        current_dc: {
            type: DataTypes.DECIMAL(6, 2)
        },
        voltage_ac: {
            type: DataTypes.DECIMAL(6, 2)
        },
        current_ac: {
            type: DataTypes.DECIMAL(6, 2)
        },
        frequency: {
            type: DataTypes.DECIMAL(5, 2)
        },
        temperature: {
            type: DataTypes.DECIMAL(5, 2)
        },
        efficiency: {
            type: DataTypes.DECIMAL(5, 2)
        },
        daily_energy: {
            type: DataTypes.DECIMAL(10, 2)
        },
        total_energy: {
            type: DataTypes.DECIMAL(12, 2)
        }
    }, {
        tableName: 'energy_monitoring',
        timestamps: false,
        indexes: [
            {
                fields: ['inverter_id', 'timestamp']
            },
            {
                fields: ['timestamp']
            }
        ]
    });

    return EnergyMonitoring;
};
