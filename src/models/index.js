const { sequelize } = require('../config/database');

// Import all models
const User = require('./User');
const Student = require('./Student');
const Course = require('./Course');
const Batch = require('./Batch');
const BatchStudent = require('./BatchStudent');
const Attendance = require('./Attendance');
const Fee = require('./Fee');
const Payment = require('./Payment');
const Expense = require('./Expense');
const Holiday = require('./Holiday');
const Notification = require('./Notification');
const Contact = require('./Contact');
const DemoBooking = require('./DemoBooking');
const Testimonial = require('./Testimonial');
const ProjectShowcase = require('./ProjectShowcase');
const Quiz = require('./Quiz');
const QuizAttempt = require('./QuizAttempt');
const Enrollment = require('./Enrollment');
const StudentSession = require('./StudentSession');

// Define model relationships

// User <-> Student (one-to-one)
User.hasOne(Student, { foreignKey: 'userId', as: 'studentProfile' });
Student.belongsTo(User, { foreignKey: 'userId', as: 'user' });

// Course relationships
Course.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Course.hasMany(Student, { foreignKey: 'courseId', as: 'students' });
Course.hasMany(Batch, { foreignKey: 'courseId', as: 'batches' });
Course.hasMany(DemoBooking, { foreignKey: 'courseId', as: 'demoBookings' });
Course.hasMany(Fee, { foreignKey: 'courseId', as: 'fees' });

// Student relationships
Student.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Student.belongsToMany(Batch, { through: BatchStudent, foreignKey: 'studentId', as: 'enrolledBatches' });
Student.hasMany(Attendance, { foreignKey: 'studentId', as: 'attendances' });
Student.hasOne(Fee, { foreignKey: 'studentId', as: 'feeRecord' });
Student.hasMany(Payment, { foreignKey: 'studentId', as: 'payments' });
Student.hasMany(ProjectShowcase, { foreignKey: 'studentId', as: 'projects' });
Student.hasMany(QuizAttempt, { foreignKey: 'studentId', as: 'quizAttempts' });
Student.hasOne(Enrollment, { foreignKey: 'studentId', as: 'enrollment' });

// Batch relationships
Batch.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Batch.belongsTo(User, { foreignKey: 'instructorId', as: 'instructor' });
Batch.belongsToMany(Student, { through: BatchStudent, foreignKey: 'batchId', as: 'students' });
Batch.hasMany(Attendance, { foreignKey: 'batchId', as: 'attendances' });

// Attendance relationships
Attendance.belongsTo(Batch, { foreignKey: 'batchId', as: 'batch' });
Attendance.belongsTo(User, { foreignKey: 'instructorId', as: 'instructor' });
Attendance.belongsTo(User, { foreignKey: 'markedBy', as: 'marker' });

// Fee & Payment relationships
Fee.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
Fee.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });
Fee.hasMany(Payment, { foreignKey: 'feeId', as: 'payments' });

Payment.belongsTo(Fee, { foreignKey: 'feeId', as: 'fee' });
Payment.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
Payment.belongsTo(User, { foreignKey: 'recordedBy', as: 'recorder' });

// Expense relationships
Expense.belongsTo(User, { foreignKey: 'recordedBy', as: 'recorder' });

// Holiday relationships
Holiday.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

// Notification relationships
Notification.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });

// DemoBooking relationships
DemoBooking.belongsTo(Course, { foreignKey: 'courseId', as: 'course' });

// ProjectShowcase relationships
ProjectShowcase.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

// Quiz relationships
Quiz.belongsTo(User, { foreignKey: 'createdBy', as: 'creator' });
Quiz.hasMany(QuizAttempt, { foreignKey: 'quizId', as: 'attempts' });

// QuizAttempt relationships
QuizAttempt.belongsTo(Quiz, { foreignKey: 'quizId', as: 'quiz' });
QuizAttempt.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });

// Enrollment relationships
Enrollment.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
Enrollment.belongsTo(User, { foreignKey: 'confirmedBy', as: 'confirmer' });
Enrollment.belongsTo(User, { foreignKey: 'rejectedBy', as: 'rejecter' });

// StudentSession relationships
StudentSession.belongsTo(Student, { foreignKey: 'studentId', as: 'student' });
Student.hasMany(StudentSession, { foreignKey: 'studentId', as: 'sessions' });

module.exports = {
  sequelize,
  User,
  Student,
  Course,
  Batch,
  BatchStudent,
  Attendance,
  Fee,
  Payment,
  Expense,
  Holiday,
  Notification,
  Contact,
  DemoBooking,
  Testimonial,
  ProjectShowcase,
  Quiz,
  QuizAttempt,
  Enrollment,
  StudentSession
};
