const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Student = sequelize.define('Student', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    unique: true,
    references: {
      model: 'users',
      key: 'id'
    },
    field: 'user_id'
  },
  studentId: {
    type: DataTypes.STRING,
    unique: true,
    field: 'student_id'
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  dateOfBirth: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'date_of_birth'
  },
  contactEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'contact_email',
    set(value) {
      if (value) {
        this.setDataValue('contactEmail', value.toLowerCase().trim());
      }
    }
  },
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
  parentEmail: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'parent_email',
    set(value) {
      if (value) {
        this.setDataValue('parentEmail', value.toLowerCase().trim());
      }
    }
  },
  emergencyContact: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'emergency_contact'
  },
  emergencyContactRelation: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'emergency_contact_relation'
  },
  grade: {
    type: DataTypes.ENUM('3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th', 'N/A'),
    defaultValue: null,
    allowNull: true
  },
  academicYear: {
    type: DataTypes.STRING,
    defaultValue: '',
    field: 'academic_year'
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
  enrollmentDate: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'enrollment_date'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  }
}, {
  tableName: 'students',
  timestamps: true,
  hooks: {
    beforeCreate: async (student) => {
      if (!student.studentId) {
        const count = await Student.count();
        student.studentId = `STU-${String(count + 1).padStart(4, '0')}`;
      }
    }
  }
});

module.exports = Student;
