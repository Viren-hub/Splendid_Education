const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { bookDemo, getAllBookings, updateBookingStatus, deleteBooking } = require('../controllers/demoBookingController');
const { protect, authorize } = require('../middleware/auth');

const bookingValidation = [
  body('parentName').notEmpty().withMessage('Parent name is required'),
  body('childName').notEmpty().withMessage("Child's name is required"),
  body('childAge').notEmpty().withMessage("Child's age is required"),
  body('phone').notEmpty().withMessage('Phone is required'),
  body('preferredDate').optional({ checkFalsy: true }).isISO8601().withMessage('Valid preferred date is required'),
];

router.post('/', bookingValidation, bookDemo);
router.get('/', protect, authorize('admin'), getAllBookings);
router.patch('/:id/status', protect, authorize('admin'), updateBookingStatus);
router.delete('/:id', protect, authorize('admin'), deleteBooking);

module.exports = router;
