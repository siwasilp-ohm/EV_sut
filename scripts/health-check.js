#!/usr/bin/env node

const axios = require('axios');
const { sequelize, ChargingStation, SolarInverter } = require('../server/models');
require('dotenv').config();

async function healthCheck() {
    console.log('🏥 EV Solar System Health Check');
    console.log('================================');
    
    const results = {
        database: false,
        api_server: false,
        ocpp_server: false,
        charging_stations: 0,
        online_stations: 0,
        solar_inverters: 0,
        online_inverters: 0
    };

    // Test database connection
    console.log('🗄️  Testing database connection...');
    try {
        await sequelize.authenticate();
        results.database = true;
        console.log('✅ Database: Connected');
    } catch (error) {
        console.log('❌ Database: Failed -', error.message);
    }

    // Test API server
    console.log('🌐 Testing API server...');
    try {
        const response = await axios.get(`http://localhost:${process.env.PORT || 3000}/health`, {
            timeout: 5000
        });
        if (response.status === 200) {
            results.api_server = true;
            console.log('✅ API Server: Running');
        }
    } catch (error) {
        console.log('❌ API Server: Not responding');
    }

    // Test OCPP server (WebSocket)
    console.log('⚡ Testing OCPP server...');
    try {
        const WebSocket = require('ws');
        const ws = new WebSocket(`ws://localhost:${process.env.OCPP_PORT || 8080}/TEST`);
        
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                ws.close();
                reject(new Error('Connection timeout'));
            }, 3000);

            ws.on('open', () => {
                clearTimeout(timeout);
                results.ocpp_server = true;
                console.log('✅ OCPP Server: Running');
                ws.close();
                resolve();
            });

            ws.on('error', (error) => {
                clearTimeout(timeout);
                reject(error);
            });
        });
    } catch (error) {
        console.log('❌ OCPP Server: Not responding');
    }

    // Check charging stations
    if (results.database) {
        console.log('🔌 Checking charging stations...');
        try {
            const stations = await ChargingStation.findAll();
            results.charging_stations = stations.length;
            results.online_stations = stations.filter(s => s.isOnline()).length;
            console.log(`✅ Charging Stations: ${results.online_stations}/${results.charging_stations} online`);
        } catch (error) {
            console.log('❌ Charging Stations: Query failed');
        }

        // Check solar inverters
        console.log('☀️  Checking solar inverters...');
        try {
            const inverters = await SolarInverter.findAll();
            results.solar_inverters = inverters.length;
            results.online_inverters = inverters.filter(i => i.status === 'online').length;
            console.log(`✅ Solar Inverters: ${results.online_inverters}/${results.solar_inverters} online`);
        } catch (error) {
            console.log('❌ Solar Inverters: Query failed');
        }
    }

    // Summary
    console.log('\n📊 Health Check Summary');
    console.log('======================');
    console.log(`Database: ${results.database ? '✅ OK' : '❌ FAIL'}`);
    console.log(`API Server: ${results.api_server ? '✅ OK' : '❌ FAIL'}`);
    console.log(`OCPP Server: ${results.ocpp_server ? '✅ OK' : '❌ FAIL'}`);
    console.log(`Charging Stations: ${results.online_stations}/${results.charging_stations} online`);
    console.log(`Solar Inverters: ${results.online_inverters}/${results.solar_inverters} online`);

    const overallHealth = results.database && results.api_server;
    console.log(`\n🏥 Overall System Health: ${overallHealth ? '✅ HEALTHY' : '❌ UNHEALTHY'}`);

    if (!overallHealth) {
        console.log('\n⚠️  System Issues Detected:');
        if (!results.database) console.log('- Database connection failed');
        if (!results.api_server) console.log('- API server not responding');
        if (!results.ocpp_server) console.log('- OCPP server not responding');
    }

    await sequelize.close();
    process.exit(overallHealth ? 0 : 1);
}

if (require.main === module) {
    healthCheck().catch(error => {
        console.error('Health check failed:', error);
        process.exit(1);
    });
}

module.exports = { healthCheck };
