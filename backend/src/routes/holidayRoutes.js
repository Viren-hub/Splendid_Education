const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const { getHolidays, createHoliday, updateHoliday, deleteHoliday } = require('../controllers/holidayController');

router.get('/', getHolidays); // Public — students and guests can view holidays

router.post(
  '/',
  protect,
  authorize('admin'),
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('date').notEmpty().withMessage('Date is required'),
    body('type').notEmpty().withMessage('Type is required'),
  ],
  createHoliday
);
router.put('/:id', protect, authorize('admin'), updateHoliday);
router.delete('/:id', protect, authorize('admin'), deleteHoliday);

module.exports = router;
