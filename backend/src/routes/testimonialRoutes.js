const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getTestimonials, createTestimonial, updateTestimonial, deleteTestimonial } = require('../controllers/testimonialController');
const { protect, authorize } = require('../middleware/auth');

const createValidation = [
  body('author').notEmpty().withMessage('Author is required'),
  body('content').notEmpty().withMessage('Content is required'),
  body('rating').optional().isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
];

router.get('/', getTestimonials);
router.post('/', protect, authorize('admin'), createValidation, createTestimonial);
router.put('/:id', protect, authorize('admin'), updateTestimonial);
router.delete('/:id', protect, authorize('admin'), deleteTestimonial);

module.exports = router;
