const { validationResult } = require('express-validator');
const DemoBooking = require('../models/DemoBooking');
const Course = require('../models/Course');

const bookDemo = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { parentName, childName, childAge, phone, preferredDate, interest } = req.body;
    const message = `Child: ${childName}, Age: ${childAge}${interest ? `, Interest: ${interest}` : ''}`;
    const booking = await DemoBooking.create({
      name: parentName,
      email: null,
      phone,
      courseId: null,
      preferredDate: preferredDate || null,
      message,
    });
    res.status(201).json({
      success: true,
      message: 'Demo class booked successfully. We will confirm shortly.',
      data: { id: booking.id },
    });
  } catch (error) { next(error); }
};

const getAllBookings = async (req, res, next) => {
  try {
    const bookings = await DemoBooking.findAll({
      include: [{ model: Course, as: 'course', attributes: ['title', 'duration', 'fee'] }],
      order: [['createdAt', 'DESC']],
    });
    res.status(200).json({ success: true, count: bookings.length, data: bookings });
  } catch (error) { next(error); }
};

const updateBookingStatus = async (req, res, next) => {
  try {
    const { status, scheduledDate } = req.body;
    const [updated] = await DemoBooking.update({ status, scheduledDate }, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ success: false, message: 'Booking not found' });
    const booking = await DemoBooking.findByPk(req.params.id, {
      include: [{ model: Course, as: 'course', attributes: ['title'] }],
    });
    res.status(200).json({ success: true, data: booking });
  } catch (error) { next(error); }
};

const deleteBooking = async (req, res, next) => {
  try {
    const deleted = await DemoBooking.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ success: false, message: 'Booking not found' });
    res.status(200).json({ success: true, message: 'Booking deleted' });
  } catch (error) { next(error); }
};

module.exports = { bookDemo, getAllBookings, updateBookingStatus, deleteBooking };
