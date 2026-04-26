const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  feeId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'fees',
      key: 'id'
    },
    field: 'fee_id'
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'students',
      key: 'id'
    },
    field: 'student_id'
  },
  amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    validate: {
      min: { args: [1], msg: 'Amount must be at least 1' }
    }
  },
  paymentDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'payment_date'
  },
  method: {
    type: DataTypes.ENUM('cash', 'upi', 'bank_transfer', 'cheque', 'other'),
    defaultValue: 'cash'
  },
  receiptNumber: {
    type: DataTypes.STRING,
    unique: true,
    field: 'receipt_number'
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  recordedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    field: 'recorded_by'
  }
}, {
  tableName: 'payments',
  timestamps: true,
  hooks: {
    beforeCreate: async (payment) => {
      if (!payment.receiptNumber) {
        const count = await Payment.count();
        payment.receiptNumber = `RCPT-${Date.now()}-${count + 1}`;
      }
    }
  }
});

module.exports = Payment;
