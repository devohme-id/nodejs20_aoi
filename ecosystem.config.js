/**
 * @file PM2 Ecosystem Configuration for Smart AOI Dashboard
 * This file configures PM2 to manage the Smart AOI Dashboard application,
 * ensuring high availability and performance.
 */
module.exports = {
  apps: [
    {
      name: "smart-aoi",
      script: "server.js",
      instances: "max",
      exec_mode: "cluster",
      watch: false,
      max_memory_restart: "1G",
      autorestart: true,
      env: { NODE_ENV: "production" },
      kill_timeout: 5000,
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
    },
  ],
};
