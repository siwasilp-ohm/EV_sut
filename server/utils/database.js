const { Sequelize } = require('sequelize');
const logger = require('./logger').createLogger('database');

class DatabaseManager {
  constructor() {
    this.sequelize = null;
    this.isConnected = false;
    this.retryAttempts = 0;
    this.maxRetries = 5;
    this.retryDelay = 5000; // 5 seconds
  }

  async connect() {
    try {
      this.sequelize = new Sequelize(
        process.env.DB_NAME || 'ev_solar_charging',
        process.env.DB_USER || 'root',
        process.env.DB_PASSWORD || '',
        {
          host: process.env.DB_HOST || 'localhost',
          port: process.env.DB_PORT || 3306,
          dialect: 'mysql',
          logging: process.env.NODE_ENV === 'development' ? 
            (msg) => logger.debug(msg) : false,
          pool: {
            max: parseInt(process.env.DB_POOL_MAX) || 10,
            min: parseInt(process.env.DB_POOL_MIN) || 0,
            acquire: parseInt(process.env.DB_POOL_ACQUIRE) || 30000,
            idle: parseInt(process.env.DB_POOL_IDLE) || 10000
          },
          dialectOptions: {
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci',
            connectTimeout: 60000,
            acquireTimeout: 60000,
            timeout: 60000,
          },
          define: {
            charset: 'utf8mb4',
            collate: 'utf8mb4_unicode_ci',
            timestamps: true,
            underscored: true,
            freezeTableName: true
          },
          retry: {
            match: [
              /ETIMEDOUT/,
              /EHOSTUNREACH/,
              /ECONNRESET/,
              /ECONNREFUSED/,
              /TIMEOUT/,
              /ESOCKETTIMEDOUT/,
              /EHOSTUNREACH/,
              /EPIPE/,
              /EAI_AGAIN/,
              /SequelizeConnectionError/,
              /SequelizeConnectionRefusedError/,
              /SequelizeHostNotFoundError/,
              /SequelizeHostNotReachableError/,
              /SequelizeInvalidConnectionError/,
              /SequelizeConnectionTimedOutError/
            ],
            max: 3
          }
        }
      );

      await this.testConnection();
      this.isConnected = true;
      this.retryAttempts = 0;
      
      logger.info('Database connected successfully');
      return this.sequelize;

    } catch (error) {
      logger.error('Database connection failed:', error);
      
      if (this.retryAttempts < this.maxRetries) {
        this.retryAttempts++;
        logger.info(`Retrying database connection (${this.retryAttempts}/${this.maxRetries}) in ${this.retryDelay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        return this.connect();
      }
      
      throw new Error(`Failed to connect to database after ${this.maxRetries} attempts: ${error.message}`);
    }
  }

  async testConnection() {
    try {
      await this.sequelize.authenticate();
      logger.info('Database authentication successful');
    } catch (error) {
      logger.error('Database authentication failed:', error);
      throw error;
    }
  }

  async syncDatabase(force = false) {
    try {
      if (!this.isConnected) {
        throw new Error('Database not connected');
      }

      logger.info(`Starting database sync${force ? ' (force mode)' : ''}...`);
      
      await this.sequelize.sync({ 
        force,
        alter: !force && process.env.NODE_ENV === 'development'
      });
      
      logger.info('Database sync completed successfully');
    } catch (error) {
      logger.error('Database sync failed:', error);
      throw error;
    }
  }

  async close() {
    try {
      if (this.sequelize) {
        await this.sequelize.close();
        this.isConnected = false;
        logger.info('Database connection closed');
      }
    } catch (error) {
      logger.error('Error closing database connection:', error);
      throw error;
    }
  }

  async healthCheck() {
    try {
      if (!this.sequelize) {
        return { status: 'error', message: 'Database not initialized' };
      }

      await this.sequelize.authenticate();
      
      const [results] = await this.sequelize.query('SELECT 1 as test');
      
      return {
        status: 'healthy',
        message: 'Database connection is working',
        details: {
          connected: this.isConnected,
          host: process.env.DB_HOST || 'localhost',
          database: process.env.DB_NAME || 'ev_solar_charging',
          pool: this.sequelize.connectionManager.pool
        }
      };
    } catch (error) {
      logger.error('Database health check failed:', error);
      return {
        status: 'error',
        message: error.message,
        details: { connected: false }
      };
    }
  }

  getSequelize() {
    return this.sequelize;
  }

  isHealthy() {
    return this.isConnected && this.sequelize !== null;
  }
}

// Singleton instance
const dbManager = new DatabaseManager();

module.exports = {
  DatabaseManager,
  dbManager
};
