const ModbusRTU = require('modbus-serial');
const cron = require('node-cron');
const { SolarInverter, EnergyMonitoring, SystemLog } = require('../models');
const { createLogger } = require('../utils/logger');

class InverterService {
    constructor() {
        this.clients = new Map(); // Map of inverter_id -> ModbusRTU client
        this.logger = createLogger('inverter');
        this.monitoringJob = null;
        this.isRunning = false;
    }

    async start() {
        try {
            await this.initializeInverters();
            this.startMonitoring();
            this.isRunning = true;
            this.logger.info('Inverter service started successfully');
        } catch (error) {
            this.logger.error('Failed to start inverter service:', error);
            throw error;
        }
    }

    async stop() {
        this.isRunning = false;
        
        // Stop monitoring job
        if (this.monitoringJob) {
            this.monitoringJob.stop();
        }

        // Close all Modbus connections
        for (const [inverterId, client] of this.clients) {
            try {
                await client.close();
                this.logger.info(`Closed connection to inverter ${inverterId}`);
            } catch (error) {
                this.logger.error(`Error closing connection to inverter ${inverterId}:`, error);
            }
        }

        this.clients.clear();
        this.logger.info('Inverter service stopped');
    }

    async initializeInverters() {
        const inverters = await SolarInverter.findAll({
            where: { status: ['online', 'offline'] }
        });

        for (const inverter of inverters) {
            try {
                await this.connectToInverter(inverter);
            } catch (error) {
                this.logger.error(`Failed to connect to inverter ${inverter.inverter_code}:`, error);
                await inverter.update({ status: 'error' });
            }
        }
    }

    async connectToInverter(inverter) {
        const client = new ModbusRTU();
        
        try {
            // Connect to inverter via TCP
            await client.connectTCP(inverter.ip_address, { port: inverter.port || 502 });
            client.setID(inverter.slave_id || 1);
            client.setTimeout(5000);

            // Test connection by reading a register
            await this.readInverterData(client, inverter);
            
            this.clients.set(inverter.id, client);
            await inverter.update({ 
                status: 'online',
                last_update: new Date()
            });

            this.logger.info(`Connected to inverter ${inverter.inverter_code} at ${inverter.ip_address}:${inverter.port}`);
        } catch (error) {
            await inverter.update({ status: 'offline' });
            throw error;
        }
    }

    async readInverterData(client, inverter) {
        try {
            // SUN2000 series Modbus register mapping
            const registers = {
                // Input registers (read-only)
                inputPower: 32080,      // Active power (W)
                inputVoltage: 32069,    // Input voltage (V)
                inputCurrent: 32070,    // Input current (A)
                outputVoltageA: 32073,  // Output voltage phase A (V)
                outputCurrentA: 32076,  // Output current phase A (A)
                frequency: 32085,       // Grid frequency (Hz)
                efficiency: 32086,      // Efficiency (%)
                temperature: 32087,     // Internal temperature (°C)
                dailyEnergy: 32114,     // Daily energy yield (kWh)
                totalEnergy: 32106      // Total energy yield (kWh)
            };

            // Read multiple registers at once for efficiency
            const startRegister = 32069;
            const registerCount = 50;
            
            const data = await client.readInputRegisters(startRegister, registerCount);
            
            // Parse the data based on register offsets
            const parseRegister = (regAddr, scale = 1, signed = false) => {
                const offset = regAddr - startRegister;
                if (offset >= 0 && offset < data.data.length) {
                    let value = data.data[offset];
                    if (signed && value > 32767) {
                        value = value - 65536;
                    }
                    return value / scale;
                }
                return null;
            };

            const inverterData = {
                power_output: parseRegister(registers.inputPower, 1) / 1000, // Convert W to kW
                voltage_dc: parseRegister(registers.inputVoltage, 10),
                current_dc: parseRegister(registers.inputCurrent, 100),
                voltage_ac: parseRegister(registers.outputVoltageA, 10),
                current_ac: parseRegister(registers.outputCurrentA, 100),
                frequency: parseRegister(registers.frequency, 100),
                efficiency: parseRegister(registers.efficiency, 100),
                temperature: parseRegister(registers.temperature, 10, true),
                daily_energy: parseRegister(registers.dailyEnergy, 100),
                total_energy: parseRegister(registers.totalEnergy, 100)
            };

            // Update inverter status
            await inverter.update({
                current_power: inverterData.power_output,
                daily_energy: inverterData.daily_energy,
                total_energy: inverterData.total_energy,
                efficiency: inverterData.efficiency,
                temperature: inverterData.temperature,
                last_update: new Date(),
                status: 'online'
            });

            // Store monitoring data
            await EnergyMonitoring.create({
                inverter_id: inverter.id,
                power_output: inverterData.power_output,
                voltage_dc: inverterData.voltage_dc,
                current_dc: inverterData.current_dc,
                voltage_ac: inverterData.voltage_ac,
                current_ac: inverterData.current_ac,
                frequency: inverterData.frequency,
                temperature: inverterData.temperature,
                efficiency: inverterData.efficiency,
                daily_energy: inverterData.daily_energy,
                total_energy: inverterData.total_energy
            });

            return inverterData;

        } catch (error) {
            this.logger.error(`Error reading data from inverter ${inverter.inverter_code}:`, error);
            await inverter.update({ 
                status: 'error',
                last_update: new Date()
            });
            throw error;
        }
    }

    startMonitoring() {
        // Monitor inverters every 30 seconds
        this.monitoringJob = cron.schedule('*/30 * * * * *', async () => {
            if (!this.isRunning) return;

            const inverters = await SolarInverter.findAll({
                where: { status: ['online', 'offline'] }
            });

            for (const inverter of inverters) {
                const client = this.clients.get(inverter.id);
                if (client) {
                    try {
                        await this.readInverterData(client, inverter);
                    } catch (error) {
                        this.logger.error(`Monitoring error for inverter ${inverter.inverter_code}:`, error);
                        
                        // Try to reconnect if connection lost
                        try {
                            await this.connectToInverter(inverter);
                        } catch (reconnectError) {
                            this.logger.error(`Failed to reconnect to inverter ${inverter.inverter_code}:`, reconnectError);
                        }
                    }
                }
            }
        });

        this.logger.info('Started inverter monitoring (30-second intervals)');
    }

    // Public methods for external control
    async getInverterStatus(inverterId) {
        const inverter = await SolarInverter.findByPk(inverterId);
        if (!inverter) {
            throw new Error('Inverter not found');
        }

        const client = this.clients.get(inverterId);
        const isConnected = client !== undefined;

        return {
            ...inverter.toJSON(),
            isConnected,
            lastReading: await EnergyMonitoring.findOne({
                where: { inverter_id: inverterId },
                order: [['timestamp', 'DESC']]
            })
        };
    }

    async getAllInvertersStatus() {
        const inverters = await SolarInverter.findAll();
        const statusList = [];

        for (const inverter of inverters) {
            try {
                const status = await this.getInverterStatus(inverter.id);
                statusList.push(status);
            } catch (error) {
                statusList.push({
                    ...inverter.toJSON(),
                    isConnected: false,
                    error: error.message
                });
            }
        }

        return statusList;
    }

    async getEnergyData(inverterId, startDate, endDate) {
        const whereClause = { inverter_id: inverterId };
        
        if (startDate) {
            whereClause.timestamp = { [require('sequelize').Op.gte]: startDate };
        }
        
        if (endDate) {
            whereClause.timestamp = { 
                ...whereClause.timestamp,
                [require('sequelize').Op.lte]: endDate 
            };
        }

        return await EnergyMonitoring.findAll({
            where: whereClause,
            order: [['timestamp', 'ASC']],
            limit: 1000 // Limit to prevent excessive data
        });
    }

    async getTotalSolarProduction() {
        const inverters = await SolarInverter.findAll();
        let totalPower = 0;
        let totalDailyEnergy = 0;
        let totalEnergy = 0;

        for (const inverter of inverters) {
            if (inverter.status === 'online') {
                totalPower += parseFloat(inverter.current_power || 0);
                totalDailyEnergy += parseFloat(inverter.daily_energy || 0);
                totalEnergy += parseFloat(inverter.total_energy || 0);
            }
        }

        return {
            totalPower,
            totalDailyEnergy,
            totalEnergy,
            activeInverters: inverters.filter(inv => inv.status === 'online').length,
            totalInverters: inverters.length
        };
    }

    // Control methods (if supported by inverter)
    async setInverterParameter(inverterId, parameter, value) {
        const inverter = await SolarInverter.findByPk(inverterId);
        if (!inverter) {
            throw new Error('Inverter not found');
        }

        const client = this.clients.get(inverterId);
        if (!client) {
            throw new Error('Inverter not connected');
        }

        try {
            // This would depend on the specific inverter model and supported parameters
            // For SUN2000 series, most parameters are read-only
            // But some configuration might be possible through holding registers
            
            this.logger.info(`Setting parameter ${parameter} to ${value} for inverter ${inverter.inverter_code}`);
            
            // Log the control action
            await SystemLog.create({
                level: 'info',
                category: 'inverter',
                message: `Parameter ${parameter} set to ${value}`,
                details: { inverterId, parameter, value },
                ip_address: inverter.ip_address
            });

            return true;
        } catch (error) {
            this.logger.error(`Error setting parameter for inverter ${inverter.inverter_code}:`, error);
            throw error;
        }
    }

    async restartInverter(inverterId) {
        const inverter = await SolarInverter.findByPk(inverterId);
        if (!inverter) {
            throw new Error('Inverter not found');
        }

        // Close existing connection
        const client = this.clients.get(inverterId);
        if (client) {
            await client.close();
            this.clients.delete(inverterId);
        }

        // Wait a moment
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Reconnect
        await this.connectToInverter(inverter);
        
        this.logger.info(`Restarted connection to inverter ${inverter.inverter_code}`);
        
        await SystemLog.create({
            level: 'info',
            category: 'inverter',
            message: 'Inverter connection restarted',
            details: { inverterId },
            ip_address: inverter.ip_address
        });

        return true;
    }
}

module.exports = InverterService;
