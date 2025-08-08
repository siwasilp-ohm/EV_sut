const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const User = sequelize.define('User', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        username: {
            type: DataTypes.STRING(50),
            allowNull: false,
            unique: true,
            validate: {
                len: [3, 50],
                isAlphanumeric: true
            }
        },
        email: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true
            }
        },
        password_hash: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        first_name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            validate: {
                len: [1, 100]
            }
        },
        last_name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            validate: {
                len: [1, 100]
            }
        },
        phone: {
            type: DataTypes.STRING(20),
            validate: {
                is: /^[0-9+\-\s()]+$/
            }
        },
        profile_image: {
            type: DataTypes.STRING(255)
        },
        role: {
            type: DataTypes.ENUM('admin', 'service', 'user'),
            defaultValue: 'user',
            allowNull: false
        },
        balance: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0.00,
            validate: {
                min: 0
            }
        },
        status: {
            type: DataTypes.ENUM('active', 'inactive', 'suspended'),
            defaultValue: 'active'
        },
        last_login: {
            type: DataTypes.DATE
        }
    }, {
        tableName: 'users',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['username']
            },
            {
                unique: true,
                fields: ['email']
            },
            {
                fields: ['role']
            },
            {
                fields: ['status']
            }
        ],
        hooks: {
            beforeCreate: (user) => {
                user.email = user.email.toLowerCase();
                user.username = user.username.toLowerCase();
            },
            beforeUpdate: (user) => {
                if (user.changed('email')) {
                    user.email = user.email.toLowerCase();
                }
                if (user.changed('username')) {
                    user.username = user.username.toLowerCase();
                }
            }
        }
    });

    // Instance methods
    User.prototype.toJSON = function() {
        const values = Object.assign({}, this.get());
        delete values.password_hash;
        return values;
    };

    User.prototype.getFullName = function() {
        return `${this.first_name} ${this.last_name}`;
    };

    User.prototype.canAccess = function(resource) {
        const permissions = {
            admin: ['dashboard', 'users', 'stations', 'payments', 'energy', 'logs', 'settings'],
            service: ['dashboard', 'stations', 'energy', 'logs'],
            user: ['profile', 'vehicles', 'charging', 'payments']
        };
        return permissions[this.role]?.includes(resource) || false;
    };

    return User;
};
