const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { submitContact, getAllContacts, updateContactStatus, deleteContact } = require('../controllers/contactController');
const { protect, authorize } = require('../middleware/auth');

const contactValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('message').notEmpty().withMessage('Message is required'),
];

router.post('/', contactValidation, submitContact);
router.get('/', protect, authorize('admin'), getAllContacts);
router.patch('/:id/status', protect, authorize('admin'), updateContactStatus);
router.delete('/:id', protect, authorize('admin'), deleteContact);

module.exports = router;
