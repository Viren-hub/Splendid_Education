const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const Student = require('../models/Student');

const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

// @desc  Login (admin or student)
// @route POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { loginId, password } = req.body;
    let user;

    if (loginId && loginId.includes('@')) {
      user = await User.findOne({ where: { email: loginId.toLowerCase() } });
    } else if (loginId) {
      // Student ID login (e.g. SE263G0001)
      const student = await Student.findOne({ where: { studentId: loginId.toUpperCase() } });
      if (student) {
        if (!student.isActive)
          return res.status(401).json({ success: false, message: 'This student account has been archived. Please contact admin.' });
        user = await User.findByPk(student.userId);
      }
    }

    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = generateToken(user.id);
    res.status(200).json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) { next(error); }
};

// @desc  Register admin (dev/seed only)
// @route POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    const { name, email, password, role } = req.body;
    const existing = await User.findOne({ where: { email } });
    if (existing)
      return res.status(400).json({ success: false, message: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));
    const user = await User.create({ name, email, password: hashedPassword, role: role || 'student' });
    const token = generateToken(user.id);
    res.status(201).json({
      success: true,
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error) { next(error); }
};

// @desc  Get current user
// @route GET /api/auth/me
const getMe = async (req, res, next) => {
  try { res.status(200).json({ success: true, user: req.user }); }
  catch (error) { next(error); }
};

module.exports = { login, register, getMe };
