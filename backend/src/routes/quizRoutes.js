const express = require('express');
const router  = express.Router();
const { protect, authorize } = require('../middleware/auth');
const {
  createQuiz, getAllQuizzes, getQuizAdmin, updateQuiz, deleteQuiz, getQuizResults,
  getMyQuizzes, getQuizToTake, startAttempt, submitAttempt, getAttemptResult,
} = require('../controllers/quizController');

// ── Student-specific static routes (must come before /:id) ──────────────────
router.get('/my',                protect,                     getMyQuizzes);
router.get('/attempt/:attemptId', protect,                    getAttemptResult);

// ── Admin CRUD ───────────────────────────────────────────────────────────────
router.get( '/', protect, authorize('admin'), getAllQuizzes);
router.post('/', protect, authorize('admin'), createQuiz);

router.get   ('/:id', protect, authorize('admin'), getQuizAdmin);
router.put   ('/:id', protect, authorize('admin'), updateQuiz);
router.delete('/:id', protect, authorize('admin'), deleteQuiz);
router.get   ('/:id/results', protect, authorize('admin'), getQuizResults);

// ── Student per-quiz actions ─────────────────────────────────────────────────
router.get ('/:id/take',   protect, getQuizToTake);
router.post('/:id/start',  protect, startAttempt);
router.put ('/:id/submit', protect, submitAttempt);

module.exports = router;
