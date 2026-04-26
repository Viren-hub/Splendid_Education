const Attendance = require('../models/Attendance');
const Batch = require('../models/Batch');
const Student = require('../models/Student');
const User = require('../models/User');
const BatchStudent = require('../models/BatchStudent');
const StudentSession = require('../models/StudentSession');
const { Op } = require('sequelize');
const { validationResult } = require('express-validator');
const attendanceService = require('../services/attendanceService');
const { sendWhatsApp } = require('../services/whatsappService');

const batchInclude = { model: Batch, as: 'batch', attributes: ['batchName'] };
const markerInclude = { model: User, as: 'marker', attributes: ['name'] };

// POST /api/attendance  (mark attendance for a batch session — upserts if already exists)
const markAttendance = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { batch, batchId: batchIdBody, date, subject, records } = req.body;
    const batchId = batch || batchIdBody;

    // Normalise records: accept both {student, status} and {studentId, status}
    const normRecords = (records || []).map((r) => ({
      studentId: r.studentId || r.student,
      status: r.status,
    }));

    // Upsert: if attendance already exists for this batch+date, update it
    const existing = await Attendance.findOne({ where: { batchId, date } });
    if (existing) {
      await existing.update({ records: normRecords, subject, markedBy: req.user.id });
      return res.status(200).json({ success: true, updated: true, data: existing });
    }

    const attendance = await Attendance.create({
      batchId, date, subject,
      instructorId: req.user.id,
      records: normRecords,
      markedBy: req.user.id,
    });
    res.status(201).json({ success: true, updated: false, data: attendance });
  } catch (error) { next(error); }
};

// PUT /api/attendance/:id
const updateAttendance = async (req, res, next) => {
  try {
    const { records, subject } = req.body;
    const [updated] = await Attendance.update({ records, subject }, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ success: false, message: 'Attendance record not found' });
    const record = await Attendance.findByPk(req.params.id, { include: [batchInclude] });
    res.status(200).json({ success: true, data: record });
  } catch (error) { next(error); }
};

// GET /api/attendance/student/me  (student's own summary)
const getMyAttendance = async (req, res, next) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

    const { month, year, batchId } = req.query;
    const summary = await attendanceService.getStudentAttendanceSummary(student.id, { month, year, batchId });
    res.status(200).json({ success: true, data: summary });
  } catch (error) { next(error); }
};

// GET /api/attendance/student/:studentId  (admin)
const getStudentAttendance = async (req, res, next) => {
  try {
    const { month, year, batchId } = req.query;
    const summary = await attendanceService.getStudentAttendanceSummary(req.params.studentId, { month, year, batchId });
    res.status(200).json({ success: true, data: summary });
  } catch (error) { next(error); }
};

const getBatchAttendance = async (req, res, next) => {
  try {
    const { page = '1', limit = '20' } = req.query;
    const where = { batchId: req.params.batchId };
    const total = await Attendance.count({ where });
    const records = await Attendance.findAll({
      where, include: [batchInclude, markerInclude],
      order: [['date', 'DESC']],
      offset: (parseInt(page) - 1) * parseInt(limit),
      limit: parseInt(limit),
    });

    // Collect all unique student UUIDs across all sessions to fetch names in one query
    const allStudentIds = [...new Set(
      records.flatMap(r => (r.records || []).map(rec => rec.studentId)).filter(Boolean)
    )];
    const studentMap = {};
    if (allStudentIds.length) {
      const students = await Student.findAll({
        where: { id: allStudentIds },
        attributes: ['id', 'studentId'],
        include: [{ model: User, as: 'user', attributes: ['name'] }],
      });
      students.forEach(s => { studentMap[s.id] = s; });
    }

    // Enrich each session's JSONB records with student name
    const enriched = records.map(r => ({
      ...r.toJSON(),
      records: (r.records || []).map(rec => ({
        ...rec,
        student: studentMap[rec.studentId]
          ? { studentId: studentMap[rec.studentId].studentId, user: { name: studentMap[rec.studentId].user?.name } }
          : { studentId: rec.studentId, user: { name: null } },
      })),
    }));

    res.status(200).json({ success: true, total, pages: Math.ceil(total / parseInt(limit)), count: enriched.length, data: enriched });
  } catch (error) { next(error); }
};

// POST /api/attendance/session/check-in  (student marks themselves present)
const studentCheckIn = async (req, res, next) => {
  try {
    const student = await Student.findOne({
      where: { userId: req.user.id },
      include: [{ model: User, as: 'user', attributes: ['name'] }],
    });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });
    if (!student.isActive) return res.status(403).json({ success: false, message: 'Your account is not active' });

    const today = new Date().toISOString().slice(0, 10);

    // Prevent duplicate check-in for today
    const existing = await StudentSession.findOne({
      where: { studentId: student.id, date: today },
    });
    if (existing) {
      return res.status(200).json({ success: true, alreadyCheckedIn: true, data: existing });
    }

    const session = await StudentSession.create({
      studentId: student.id,
      date: today,
      checkInAt: new Date(),
    });

    // Upsert attendance record marking this student present
    const batchStudents = await BatchStudent.findAll({ where: { studentId: student.id } });
    if (batchStudents.length > 0) {
      const batchId = batchStudents[0].batchId;
      const atExisting = await Attendance.findOne({ where: { batchId, date: today } });
      if (atExisting) {
        const records = atExisting.records || [];
        const idx = records.findIndex(r => r.studentId === student.id);
        if (idx === -1) records.push({ studentId: student.id, status: 'present' });
        else records[idx].status = 'present';
        await atExisting.update({ records });
      } else {
        await Attendance.create({
          batchId, date: today,
          records: [{ studentId: student.id, status: 'present' }],
          markedBy: req.user.id,
        });
      }
    }

    // WhatsApp notify parent
    const parentPhone = student.parentPhone;
    const studentName = student.user?.name || 'Your child';
    const checkInTime = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    if (parentPhone) {
      const msg = `✅ *Splendid Education*\n\nDear Parent,\n*${studentName}* has checked in to class today at *${checkInTime}*.\n\nHave a great learning session! 🎓`;
      await sendWhatsApp(parentPhone, msg);
      await session.update({ notifiedParentIn: true });
    }

    res.status(201).json({ success: true, data: session });
  } catch (error) { next(error); }
};

// POST /api/attendance/session/check-out  (student logs out)
const studentCheckOut = async (req, res, next) => {
  try {
    const student = await Student.findOne({
      where: { userId: req.user.id },
      include: [{ model: User, as: 'user', attributes: ['name'] }],
    });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

    const today = new Date().toISOString().slice(0, 10);
    const session = await StudentSession.findOne({
      where: { studentId: student.id, date: today, checkOutAt: null },
    });
    if (!session) return res.status(404).json({ success: false, message: 'No active check-in found for today' });

    const checkOutAt = new Date();
    const durationMinutes = Math.round((checkOutAt - new Date(session.checkInAt)) / 60000);
    await session.update({ checkOutAt, durationMinutes });

    // WhatsApp notify parent
    const parentPhone = student.parentPhone;
    const studentName = student.user?.name || 'Your child';
    const checkOutTime = checkOutAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
    const hours = Math.floor(durationMinutes / 60);
    const mins  = durationMinutes % 60;
    const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    if (parentPhone) {
      const msg = `👋 *Splendid Education*\n\nDear Parent,\n*${studentName}* has checked out of class at *${checkOutTime}*.\nTotal time in class: *${durationStr}*.\n\nGreat work today! 🌟`;
      await sendWhatsApp(parentPhone, msg);
      await session.update({ notifiedParentOut: true });
    }

    res.status(200).json({ success: true, data: session });
  } catch (error) { next(error); }
};

// GET /api/attendance/session/me  (get today's session for the logged-in student)
const getMySession = async (req, res, next) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ success: false, message: 'Student profile not found' });

    const today = new Date().toISOString().slice(0, 10);
    const session = await StudentSession.findOne({
      where: { studentId: student.id, date: today },
    });
    res.status(200).json({ success: true, data: session || null });
  } catch (error) { next(error); }
};

module.exports = { markAttendance, updateAttendance, getMyAttendance, getStudentAttendance, getBatchAttendance, studentCheckIn, studentCheckOut, getMySession };
