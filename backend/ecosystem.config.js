// PM2 Process Manager configuration
// Usage (from backend/ directory):
//   pm2 start ecosystem.config.js --env production
//   pm2 restart splendid-backend --update-env
//   pm2 logs splendid-backend
//   pm2 monit

module.exports = {
  apps: [
    {
      name: 'splendid-backend',
      script: 'server.js',
      cwd: __dirname,

      // Run a single process on t3.micro (1 vCPU)
      instances: 1,
      exec_mode: 'fork',

      // Auto-restart if the process crashes
      autorestart: true,
      watch: false,
      max_memory_restart: '450M',

      // Graceful shutdown: wait up to 5 s for in-flight requests
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000,

      // Log files
      error_file: '/home/ubuntu/logs/splendid-error.log',
      out_file: '/home/ubuntu/logs/splendid-out.log',
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',

      env: {
        NODE_ENV: 'development',
        PORT: 5000,
      },

      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
  ],
};
