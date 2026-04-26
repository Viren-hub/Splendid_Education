const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const StudentSession = sequelize.define('StudentSession', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: { model: 'students', key: 'id' },
    field: 'student_id',
  },
  checkInAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    field: 'check_in_at',
  },
  checkOutAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'check_out_at',
  },
  durationMinutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'duration_minutes',
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  notifiedParentIn: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'notified_parent_in',
  },
  notifiedParentOut: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    field: 'notified_parent_out',
  },
}, {
  tableName: 'student_sessions',
  timestamps: true,
});

module.exports = StudentSession;
