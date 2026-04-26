const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Quiz = sequelize.define('Quiz', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Quiz title is required' }
    }
  },
  description: {
    type: DataTypes.TEXT,
    defaultValue: ''
  },
  assignedTo: {
    type: DataTypes.JSONB,
    defaultValue: { type: 'all', course: null, batch: null },
    field: 'assigned_to',
    comment: 'JSON object: {type: "all"|"course"|"batch", course: UUID, batch: UUID}'
  },
  questions: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of {text, options: [{text, isCorrect}], marks, explanation}'
  },
  duration: {
    type: DataTypes.INTEGER,
    defaultValue: 30,
    comment: 'Duration in minutes, 0 = no limit'
  },
  passingMarks: {
    type: DataTypes.INTEGER,
    defaultValue: 40,
    field: 'passing_marks',
    comment: 'Passing percentage'
  },
  totalMarks: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'total_marks'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_active'
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'scheduled_at'
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    field: 'created_by'
  }
}, {
  tableName: 'quizzes',
  timestamps: true,
  hooks: {
    beforeSave: (quiz) => {
      if (quiz.questions && Array.isArray(quiz.questions)) {
        const { randomUUID } = require('crypto');
        quiz.questions = quiz.questions.map(q => ({
          ...q,
          id: q.id || q._id || randomUUID(),
          options: (q.options || []).map(o => ({ ...o, id: o.id || o._id || randomUUID() })),
        }));
        quiz.totalMarks = quiz.questions.reduce((sum, q) => sum + (q.marks || 1), 0);
      }
    }
  }
});

module.exports = Quiz;
