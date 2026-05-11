const Notification = require('../models/Notification');
const User = require('../models/User');
const { Op } = require('sequelize');

// GET: notifications for the logged-in user (global or targeted)
const getMyNotifications = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = '1' } = req.query;
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 100);
    const offset = (parseInt(page) - 1) * limit;

    // For students, only show global notifications created on/after their account creation date
    // so newly enrolled students don't see historical broadcasts
    let globalCondition = { isGlobal: true };
    if (req.user.role === 'student') {
      const user = await User.findByPk(userId, { attributes: ['createdAt'] });
      if (user?.createdAt) {
        globalCondition = { isGlobal: true, createdAt: { [Op.gte]: user.createdAt } };
      }
    }

    const { count, rows } = await Notification.findAndCountAll({
      where: {
        [Op.or]: [
          globalCondition,
          { recipients: { [Op.contains]: [userId] } },
        ],
      },
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    // Mark each as read
    const unread = rows.filter(n => !n.readBy.includes(userId));
    for (const n of unread) {
      if (!n.readBy.includes(userId)) {
        await Notification.update(
          { readBy: [...n.readBy, userId] },
          { where: { id: n.id } }
        );
      }
    }

    const withRead = rows.map(n => ({
      ...n.toJSON(),
      isRead: n.readBy.includes(userId),
    }));
    res.status(200).json({ success: true, count, pages: Math.ceil(count / limit), data: withRead });
  } catch (error) { next(error); }
};

// POST: create notification (admin only)
const createNotification = async (req, res, next) => {
  try {
    const { title, message, type, recipients, isGlobal } = req.body;
    const notification = await Notification.create({
      title, message,
      type: type || 'info',
      recipients: recipients || [],
      isGlobal: isGlobal !== undefined ? isGlobal : true,
      readBy: [],
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, data: notification });
  } catch (error) { next(error); }
};

// DELETE: admin delete
const deleteNotification = async (req, res, next) => {
  try {
    const deleted = await Notification.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ success: false, message: 'Notification not found' });
    res.status(200).json({ success: true, message: 'Notification deleted' });
  } catch (error) { next(error); }
};

// GET: all notifications (admin)
const getAllNotifications = async (req, res, next) => {
  try {
    const data = await Notification.findAll({
      include: [{ model: User, as: 'creator', attributes: ['name'] }],
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) { next(error); }
};

const markAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notification = await Notification.findByPk(req.params.id);
    if (!notification) return res.status(404).json({ success: false, message: 'Notification not found' });
    if (!notification.readBy.includes(userId)) {
      await Notification.update({ readBy: [...notification.readBy, userId] }, { where: { id: req.params.id } });
    }
    res.status(200).json({ success: true, message: 'Marked as read' });
  } catch (error) { next(error); }
};

const markAllAsRead = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const notifications = await Notification.findAll({
      where: {
        [Op.or]: [
          { isGlobal: true },
          { recipients: { [Op.contains]: [userId] } },
        ],
      },
    });
    for (const n of notifications) {
      if (!n.readBy.includes(userId)) {
        await Notification.update({ readBy: [...n.readBy, userId] }, { where: { id: n.id } });
      }
    }
    res.status(200).json({ success: true, message: 'All notifications marked as read' });
  } catch (error) { next(error); }
};

module.exports = { getMyNotifications, createNotification, deleteNotification, getAllNotifications, markAsRead, markAllAsRead };
