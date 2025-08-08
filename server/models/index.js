const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config();

// Database connection
const sequelize = new Sequelize(
    process.env.DB_NAME || 'ev_solar_charging',
    process.env.DB_USER || 'root',
    process.env.DB_PASSWORD || '',
    {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 3306,
        dialect: 'mysql',
        logging: process.env.NODE_ENV === 'development' ? console.log : false,
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000
        },
        timezone: '+07:00'
    }
);

// Import models
const User = require('./User')(sequelize);
const UserVehicle = require('./UserVehicle')(sequelize);
const ChargingStation = require('./ChargingStation')(sequelize);
const SolarInverter = require('./SolarInverter')(sequelize);
const ChargingSession = require('./ChargingSession')(sequelize);
const PaymentTransaction = require('./PaymentTransaction')(sequelize);
const EnergyMonitoring = require('./EnergyMonitoring')(sequelize);
const SystemLog = require('./SystemLog')(sequelize);
const OCPPMessage = require('./OCPPMessage')(sequelize);
const SystemSetting = require('./SystemSetting')(sequelize);

// Define associations
User.hasMany(UserVehicle, { foreignKey: 'user_id', as: 'vehicles' });
UserVehicle.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

User.hasMany(ChargingSession, { foreignKey: 'user_id', as: 'sessions' });
ChargingSession.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

UserVehicle.hasMany(ChargingSession, { foreignKey: 'vehicle_id', as: 'sessions' });
ChargingSession.belongsTo(UserVehicle, { foreignKey: 'vehicle_id', as: 'vehicle' });

ChargingStation.hasMany(ChargingSession, { foreignKey: 'station_id', as: 'sessions' });
ChargingSession.belongsTo(ChargingStation, { foreignKey: 'station_id', as: 'station' });

User.hasMany(PaymentTransaction, { foreignKey: 'user_id', as: 'transactions' });
PaymentTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

ChargingSession.hasMany(PaymentTransaction, { foreignKey: 'session_id', as: 'transactions' });
PaymentTransaction.belongsTo(ChargingSession, { foreignKey: 'session_id', as: 'session' });

User.hasMany(PaymentTransaction, { foreignKey: 'verified_by', as: 'verifiedTransactions' });
PaymentTransaction.belongsTo(User, { foreignKey: 'verified_by', as: 'verifier' });

SolarInverter.hasMany(EnergyMonitoring, { foreignKey: 'inverter_id', as: 'monitoring' });
EnergyMonitoring.belongsTo(SolarInverter, { foreignKey: 'inverter_id', as: 'inverter' });

ChargingStation.hasMany(OCPPMessage, { foreignKey: 'station_id', as: 'messages' });
OCPPMessage.belongsTo(ChargingStation, { foreignKey: 'station_id', as: 'station' });

User.hasMany(SystemSetting, { foreignKey: 'updated_by', as: 'updatedSettings' });
SystemSetting.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

module.exports = {
    sequelize,
    User,
    UserVehicle,
    ChargingStation,
    SolarInverter,
    ChargingSession,
    PaymentTransaction,
    EnergyMonitoring,
    SystemLog,
    OCPPMessage,
    SystemSetting
};
