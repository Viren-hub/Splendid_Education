const ProjectShowcase = require('../models/ProjectShowcase');
const Student = require('../models/Student');
const User = require('../models/User');
const { validationResult } = require('express-validator');

const studentInclude = {
  model: Student, as: 'student', attributes: ['studentId'],
  include: [{ model: User, as: 'user', attributes: ['name'] }],
};

const getPublishedProjects = async (req, res, next) => {
  try {
    const data = await ProjectShowcase.findAll({
      where: { isPublished: true }, include: [studentInclude], order: [['createdAt', 'DESC']],
    });
    res.status(200).json({ success: true, count: data.length, data });
  } catch (error) { next(error); }
};

const createProject = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { title, description, techStack, githubUrl, liveUrl, studentId, isPublished } = req.body;
    const project = await ProjectShowcase.create({
      title, description, techStack, githubUrl, liveUrl,
      studentId: studentId || null,
      isPublished: isPublished !== undefined ? isPublished : true,
    });
    res.status(201).json({ success: true, data: project });
  } catch (error) { next(error); }
};

const updateProject = async (req, res, next) => {
  try {
    const [updated] = await ProjectShowcase.update(req.body, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ success: false, message: 'Project not found' });
    const project = await ProjectShowcase.findByPk(req.params.id);
    res.status(200).json({ success: true, data: project });
  } catch (error) { next(error); }
};

const deleteProject = async (req, res, next) => {
  try {
    const deleted = await ProjectShowcase.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ success: false, message: 'Project not found' });
    res.status(200).json({ success: true, message: 'Project deleted' });
  } catch (error) { next(error); }
};

module.exports = { getPublishedProjects, getProjects: getPublishedProjects, createProject, updateProject, deleteProject };
