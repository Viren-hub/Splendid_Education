const bcrypt = require('bcryptjs');
const { validationResult } = require('express-validator');
const Enrollment = require('../models/Enrollment');
const Student = require('../models/Student');
const User = require('../models/User');
const Fee = require('../models/Fee');
const BatchStudent = require('../models/BatchStudent');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');

const CLASS_TO_GRADE = {
  '3rd Class': '3rd', '4th Class': '4th', '5th Class': '5th',
  '6th Class': '6th', '7th Class': '7th', '8th Class': '8th',
  '9th Class': '9th', '10th Class (SSC)': '10th', '10th Class': '10th',
  '11th Class': '11th', '12th Class': '12th',
};

function generateTempPassword() {
  return 'Splendid@' + String(Math.floor(1000 + Math.random() * 9000));
}

const studentInclude = {
  model: Student, as: 'student', attributes: ['studentId'],
  include: [{ model: User, as: 'user', attributes: ['name', 'email'] }],
};

const getAllEnrollments = async (req, res, next) => {
  try {
    const { status, page = '1', limit = '20' } = req.query;
    const where = status ? { paymentStatus: status } : {};
    const total = await Enrollment.count({ where });
    const data = await Enrollment.findAll({
      where,
      include: [studentInclude],
      order: [['createdAt', 'DESC']],
      offset: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit),
    });
    res.status(200).json({ success: true, total, pages: Math.ceil(total / parseInt(limit)), count: data.length, data });
  } catch (error) { next(error); }
};

const getEnrollmentById = async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findByPk(req.params.id, { include: [studentInclude] });
    if (!enrollment) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    res.status(200).json({ success: true, data: enrollment });
  } catch (error) { next(error); }
};

const createEnrollment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { studentId, courseId, enrollmentDate, notes } = req.body;
    const enrollment = await Enrollment.create({
      studentId, courseId, enrollmentDate: enrollmentDate || new Date(),
      status: 'pending', notes,
    });
    res.status(201).json({ success: true, data: enrollment });
  } catch (error) { next(error); }
};

const updateEnrollmentStatus = async (req, res, next) => {
  try {
    const { status, notes } = req.body;
    const update = {
      status,
      ...(notes !== undefined && { notes }),
      ...(status === 'confirmed' && { confirmedBy: req.user.id }),
      ...(status === 'rejected' && { rejectedBy: req.user.id }),
    };
    const [updated] = await Enrollment.update(update, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    const enrollment = await Enrollment.findByPk(req.params.id, { include: [studentInclude] });
    res.status(200).json({ success: true, data: enrollment });
  } catch (error) { next(error); }
};

const deleteEnrollment = async (req, res, next) => {
  try {
    const deleted = await Enrollment.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    res.status(200).json({ success: true, message: 'Enrollment deleted' });
  } catch (error) { next(error); }
};

// ── Public / student-facing functions ────────────────────────────────────────

const submitEnrollment = async (req, res, next) => {
  try {
    const { studentName, email, phone, className, courseId, courseFee, ...rest } = req.body;
    if (!studentName || !email || !phone || !className) {
      return res.status(400).json({ success: false, message: 'studentName, email, phone and className are required' });
    }
    const enrollment = await Enrollment.create({
      studentName, email, phone, className, courseId: courseId || null,
      courseFee: courseFee || 0, ...rest, paymentStatus: 'pending_payment',
    });
    res.status(201).json({ success: true, data: { id: enrollment.id, paymentStatus: enrollment.paymentStatus } });
  } catch (error) { next(error); }
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const submitUTR = async (req, res, next) => {
  try {
    const { utrNumber } = req.body;
    if (!UUID_RE.test(req.params.id)) {
      return res.status(400).json({ success: false, message: 'Invalid enrollment reference. Please restart the enrollment process.' });
    }
    if (!utrNumber) return res.status(400).json({ success: false, message: 'UTR number is required' });
    const [updated] = await Enrollment.update(
      { utrNumber, utrEnteredBy: 'applicant', utrSubmittedAt: new Date(), paymentStatus: 'utr_submitted' },
      { where: { id: req.params.id, paymentStatus: 'pending_payment' } }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Enrollment not found or already processed' });
    res.status(200).json({ success: true, message: 'UTR submitted successfully' });
  } catch (error) { next(error); }
};

const getEnrollmentStatus = async (req, res, next) => {
  try {
    const enrollment = await Enrollment.findByPk(req.params.id, {
      attributes: ['id', 'studentName', 'paymentStatus', 'rejectionReason', 'createdAt'],
    });
    if (!enrollment) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    res.status(200).json({ success: true, data: enrollment });
  } catch (error) { next(error); }
};

// ── Admin-only functions ──────────────────────────────────────────────────────

const adminEnterUTR = async (req, res, next) => {
  try {
    const { utrNumber } = req.body;
    if (!utrNumber) return res.status(400).json({ success: false, message: 'UTR number is required' });
    const [updated] = await Enrollment.update(
      { utrNumber, utrEnteredBy: 'admin', utrSubmittedAt: new Date(), paymentStatus: 'utr_submitted' },
      { where: { id: req.params.id } }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    const enrollment = await Enrollment.findByPk(req.params.id, { include: [studentInclude] });
    res.status(200).json({ success: true, data: enrollment });
  } catch (error) { next(error); }
};

const confirmEnrollment = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const enrollment = await Enrollment.findByPk(req.params.id, { transaction: t });
    if (!enrollment) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Enrollment not found' });
    }

    // Idempotency: already confirmed and student exists
    if (enrollment.paymentStatus === 'payment_confirmed' && enrollment.studentId) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'This enrollment has already been confirmed and a student account exists.' });
    }

    // ── 1. Create or find the User account ─────────────────────────────
    let user = await User.findOne({ where: { email: enrollment.email }, transaction: t });
    const tempPassword = generateTempPassword();
    if (!user) {
      const hashed = await bcrypt.hash(tempPassword, 10);
      user = await User.create({
        name: enrollment.studentName,
        email: enrollment.email,
        password: hashed,
        role: 'student',
        isActive: true,
      }, { transaction: t });
    }

    // ── 2. Create the Student profile ───────────────────────────────────
    const now = new Date();
    const yy  = String(now.getFullYear()).slice(-2);
    const mm  = String(now.getMonth() + 1);
    const seq = String((await Student.count({ transaction: t })) + 1).padStart(4, '0');
    const generatedStudentId = `SE${yy}${mm}G${seq}`;

    const student = await Student.create({
      userId:           user.id,
      studentId:        generatedStudentId,
      phone:            enrollment.phone,
      address:          enrollment.address     || null,
      dateOfBirth:      enrollment.dateOfBirth || null,
      contactEmail:     enrollment.email,
      parentName:       enrollment.parentName  || null,
      parentPhone:      enrollment.parentPhone || null,
      emergencyContact: enrollment.emergencyContactName || null,
      grade:            CLASS_TO_GRADE[enrollment.className] || 'N/A',
      academicYear:     `${now.getFullYear()}-${String(now.getFullYear() + 1).slice(-2)}`,
      courseId:         enrollment.courseId || null,
      feeStatus:        'pending',
      enrollmentDate:   now,
      isActive:         true,
    }, { transaction: t });

    // ── 3. Create Fee record ────────────────────────────────────────────
    const { courseFee = 0, amountPaid = 0, dueDate } = req.body;
    const totalFee  = parseFloat(courseFee)  || parseFloat(enrollment.courseFee) || 0;
    const paid      = parseFloat(amountPaid) || 0;
    const feeStatus = paid >= totalFee && totalFee > 0 ? 'paid'
                    : paid > 0                          ? 'partial'
                    :                                    'pending';

    await Fee.create({
      studentId: student.id,
      courseId:  enrollment.courseId || null,
      totalFee,
      amountPaid: paid,
      dueDate:   dueDate || null,
      status:    feeStatus,
    }, { transaction: t });

    // Keep Student.feeStatus in sync
    await student.update({ feeStatus }, { transaction: t });

    // ── 4. Optionally assign to a batch ─────────────────────────────────
    if (req.body.batchId) {
      await BatchStudent.create({ batchId: req.body.batchId, studentId: student.id }, { transaction: t });
    }

    // ── 5. Update the enrollment ────────────────────────────────────────
    await enrollment.update({
      paymentStatus: 'payment_confirmed',
      confirmedBy:   req.user.id,
      confirmedAt:   now,
      adminNote:     req.body.adminNote || null,
      studentId:     student.id,
    }, { transaction: t });

    await t.commit();

    res.status(200).json({
      success: true,
      message: `Enrollment confirmed. Student account created (ID: ${generatedStudentId}).`,
      data: {
        studentName:  enrollment.studentName,
        email:        enrollment.email,
        studentId:    generatedStudentId,
        tempPassword,
        feeStatus,
      },
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

const rejectEnrollment = async (req, res, next) => {
  try {
    const [updated] = await Enrollment.update(
      { paymentStatus: 'rejected', rejectedBy: req.user.id, rejectedAt: new Date(), rejectionReason: req.body.rejectionReason || req.body.reason || null },
      { where: { id: req.params.id } }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    const enrollment = await Enrollment.findByPk(req.params.id, { include: [studentInclude] });
    res.status(200).json({ success: true, data: enrollment });
  } catch (error) { next(error); }
};

const reopenEnrollment = async (req, res, next) => {
  try {
    const [updated] = await Enrollment.update(
      { paymentStatus: 'pending_payment', rejectionReason: null, adminNote: null },
      { where: { id: req.params.id } }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    const enrollment = await Enrollment.findByPk(req.params.id, { include: [studentInclude] });
    res.status(200).json({ success: true, data: enrollment });
  } catch (error) { next(error); }
};

module.exports = {
  getAllEnrollments, getEnrollmentById, createEnrollment, updateEnrollmentStatus, deleteEnrollment,
  submitEnrollment, submitUTR, getEnrollmentStatus, adminEnterUTR, confirmEnrollment, rejectEnrollment, reopenEnrollment,
};
