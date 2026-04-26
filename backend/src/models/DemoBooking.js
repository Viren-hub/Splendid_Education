const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DemoBooking = sequelize.define('DemoBooking', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Name is required' }
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: { msg: 'Must be a valid email address' }
    },
    set(value) {
      if (value) this.setDataValue('email', value.toLowerCase().trim());
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Phone is required' }
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
  preferredDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'preferred_date'
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'cancelled'),
    defaultValue: 'pending'
  },
  scheduledDate: {
    type: DataTypes.DATEONLY,
    allowNull: true,
    field: 'scheduled_date'
  }
}, {
  tableName: 'demo_bookings',
  timestamps: true
});

module.exports = DemoBooking;
