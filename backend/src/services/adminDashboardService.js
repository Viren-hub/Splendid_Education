const { sequelize } = require('../config/database');
const { Op, fn, col, literal } = require('sequelize');
const Student = require('../models/Student');
const User = require('../models/User');
const Course = require('../models/Course');
const Batch = require('../models/Batch');
const Enrollment = require('../models/Enrollment');
const Fee = require('../models/Fee');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const Attendance = require('../models/Attendance');
const QuizAttempt = require('../models/QuizAttempt');
const Contact = require('../models/Contact');

/**
 * Summary counts for dashboard cards.
 */
const getDashboardStats = async () => {
  const [
    totalStudents, activeStudents,
    totalCourses, activeCourses,
    totalBatches, activeBatches,
    pendingEnrollments,
    totalRevenue, pendingFees,
    newContacts,
  ] = await Promise.all([
    Student.count(),
    Student.count({ where: { isActive: true } }),
    Course.count(),
    Course.count({ where: { isActive: true } }),
    Batch.count(),
    Batch.count({ where: { isActive: true } }),
    Enrollment.count({ where: sequelize.literal(`"Enrollment"."payment_status" IN ('pending_payment', 'utr_submitted')`) }),
    Payment.sum('amount').then(v => Number(v) || 0),
    sequelize.query(
      `SELECT COALESCE(SUM(f.total_fee - f.amount_paid - f.discount), 0)::float AS outstanding
       FROM fees f
       JOIN students s ON s.id = f.student_id
       WHERE f.status != 'paid' AND s.is_active = true`,
      { type: sequelize.QueryTypes.SELECT }
    ).then(rows => rows[0]?.outstanding || 0),
    Contact.count({ where: { status: 'new' } }),
  ]);

  return {
    students: { total: totalStudents, active: activeStudents },
    courses: { total: totalCourses, active: activeCourses },
    batches: { total: totalBatches, active: activeBatches },
    enrollments: { pending: pendingEnrollments },
    finance: { totalRevenue, pendingFees },
    contacts: { new: newContacts },
  };
};

/**
 * Monthly revenue for the last N months.
 */
const getMonthlyRevenue = async (months = 6) => {
  const since = new Date();
  since.setMonth(since.getMonth() - months + 1);
  since.setDate(1);

  const rows = await sequelize.query(
    `SELECT EXTRACT(YEAR  FROM "payment_date")::int AS year,
            EXTRACT(MONTH FROM "payment_date")::int AS month,
            SUM(amount)::float                      AS revenue
     FROM   payments
     WHERE  "payment_date" >= :since
     GROUP  BY year, month
     ORDER  BY year, month`,
    { replacements: { since }, type: sequelize.QueryTypes.SELECT }
  );
  return rows;
};

/**
 * Monthly expenses for the last N months.
 */
const getMonthlyExpenses = async (months = 6) => {
  const since = new Date();
  since.setMonth(since.getMonth() - months + 1);
  since.setDate(1);

  const rows = await sequelize.query(
    `SELECT EXTRACT(YEAR  FROM date)::int AS year,
            EXTRACT(MONTH FROM date)::int AS month,
            SUM(amount)::float            AS expenses
     FROM   expenses
     WHERE  date >= :since
     GROUP  BY year, month
     ORDER  BY year, month`,
    { replacements: { since }, type: sequelize.QueryTypes.SELECT }
  );
  return rows;
};

/**
 * Fee status breakdown.
 */
const getFeeStatusBreakdown = async () => {
  const rows = await sequelize.query(
    `SELECT status, COUNT(*)::int AS count, COALESCE(SUM("total_fee"),0)::float AS total
     FROM fees GROUP BY status`,
    { type: sequelize.QueryTypes.SELECT }
  );
  return rows;
};

/**
 * Overall attendance rate (present+late / total records).
 */
const getAttendanceStats = async ({ month, year } = {}) => {
  let dateFilter = '';
  const replacements = {};
  if (year && month) {
    dateFilter = ` AND date >= :start AND date <= :end`;
    replacements.start = `${year}-${String(month).padStart(2,'0')}-01`;
    const end = new Date(year, month, 0);
    replacements.end = end.toISOString().slice(0,10);
  } else if (year) {
    dateFilter = ` AND date >= :start AND date <= :end`;
    replacements.start = `${year}-01-01`;
    replacements.end = `${year}-12-31`;
  }

  // Expand JSONB records array and aggregate — only active students
  const rows = await sequelize.query(
    `SELECT
       COUNT(*) FILTER (WHERE r.value->>'status' IN ('present','late'))::int AS present,
       COUNT(*) FILTER (WHERE r.value->>'status' NOT IN ('present','late'))::int AS absent,
       COUNT(*)::int AS total
     FROM attendances a,
          jsonb_array_elements(a.records) AS r(value)
     WHERE EXISTS (
       SELECT 1 FROM students s
       WHERE s.id::text = r.value->>'studentId' AND s.is_active = true
     )${dateFilter}`,
    { replacements, type: sequelize.QueryTypes.SELECT }
  );
  const { present = 0, absent = 0, total = 0 } = rows[0] || {};
  const percentage = total > 0 ? parseFloat(((present / total) * 100).toFixed(2)) : 0;
  return { present, absent, total, percentage };
};

/**
 * Quiz performance summary.
 */
const getQuizStats = async () => {
  const rows = await sequelize.query(
    `SELECT COUNT(*)::int               AS total_attempts,
            AVG(percentage)::float       AS avg_percentage,
            COUNT(*) FILTER (WHERE passed)::int  AS passed,
            COUNT(*) FILTER (WHERE NOT passed)::int AS failed
     FROM quiz_attempts`,
    { type: sequelize.QueryTypes.SELECT }
  );
  return rows[0] || {};
};

/**
 * Recent enrollments (latest 5).
 */
const getRecentEnrollments = async (limit = 5) => {
  const Enrollment = require('../models/Enrollment');
  return Enrollment.findAll({
    attributes: ['id', 'studentName', 'email', 'phone', 'paymentStatus', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit,
  });
};

/**
 * Student count per grade (active students only).
 */
const getCourseDistribution = async () => {
  const rows = await sequelize.query(
    `SELECT
       COALESCE(NULLIF(TRIM(s.grade::text), ''), 'Unassigned') AS "courseName",
       COUNT(s.id)::int AS count
     FROM students s
     WHERE s.is_active = true
     GROUP BY COALESCE(NULLIF(TRIM(s.grade::text), ''), 'Unassigned')
     ORDER BY count DESC
     LIMIT 8`,
    { type: sequelize.QueryTypes.SELECT }
  );
  return rows;
};

/**
 * Most recently enrolled active students.
 */
const getRecentStudents = async (limit = 5) => {
  return Student.findAll({
    where: { isActive: true },
    include: [{ model: User, as: 'user', attributes: ['name'] }],
    order: [['enrollmentDate', 'DESC']],
    limit,
    attributes: ['id', 'enrollmentDate', 'academicYear', 'grade'],
  });
};

/**
 * Unpaid/partial fee records sorted by due date.
 */
const getPendingFeeAlerts = async (limit = 5) => {
  return Fee.findAll({
    where: { status: { [Op.ne]: 'paid' } },
    include: [{
      model: Student, as: 'student',
      required: true,
      where: { isActive: true },
      attributes: ['id', 'studentId'],
      include: [{ model: User, as: 'user', attributes: ['name'] }],
    }],
    order: [[literal('"dueDate" ASC NULLS LAST')]],
    limit,
    attributes: ['id', 'totalFee', 'amountPaid', 'discount', 'dueDate', 'status'],
  });
};

/**
 * Most recent payments.
 */
const getRecentPayments = async (limit = 8) => {
  return Payment.findAll({
    include: [{
      model: Student, as: 'student',
      attributes: ['id', 'studentId'],
      include: [{ model: User, as: 'user', attributes: ['name'] }],
    }],
    order: [['createdAt', 'DESC']],
    limit,
    attributes: ['id', 'receiptNumber', 'amount', 'method', 'createdAt'],
  });
};

module.exports = {
  getDashboardStats,
  getMonthlyRevenue,
  getMonthlyExpenses,
  getFeeStatusBreakdown,
  getAttendanceStats,
  getQuizStats,
  getRecentEnrollments,
  getCourseDistribution,
  getRecentStudents,
  getPendingFeeAlerts,
  getRecentPayments,
};
