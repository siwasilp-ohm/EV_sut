-- EV Solar Charging System Database Schema
-- Created for complete charging management system

CREATE DATABASE IF NOT EXISTS ev_solar_charging CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ev_solar_charging;

-- Users table with role-based access
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    profile_image VARCHAR(255),
    role ENUM('admin', 'service', 'user') NOT NULL DEFAULT 'user',
    balance DECIMAL(10,2) DEFAULT 0.00,
    status ENUM('active', 'inactive', 'suspended') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL
);

-- User vehicles
CREATE TABLE user_vehicles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    brand VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    year INT,
    battery_capacity DECIMAL(5,2), -- kWh
    max_charging_power DECIMAL(5,2), -- kW
    connector_type ENUM('Type1', 'Type2', 'CCS', 'CHAdeMO') NOT NULL,
    license_plate VARCHAR(20),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Charging stations
CREATE TABLE charging_stations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    station_code VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    address TEXT,
    power_rating DECIMAL(5,2) NOT NULL, -- kW
    connector_type ENUM('Type1', 'Type2', 'CCS', 'CHAdeMO') NOT NULL,
    status ENUM('available', 'occupied', 'maintenance', 'offline') DEFAULT 'available',
    ocpp_id VARCHAR(50) UNIQUE,
    ip_address VARCHAR(45),
    firmware_version VARCHAR(50),
    last_heartbeat TIMESTAMP NULL,
    energy_price_pea DECIMAL(8,4) NOT NULL DEFAULT 4.50, -- THB per kWh
    energy_price_solar DECIMAL(8,4) NOT NULL DEFAULT 3.50, -- THB per kWh
    service_fee DECIMAL(8,4) DEFAULT 0.50, -- THB per kWh
    image_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Solar inverters
CREATE TABLE solar_inverters (
    id INT PRIMARY KEY AUTO_INCREMENT,
    inverter_code VARCHAR(20) UNIQUE NOT NULL,
    model VARCHAR(100) NOT NULL, -- SUN2000-(2KTL-6KTL)-L1
    serial_number VARCHAR(100) UNIQUE,
    ip_address VARCHAR(45) NOT NULL,
    port INT DEFAULT 502,
    slave_id INT DEFAULT 1,
    rated_power DECIMAL(8,2) NOT NULL, -- kW
    status ENUM('online', 'offline', 'error', 'maintenance') DEFAULT 'offline',
    current_power DECIMAL(8,2) DEFAULT 0.00, -- Current output kW
    daily_energy DECIMAL(10,2) DEFAULT 0.00, -- kWh
    total_energy DECIMAL(12,2) DEFAULT 0.00, -- kWh
    efficiency DECIMAL(5,2) DEFAULT 0.00, -- %
    temperature DECIMAL(5,2), -- °C
    last_update TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Charging sessions
CREATE TABLE charging_sessions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    session_code VARCHAR(30) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    vehicle_id INT NOT NULL,
    station_id INT NOT NULL,
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP NULL,
    duration_minutes INT DEFAULT 0,
    energy_delivered DECIMAL(8,3) DEFAULT 0.000, -- kWh
    energy_from_solar DECIMAL(8,3) DEFAULT 0.000, -- kWh
    energy_from_grid DECIMAL(8,3) DEFAULT 0.000, -- kWh
    cost_total DECIMAL(10,2) DEFAULT 0.00,
    cost_energy DECIMAL(10,2) DEFAULT 0.00,
    cost_service DECIMAL(10,2) DEFAULT 0.00,
    status ENUM('preparing', 'charging', 'suspended', 'finishing', 'completed', 'faulted') DEFAULT 'preparing',
    stop_reason ENUM('user', 'complete', 'emergency', 'fault', 'timeout') NULL,
    meter_start DECIMAL(10,3) DEFAULT 0.000,
    meter_stop DECIMAL(10,3) DEFAULT 0.000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (vehicle_id) REFERENCES user_vehicles(id),
    FOREIGN KEY (station_id) REFERENCES charging_stations(id)
);

-- Payment transactions
CREATE TABLE payment_transactions (
    id INT PRIMARY KEY AUTO_INCREMENT,
    transaction_code VARCHAR(30) UNIQUE NOT NULL,
    user_id INT NOT NULL,
    session_id INT NULL,
    type ENUM('topup', 'charge', 'refund', 'adjustment') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    balance_before DECIMAL(10,2) NOT NULL,
    balance_after DECIMAL(10,2) NOT NULL,
    payment_method ENUM('wallet', 'promptpay', 'bank_transfer', 'cash', 'admin') NOT NULL,
    reference_number VARCHAR(100),
    slip_image VARCHAR(255),
    status ENUM('pending', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
    verified_by INT NULL,
    verified_at TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (session_id) REFERENCES charging_sessions(id),
    FOREIGN KEY (verified_by) REFERENCES users(id)
);

-- Energy monitoring (real-time data from inverters)
CREATE TABLE energy_monitoring (
    id INT PRIMARY KEY AUTO_INCREMENT,
    inverter_id INT NOT NULL,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    power_output DECIMAL(8,2) NOT NULL, -- kW
    voltage_dc DECIMAL(6,2), -- V
    current_dc DECIMAL(6,2), -- A
    voltage_ac DECIMAL(6,2), -- V
    current_ac DECIMAL(6,2), -- A
    frequency DECIMAL(5,2), -- Hz
    temperature DECIMAL(5,2), -- °C
    efficiency DECIMAL(5,2), -- %
    daily_energy DECIMAL(10,2), -- kWh
    total_energy DECIMAL(12,2), -- kWh
    FOREIGN KEY (inverter_id) REFERENCES solar_inverters(id),
    INDEX idx_inverter_timestamp (inverter_id, timestamp)
);

-- System logs
CREATE TABLE system_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    level ENUM('info', 'warning', 'error', 'critical') NOT NULL,
    category ENUM('system', 'ocpp', 'inverter', 'payment', 'user', 'charging') NOT NULL,
    message TEXT NOT NULL,
    details JSON,
    user_id INT NULL,
    station_id INT NULL,
    session_id INT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (station_id) REFERENCES charging_stations(id),
    FOREIGN KEY (session_id) REFERENCES charging_sessions(id),
    INDEX idx_level_category (level, category),
    INDEX idx_created_at (created_at)
);

-- OCPP messages log
CREATE TABLE ocpp_messages (
    id INT PRIMARY KEY AUTO_INCREMENT,
    station_id INT NOT NULL,
    message_type ENUM('call', 'callresult', 'callerror') NOT NULL,
    action VARCHAR(50) NOT NULL,
    message_id VARCHAR(36) NOT NULL,
    payload JSON,
    direction ENUM('incoming', 'outgoing') NOT NULL,
    status ENUM('sent', 'received', 'error', 'timeout') NOT NULL,
    error_code VARCHAR(50) NULL,
    error_description TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (station_id) REFERENCES charging_stations(id),
    INDEX idx_station_created (station_id, created_at),
    INDEX idx_message_id (message_id)
);

-- System settings
CREATE TABLE system_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    setting_key VARCHAR(100) UNIQUE NOT NULL,
    setting_value TEXT NOT NULL,
    data_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    is_public BOOLEAN DEFAULT FALSE,
    updated_by INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Insert default users
INSERT INTO users (username, email, password_hash, first_name, last_name, role) VALUES
('admin1', 'admin1@evsolar.com', '$2a$10$rOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ', 'Admin', 'One', 'admin'),
('admin2', 'admin2@evsolar.com', '$2a$10$rOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ', 'Admin', 'Two', 'admin'),
('service1', 'service1@evsolar.com', '$2a$10$rOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ', 'Service', 'One', 'service'),
('service2', 'service2@evsolar.com', '$2a$10$rOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ', 'Service', 'Two', 'service'),
('user1', 'user1@evsolar.com', '$2a$10$rOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ', 'User', 'One', 'user'),
('user2', 'user2@evsolar.com', '$2a$10$rOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ', 'User', 'Two', 'user'),
('user3', 'user3@evsolar.com', '$2a$10$rOzJqQZQZQZQZQZQZQZQZOzJqQZQZQZQZQZQZQZQZQZQZQZQZQZQZQ', 'User', 'Three', 'user');

-- Insert sample charging station
INSERT INTO charging_stations (station_code, name, description, latitude, longitude, address, power_rating, connector_type, ocpp_id) VALUES
('EVS001', 'EV Solar Station 1', 'Main charging station with solar power', 13.7563, 100.5018, '123 Bangkok, Thailand', 7.4, 'Type2', 'DELTA_001');

-- Insert sample solar inverter
INSERT INTO solar_inverters (inverter_code, model, serial_number, ip_address, rated_power) VALUES
('INV001', 'SUN2000-5KTL-L1', 'SN123456789', '192.168.1.100', 5.0);

-- Insert default system settings
INSERT INTO system_settings (setting_key, setting_value, data_type, description, category) VALUES
('site_name', 'EV Solar Charging System', 'string', 'Site name', 'general'),
('default_energy_price_pea', '4.50', 'number', 'Default PEA energy price per kWh', 'pricing'),
('default_energy_price_solar', '3.50', 'number', 'Default solar energy price per kWh', 'pricing'),
('default_service_fee', '0.50', 'number', 'Default service fee per kWh', 'pricing'),
('max_session_duration', '480', 'number', 'Maximum charging session duration in minutes', 'charging'),
('promptpay_id', '0123456789', 'string', 'PromptPay ID for payments', 'payment'),
('maintenance_mode', 'false', 'boolean', 'System maintenance mode', 'system');
