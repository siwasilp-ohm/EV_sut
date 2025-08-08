const WebSocket = require('ws');
const { v4: uuidv4 } = require('uuid');
const { ChargingStation, ChargingSession, OCPPMessage, SystemLog } = require('../models');
const { createLogger } = require('../utils/logger');

class OCPPServer {
    constructor(port = 8080) {
        this.port = port;
        this.server = null;
        this.clients = new Map(); // Map of station_id -> WebSocket
        this.logger = createLogger('ocpp');
        this.messageHandlers = this.initializeMessageHandlers();
    }

    async start() {
        this.server = new WebSocket.Server({ 
            port: this.port,
            perMessageDeflate: false
        });

        this.server.on('connection', (ws, req) => {
            this.handleConnection(ws, req);
        });

        this.logger.info(`OCPP Server started on port ${this.port}`);
    }

    async stop() {
        if (this.server) {
            this.server.close();
            this.logger.info('OCPP Server stopped');
        }
    }

    handleConnection(ws, req) {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const stationId = url.pathname.split('/').pop();
        
        this.logger.info(`Station ${stationId} connected from ${req.socket.remoteAddress}`);
        
        ws.stationId = stationId;
        this.clients.set(stationId, ws);

        ws.on('message', async (data) => {
            try {
                await this.handleMessage(ws, data);
            } catch (error) {
                this.logger.error(`Error handling message from ${stationId}:`, error);
            }
        });

        ws.on('close', () => {
            this.logger.info(`Station ${stationId} disconnected`);
            this.clients.delete(stationId);
        });

        ws.on('error', (error) => {
            this.logger.error(`WebSocket error for station ${stationId}:`, error);
        });

        // Send initial BootNotification request
        this.sendMessage(ws, 'BootNotification', {
            chargePointVendor: 'Delta',
            chargePointModel: 'AC Mini Plus',
            chargePointSerialNumber: stationId,
            firmwareVersion: '1.0.0'
        });
    }

    async handleMessage(ws, data) {
        let message;
        try {
            message = JSON.parse(data.toString());
        } catch (error) {
            this.logger.error('Invalid JSON message:', error);
            return;
        }

        const [messageType, messageId, action, payload] = message;
        
        // Log incoming message
        await this.logMessage(ws.stationId, 'incoming', messageType, action, messageId, payload);

        if (messageType === 2) { // CALL
            await this.handleCall(ws, messageId, action, payload);
        } else if (messageType === 3) { // CALLRESULT
            await this.handleCallResult(ws, messageId, payload);
        } else if (messageType === 4) { // CALLERROR
            await this.handleCallError(ws, messageId, payload);
        }
    }

    async handleCall(ws, messageId, action, payload) {
        const handler = this.messageHandlers[action];
        if (handler) {
            try {
                const response = await handler(ws.stationId, payload);
                this.sendCallResult(ws, messageId, response);
            } catch (error) {
                this.logger.error(`Error handling ${action}:`, error);
                this.sendCallError(ws, messageId, 'InternalError', error.message);
            }
        } else {
            this.logger.warn(`Unknown action: ${action}`);
            this.sendCallError(ws, messageId, 'NotSupported', `Action ${action} not supported`);
        }
    }

    async handleCallResult(ws, messageId, payload) {
        this.logger.info(`Received CallResult for message ${messageId}:`, payload);
    }

    async handleCallError(ws, messageId, payload) {
        this.logger.error(`Received CallError for message ${messageId}:`, payload);
    }

    initializeMessageHandlers() {
        return {
            // Boot notification from charging station
            BootNotification: async (stationId, payload) => {
                await this.updateStationStatus(stationId, {
                    firmware_version: payload.firmwareVersion,
                    last_heartbeat: new Date(),
                    status: 'available'
                });

                return {
                    status: 'Accepted',
                    currentTime: new Date().toISOString(),
                    interval: 300 // Heartbeat interval in seconds
                };
            },

            // Heartbeat from charging station
            Heartbeat: async (stationId, payload) => {
                await this.updateStationStatus(stationId, {
                    last_heartbeat: new Date()
                });

                return {
                    currentTime: new Date().toISOString()
                };
            },

            // Status notification
            StatusNotification: async (stationId, payload) => {
                const statusMap = {
                    'Available': 'available',
                    'Occupied': 'occupied',
                    'Faulted': 'offline',
                    'Unavailable': 'maintenance'
                };

                await this.updateStationStatus(stationId, {
                    status: statusMap[payload.status] || 'offline'
                });

                return {};
            },

            // Authorize user
            Authorize: async (stationId, payload) => {
                // In real implementation, validate the idTag
                return {
                    idTagInfo: {
                        status: 'Accepted'
                    }
                };
            },

            // Start transaction
            StartTransaction: async (stationId, payload) => {
                const station = await ChargingStation.findOne({
                    where: { ocpp_id: stationId }
                });

                if (!station) {
                    throw new Error('Station not found');
                }

                // Create charging session
                const session = await ChargingSession.create({
                    session_code: `CHG${Date.now()}`,
                    user_id: 1, // Default user for now
                    vehicle_id: 1, // Default vehicle for now
                    station_id: station.id,
                    start_time: new Date(),
                    meter_start: payload.meterStart,
                    status: 'charging'
                });

                await this.updateStationStatus(stationId, {
                    status: 'occupied'
                });

                return {
                    transactionId: session.id,
                    idTagInfo: {
                        status: 'Accepted'
                    }
                };
            },

            // Stop transaction
            StopTransaction: async (stationId, payload) => {
                const session = await ChargingSession.findByPk(payload.transactionId);
                
                if (session) {
                    const energyDelivered = (payload.meterStop - session.meter_start) / 1000; // Wh to kWh
                    
                    await session.update({
                        end_time: new Date(),
                        meter_stop: payload.meterStop,
                        energy_delivered: energyDelivered,
                        status: 'completed',
                        stop_reason: payload.reason || 'user'
                    });
                }

                await this.updateStationStatus(stationId, {
                    status: 'available'
                });

                return {
                    idTagInfo: {
                        status: 'Accepted'
                    }
                };
            },

            // Meter values
            MeterValues: async (stationId, payload) => {
                // Process meter values and update session
                if (payload.transactionId) {
                    const session = await ChargingSession.findByPk(payload.transactionId);
                    if (session && payload.meterValue && payload.meterValue.length > 0) {
                        const meterValue = payload.meterValue[0];
                        if (meterValue.sampledValue && meterValue.sampledValue.length > 0) {
                            const energyValue = meterValue.sampledValue.find(v => v.measurand === 'Energy.Active.Import.Register');
                            if (energyValue) {
                                const currentEnergy = (parseFloat(energyValue.value) - session.meter_start) / 1000;
                                await session.update({
                                    energy_delivered: currentEnergy
                                });
                            }
                        }
                    }
                }

                return {};
            }
        };
    }

    async updateStationStatus(stationId, updates) {
        try {
            await ChargingStation.update(updates, {
                where: { ocpp_id: stationId }
            });
        } catch (error) {
            this.logger.error(`Error updating station ${stationId}:`, error);
        }
    }

    sendMessage(ws, action, payload) {
        const messageId = uuidv4();
        const message = [2, messageId, action, payload]; // CALL message
        
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
            this.logMessage(ws.stationId, 'outgoing', 2, action, messageId, payload);
        }
    }

    sendCallResult(ws, messageId, payload) {
        const message = [3, messageId, payload]; // CALLRESULT message
        
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
            this.logMessage(ws.stationId, 'outgoing', 3, 'CallResult', messageId, payload);
        }
    }

    sendCallError(ws, messageId, errorCode, errorDescription) {
        const message = [4, messageId, errorCode, errorDescription, {}]; // CALLERROR message
        
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(message));
            this.logMessage(ws.stationId, 'outgoing', 4, 'CallError', messageId, { errorCode, errorDescription });
        }
    }

    async logMessage(stationId, direction, messageType, action, messageId, payload) {
        try {
            const station = await ChargingStation.findOne({
                where: { ocpp_id: stationId }
            });

            if (station) {
                await OCPPMessage.create({
                    station_id: station.id,
                    message_type: messageType === 2 ? 'call' : messageType === 3 ? 'callresult' : 'callerror',
                    action: action,
                    message_id: messageId,
                    payload: payload,
                    direction: direction,
                    status: 'received'
                });
            }
        } catch (error) {
            this.logger.error('Error logging OCPP message:', error);
        }
    }

    // Public methods for external control
    async remoteStartTransaction(stationId, idTag, connectorId = 1) {
        const ws = this.clients.get(stationId);
        if (ws) {
            this.sendMessage(ws, 'RemoteStartTransaction', {
                idTag: idTag,
                connectorId: connectorId
            });
            return true;
        }
        return false;
    }

    async remoteStopTransaction(stationId, transactionId) {
        const ws = this.clients.get(stationId);
        if (ws) {
            this.sendMessage(ws, 'RemoteStopTransaction', {
                transactionId: transactionId
            });
            return true;
        }
        return false;
    }

    async resetStation(stationId, type = 'Soft') {
        const ws = this.clients.get(stationId);
        if (ws) {
            this.sendMessage(ws, 'Reset', {
                type: type
            });
            return true;
        }
        return false;
    }

    getConnectedStations() {
        return Array.from(this.clients.keys());
    }

    isStationConnected(stationId) {
        return this.clients.has(stationId);
    }
}

module.exports = OCPPServer;
