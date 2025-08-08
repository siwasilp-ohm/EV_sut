const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const ChargingStation = sequelize.define('ChargingStation', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        station_code: {
            type: DataTypes.STRING(20),
            allowNull: false,
            unique: true,
            validate: {
                len: [3, 20],
                isAlphanumeric: true
            }
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            validate: {
                len: [1, 100]
            }
        },
        description: {
            type: DataTypes.TEXT
        },
        latitude: {
            type: DataTypes.DECIMAL(10, 8),
            allowNull: false,
            validate: {
                min: -90,
                max: 90
            }
        },
        longitude: {
            type: DataTypes.DECIMAL(11, 8),
            allowNull: false,
            validate: {
                min: -180,
                max: 180
            }
        },
        address: {
            type: DataTypes.TEXT
        },
        power_rating: {
            type: DataTypes.DECIMAL(5, 2),
            allowNull: false,
            validate: {
                min: 0.1,
                max: 350
            }
        },
        connector_type: {
            type: DataTypes.ENUM('Type1', 'Type2', 'CCS', 'CHAdeMO'),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('available', 'occupied', 'maintenance', 'offline'),
            defaultValue: 'available'
        },
        ocpp_id: {
            type: DataTypes.STRING(50),
            unique: true
        },
        ip_address: {
            type: DataTypes.STRING(45),
            validate: {
                isIP: true
            }
        },
        firmware_version: {
            type: DataTypes.STRING(50)
        },
        last_heartbeat: {
            type: DataTypes.DATE
        },
        energy_price_pea: {
            type: DataTypes.DECIMAL(8, 4),
            defaultValue: 4.50,
            validate: {
                min: 0
            }
        },
        energy_price_solar: {
            type: DataTypes.DECIMAL(8, 4),
            defaultValue: 3.50,
            validate: {
                min: 0
            }
        },
        service_fee: {
            type: DataTypes.DECIMAL(8, 4),
            defaultValue: 0.50,
            validate: {
                min: 0
            }
        },
        image_url: {
            type: DataTypes.STRING(255),
            validate: {
                isUrl: true
            }
        }
    }, {
        tableName: 'charging_stations',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['station_code']
            },
            {
                unique: true,
                fields: ['ocpp_id']
            },
            {
                fields: ['status']
            },
            {
                fields: ['latitude', 'longitude']
            }
        ]
    });

    // Instance methods
    ChargingStation.prototype.isAvailable = function() {
        return this.status === 'available';
    };

    ChargingStation.prototype.isOnline = function() {
        if (!this.last_heartbeat) return false;
        const now = new Date();
        const heartbeatTime = new Date(this.last_heartbeat);
        const diffMinutes = (now - heartbeatTime) / (1000 * 60);
        return diffMinutes <= 5; // Consider online if heartbeat within 5 minutes
    };

    ChargingStation.prototype.calculateDistance = function(lat, lng) {
        const R = 6371; // Earth's radius in km
        const dLat = (lat - this.latitude) * Math.PI / 180;
        const dLng = (lng - this.longitude) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(this.latitude * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in km
    };

    return ChargingStation;
};
