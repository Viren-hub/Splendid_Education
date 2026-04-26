const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const QuizAttempt = sequelize.define('QuizAttempt', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  quizId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'quizzes',
      key: 'id'
    },
    field: 'quiz_id'
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'students',
      key: 'id'
    },
    field: 'student_id'
  },
  answers: {
    type: DataTypes.JSONB,
    defaultValue: [],
    comment: 'Array of {questionId, selectedOption, isCorrect, marksEarned}'
  },
  score: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0
  },
  totalMarks: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0,
    field: 'total_marks'
  },
  percentage: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 0
  },
  passed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  timeTaken: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
    field: 'time_taken',
    comment: 'Time taken in seconds'
  },
  startedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    field: 'started_at'
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'completed_at'
  },
  status: {
    type: DataTypes.ENUM('in-progress', 'completed', 'abandoned'),
    defaultValue: 'in-progress'
  }
}, {
  tableName: 'quiz_attempts',
  timestamps: true,
  indexes: [
    {
      fields: ['quiz_id', 'student_id', 'status']
    }
  ]
});

module.exports = QuizAttempt;
