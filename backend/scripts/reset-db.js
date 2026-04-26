/**
 * reset-db.js
 * Wipes ALL application data from the database, then re-seeds the admin account.
 *
 * Usage:
 *   node scripts/reset-db.js
 *
 * WARNING: This is IRREVERSIBLE. All students, fees, attendance, etc. are deleted.
 */
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
const bcrypt    = require('bcryptjs');
const { sequelize } = require('../src/config/database');
// Load models so associations are registered before we use User
require('../src/models/index');
const User = require('../src/models/User');

// Tables in dependency order (children first to avoid FK violations)
const TRUNCATE_ORDER = [
  'student_sessions',
  'quiz_attempts',
  'payments',
  'fees',
  'attendances',
  'enrollments',
  'batch_students',
  'notifications',
  'expenses',
  'holidays',
  'project_showcases',
  'testimonials',
  'demo_bookings',
  'contacts',
  'quizzes',
  'students',
  'batches',
  'courses',
  'users',
];

const ADMIN_EMAIL    = 'admin@splendidEducation.com';
const ADMIN_PASSWORD = 'Admin@2026#';
const ADMIN_NAME     = 'Admin';

async function resetDB() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Disable FK checks, truncate all tables, re-enable
    await sequelize.transaction(async (t) => {
      await sequelize.query('SET session_replication_role = replica;', { transaction: t });
      for (const table of TRUNCATE_ORDER) {
        await sequelize.query(`TRUNCATE TABLE "${table}" RESTART IDENTITY CASCADE;`, { transaction: t })
          .catch(() => {
            // Table may not exist yet (e.g. student_sessions on fresh install) — skip silently
          });
        process.stdout.write(`   Cleared: ${table}\n`);
      }
      await sequelize.query('SET session_replication_role = DEFAULT;', { transaction: t });
    });

    console.log('\n✅ All data wiped\n');

    // Re-seed admin via Sequelize model (handles UUID generation)
    const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashed,
      role: 'admin',
      isActive: true,
    });

    console.log('✅ Admin account created');
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ Reset failed:', err.message);
    process.exit(1);
  }
}

resetDB();
