const Fee = require('../models/Fee');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const { Op } = require('sequelize');

/**
 * Get fee overview stats for dashboard / reports.
 */
const getFeeStats = async () => {
  const [totalRevenue, pendingRevenue, count] = await Promise.all([
    Payment.sum('amount') || 0,
    Fee.sum('totalFee', { where: { status: { [Op.ne]: 'paid' } } }) || 0,
    Fee.count(),
  ]);
  const paidCount = await Fee.count({ where: { status: 'paid' } });
  const overdueCount = await Fee.count({ where: { status: 'overdue' } });

  return {
    totalRevenue: Number(totalRevenue) || 0,
    pendingRevenue: Number(pendingRevenue) || 0,
    totalRecords: count,
    paidCount,
    overdueCount,
  };
};

/**
 * Get all payments for a given fee record.
 */
const getFeePayments = async (feeId) => {
  const fee = await Fee.findByPk(feeId);
  if (!fee) throw new Error('Fee record not found');
  const payments = await Payment.findAll({
    where: { feeId },
    order: [['paymentDate', 'DESC']],
  });
  return { fee, payments };
};

module.exports = { getFeeStats, getFeePayments };
