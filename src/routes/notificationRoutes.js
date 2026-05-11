const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { protect, authorize } = require('../middleware/auth');
const {
  getMyNotifications,
  createNotification,
  markAsRead,
  markAllAsRead,
  getAllNotifications,
  deleteNotification,
} = require('../controllers/notificationController');

router.get('/', protect, getMyNotifications);
router.get('/all', protect, authorize('admin'), getAllNotifications);
router.put('/read-all', protect, markAllAsRead);
router.put('/:id/read', protect, markAsRead);
router.delete('/:id', protect, authorize('admin'), deleteNotification);

router.post(
  '/',
  protect,
  authorize('admin'),
  [
    body('title').notEmpty().withMessage('Title is required'),
    body('message').notEmpty().withMessage('Message is required'),
  ],
  createNotification
);

module.exports = router;
