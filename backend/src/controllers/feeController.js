const Fee = require('../models/Fee');
const Payment = require('../models/Payment');
const Student = require('../models/Student');
const Course = require('../models/Course');
const User = require('../models/User');
const { Op, literal } = require('sequelize');
const { validationResult } = require('express-validator');

const studentInclude = {
  model: Student, as: 'student', attributes: ['studentId'],
  include: [{ model: User, as: 'user', attributes: ['name', 'email'] }],
};
const courseInclude = { model: Course, as: 'course', attributes: ['title'] };
const paymentsInclude = { model: Payment, as: 'payments' };

/**
 * Auto-sync: recalculate & persist status for every fee record.
 * Throttled to run at most once per 60 seconds across all requests.
 */
let _feeStatusLastSync = 0;
const SYNC_THROTTLE_MS = 60_000;

const syncFeeStatuses = async () => {
  const now = Date.now();
  if (now - _feeStatusLastSync < SYNC_THROTTLE_MS) return;
  _feeStatusLastSync = now;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const fees = await Fee.findAll({
    attributes: ['id', 'studentId', 'totalFee', 'discount', 'amountPaid', 'dueDate', 'status'],
  });

  for (const fee of fees) {
    const total     = parseFloat(fee.totalFee   || 0);
    const discount  = parseFloat(fee.discount   || 0);
    const paid      = parseFloat(fee.amountPaid || 0);
    const effective = total - discount;
    const overdue   = fee.dueDate && new Date(fee.dueDate) < today;

    let correct;
    if (paid >= effective && effective > 0) {
      correct = 'paid';
    } else if (overdue && paid < effective) {
      correct = 'overdue';
    } else if (paid > 0) {
      correct = 'partial';
    } else {
      correct = 'pending';
    }

    if (fee.status !== correct) {
      await Fee.update({ status: correct }, { where: { id: fee.id } });
      const studentStatus = correct === 'paid' ? 'paid' : correct === 'partial' ? 'partial' : 'pending';
      await Student.update({ feeStatus: studentStatus }, { where: { id: fee.studentId } });
    }
  }
};

const getAllFees = async (req, res, next) => {
  try {
    await syncFeeStatuses();

    const { status, page = '1' } = req.query;
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 100);
    // Exclude fees belonging to archived (inactive) students
    const where = { studentId: { [Op.in]: literal(`(SELECT id FROM students WHERE is_active = true)`) } };
    if (status) where.status = status;
    const total = await Fee.count({ where });
    const fees = await Fee.findAll({
      where,
      include: [studentInclude, courseInclude, paymentsInclude],
      order: [
        literal(`CASE "Fee"."status" WHEN 'overdue' THEN 1 WHEN 'pending' THEN 2 WHEN 'partial' THEN 3 WHEN 'paid' THEN 4 ELSE 5 END`),
        [{ model: Student, as: 'student' }, { model: User, as: 'user' }, 'name', 'ASC'],
      ],
      offset: (parseInt(page) - 1) * limit,
      limit,
    });
    res.status(200).json({ success: true, total, pages: Math.ceil(total / parseInt(limit)), count: fees.length, data: fees });
  } catch (error) { next(error); }
};

const getFeeById = async (req, res, next) => {
  try {
    const fee = await Fee.findByPk(req.params.id, {
      include: [studentInclude, courseInclude, paymentsInclude],
    });
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });
    res.status(200).json({ success: true, data: fee });
  } catch (error) { next(error); }
};

const getMyFees = async (req, res, next) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
    const fee = await Fee.findOne({
      where: { studentId: student.id },
      include: [courseInclude, paymentsInclude],
    });
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });
    res.status(200).json({ success: true, data: fee });
  } catch (error) { next(error); }
};

const createFee = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { studentId, courseId, totalFee, amountPaid, discount, dueDate } = req.body;
    const existing = await Fee.findOne({ where: { studentId } });
    if (existing) return res.status(400).json({ success: false, message: 'Fee record already exists for this student' });
    const fee = await Fee.create({
      studentId, courseId: courseId || null,
      totalFee, amountPaid: amountPaid || 0,
      discount: discount || 0, dueDate,
    });
    res.status(201).json({ success: true, data: fee });
  } catch (error) { next(error); }
};

const updateFee = async (req, res, next) => {
  try {
    const id = req.params.feeId || req.params.id;
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const fee = await Fee.findByPk(id);
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });

    const { totalFee, discount, dueDate, status } = req.body;
    const newTotalFee = totalFee !== undefined ? parseFloat(totalFee) : parseFloat(fee.totalFee);
    const newDiscount = discount !== undefined ? parseFloat(discount) : parseFloat(fee.discount || 0);

    if (newDiscount > newTotalFee) {
      return res.status(400).json({ success: false, message: 'Discount cannot exceed total fee' });
    }

    const updates = { totalFee: newTotalFee, discount: newDiscount };
    if (dueDate !== undefined) updates.dueDate = dueDate || null;

    const VALID_FEE_STATUSES = ['pending', 'partial', 'paid', 'overdue', 'waived'];
    if (status) {
      if (!VALID_FEE_STATUSES.includes(status))
        return res.status(400).json({ success: false, message: `Invalid status. Must be one of: ${VALID_FEE_STATUSES.join(', ')}` });
      updates.status = status;
    } else {
      // Auto-recalculate status from current payments vs updated totals
      const amountPaid = parseFloat(fee.amountPaid || 0);
      const effective  = newTotalFee - newDiscount;
      updates.status   = amountPaid >= effective && effective > 0 ? 'paid'
                       : amountPaid > 0 ? 'partial'
                       : 'pending';
    }

    await Fee.update(updates, { where: { id } });
    const updated = await Fee.findByPk(id, {
      include: [studentInclude, courseInclude, paymentsInclude],
    });
    res.status(200).json({ success: true, data: updated });
  } catch (error) { next(error); }
};

const recordPayment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { amount, method, note } = req.body;
    const feeId = req.params.feeId || req.params.id;
    const fee = await Fee.findByPk(feeId);
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found' });

    // Create payment record
    const receiptNumber = 'RCP-' + Date.now();
    await Payment.create({
      feeId: fee.id,
      studentId: fee.studentId,
      amount, method: method || 'cash',
      paymentDate: new Date(),
      receiptNumber, note,
      recordedBy: req.user.id,
    });

    // Update fee totals
    const newPaid = Number(fee.amountPaid) + Number(amount);
    const effective = Number(fee.totalFee) - Number(fee.discount || 0);
    const status = newPaid >= effective ? 'paid' : newPaid > 0 ? 'partial' : 'pending';
    await Fee.update({ amountPaid: newPaid, status }, { where: { id: fee.id } });

    // Update student feeStatus
    const studentStatus = status === 'paid' ? 'paid' : status === 'partial' ? 'partial' : 'pending';
    await Student.update({ feeStatus: studentStatus }, { where: { id: fee.studentId } });

    const updated = await Fee.findByPk(fee.id, {
      include: [studentInclude, courseInclude, paymentsInclude],
    });
    res.status(200).json({ success: true, message: 'Payment recorded', data: updated });
  } catch (error) { next(error); }
};

const getFeeByStudent = async (req, res, next) => {
  try {
    const fee = await Fee.findOne({
      where: { studentId: req.params.studentId },
      include: [studentInclude, courseInclude, paymentsInclude],
    });
    if (!fee) return res.status(404).json({ success: false, message: 'Fee record not found for this student' });
    res.status(200).json({ success: true, data: fee });
  } catch (error) { next(error); }
};

const getMyFee = getMyFees;

const addPayment = async (req, res, next) => {
  req.params.id = req.params.feeId;
  return recordPayment(req, res, next);
};

const getPayments = async (req, res, next) => {
  try {
    const payments = await Payment.findAll({
      where: { feeId: req.params.feeId },
      include: [{ model: User, as: 'recorder', attributes: ['name'] }],
      order: [['paymentDate', 'DESC']],
    });
    res.status(200).json({ success: true, count: payments.length, data: payments });
  } catch (error) { next(error); }
};

const getFeeStats = async (req, res, next) => {
  try {
    await syncFeeStatuses();

    // Active students' fees (for pending/partial/overdue balances)
    const activeFees = await Fee.findAll({
      attributes: ['totalFee', 'amountPaid', 'discount', 'status'],
      where: { studentId: { [Op.in]: literal(`(SELECT id FROM students WHERE is_active = true)`) } },
    });

    // ALL fees including archived — to get true total collected (money already received)
    const allFees = await Fee.findAll({
      attributes: ['totalFee', 'amountPaid', 'discount', 'status'],
    });

    const statuses = ['paid', 'partial', 'pending', 'overdue'];

    // byStatus is based on active students only (actionable balances)
    const byStatus = statuses.map(s => {
      const group = activeFees.filter(f => f.status === s);
      return {
        status: s,
        count: group.length,
        totalAmount: group.reduce((sum, f) => sum + (parseFloat(f.totalFee || 0) - parseFloat(f.discount || 0)), 0),
        collected: group.reduce((sum, f) => sum + parseFloat(f.amountPaid || 0), 0),
      };
    });

    // Only fees with totalFee > 0 are meaningful for counts
    const activeFeeSet = activeFees.filter(f => parseFloat(f.totalFee || 0) > 0);

    const stats = {
      total: activeFeeSet.length,
      paid:    activeFeeSet.filter(f => f.status === 'paid').length,
      partial: activeFeeSet.filter(f => f.status === 'partial').length,
      pending: activeFeeSet.filter(f => f.status === 'pending').length,
      overdue: activeFeeSet.filter(f => f.status === 'overdue').length,
      byStatus,
      // totalRevenue = total billed to active students (net of discount)
      totalRevenue: activeFees.reduce((s, f) => s + Math.max(parseFloat(f.totalFee || 0) - parseFloat(f.discount || 0), 0), 0),
      // totalCollected = all money actually received (including from now-archived students)
      totalCollected: allFees.reduce((s, f) => s + parseFloat(f.amountPaid || 0), 0),
    };
    stats.outstanding = stats.totalRevenue - activeFees.reduce((s, f) => s + parseFloat(f.amountPaid || 0), 0);
    res.status(200).json({ success: true, data: stats });
  } catch (error) { next(error); }
};

module.exports = { getAllFees, getFeeById, getMyFees, createFee, updateFee, recordPayment, getFeeByStudent, getMyFee, addPayment, getPayments, getFeeStats };
