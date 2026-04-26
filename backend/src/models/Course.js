const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Course = sequelize.define('Course', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Course title is required' }
    }
  },
  category: {
    type: DataTypes.ENUM('web_development', 'ai_ml', 'mobile_apps', 'game_development', 'other'),
    allowNull: false,
    defaultValue: 'other',
    validate: {
      notEmpty: { msg: 'Category is required' }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  duration: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Duration is required' }
    }
  },
  fee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Course fee is required' },
      min: { args: [0], msg: 'Fee must be non-negative' }
    }
  },
  ageGroup: {
    type: DataTypes.STRING,
    defaultValue: 'All Ages'
  },
  syllabus: {
    type: DataTypes.ARRAY(DataTypes.TEXT),
    defaultValue: []
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'courses',
  timestamps: true
});

module.exports = Course;
