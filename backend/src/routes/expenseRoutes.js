const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  getAllExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseTrend,
} = require('../controllers/expenseController');

router.get('/trend', protect, authorize('admin'), getExpenseTrend);
router.get('/', protect, authorize('admin'), getAllExpenses);
router.post(
  '/',
  protect,
  authorize('admin'),
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('category').notEmpty().withMessage('Category is required'),
    body('amount').isNumeric({ min: 1 }).withMessage('Amount must be a positive number'),
  ],
  createExpense
);
router.put('/:id', protect, authorize('admin'), updateExpense);
router.delete('/:id', protect, authorize('admin'), deleteExpense);

module.exports = router;
