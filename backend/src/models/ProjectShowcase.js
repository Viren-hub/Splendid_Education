const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ProjectShowcase = sequelize.define('ProjectShowcase', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'Project title is required' }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  techStack: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
    field: 'tech_stack'
  },
  githubUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'github_url'
  },
  liveUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'live_url'
  },
  studentId: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'students',
      key: 'id'
    },
    field: 'student_id'
  },
  isPublished: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    field: 'is_published'
  }
}, {
  tableName: 'project_showcases',
  timestamps: true
});

module.exports = ProjectShowcase;
