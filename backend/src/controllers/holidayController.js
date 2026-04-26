const Holiday = require('../models/Holiday');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');

const getHolidays = async (req, res, next) => {
  try {
    const { year } = req.query;
    const where = year
      ? { date: { [Op.between]: [`${year}-01-01`, `${year}-12-31`] } }
      : {};
    const holidays = await Holiday.findAll({ where, order: [['date', 'ASC']] });
    res.status(200).json({ success: true, count: holidays.length, data: holidays });
  } catch (error) { next(error); }
};

const createHoliday = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { title, date, type, description } = req.body;
    const holiday = await Holiday.create({ title, date, type, description, createdBy: req.user.id });
    res.status(201).json({ success: true, data: holiday });
  } catch (error) { next(error); }
};

const updateHoliday = async (req, res, next) => {
  try {
    const [updated] = await Holiday.update(req.body, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ success: false, message: 'Holiday not found' });
    const holiday = await Holiday.findByPk(req.params.id);
    res.status(200).json({ success: true, data: holiday });
  } catch (error) { next(error); }
};

const deleteHoliday = async (req, res, next) => {
  try {
    const deleted = await Holiday.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ success: false, message: 'Holiday not found' });
    res.status(200).json({ success: true, message: 'Holiday deleted' });
  } catch (error) { next(error); }
};

module.exports = { getHolidays, createHoliday, updateHoliday, deleteHoliday };
