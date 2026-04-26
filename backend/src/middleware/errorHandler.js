// Centralized error handling middleware
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Sequelize validation error
  if (err.name === 'SequelizeValidationError') {
    statusCode = 400;
    message = err.errors.map((e) => e.message).join(', ');
  }

  // Sequelize unique constraint (duplicate)
  if (err.name === 'SequelizeUniqueConstraintError') {
    statusCode = 400;
    const field = err.errors[0]?.path || 'field';
    message = `A record with this ${field} already exists.`;
  }

  // Sequelize foreign key violation
  if (err.name === 'SequelizeForeignKeyConstraintError') {
    statusCode = 400;
    message = 'Invalid reference: related record not found.';
  }

  // Sequelize generic database error (e.g. invalid UUID syntax)
  if (err.name === 'SequelizeDatabaseError') {
    statusCode = 400;
    if (err.message && err.message.toLowerCase().includes('uuid')) {
      message = 'Invalid ID format. Please try again or restart the process.';
    } else {
      message = 'A database error occurred. Please try again.';
    }
  }

  // Sequelize database connection error
  if (err.name === 'SequelizeConnectionError') {
    statusCode = 503;
    message = 'Database connection error. Please try again.';
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token. Please log in again.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Your session has expired. Please log in again.';
  }

  // Log unexpected server errors (never expose stack in production)
  if (statusCode === 500) {
    console.error('[SERVER ERROR]', err.stack || err.message);
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = errorHandler;
