const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
    const SystemSetting = sequelize.define('SystemSetting', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        setting_key: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true
        },
        setting_value: {
            type: DataTypes.TEXT,
            allowNull: false
        },
        data_type: {
            type: DataTypes.ENUM('string', 'number', 'boolean', 'json'),
            defaultValue: 'string'
        },
        description: {
            type: DataTypes.TEXT
        },
        category: {
            type: DataTypes.STRING(50),
            defaultValue: 'general'
        },
        is_public: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        updated_by: {
            type: DataTypes.INTEGER,
            references: {
                model: 'users',
                key: 'id'
            }
        }
    }, {
        tableName: 'system_settings',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['setting_key']
            },
            {
                fields: ['category']
            },
            {
                fields: ['is_public']
            }
        ]
    });

    return SystemSetting;
};
