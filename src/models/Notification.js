const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Title is required' }
    }
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Message is required' }
    }
  },
  type: {
    type: DataTypes.ENUM('info', 'warning', 'fee_reminder', 'attendance', 'general', 'fee', 'schedule', 'holiday', 'achievement'),
    defaultValue: 'general'
  },
  recipients: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    defaultValue: [],
    comment: 'Array of student UUIDs, empty = broadcast to all'
  },
  isGlobal: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'is_global'
  },
  readBy: {
    type: DataTypes.ARRAY(DataTypes.UUID),
    defaultValue: [],
    field: 'read_by',
    comment: 'Array of student UUIDs who have read this notification'
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    field: 'created_by'
  }
}, {
  tableName: 'notifications',
  timestamps: true
});

module.exports = Notification;
