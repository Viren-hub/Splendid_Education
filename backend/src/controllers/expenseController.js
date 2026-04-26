const Expense = require('../models/Expense');
const User = require('../models/User');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');

const getAllExpenses = async (req, res, next) => {
  try {
    const { month, year, category, page = 1 } = req.query;
    const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 20), 100);
    const where = {};
    if (year) {
      const start = new Date(year, month ? month - 1 : 0, 1);
      const end = month
        ? new Date(year, month, 0, 23, 59, 59)
        : new Date(Number(year) + 1, 0, 0, 23, 59, 59);
      where.date = { [Op.between]: [start, end] };
    }
    if (category) where.category = category;

    const total = await Expense.count({ where });
    const expenses = await Expense.findAll({
      where,
      include: [{ model: User, as: 'recorder', attributes: ['name'] }],
      order: [['date', 'DESC']],
      offset: (page - 1) * limit,
      limit: Number(limit),
    });

    // Sum total amount for current filter
    const sumRaw = await Expense.sum('amount', { where });
    res.status(200).json({
      success: true, count: expenses.length, total,
      totalAmount: Number(sumRaw) || 0,
      pages: Math.ceil(total / limit), data: expenses,
    });
  } catch (error) { next(error); }
};

const createExpense = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { title, category, amount, date, description } = req.body;
    const expense = await Expense.create({
      title, category, amount,
      date: date ? new Date(date) : new Date(),
      description, recordedBy: req.user.id,
    });
    res.status(201).json({ success: true, data: expense });
  } catch (error) { next(error); }
};

const updateExpense = async (req, res, next) => {
  try {
    const { title, category, amount, date, description } = req.body;
    const allowed = {};
    if (title !== undefined) allowed.title = title;
    if (category !== undefined) allowed.category = category;
    if (amount !== undefined) allowed.amount = amount;
    if (date !== undefined) allowed.date = new Date(date);
    if (description !== undefined) allowed.description = description;
    const [updated] = await Expense.update(allowed, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ success: false, message: 'Expense not found' });
    const expense = await Expense.findByPk(req.params.id);
    res.status(200).json({ success: true, data: expense });
  } catch (error) { next(error); }
};

const deleteExpense = async (req, res, next) => {
  try {
    const deleted = await Expense.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ success: false, message: 'Expense not found' });
    res.status(200).json({ success: true, message: 'Expense deleted' });
  } catch (error) { next(error); }
};

const getExpenseTrend = async (req, res, next) => {
  try {
    const months = Math.min(Math.max(1, parseInt(req.query.months) || 6), 24);
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const trend = await sequelize.query(
      `SELECT EXTRACT(YEAR FROM date)::int AS year,
              EXTRACT(MONTH FROM date)::int AS month,
              category, SUM(amount) AS total
       FROM expenses WHERE date >= :since
       GROUP BY year, month, category ORDER BY year, month`,
      { replacements: { since }, type: sequelize.QueryTypes.SELECT }
    );
    res.status(200).json({ success: true, data: trend });
  } catch (error) { next(error); }
};

module.exports = { getAllExpenses, createExpense, updateExpense, deleteExpense, getExpenseTrend };
