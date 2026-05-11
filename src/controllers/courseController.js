const { validationResult } = require('express-validator');
const Course = require('../models/Course');
const User = require('../models/User');

const creatorInclude = { model: User, as: 'creator', attributes: ['name', 'email'] };

const getAllCourses = async (req, res, next) => {
  try {
    const where = req.user?.role === 'admin' ? {} : { isActive: true };
    const courses = await Course.findAll({ where, include: [creatorInclude], order: [['createdAt', 'DESC']] });
    res.status(200).json({ success: true, count: courses.length, data: courses });
  } catch (error) { next(error); }
};

const getCourseById = async (req, res, next) => {
  try {
    const course = await Course.findByPk(req.params.id, { include: [creatorInclude] });
    if (!course) return res.status(404).json({ success: false, message: 'Course not found' });
    res.status(200).json({ success: true, data: course });
  } catch (error) { next(error); }
};

const createCourse = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { title, category, description, duration, fee, ageGroup, syllabus } = req.body;
    const course = await Course.create({
      title, category: category || 'other', description, duration, fee,
      ageGroup: ageGroup || 'All Ages', syllabus, createdBy: req.user.id,
    });
    res.status(201).json({ success: true, data: course });
  } catch (error) { next(error); }
};

const updateCourse = async (req, res, next) => {
  try {
    const { title, category, description, duration, fee, ageGroup, syllabus, isActive } = req.body;
    const [updated] = await Course.update(
      { title, category, description, duration, fee, ageGroup, syllabus, isActive },
      { where: { id: req.params.id } }
    );
    if (!updated) return res.status(404).json({ success: false, message: 'Course not found' });
    const course = await Course.findByPk(req.params.id, { include: [creatorInclude] });
    res.status(200).json({ success: true, data: course });
  } catch (error) { next(error); }
};

const deleteCourse = async (req, res, next) => {
  try {
    const [updated] = await Course.update({ isActive: false }, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ success: false, message: 'Course not found' });
    res.status(200).json({ success: true, message: 'Course deactivated successfully' });
  } catch (error) { next(error); }
};

module.exports = { getAllCourses, getCourseById, createCourse, updateCourse, deleteCourse };
