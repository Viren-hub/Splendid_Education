const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Enrollment = sequelize.define('Enrollment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  // ── Student Details ───────────────────────────────────
  studentName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'student_name'
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: { msg: 'Must be a valid email address' }
    },
    set(value) {
      this.setDataValue('email', value.toLowerCase().trim());
    }
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dateOfBirth: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'date_of_birth'
  },
  schoolName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'school_name'
  },
  className: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'class_name'
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  // ── Parent / Guardian Details ─────────────────────────
  parentName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'parent_name'
  },
  parentPhone: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'parent_phone'
  },
  relation: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: 'Father / Mother / Guardian'
  },
  alternatePhone: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'alternate_phone'
  },
  // ── Child Safety Info ─────────────────────────────────
  bloodGroup: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'blood_group',
    comment: 'A+, B-, O+ etc.'
  },
  medicalInfo: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'medical_info',
    comment: 'Allergies / conditions'
  },
  emergencyContactName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'emergency_contact_name'
  },
  // ── Program / Fee ─────────────────────────────────────
  courseFee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'course_fee'
  },
  // ── Payment ────────────────────────────────────────────
  paymentStatus: {
    type: DataTypes.ENUM('pending_payment', 'utr_submitted', 'payment_confirmed', 'rejected'),
    defaultValue: 'pending_payment',
    field: 'payment_status'
  },
  utrNumber: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'utr_number'
  },
  utrEnteredBy: {
    type: DataTypes.ENUM('applicant', 'admin'),
    allowNull: true,
    field: 'utr_entered_by'
  },
  utrSubmittedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'utr_submitted_at'
  },
  // ── Admin actions ──────────────────────────────────────
  confirmedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    field: 'confirmed_by'
  },
  confirmedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'confirmed_at'
  },
  rejectedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    field: 'rejected_by'
  },
  rejectedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'rejected_at'
  },
  rejectionReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'rejection_reason'
  },
  adminNote: {
    type: DataTypes.TEXT,
    allowNull: true,
    field: 'admin_note'
  },
  // ── Linked Student (set after confirmation) ────────────
  studentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'students',
      key: 'id'
    },
    field: 'student_id'
  }
}, {
  tableName: 'enrollments',
  timestamps: true
});

module.exports = Enrollment;
