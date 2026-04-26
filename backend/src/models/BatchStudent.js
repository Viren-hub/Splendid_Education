const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

// Junction table for Batch-Student many-to-many relationship
const BatchStudent = sequelize.define('BatchStudent', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  batchId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'batches',
      key: 'id'
    },
    field: 'batch_id'
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'students',
      key: 'id'
    },
    field: 'student_id'
  }
}, {
  tableName: 'batch_students',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['batch_id', 'student_id']
    }
  ]
});

module.exports = BatchStudent;
