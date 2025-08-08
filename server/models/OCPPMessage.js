const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const OCPPMessage = sequelize.define('OCPPMessage', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        station_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'charging_stations',
                key: 'id'
            }
        },
        message_type: {
            type: DataTypes.ENUM('call', 'callresult', 'callerror'),
            allowNull: false
        },
        action: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        message_id: {
            type: DataTypes.STRING(36),
            allowNull: false
        },
        payload: {
            type: DataTypes.JSON
        },
        direction: {
            type: DataTypes.ENUM('incoming', 'outgoing'),
            allowNull: false
        },
        status: {
            type: DataTypes.ENUM('sent', 'received', 'error', 'timeout'),
            allowNull: false
        },
        error_code: {
            type: DataTypes.STRING(50)
        },
        error_description: {
            type: DataTypes.TEXT
        }
    }, {
        tableName: 'ocpp_messages',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: false,
        indexes: [
            {
                fields: ['station_id', 'created_at']
            },
            {
                fields: ['message_id']
            },
            {
                fields: ['action']
            },
            {
                fields: ['created_at']
            }
        ]
    });

    return OCPPMessage;
};
