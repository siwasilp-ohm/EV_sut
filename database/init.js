const bcrypt = require('bcryptjs');
const { sequelize, User, ChargingStation, SolarInverter, SystemSetting } = require('../server/models');

async function initializeDatabase() {
    try {
        console.log('Initializing database...');
        
        // Test connection
        await sequelize.authenticate();
        console.log('Database connection established successfully.');

        // Sync all models
        await sequelize.sync({ force: false, alter: true });
        console.log('Database models synchronized.');

        // Create default users with hashed passwords
        const saltRounds = 10;
        const defaultPassword = await bcrypt.hash('123456', saltRounds);

        const users = [
            { username: 'admin1', email: 'admin1@evsolar.com', password_hash: defaultPassword, first_name: 'Admin', last_name: 'One', role: 'admin' },
            { username: 'admin2', email: 'admin2@evsolar.com', password_hash: defaultPassword, first_name: 'Admin', last_name: 'Two', role: 'admin' },
            { username: 'service1', email: 'service1@evsolar.com', password_hash: defaultPassword, first_name: 'Service', last_name: 'One', role: 'service' },
            { username: 'service2', email: 'service2@evsolar.com', password_hash: defaultPassword, first_name: 'Service', last_name: 'Two', role: 'service' },
            { username: 'user1', email: 'user1@evsolar.com', password_hash: defaultPassword, first_name: 'User', last_name: 'One', role: 'user', balance: 1000.00 },
            { username: 'user2', email: 'user2@evsolar.com', password_hash: defaultPassword, first_name: 'User', last_name: 'Two', role: 'user', balance: 500.00 },
            { username: 'user3', email: 'user3@evsolar.com', password_hash: defaultPassword, first_name: 'User', last_name: 'Three', role: 'user', balance: 750.00 }
        ];

        for (const userData of users) {
            const [user, created] = await User.findOrCreate({
                where: { username: userData.username },
                defaults: userData
            });
            if (created) {
                console.log(`Created user: ${userData.username}`);
            } else {
                console.log(`User already exists: ${userData.username}`);
            }
        }

        // Create sample charging station
        const [station, stationCreated] = await ChargingStation.findOrCreate({
            where: { station_code: 'EVS001' },
            defaults: {
                station_code: 'EVS001',
                name: 'EV Solar Station 1',
                description: 'Main charging station with solar power integration',
                latitude: 13.7563,
                longitude: 100.5018,
                address: '123 Sukhumvit Road, Bangkok, Thailand 10110',
                power_rating: 7.4,
                connector_type: 'Type2',
                ocpp_id: 'DELTA_001',
                ip_address: '192.168.1.101',
                energy_price_pea: 4.50,
                energy_price_solar: 3.50,
                service_fee: 0.50,
                status: 'available'
            }
        });
        if (stationCreated) {
            console.log('Created sample charging station: EVS001');
        }

        // Create sample solar inverter
        const [inverter, inverterCreated] = await SolarInverter.findOrCreate({
            where: { inverter_code: 'INV001' },
            defaults: {
                inverter_code: 'INV001',
                model: 'SUN2000-5KTL-L1',
                serial_number: 'SN123456789',
                ip_address: '192.168.1.100',
                port: 502,
                slave_id: 1,
                rated_power: 5.0,
                status: 'offline'
            }
        });
        if (inverterCreated) {
            console.log('Created sample solar inverter: INV001');
        }

        // Create system settings
        const settings = [
            { setting_key: 'site_name', setting_value: 'EV Solar Charging System', data_type: 'string', description: 'Site name', category: 'general' },
            { setting_key: 'default_energy_price_pea', setting_value: '4.50', data_type: 'number', description: 'Default PEA energy price per kWh', category: 'pricing' },
            { setting_key: 'default_energy_price_solar', setting_value: '3.50', data_type: 'number', description: 'Default solar energy price per kWh', category: 'pricing' },
            { setting_key: 'default_service_fee', setting_value: '0.50', data_type: 'number', description: 'Default service fee per kWh', category: 'pricing' },
            { setting_key: 'max_session_duration', setting_value: '480', data_type: 'number', description: 'Maximum charging session duration in minutes', category: 'charging' },
            { setting_key: 'promptpay_id', setting_value: '0123456789', data_type: 'string', description: 'PromptPay ID for payments', category: 'payment' },
            { setting_key: 'maintenance_mode', setting_value: 'false', data_type: 'boolean', description: 'System maintenance mode', category: 'system' }
        ];

        for (const settingData of settings) {
            const [setting, settingCreated] = await SystemSetting.findOrCreate({
                where: { setting_key: settingData.setting_key },
                defaults: settingData
            });
            if (settingCreated) {
                console.log(`Created system setting: ${settingData.setting_key}`);
            }
        }

        console.log('Database initialization completed successfully!');
        console.log('\nDefault users created:');
        console.log('- admin1/admin2 (password: 123456) - Admin access');
        console.log('- service1/service2 (password: 123456) - Service access');
        console.log('- user1/user2/user3 (password: 123456) - User access');
        console.log('\nSample data:');
        console.log('- Charging Station: EVS001 (Delta AC Mini Plus 7.4kW)');
        console.log('- Solar Inverter: INV001 (SUN2000-5KTL-L1)');

    } catch (error) {
        console.error('Database initialization failed:', error);
        throw error;
    }
}

// Run initialization if called directly
if (require.main === module) {
    initializeDatabase()
        .then(() => {
            console.log('Initialization complete. Exiting...');
            process.exit(0);
        })
        .catch((error) => {
            console.error('Initialization failed:', error);
            process.exit(1);
        });
}

module.exports = { initializeDatabase };
