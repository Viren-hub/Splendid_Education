const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getAllStudents,
  getStudentHistory,
  getStudentById,
  getStudentOverview,
  createStudent,
  updateStudent,
  deleteStudent,
  resetStudentPassword,
  getMe,
  getUpcomingClasses,
} = require('../controllers/studentController');
const { protect, authorize } = require('../middleware/auth');

const createStudentValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('contactEmail').optional({ checkFalsy: true }).isEmail().withMessage('Contact email must be a valid email'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

// Self-service routes (must be before /:id parameter route)
router.get('/me', protect, getMe);
router.get('/upcoming-classes', protect, getUpcomingClasses);

// Admin-only CRUD
router.get('/history', protect, authorize('admin'), getStudentHistory);
router.get('/',    protect, authorize('admin'), getAllStudents);
router.post('/',   protect, authorize('admin'), createStudentValidation, createStudent);
router.get('/:id/overview', protect, authorize('admin'), getStudentOverview);
router.post('/:id/reset-password', protect, authorize('admin'), resetStudentPassword);
router.get('/:id', protect, authorize('admin'), getStudentById);
router.put('/:id', protect, authorize('admin'), updateStudent);
router.delete('/:id', protect, authorize('admin'), deleteStudent);

module.exports = router;
