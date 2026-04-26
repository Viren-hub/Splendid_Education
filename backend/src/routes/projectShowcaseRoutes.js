const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { getProjects, createProject, updateProject, deleteProject } = require('../controllers/projectShowcaseController');
const { protect, authorize } = require('../middleware/auth');

const createValidation = [
  body('title').notEmpty().withMessage('Title is required'),
];

router.get('/', getProjects);
router.post('/', protect, authorize('admin'), createValidation, createProject);
router.put('/:id', protect, authorize('admin'), updateProject);
router.delete('/:id', protect, authorize('admin'), deleteProject);

module.exports = router;
