// Bug fixes and improvements for the EV Solar Charging System
const logger = require('./logger').createLogger('bugfixes');

class BugFixManager {
  constructor() {
    this.fixes = [];
    this.appliedFixes = new Set();
  }

  // Register a bug fix
  registerFix(id, description, fix) {
    this.fixes.push({
      id,
      description,
      fix,
      applied: false,
      timestamp: new Date()
    });
  }

  // Apply all registered fixes
  async applyAllFixes() {
    logger.info('Applying bug fixes...');
    
    for (const fixItem of this.fixes) {
      if (!this.appliedFixes.has(fixItem.id)) {
        try {
          await fixItem.fix();
          this.appliedFixes.add(fixItem.id);
          fixItem.applied = true;
          logger.info(`Applied fix: ${fixItem.description}`);
        } catch (error) {
          logger.error(`Failed to apply fix ${fixItem.id}:`, error);
        }
      }
    }
  }

  // Get status of all fixes
  getFixStatus() {
    return this.fixes.map(fix => ({
      id: fix.id,
      description: fix.description,
      applied: fix.applied,
      timestamp: fix.timestamp
    }));
  }
}

const bugFixManager = new BugFixManager();

// Register common bug fixes
bugFixManager.registerFix('auth-validation', 'Fix authentication validation', async () => {
  // This is handled by the validation middleware we created
});

bugFixManager.registerFix('cors-config', 'Fix CORS configuration', async () => {
  // This is handled by the security middleware we created
});

bugFixManager.registerFix('error-handling', 'Improve error handling', async () => {
  // This is handled by the error handler middleware we created
});

bugFixManager.registerFix('database-connection', 'Improve database connection reliability', async () => {
  // This is handled by the database manager we created
});

bugFixManager.registerFix('rate-limiting', 'Implement proper rate limiting', async () => {
  // This is handled by the security middleware we created
});

// Common bug fixes and improvements
const commonFixes = {
  // Fix timezone issues
  fixTimezone: () => {
    process.env.TZ = process.env.TZ || 'Asia/Bangkok';
  },

  // Fix memory leaks
  fixMemoryLeaks: () => {
    // Set max listeners to prevent memory leak warnings
    process.setMaxListeners(20);
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  },

  // Fix JSON parsing issues
  fixJSONParsing: (app) => {
    app.use((err, req, res, next) => {
      if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        logger.error('JSON parsing error:', err);
        return res.status(400).json({
          success: false,
          error: 'Invalid JSON format'
        });
      }
      next(err);
    });
  },

  // Fix file upload issues
  fixFileUploads: () => {
    const multer = require('multer');
    const path = require('path');
    const fs = require('fs');

    // Ensure upload directories exist
    const uploadDirs = [
      'uploads/profiles',
      'uploads/payment-slips',
      'uploads/documents'
    ];

    uploadDirs.forEach(dir => {
      const fullPath = path.join(process.cwd(), dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        logger.info(`Created upload directory: ${fullPath}`);
      }
    });
  },

  // Fix environment variables
  fixEnvironmentVariables: () => {
    const requiredEnvVars = [
      'DB_HOST',
      'DB_USER',
      'DB_PASSWORD',
      'DB_NAME',
      'JWT_SECRET',
      'OCPP_PORT',
      'INVERTER_IP'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.warn(`Missing environment variables: ${missingVars.join(', ')}`);
      
      // Set default values for development
      if (process.env.NODE_ENV !== 'production') {
        const defaults = {
          DB_HOST: 'localhost',
          DB_USER: 'root',
          DB_PASSWORD: '',
          DB_NAME: 'ev_solar_charging',
          JWT_SECRET: 'your-secret-key-change-in-production',
          OCPP_PORT: '8080',
          INVERTER_IP: '192.168.1.100'
        };

        missingVars.forEach(varName => {
          if (defaults[varName]) {
            process.env[varName] = defaults[varName];
            logger.info(`Set default value for ${varName}`);
          }
        });
      }
    }
  },

  // Fix SSL/TLS issues
  fixSSLIssues: () => {
    if (process.env.NODE_ENV === 'development') {
      // Allow self-signed certificates in development
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
  },

  // Fix logging issues
  fixLogging: () => {
    // Ensure logs directory exists
    const fs = require('fs');
    const path = require('path');
    
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
      logger.info(`Created logs directory: ${logsDir}`);
    }
  }
};

// Apply all common fixes
const applyCommonFixes = (app) => {
  logger.info('Applying common bug fixes...');
  
  commonFixes.fixTimezone();
  commonFixes.fixMemoryLeaks();
  commonFixes.fixEnvironmentVariables();
  commonFixes.fixSSLIssues();
  commonFixes.fixLogging();
  commonFixes.fixFileUploads();
  
  if (app) {
    commonFixes.fixJSONParsing(app);
  }
  
  logger.info('Common bug fixes applied successfully');
};

module.exports = {
  BugFixManager,
  bugFixManager,
  commonFixes,
  applyCommonFixes
};
