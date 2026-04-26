const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const { getDashboard } = require('../controllers/adminDashboardController');

router.get('/dashboard', protect, authorize('admin'), getDashboard);

module.exports = router;
