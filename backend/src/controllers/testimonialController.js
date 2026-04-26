const Testimonial = require('../models/Testimonial');
const { validationResult } = require('express-validator');

const getPublishedTestimonials = async (req, res, next) => {
  try {
    const data = await Testimonial.findAll({ where: { isPublished: true }, order: [['createdAt', 'DESC']] });
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) { next(error); }
};

const getAllTestimonials = async (req, res, next) => {
  try {
    const data = await Testimonial.findAll({ order: [['createdAt', 'DESC']] });
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) { next(error); }
};

const createTestimonial = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { author, role, content, rating, isPublished } = req.body;
    const t = await Testimonial.create({ author, role, content, rating, isPublished });
    res.status(201).json({ success: true, data: t });
  } catch (error) { next(error); }
};

const updateTestimonial = async (req, res, next) => {
  try {
    const [updated] = await Testimonial.update(req.body, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ success: false, message: 'Testimonial not found' });
    const t = await Testimonial.findByPk(req.params.id);
    res.status(200).json({ success: true, data: t });
  } catch (error) { next(error); }
};

const deleteTestimonial = async (req, res, next) => {
  try {
    const deleted = await Testimonial.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ success: false, message: 'Testimonial not found' });
    res.status(200).json({ success: true, message: 'Testimonial deleted' });
  } catch (error) { next(error); }
};

module.exports = { getPublishedTestimonials, getAllTestimonials, getTestimonials: getPublishedTestimonials, createTestimonial, updateTestimonial, deleteTestimonial };
