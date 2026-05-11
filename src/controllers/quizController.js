const Quiz = require('../models/Quiz');
const QuizAttempt = require('../models/QuizAttempt');
const Student = require('../models/Student');
const User = require('../models/User');
const { Op } = require('sequelize');
const { validationResult } = require('express-validator');

// Build JSONB-safe quiz assignment filter for a student
function buildAssignedToFilter(courseId, batchIds) {
  const conditions = [
    { assignedTo: { [Op.contains]: { type: 'all' } } },
  ];
  if (courseId) {
    conditions.push({ assignedTo: { [Op.contains]: { type: 'course', course: courseId } } });
  }
  for (const bId of (batchIds || [])) {
    conditions.push({ assignedTo: { [Op.contains]: { type: 'batch', batch: bId } } });
  }
  return conditions;
}

const creatorInclude = { model: User, as: 'creator', attributes: ['name'] };

// GET all quizzes (admin) or assigned quizzes (student)
const getQuizzes = async (req, res, next) => {
  try {
    let quizzes;
    if (req.user.role === 'student') {
      const student = await Student.findOne({ where: { userId: req.user.id }, attributes: ['id', 'courseId'] });
      if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

      // Get student's batches
      const Batch = require('../models/Batch');
      const batches = await Student.findByPk(student.id, {
        include: [{ model: Batch, as: 'enrolledBatches', attributes: ['id'] }]
      });
      const batchIds = batches?.enrolledBatches?.map(b => b.id) || [];

      quizzes = await Quiz.findAll({
        where: {
          isActive: true,
          [Op.or]: buildAssignedToFilter(student.courseId, batchIds),
        },
        include: [creatorInclude],
        order: [['scheduledAt', 'ASC']],
      });
    } else {
      // Admin — fetch quizzes with attempt aggregates
      quizzes = await Quiz.findAll({
        include: [
          creatorInclude,
          { model: QuizAttempt, as: 'attempts', attributes: ['percentage', 'passed'] },
        ],
        order: [['createdAt', 'DESC']],
      });

      // Attach computed fields and strip raw attempts array
      quizzes = quizzes.map(q => {
        const plain = q.toJSON();
        const allAttempts = plain.attempts || [];
        const completed = allAttempts.filter(a => a.percentage != null);
        plain.questionCount = Array.isArray(plain.questions) ? plain.questions.length : 0;
        plain.attemptCount  = completed.length;
        plain.avgScore      = completed.length
          ? parseFloat((completed.reduce((s, a) => s + parseFloat(a.percentage || 0), 0) / completed.length).toFixed(1))
          : null;
        delete plain.attempts;   // don't send full attempts in list
        delete plain.questions;  // don't send full questions array in list (saves bandwidth)
        return plain;
      });
    }
    res.status(200).json({ success: true, count: quizzes.length, data: quizzes });
  } catch (error) { next(error); }
};

const getQuizById = async (req, res, next) => {
  try {
    const quiz = await Quiz.findByPk(req.params.id, { include: [creatorInclude] });
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });
    // Students don't see answers
    if (req.user.role === 'student') {
      const safe = quiz.toJSON();
      if (safe.questions) {
        safe.questions = safe.questions.map(q => {
          const { correctAnswer, ...rest } = q;
          return rest;
        });
      }
      return res.status(200).json({ success: true, data: safe });
    }
    res.status(200).json({ success: true, data: quiz });
  } catch (error) { next(error); }
};

const createQuiz = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });
    const { title, description, assignedTo, questions, duration, passingMarks, totalMarks, scheduledAt } = req.body;
    const quiz = await Quiz.create({
      title, description, assignedTo: assignedTo || { type: 'all', course: null, batch: null },
      questions, duration, passingMarks, totalMarks, scheduledAt,
      createdBy: req.user.id,
    });
    res.status(201).json({ success: true, data: quiz });
  } catch (error) { next(error); }
};

const updateQuiz = async (req, res, next) => {
  try {
    const { title, description, assignedTo, questions, duration, passingMarks, totalMarks, scheduledAt, isActive } = req.body;
    const allowed = {};
    if (title !== undefined) allowed.title = title;
    if (description !== undefined) allowed.description = description;
    if (assignedTo !== undefined) allowed.assignedTo = assignedTo;
    if (questions !== undefined) allowed.questions = questions;
    if (duration !== undefined) allowed.duration = duration;
    if (passingMarks !== undefined) allowed.passingMarks = passingMarks;
    if (totalMarks !== undefined) allowed.totalMarks = totalMarks;
    if (scheduledAt !== undefined) allowed.scheduledAt = scheduledAt;
    if (isActive !== undefined) allowed.isActive = isActive;
    const [updated] = await Quiz.update(allowed, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ success: false, message: 'Quiz not found' });
    const quiz = await Quiz.findByPk(req.params.id);
    res.status(200).json({ success: true, data: quiz });
  } catch (error) { next(error); }
};

const deleteQuiz = async (req, res, next) => {
  try {
    const deleted = await Quiz.destroy({ where: { id: req.params.id } });
    if (!deleted) return res.status(404).json({ success: false, message: 'Quiz not found' });
    res.status(200).json({ success: true, message: 'Quiz deleted' });
  } catch (error) { next(error); }
};

// POST /api/quizzes/:id/attempt  — submit attempt
const submitAttempt = async (req, res, next) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id } });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    const quiz = await Quiz.findByPk(req.params.id);
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    const prior = await QuizAttempt.findOne({ where: { quizId: quiz.id, studentId: student.id } });
    if (prior && prior.status === 'completed') {
      return res.status(400).json({ success: false, message: 'Quiz already completed' });
    }

    const { answers, timeTaken, startedAt } = req.body;

    // Auto-grade
    let score = 0;
    const questions = quiz.questions || [];
    (answers || []).forEach(a => {
      const q = questions.find(q => (q.id || q._id) === a.questionId);
      if (!q) return;
      const correctOpt = (q.options || []).find(o => o.isCorrect);
      if (correctOpt && (correctOpt.id || correctOpt._id) === (a.selectedOptionId || a.answer)) score += (q.marks || 1);
    });
    const totalMarks = quiz.totalMarks || questions.length;
    const percentage = totalMarks > 0 ? parseFloat(((score / totalMarks) * 100).toFixed(2)) : 0;
    const passed = percentage >= (quiz.passingMarks || 60);

    if (prior) {
      // Update the in-progress attempt started via startAttempt
      await prior.update({
        answers: answers || [], score, totalMarks,
        percentage, passed, timeTaken,
        startedAt: startedAt || prior.startedAt,
        completedAt: new Date(), status: 'completed',
      });
      return res.status(200).json({ success: true, data: prior });
    }

    // Fallback: no prior attempt (direct submit without startAttempt)
    const attempt = await QuizAttempt.create({
      quizId: quiz.id, studentId: student.id,
      answers: answers || [], score, totalMarks,
      percentage, passed, timeTaken, startedAt,
      completedAt: new Date(), status: 'completed',
    });
    res.status(201).json({ success: true, data: attempt });
  } catch (error) { next(error); }
};

// GET /api/quizzes/:id/attempts  — admin view all attempts for quiz
const getAttempts = async (req, res, next) => {
  try {
    const quiz = await Quiz.findByPk(req.params.id, {
      include: [creatorInclude],
      attributes: { exclude: ['questions'] },
    });
    if (!quiz) return res.status(404).json({ success: false, message: 'Quiz not found' });

    const studentInclude = {
      model: Student, as: 'student', attributes: ['studentId'],
      include: [{ model: User, as: 'user', attributes: ['name', 'email'] }],
    };
    const attempts = await QuizAttempt.findAll({
      where: { quizId: req.params.id, status: 'completed' },
      include: [studentInclude],
      order: [['completedAt', 'DESC']],
    });

    // Build stats
    const total    = attempts.length;
    const passed   = attempts.filter(a => a.passed).length;
    const scores   = attempts.map(a => parseFloat(a.percentage || 0));
    const avgScore = total ? parseFloat((scores.reduce((s, v) => s + v, 0) / total).toFixed(1)) : 0;
    const topScore = total ? parseFloat(Math.max(...scores).toFixed(1)) : 0;

    res.status(200).json({
      success: true,
      data: {
        quiz: quiz.toJSON(),
        attempts,
        stats: { total, passed, avgScore, topScore },
      },
    });
  } catch (error) { next(error); }
};

// ── Aliases and additional student-facing functions ───────────────────────────

const getAllQuizzes = getQuizzes;
const getQuizAdmin = getQuizById;
const getQuizResults = getAttempts;

const getMyQuizzes = async (req, res, next) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id }, attributes: ['id', 'courseId'] });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Get student's batches
    const Batch = require('../models/Batch');
    const batches = await Student.findByPk(student.id, {
      include: [{ model: Batch, as: 'enrolledBatches', attributes: ['id'] }]
    });
    const batchIds = batches?.enrolledBatches?.map(b => b.id) || [];

    const quizzes = await Quiz.findAll({
      where: {
        isActive: true,
        [Op.or]: buildAssignedToFilter(student.courseId, batchIds),
      },
      include: [creatorInclude],
      order: [['scheduledAt', 'ASC']],
    });
    const attempts = await QuizAttempt.findAll({
      where: { studentId: student.id },
      attributes: ['quizId', 'score', 'percentage', 'passed', 'status', 'completedAt'],
    });
    const attemptMap = {};
    attempts.forEach(a => { attemptMap[a.quizId] = a; });
    const result = quizzes.map(q => ({ ...q.toJSON(), attempt: attemptMap[q.id] || null }));
    res.status(200).json({ success: true, count: result.length, data: result });
  } catch (error) { next(error); }
};

const getQuizToTake = async (req, res, next) => {
  try {
    const quiz = await Quiz.findByPk(req.params.id, { include: [creatorInclude] });
    if (!quiz || !quiz.isActive) return res.status(404).json({ success: false, message: 'Quiz not found' });

    // Students can only access quizzes assigned to them
    if (req.user.role === 'student') {
      const student = await Student.findOne({ where: { userId: req.user.id }, attributes: ['id', 'courseId'] });
      if (!student) return res.status(403).json({ success: false, message: 'Student profile not found' });
      const Batch = require('../models/Batch');
      const withBatches = await Student.findByPk(student.id, {
        include: [{ model: Batch, as: 'enrolledBatches', attributes: ['id'] }],
      });
      const batchIds = withBatches?.enrolledBatches?.map(b => b.id) || [];
      const assigned = await Quiz.findOne({
        where: {
          id: req.params.id, isActive: true,
          [Op.or]: buildAssignedToFilter(student.courseId, batchIds),
        },
      });
      if (!assigned) return res.status(403).json({ success: false, message: 'You are not assigned to this quiz' });
    }

    const safe = quiz.toJSON();
    if (safe.questions) {
      const { randomUUID } = require('crypto');
      safe.questions = safe.questions.map(({ correctAnswer, ...q }) => ({
        ...q,
        id: q.id || randomUUID(),
        options: (q.options || []).map(o => ({ ...o, id: o.id || randomUUID() })),
      }));
    }
    res.status(200).json({ success: true, data: safe });
  } catch (error) { next(error); }
};

const startAttempt = async (req, res, next) => {
  try {
    const student = await Student.findOne({ where: { userId: req.user.id }, attributes: ['id', 'courseId'] });
    if (!student) return res.status(404).json({ success: false, message: 'Student not found' });

    // Verify this quiz is actually assigned to the student
    const Batch = require('../models/Batch');
    const withBatches = await Student.findByPk(student.id, {
      include: [{ model: Batch, as: 'enrolledBatches', attributes: ['id'] }],
    });
    const batchIds = withBatches?.enrolledBatches?.map(b => b.id) || [];
    const quiz = await Quiz.findOne({
      where: {
        id: req.params.id, isActive: true,
        [Op.or]: buildAssignedToFilter(student.courseId, batchIds),
      },
    });
    if (!quiz) return res.status(403).json({ success: false, message: 'Quiz not found or not assigned to you' });
    const existing = await QuizAttempt.findOne({ where: { quizId: quiz.id, studentId: student.id } });
    if (existing) {
      if (existing.status === 'completed') return res.status(400).json({ success: false, message: 'Quiz already completed' });
      return res.status(200).json({ success: true, data: existing });
    }
    const attempt = await QuizAttempt.create({
      quizId: quiz.id, studentId: student.id,
      answers: [], score: 0, totalMarks: quiz.totalMarks || 0,
      percentage: 0, passed: false, status: 'in-progress', startedAt: new Date(),
    });
    res.status(201).json({ success: true, data: attempt });
  } catch (error) { next(error); }
};

const getAttemptResult = async (req, res, next) => {
  try {
    const attempt = await QuizAttempt.findByPk(req.params.attemptId, {
      include: [
        { model: Quiz, as: 'quiz' }, // full quiz including questions for breakdown
        { model: Student, as: 'student', attributes: ['studentId'], include: [{ model: User, as: 'user', attributes: ['name'] }] },
      ],
    });
    if (!attempt) return res.status(404).json({ success: false, message: 'Attempt not found' });
    if (req.user.role === 'student') {
      const student = await Student.findOne({ where: { userId: req.user.id } });
      if (!student || attempt.studentId !== student.id) {
        return res.status(403).json({ success: false, message: 'Not authorized' });
      }
    }

    const attemptData = attempt.toJSON();
    const questions = attemptData.quiz?.questions || [];
    const studentAnswers = attemptData.answers || [];

    // Build per-question breakdown
    const breakdown = questions.map(q => {
      const studentAns = studentAnswers.find(a => a.questionId === q.id);
      const selectedOptionId = studentAns?.selectedOptionId || studentAns?.selectedOption || null;
      const correctOption = (q.options || []).find(o => o.isCorrect);
      const isCorrect = !!(selectedOptionId && correctOption && selectedOptionId === (correctOption.id || correctOption._id));
      return {
        questionId: q.id,
        questionText: q.text,
        options: (q.options || []).map(o => ({ id: o.id || o._id, text: o.text, isCorrect: !!o.isCorrect })),
        selectedOption: selectedOptionId,
        correctOption: correctOption ? (correctOption.id || correctOption._id) : null,
        isCorrect,
        marksEarned: isCorrect ? (q.marks || 1) : 0,
        marks: q.marks || 1,
        explanation: q.explanation || null,
      };
    });

    // Return quiz metadata without raw questions (breakdown has the enriched version)
    const { questions: _qs, ...quizMeta } = attemptData.quiz || {};
    res.status(200).json({
      success: true,
      data: { ...attemptData, quiz: quizMeta, breakdown },
    });
  } catch (error) { next(error); }
};

module.exports = {
  getQuizzes, getQuizById, createQuiz, updateQuiz, deleteQuiz, submitAttempt, getAttempts,
  getAllQuizzes, getQuizAdmin, getQuizResults, getMyQuizzes, getQuizToTake, startAttempt, getAttemptResult,
};
