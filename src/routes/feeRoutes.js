const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  createFee,
  getFeeByStudent,
  getMyFee,
  getAllFees,
  updateFee,
  addPayment,
  getPayments,
  getFeeStats,
} = require('../controllers/feeController');

router.get('/stats/summary', protect, authorize('admin'), getFeeStats);
router.get('/student/me', protect, getMyFee); // student self-service
router.get('/', protect, authorize('admin'), getAllFees);
router.post(
  '/',
  protect,
  authorize('admin'),
  [
    body('student').notEmpty().withMessage('Student is required'),
    body('totalFee').isNumeric().withMessage('Total fee must be a number'),
  ],
  createFee
);

router.get('/student/:studentId', protect, authorize('admin'), getFeeByStudent);
router.put(
  '/:feeId',
  protect,
  authorize('admin'),
  [
    body('totalFee').optional().isFloat({ min: 0 }).withMessage('Total fee must be non-negative'),
    body('discount').optional().isFloat({ min: 0 }).withMessage('Discount must be non-negative'),
  ],
  updateFee
);

router.post(
  '/:feeId/payments',
  protect,
  authorize('admin'),
  [body('amount').isFloat({ min: 1 }).withMessage('Amount must be a positive number')],
  addPayment
);
router.get('/:feeId/payments', protect, authorize('admin'), getPayments);

module.exports = router;
