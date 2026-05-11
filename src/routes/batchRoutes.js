const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');
const BatchStudent = require('../models/BatchStudent');
const Student = require('../models/Student');
const User = require('../models/User');
const Course = require('../models/Course');
const { protect, authorize } = require('../middleware/auth');
const { Op } = require('sequelize');

const courseInclude = { model: Course, as: 'course', attributes: ['title', 'duration', 'fee'] };
const instructorInclude = { model: User, as: 'instructor', attributes: ['name', 'email'] };
const studentsInclude = {
  model: Student, as: 'students', through: { attributes: [] },
  include: [{ model: User, as: 'user', attributes: ['name', 'email'] }],
};

// GET /api/batches  — all batches (public: active only; admin: all)
router.get('/', protect, async (req, res, next) => {
  try {
    const where = req.user.role !== 'admin' ? { isActive: true } : {};
    const batches = await Batch.findAll({
      where,
      include: [courseInclude, instructorInclude],
      order: [['startDate', 'ASC']],
    });
    // Attach enrolled student count to each batch
    const result = await Promise.all(batches.map(async b => {
      const enrolledCount = await BatchStudent.count({ where: { batchId: b.id } });
      return { ...b.toJSON(), enrolledCount };
    }));

    res.status(200).json({ success: true, count: result.length, data: result });
  } catch (error) { next(error); }
});

// GET /api/batches/:id
router.get('/:id', protect, async (req, res, next) => {
  try {
    const batch = await Batch.findByPk(req.params.id, {
      include: [courseInclude, instructorInclude, studentsInclude],
    });
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    res.status(200).json({ success: true, data: batch });
  } catch (error) { next(error); }
});

// POST /api/batches  — admin create
router.post('/', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { batchName, courseId, instructorId, startDate, endDate, schedule, maxCapacity, allowedGrades } = req.body;
    const batch = await Batch.create({ batchName, courseId, instructorId, startDate, endDate, schedule, maxCapacity, allowedGrades: allowedGrades || [] });
    const full = await Batch.findByPk(batch.id, { include: [courseInclude, instructorInclude] });
    res.status(201).json({ success: true, data: full });
  } catch (error) { next(error); }
});

// PUT /api/batches/:id  — admin update
router.put('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { batchName, courseId, instructorId, startDate, endDate, schedule, maxCapacity, isActive, allowedGrades } = req.body;
    const updateData = { batchName, courseId, instructorId, startDate, endDate, schedule, maxCapacity, isActive };
    if (allowedGrades !== undefined) updateData.allowedGrades = allowedGrades;
    const [updated] = await Batch.update(updateData, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ success: false, message: 'Batch not found' });
    const batch = await Batch.findByPk(req.params.id, { include: [courseInclude, instructorInclude] });
    res.status(200).json({ success: true, data: batch });
  } catch (error) { next(error); }
});

// DELETE /api/batches/:id  — admin delete (permanent)
router.delete('/:id', protect, authorize('admin'), async (req, res, next) => {
  try {
    const batch = await Batch.findByPk(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });
    // Remove all student enrollments first, then delete the batch
    await BatchStudent.destroy({ where: { batchId: req.params.id } });
    await batch.destroy();
    res.status(200).json({ success: true, message: 'Batch deleted permanently' });
  } catch (error) { next(error); }
});

// POST /api/batches/:id/enroll  — enroll student(s) in batch
router.post('/:id/enroll', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { studentIds } = req.body;
    if (!studentIds || !studentIds.length)
      return res.status(400).json({ success: false, message: 'studentIds required' });

    const batch = await Batch.findByPk(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

    const results = [];
    for (const sid of studentIds) {
      const [record, created] = await BatchStudent.findOrCreate({ where: { batchId: batch.id, studentId: sid } });
      results.push({ studentId: sid, enrolled: created });
    }
    res.status(200).json({ success: true, data: results });
  } catch (error) { next(error); }
});

// DELETE /api/batches/:id/unenroll  — remove student from batch
router.delete('/:id/unenroll', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { studentId } = req.body;
    const deleted = await BatchStudent.destroy({ where: { batchId: req.params.id, studentId } });
    if (!deleted) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    res.status(200).json({ success: true, message: 'Student removed from batch' });
  } catch (error) { next(error); }
});

// POST /api/batches/:id/students  — assign a single student (one-batch-per-student)
router.post('/:id/students', protect, authorize('admin'), async (req, res, next) => {
  try {
    const { studentId } = req.body;
    if (!studentId) return res.status(400).json({ success: false, message: 'studentId required' });

    const batch = await Batch.findByPk(req.params.id);
    if (!batch) return res.status(404).json({ success: false, message: 'Batch not found' });

    // Enforce: student can only be in one batch at a time
    const existing = await BatchStudent.findOne({ where: { studentId } });
    if (existing && existing.batchId !== batch.id) {
      const existingBatch = await Batch.findByPk(existing.batchId, { attributes: ['batchName'] });
      const batchName = existingBatch?.batchName || 'another batch';
      return res.status(409).json({ success: false, message: `Student is already assigned to "${batchName}". Remove them from that batch first.` });
    }

    await BatchStudent.findOrCreate({ where: { batchId: batch.id, studentId } });
    res.status(200).json({ success: true, message: 'Student assigned to batch' });
  } catch (error) { next(error); }
});

// DELETE /api/batches/:id/students/:studentId  — remove a single student
router.delete('/:id/students/:studentId', protect, authorize('admin'), async (req, res, next) => {
  try {
    const deleted = await BatchStudent.destroy({
      where: { batchId: req.params.id, studentId: req.params.studentId },
    });
    if (!deleted) return res.status(404).json({ success: false, message: 'Enrollment not found' });
    res.status(200).json({ success: true, message: 'Student removed from batch' });
  } catch (error) { next(error); }
});

module.exports = router;
