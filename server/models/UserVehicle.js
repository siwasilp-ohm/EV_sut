const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const UserVehicle = sequelize.define('UserVehicle', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'users',
                key: 'id'
            }
        },
        brand: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        model: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        year: {
            type: DataTypes.INTEGER,
            validate: {
                min: 2010,
                max: new Date().getFullYear() + 1
            }
        },
        battery_capacity: {
            type: DataTypes.DECIMAL(5, 2),
            validate: {
                min: 10,
                max: 200
            }
        },
        max_charging_power: {
            type: DataTypes.DECIMAL(5, 2),
            validate: {
                min: 1,
                max: 350
            }
        },
        connector_type: {
            type: DataTypes.ENUM('Type1', 'Type2', 'CCS', 'CHAdeMO'),
            allowNull: false
        },
        license_plate: {
            type: DataTypes.STRING(20)
        },
        is_default: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    }, {
        tableName: 'user_vehicles',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['user_id']
            },
            {
                fields: ['user_id', 'is_default']
            }
        ]
    });

    return UserVehicle;
};
