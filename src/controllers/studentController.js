const bcrypt = require('bcryptjs');
const Student = require('../models/Student');
const User = require('../models/User');
const Batch = require('../models/Batch');
const BatchStudent = require('../models/BatchStudent');
const Course = require('../models/Course');
const Fee = require('../models/Fee');
const Payment = require('../models/Payment');
const Attendance = require('../models/Attendance');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { validationResult } = require('express-validator');

const fullInclude = [
  { model: User, as: 'user', attributes: { exclude: ['password'] } },
  { model: Course, as: 'course', attributes: ['id', 'title'] },
  {
    model: Batch, as: 'enrolledBatches', through: { attributes: [] },
    include: [{ model: Course, as: 'course', attributes: ['title'] }],
  },
];

const getAllStudents = async (req, res, next) => {
  try {
    const { search, isActive, page = '1', limit = '20' } = req.query;
    const where = { isActive: true };
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const students = await Student.findAll({
      where: { isActive: true },
      include: [
        {
          model: User, as: 'user', attributes: { exclude: ['password'] },
          ...(search ? { where: userWhere, required: false } : {}),
        },
        { model: Batch, as: 'enrolledBatches', through: { attributes: [] } },
      ],
      order: [[{ model: User, as: 'user' }, 'name', 'ASC']],
      offset: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit),
    });

    // Filter in JS for OR across student ID + user name/email
    const filtered = search
      ? students.filter(s => {
          const q = search.toLowerCase();
          return (
            (s.studentId || '').toLowerCase().includes(q) ||
            (s.user?.name || '').toLowerCase().includes(q) ||
            (s.user?.email || '').toLowerCase().includes(q) ||
            (s.contactEmail || '').toLowerCase().includes(q)
          );
        })
      : students;

    res.status(200).json({ success: true, total: filtered.length, count: filtered.length, data: filtered });
  } catch (error) { next(error); }
};

const getStudentById = async (req, res, next) => {
  try {
    const student = await Student.findByPk(req.params.id, { include: fullInclude });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });
    res.status(200).json({ success: true, data: student });
  } catch (error) { next(error); }
};

const getMyProfile = async (req, res, next) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id }, include: fullInclude });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
    res.status(200).json({ success: true, data: student });
  } catch (error) { next(error); }
};

const createStudent = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const {
      name, password, phone, address, dateOfBirth, parentName, parentPhone,
      emergencyContact, emergencyContactRelation, grade, academicYear, courseId, enrollmentDate,
    } = req.body;
    const batchId = req.body.batchId || null;

    // Derive batch letter from the assigned batch name (first A-Z letter found), default 'X'
    let batchLetter = 'X';
    if (batchId) {
      const batch = await Batch.findByPk(batchId, { attributes: ['batchName'] });
      if (batch) {
        const match = batch.batchName.match(/[A-Z]/i);
        if (match) batchLetter = match[0].toUpperCase();
      }
    }

    // Generate Student ID: SE + YY + MM + batchLetter + 4-digit random number
    // Format: SE2603A6217
    const now = new Date();
    const year  = now.getFullYear().toString().slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const rand  = String(Math.floor(1000 + Math.random() * 9000));
    let studentId = `SE${year}${month}${batchLetter}${rand}`;

    // Ensure uniqueness (retry up to 5 times if collision)
    for (let i = 0; i < 5; i++) {
      const existing = await Student.findOne({ where: { studentId } });
      if (!existing) break;
      studentId = `SE${year}${month}${batchLetter}${String(Math.floor(1000 + Math.random() * 9000))}`;
    }

    // contactEmail is optional — siblings can share parent details without needing a unique email
    let email = (req.body.contactEmail || req.body.email || '').trim().toLowerCase();
    if (!email) email = `${studentId.toLowerCase()}@internal.local`;

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) return res.status(400).json({ success: false, message: `Email "${email}" is already linked to another account. Use a different email or leave it blank to auto-assign one.` });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { user, student } = await sequelize.transaction(async (t) => {
      const user = await User.create({ name, email, password: hashedPassword, role: 'student' }, { transaction: t });
      const student = await Student.create({
        userId: user.id, studentId, phone, address,
        dateOfBirth: dateOfBirth || null,
        parentName, parentPhone, emergencyContact, emergencyContactRelation: emergencyContactRelation || null,
        grade, academicYear, courseId: courseId || null,
        enrollmentDate: enrollmentDate || new Date(),
      }, { transaction: t });
      if (batchId) {
        await BatchStudent.create({ studentId: student.id, batchId }, { transaction: t }).catch(() => {});
      }
      // Auto-create fee record
      const courseFee = courseId ? (await Course.findByPk(courseId, { attributes: ['fee'], transaction: t }))?.fee || 0 : 0;
      await Fee.create({
        studentId: student.id,
        courseId: courseId || null,
        totalFee: req.body.totalFee || 0,
        amountPaid: 0,
        discount: 0,
        status: 'pending',
      }, { transaction: t });
      return { user, student };
    });

    const full = await Student.findByPk(student.id, { include: fullInclude });
    res.status(201).json({ success: true, data: full });
  } catch (error) { next(error); }
};

const updateStudent = async (req, res, next) => {
  try {
    const {
      phone, address, dateOfBirth, parentName, parentPhone,
      emergencyContact, emergencyContactRelation, grade, academicYear, isActive, courseId,
    } = req.body;

    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    await Student.update(
      { phone, address, dateOfBirth: dateOfBirth || null, parentName, parentPhone,
        emergencyContact, emergencyContactRelation: emergencyContactRelation ?? null, grade, academicYear, isActive,
        courseId: courseId !== undefined ? courseId : student.courseId },
      { where: { id: req.params.id } }
    );

    // Also update user name/email/isActive if provided
    if (req.body.name || req.body.email || isActive !== undefined) {
      const userUpdate = {};
      if (req.body.name)      userUpdate.name     = req.body.name;
      if (req.body.email)     userUpdate.email    = req.body.email;
      if (isActive !== undefined) userUpdate.isActive = isActive;
      await User.update(userUpdate, { where: { id: student.userId } });
    }

    const updated = await Student.findByPk(req.params.id, { include: fullInclude });
    res.status(200).json({ success: true, data: updated });
  } catch (error) { next(error); }
};

const deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Soft-archive: mark student inactive and disable login
    await Student.update({ isActive: false }, { where: { id: req.params.id } });
    await User.update({ isActive: false }, { where: { id: student.userId } });

    // Remove student from all batch enrollments
    await BatchStudent.destroy({ where: { studentId: req.params.id } });

    // Remove student from all attendance JSONB records
    await sequelize.query(
      `UPDATE attendances
       SET records = (
         SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
         FROM jsonb_array_elements(records) AS elem
         WHERE elem->>'studentId' != :studentId
       )
       WHERE records @> jsonb_build_array(jsonb_build_object('studentId', :studentId::text))`,
      { replacements: { studentId: req.params.id }, type: sequelize.QueryTypes.UPDATE }
    );

    res.status(200).json({ success: true, message: 'Student archived successfully' });
  } catch (error) { next(error); }
};

// Alias used by student self-service routes
const getMe = getMyProfile;

const getStudentHistory = async (req, res, next) => {
  try {
    const { search, year, month, grade, page = '1', limit = '50' } = req.query;
    const where = { isActive: false };
    const userWhere = {};
    if (search) userWhere.name = { [Op.iLike]: `%${search}%` };
    if (grade)  where.grade = grade;
    if (year)   where.academicYear = year;
    if (month) {
      const m = parseInt(month);
      where.enrollmentDate = {
        [Op.and]: [
          sequelize.where(sequelize.fn('EXTRACT', sequelize.literal('MONTH FROM "Student"."enrollment_date"')), m),
        ],
      };
    }
    const countOptions = { where };
    if (Object.keys(userWhere).length) countOptions.include = [{ model: User, as: 'user', where: userWhere }];
    const total = await Student.count(countOptions);
    const students = await Student.findAll({
      where,
      include: [
        { model: User, as: 'user', attributes: { exclude: ['password'] }, where: Object.keys(userWhere).length ? userWhere : undefined },
      ],
      order: [[{ model: User, as: 'user' }, 'name', 'ASC']],
      offset: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit),
    });
    res.status(200).json({ success: true, total, data: students });
  } catch (error) { next(error); }
};

const getStudentOverview = async (req, res, next) => {
  try {
    const student = await Student.findByPk(req.params.id, { include: fullInclude });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Get fees
    const fees = await Fee.findAll({ where: { studentId: req.params.id } });
    const totalFee = fees.reduce((s, f) => s + parseFloat(f.totalFee || 0), 0);
    const amountPaid = fees.reduce((s, f) => s + parseFloat(f.amountPaid || 0), 0);

    // Get attendance — filter at DB level to avoid loading all sessions
    const attendanceRecords = await Attendance.findAll({
      where: { records: { [Op.contains]: [{ studentId: req.params.id }] } },
      attributes: ['records'],
    });
    let attendanceTotal = 0;
    let attendancePresent = 0;

    attendanceRecords.forEach(record => {
      const studentRecord = (record.records || []).find(r => r.studentId === req.params.id);
      if (studentRecord) {
        attendanceTotal++;
        if (studentRecord.status === 'present' || studentRecord.status === 'late') {
          attendancePresent++;
        }
      }
    });

    res.status(200).json({
      success: true,
      data: {
        student,
        financials: { totalFee, amountPaid, balance: totalFee - amountPaid },
        attendance: { total: attendanceTotal, present: attendancePresent, percentage: attendanceTotal ? Math.round((attendancePresent / attendanceTotal) * 100) : 0 },
      },
    });
  } catch (error) { next(error); }
};

const resetStudentPassword = async (req, res, next) => {
  try {
    const student = await Student.findByPk(req.params.id);
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters' });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(newPassword, salt);
    await User.update({ password: hashed }, { where: { id: student.userId } });

    res.status(200).json({ success: true, message: 'Password reset successfully' });
  } catch (error) { next(error); }
};

const getUpcomingClasses = async (req, res, next) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

    const batches = await Batch.findAll({
      include: [
        { model: Course, as: 'course', attributes: ['title'] },
        { model: Student, as: 'students', through: { attributes: [] }, where: { id: student.id }, required: true },
      ],
      where: { isActive: true, endDate: { [Op.gte]: new Date() } },
      order: [['startDate', 'ASC']],
    });

    const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Normalise a day string to its first 3 chars lowercase for comparison ("Monday"→"mon", "Mon"→"mon")
    const normaliseDay = d => d.trim().toLowerCase().slice(0, 3);

    // Expand each batch's weekly schedule into concrete dates for the next 14 days
    const sessions = [];
    for (const batch of batches) {
      const scheduledDays = batch.schedule?.days || [];   // e.g. ["Mon","Wed"] or ["Monday","Wednesday"]
      const time          = batch.schedule?.time || '';
      const batchStart    = new Date(batch.startDate);
      batchStart.setHours(0, 0, 0, 0);
      const batchEnd      = batch.endDate ? new Date(batch.endDate) : null;

      const normalisedScheduledDays = scheduledDays.map(normaliseDay);

      for (let offset = 0; offset < 14; offset++) {
        const d = new Date(today);
        d.setDate(d.getDate() + offset);
        if (d < batchStart) continue;
        if (batchEnd && d > batchEnd) continue;

        const dayName = DAY_NAMES[d.getDay()];
        if (normalisedScheduledDays.includes(normaliseDay(dayName))) {
          sessions.push({
            batchId:    batch.id,
            batchName:  batch.batchName,
            courseName: batch.course?.title || batch.batchName,
            day:        dayName,
            date:       d.toISOString(),
            time,
          });
        }
      }
    }

    // Sort chronologically
    sessions.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json({ success: true, data: sessions });
  } catch (error) { next(error); }
};

module.exports = {
  getAllStudents, getStudentById, getMyProfile, getMe,
  createStudent, updateStudent, deleteStudent,
  getStudentHistory, getStudentOverview, resetStudentPassword, getUpcomingClasses,
};
