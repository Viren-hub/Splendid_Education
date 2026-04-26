const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  submitEnrollment,
  submitUTR,
  getEnrollmentStatus,
  getAllEnrollments,
  adminEnterUTR,
  confirmEnrollment,
  rejectEnrollment,
  reopenEnrollment,
  deleteEnrollment,
} = require('../controllers/enrollmentController');

// ── Public routes (no auth) ──────────────────────────────────
router.post('/', submitEnrollment);
router.put('/:id/utr', submitUTR);
router.get('/:id/status', getEnrollmentStatus);

// ── Admin-only routes ────────────────────────────────────────
router.use(protect, authorize('admin'));
router.get('/', getAllEnrollments);
router.put('/:id/admin-utr', adminEnterUTR);
router.put('/:id/confirm', confirmEnrollment);
router.put('/:id/reject', rejectEnrollment);
router.put('/:id/reopen', reopenEnrollment);
router.delete('/:id', deleteEnrollment);

module.exports = router;
