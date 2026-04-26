require('dotenv').config({ path: require('path').resolve(__dirname, '.env'), quiet: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { connectDB, sequelize } = require('./src/config/database');
const errorHandler = require('./src/middleware/errorHandler');

// Load all models and register associations before routes
require('./src/models/index');

const authRoutes = require('./src/routes/authRoutes');
const studentRoutes = require('./src/routes/studentRoutes');
const contactRoutes = require('./src/routes/contactRoutes');
const demoBookingRoutes = require('./src/routes/demoBookingRoutes');
const testimonialRoutes = require('./src/routes/testimonialRoutes');
const projectShowcaseRoutes = require('./src/routes/projectShowcaseRoutes');
const attendanceRoutes = require('./src/routes/attendanceRoutes');
const feeRoutes = require('./src/routes/feeRoutes');
const expenseRoutes = require('./src/routes/expenseRoutes');
const holidayRoutes = require('./src/routes/holidayRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const batchRoutes = require('./src/routes/batchRoutes');
const courseRoutes = require('./src/routes/courseRoutes');
const quizRoutes  = require('./src/routes/quizRoutes');
const enrollmentRoutes = require('./src/routes/enrollmentRoutes');

// Fail fast if critical secrets are missing
if (!process.env.JWT_SECRET) {
  console.error('[SECURITY] JWT_SECRET is not set. Set it in your .env file before starting the server.');
  process.exit(1);
}

// Connect to PostgreSQL
connectDB();

const app = express();

// Security headers
app.use(helmet());

// Compress all responses
app.use(compression());

// HTTP request logging (skip in test)
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Body parser — limit payload size
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// CORS
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',')
  : ['http://localhost:4200'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Global rate limiter (100 requests per 15 min per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
});

// Strict limiter for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts, please try again later.' },
});

app.use(globalLimiter);

// Root ping
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Splendid Education API is running' });
});

// Dedicated health-check — used by CI/CD and AWS target group checks
app.get('/api/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ success: true, status: 'healthy', db: 'connected', timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(503).json({ success: false, status: 'unhealthy', db: 'disconnected' });
  }
});

// API Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/demo-booking', demoBookingRoutes);
app.use('/api/testimonials', testimonialRoutes);
app.use('/api/projects', projectShowcaseRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/holidays', holidayRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/batches', batchRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/enrollment', enrollmentRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.originalUrl} not found` });
});

// Centralized error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

module.exports = app;
