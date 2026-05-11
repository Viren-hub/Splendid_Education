const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Batch = sequelize.define('Batch', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  batchName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'batch_name',
    validate: {
      notEmpty: { msg: 'Batch name is required' }
    }
  },
  courseId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'courses',
      key: 'id'
    },
    field: 'course_id'
  },
  instructorId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    field: 'instructor_id'
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'start_date',
    validate: {
      notEmpty: { msg: 'Start date is required' }
    }
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'end_date'
  },
  schedule: {
    type: DataTypes.JSONB,
    defaultValue: { days: [], time: '' }
  },
  allowedGrades: {
    type: DataTypes.JSONB,
    defaultValue: [],
    field: 'allowed_grades'
  },
  maxCapacity: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    field: 'max_capacity',
    validate: {
      min: { args: [1], msg: 'Max capacity must be at least 1' }
    }
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'batches',
  timestamps: true
});

module.exports = Batch;
