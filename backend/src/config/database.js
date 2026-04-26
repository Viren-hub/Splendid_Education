const { Sequelize } = require('sequelize');

// Support both DATABASE_URL (Neon/Render) and individual DB_* vars
const sequelize = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      dialect: 'postgres',
      logging: false,
      dialectOptions: {
        ssl: {
          require: true,
          rejectUnauthorized: false,
        },
        keepAlive: true,
      },
      pool: {
        max:     process.env.NODE_ENV === 'production' ? 10 : 5,
        min:     0,
        acquire: 30000,
        idle:    10000,
      },
      define: {
        timestamps: true,
        underscored: false,
        createdAt: 'createdAt',
        updatedAt: 'updatedAt',
      },
    })
  : new Sequelize(
      process.env.DB_NAME || 'splendid_education',
      process.env.DB_USER || 'postgres',
      process.env.DB_PASSWORD,
      {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        dialect: 'postgres',
        logging: false,
        pool: {
          max:     5,
          min:     0,
          acquire: 30000,
          idle:    10000,
        },
        define: {
          timestamps: true,
          underscored: false,
          createdAt: 'createdAt',
          updatedAt: 'updatedAt',
        },
      }
    );

const connectDB = async () => {
  // Require either DATABASE_URL or DB_PASSWORD in production
  if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL && !process.env.DB_PASSWORD) {
    console.error('[SECURITY] Neither DATABASE_URL nor DB_PASSWORD is set. Cannot start in production.');
    process.exit(1);
  }
  try {
    await sequelize.authenticate();
    console.log(`PostgreSQL Connected: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);

    // Sync models: use alter only on the very first run (when tables don't exist yet),
    // then switch to force:false / alter:false for fast restarts.
    // Set DB_SYNC_ALTER=true in .env to force a full alter (e.g. after adding a new column).
    if (process.env.NODE_ENV !== 'production') {
      const alterSchema = process.env.DB_SYNC_ALTER === 'true';
      await sequelize.sync({ alter: alterSchema });
      console.log(`Database synchronized${alterSchema ? ' (alter mode)' : ''}`);
    }
  } catch (error) {
    console.error(`DB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
