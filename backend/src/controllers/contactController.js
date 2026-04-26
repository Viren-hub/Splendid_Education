const { validationResult } = require('express-validator');
const Contact = require('../models/Contact');

const submitContact = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { name, email, phone, message } = req.body;
    const contact = await Contact.create({ name, email, phone, message });
    res.status(201).json({
      success: true,
      message: 'Your message has been received. We will get back to you soon.',
      data: { id: contact.id },
    });
  } catch (error) { next(error); }
};

const getAllContacts = async (req, res, next) => {
  try {
    const contacts = await Contact.findAll({ order: [['createdAt', 'DESC']] });
    res.status(200).json({ success: true, count: contacts.length, data: contacts });
  } catch (error) { next(error); }
};

const updateContactStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const [updated] = await Contact.update({ status }, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ success: false, message: 'Contact not found' });
    const contact = await Contact.findByPk(req.params.id);
    res.status(200).json({ success: true, data: contact });
  } catch (error) { next(error); }
};

const deleteContact = async (req, res, next) => {
  try {
    const deleted = await Contact.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ success: false, message: 'Contact not found' });
    res.status(200).json({ success: true, message: 'Enquiry deleted' });
  } catch (error) { next(error); }
};

module.exports = { submitContact, getAllContacts, updateContactStatus, deleteContact };
