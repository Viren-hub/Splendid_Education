const adminDashboardService = require('../services/adminDashboardService');

// 60-second in-memory cache for the heavy dashboard aggregate
let _dashCache = null;
let _dashCacheAt = 0;
const DASH_CACHE_TTL = 60_000;

const getDashboardStats = async (req, res, next) => {
  try {
    const stats = await adminDashboardService.getDashboardStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) { next(error); }
};

const getFinancialOverview = async (req, res, next) => {
  try {
    const months = parseInt(req.query.months) || 6;
    const [revenue, expenses, feeBreakdown] = await Promise.all([
      adminDashboardService.getMonthlyRevenue(months),
      adminDashboardService.getMonthlyExpenses(months),
      adminDashboardService.getFeeStatusBreakdown(),
    ]);
    res.status(200).json({ success: true, data: { revenue, expenses, feeBreakdown } });
  } catch (error) { next(error); }
};

const getAttendanceOverview = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const stats = await adminDashboardService.getAttendanceStats({ month, year });
    res.status(200).json({ success: true, data: stats });
  } catch (error) { next(error); }
};

const getQuizOverview = async (req, res, next) => {
  try {
    const stats = await adminDashboardService.getQuizStats();
    res.status(200).json({ success: true, data: stats });
  } catch (error) { next(error); }
};

const getRecentActivity = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const recentEnrollments = await adminDashboardService.getRecentEnrollments(limit);
    res.status(200).json({ success: true, data: { recentEnrollments } });
  } catch (error) { next(error); }
};

const getDashboard = async (req, res, next) => {
  try {
    // Serve cached response if fresh
    if (_dashCache && Date.now() - _dashCacheAt < DASH_CACHE_TTL) {
      return res.status(200).json({ success: true, data: _dashCache });
    }

    const [
      stats,
      revenueRows,
      attendanceStats,
      courseDistribution,
      recentStudents,
      pendingFeeAlerts,
      recentPayments,
    ] = await Promise.all([
      adminDashboardService.getDashboardStats(),
      adminDashboardService.getMonthlyRevenue(6),
      adminDashboardService.getAttendanceStats(),
      adminDashboardService.getCourseDistribution(),
      adminDashboardService.getRecentStudents(),
      adminDashboardService.getPendingFeeAlerts(),
      adminDashboardService.getRecentPayments(),
    ]);

    // Frontend buildCharts expects `total` field; service returns `revenue`
    const monthlyRevenue = revenueRows.map(r => ({ year: r.year, month: r.month, total: r.revenue }));

    const data = {
      students:    stats.students,
      courses:     stats.courses,
      batches:     stats.batches,
      enrollments: stats.enrollments,
      fees: {
        pending:   stats.finance.pendingFees,
        collected: stats.finance.totalRevenue,
      },
      contacts:         stats.contacts,
      attendancePct:    attendanceStats.percentage,
      monthlyRevenue,
      courseDistribution,
      recentEnrollments:  recentStudents,
      pendingFeeAlerts,
      recentPayments,
      trends: {},
    };

    _dashCache = data;
    _dashCacheAt = Date.now();

    res.status(200).json({ success: true, data });
  } catch (error) { next(error); }
};

module.exports = {
  getDashboardStats,
  getDashboard,
  getFinancialOverview,
  getAttendanceOverview,
  getQuizOverview,
  getRecentActivity,
};
