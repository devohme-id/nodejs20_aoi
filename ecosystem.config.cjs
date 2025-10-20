// ======================================================
// Smart AOI Dashboard - PM2 Ecosystem Configuration
// ======================================================
// File ini menggunakan format CommonJS (module.exports) agar kompatibel
// dengan semua versi PM2.

module.exports = {
  apps: [
    {
      name: "smart-aoi", // Nama proses di PM2
      script: "server.js", // Entry point, path relatif dari root proyek
      instances: "max", // Gunakan semua core CPU
      exec_mode: "cluster", // Mode cluster untuk load balancing
      watch: false, // Nonaktifkan watch (lebih stabil di production)
      max_memory_restart: "1G", // Restart jika > 1GB RAM
      autorestart: true, // Auto restart kalau crash
      env: { NODE_ENV: "production" }, // PORT lebih baik diatur di file .env
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z", // Format timestamp modern
    },
  ],
};
