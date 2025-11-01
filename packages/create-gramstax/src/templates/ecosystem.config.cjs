module.exports = {
  apps: [
    {
      name: `{{projectName}}`, // Process name (appears in 'pm2 list')
      script: `bun`, // Main command to run (using Bun runtime)
      args: `src/index.ts`, // Arguments for the command (entry file)
      instances: 1, // Number of instances (use 'max' for multi-core)
      exec_mode: `fork`, // Cluster mode (PM2 will balance across cores)
      autorestart: true, // Automatically restart if the process crashes
      watch: false, // Disable auto-reload on file changes (set true for dev)
      max_memory_restart: undefined, // Restart if memory usage exceeds (default undefined)
      env: {
        NODE_ENV: `production`, // Default environment variables
      },
      env_production: {
        NODE_ENV: `production`, // Environment variables for production mode
      },
      error_file: `./logs/err.log`, // Error log file
      out_file: `./logs/out.log`, // Standard output log file
      log_file: `./logs/combined.log`, // Combined log file
      time: false, // Add timestamps to logs
      merge_logs: false, // Merge logs from multiple instances
      log_date_format: `YYYY-MM-DD HH:mm:ss Z`, // Log date format
    },
  ],
};
