require('dotenv').config({ path: require('path').resolve(__dirname, '../.env'), quiet: true });
const bcrypt = require('bcryptjs');
const { User, sequelize } = require('../src/models');

const ADMIN_NAME     = 'Admin';
const ADMIN_EMAIL    = 'admin@splendidEducation.com';
const ADMIN_PASSWORD = 'Admin@2026#';

async function seedAdmin() {
  try {
    await sequelize.authenticate();

    const existing = await User.findOne({ where: { email: ADMIN_EMAIL.toLowerCase() } });
    if (existing) {
      console.log(`ℹ️  Admin user already exists: ${ADMIN_EMAIL}`);
      process.exit(0);
    }

    const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);
    await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: hashed,
      role: 'admin',
      isActive: true,
    });

    console.log('✅ Admin user created');
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error.message);
    process.exit(1);
  }
}

seedAdmin();


