const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { login, register, getMe } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/auth');

const loginValidation = [
  body('loginId').notEmpty().withMessage('Email or Student ID is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const registerValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
];

router.post('/login', loginValidation, login);
// Admin-only: create additional admin/staff accounts
router.post('/register', protect, authorize('admin'), registerValidation, register);
router.get('/me', protect, getMe);

module.exports = router;
