const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Fee = sequelize.define('Fee', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'students',
      key: 'id'
    },
    field: 'student_id'
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
  totalFee: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'total_fee',
    validate: {
      min: { args: [0], msg: 'Total fee must be non-negative' }
    }
  },
  amountPaid: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'amount_paid',
    validate: {
      min: { args: [0], msg: 'Amount paid must be non-negative' }
    }
  },
  discount: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    validate: {
      min: { args: [0], msg: 'Discount must be non-negative' }
    }
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'due_date'
  },
  status: {
    type: DataTypes.ENUM('paid', 'partial', 'pending', 'overdue'),
    defaultValue: 'pending'
  },
  pendingAmount: {
    type: DataTypes.VIRTUAL,
    get() {
      return parseFloat(this.totalFee || 0) - parseFloat(this.discount || 0) - parseFloat(this.amountPaid || 0);
    }
  }
}, {
  tableName: 'fees',
  timestamps: true
});

module.exports = Fee;
