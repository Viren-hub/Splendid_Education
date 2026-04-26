const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getAllCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
} = require('../controllers/courseController');
const { protect, authorize } = require('../middleware/auth');

const createCourseValidation = [
  body('title').notEmpty().withMessage('Course title is required'),
  body('duration').notEmpty().withMessage('Duration is required'),
  body('fee').isNumeric().withMessage('Fee must be a number').custom((v) => v >= 0),
];

// Public read; write for admin only
router.get('/', getAllCourses);
router.get('/:id', getCourseById);
router.post('/', protect, authorize('admin'), createCourseValidation, createCourse);
router.put('/:id', protect, authorize('admin'), updateCourse);
router.delete('/:id', protect, authorize('admin'), deleteCourse);

module.exports = router;
