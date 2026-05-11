const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  markAttendance,
  updateAttendance,
  getBatchAttendance,
  getStudentAttendance,
  getMyAttendance,
  studentCheckIn,
  studentCheckOut,
  getMySession,
} = require('../controllers/attendanceController');

// Student self check-in / check-out / session
router.get('/session/me', protect, getMySession);
router.post('/session/check-in', protect, studentCheckIn);
router.post('/session/check-out', protect, studentCheckOut);

router.post(
  '/',
  protect,
  authorize('admin'),
  [
    body('batch').notEmpty().withMessage('Batch is required'),
    body('date').notEmpty().withMessage('Date is required'),
    body('records').isArray({ min: 0 }).withMessage('Records must be an array'),
  ],
  markAttendance
);

router.put('/:id', protect, authorize('admin'), updateAttendance);
router.get('/student/me', protect, getMyAttendance);
router.get('/batch/:batchId', protect, authorize('admin'), getBatchAttendance);
router.get('/student/:studentId', protect, authorize('admin'), getStudentAttendance);

module.exports = router;
