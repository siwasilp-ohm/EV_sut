#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 EV Solar Charging System Deployment Script');
console.log('==============================================');

// Check Node.js version
const nodeVersion = process.version;
const requiredVersion = 'v16.0.0';
console.log(`📋 Node.js version: ${nodeVersion}`);

if (nodeVersion < requiredVersion) {
    console.error(`❌ Node.js ${requiredVersion} or higher is required`);
    process.exit(1);
}

// Check if required directories exist
const requiredDirs = [
    'uploads',
    'uploads/profiles',
    'uploads/slips',
    'logs'
];

console.log('📁 Creating required directories...');
requiredDirs.forEach(dir => {
    const dirPath = path.join(__dirname, '..', dir);
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`✅ Created directory: ${dir}`);
    } else {
        console.log(`✅ Directory exists: ${dir}`);
    }
});

// Check environment file
const envPath = path.join(__dirname, '..', '.env');
if (!fs.existsSync(envPath)) {
    console.log('⚠️  .env file not found, copying from .env.example');
    const envExamplePath = path.join(__dirname, '..', '.env.example');
    if (fs.existsSync(envExamplePath)) {
        fs.copyFileSync(envExamplePath, envPath);
        console.log('✅ .env file created from .env.example');
        console.log('⚠️  Please update .env file with your configuration');
    } else {
        console.error('❌ .env.example file not found');
        process.exit(1);
    }
}

// Install dependencies
console.log('📦 Installing dependencies...');
try {
    execSync('npm install', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('✅ Dependencies installed successfully');
} catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
}

// Test database connection
console.log('🗄️  Testing database connection...');
try {
    require('dotenv').config({ path: envPath });
    const { sequelize } = require('../server/models');
    
    sequelize.authenticate().then(() => {
        console.log('✅ Database connection successful');
        
        // Initialize database
        console.log('🔧 Initializing database...');
        const { initializeDatabase } = require('../database/init');
        
        initializeDatabase().then(() => {
            console.log('✅ Database initialized successfully');
            console.log('');
            console.log('🎉 Deployment completed successfully!');
            console.log('');
            console.log('📋 Next steps:');
            console.log('1. Update .env file with your configuration');
            console.log('2. Configure your MySQL database');
            console.log('3. Set up your Delta AC Mini Plus charger');
            console.log('4. Configure your SUN2000 inverter');
            console.log('5. Run: npm start');
            console.log('');
            console.log('🌐 Access URLs:');
            console.log('- API Server: http://localhost:3000');
            console.log('- Health Check: http://localhost:3000/health');
            console.log('- OCPP WebSocket: ws://localhost:8080');
            console.log('');
            console.log('👥 Default Users:');
            console.log('- admin1/admin2 (password: 123456) - Admin access');
            console.log('- service1/service2 (password: 123456) - Service access');
            console.log('- user1/user2/user3 (password: 123456) - User access');
            
            process.exit(0);
        }).catch(error => {
            console.error('❌ Database initialization failed:', error.message);
            process.exit(1);
        });
        
    }).catch(error => {
        console.error('❌ Database connection failed:', error.message);
        console.log('⚠️  Please check your database configuration in .env file');
        process.exit(1);
    });
    
} catch (error) {
    console.error('❌ Database test failed:', error.message);
    process.exit(1);
}
