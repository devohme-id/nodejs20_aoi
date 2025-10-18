// ======================================================
// Smart AOI Dashboard - PM2 Ecosystem Configuration
// ======================================================

export default {
  apps: [
    {
      name: "smart-aoi",                     // Nama proses di PM2
      script: "./server.js",                 // Entry point
      instances: "max",                      // Gunakan semua core CPU
      exec_mode: "cluster",                  // Mode cluster untuk load balancing
      watch: false,                          // Nonaktifkan watch (lebih stabil di production)
      max_memory_restart: "1G",              // Restart jika > 1GB RAM
      autorestart: true,                     // Auto restart kalau crash
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/var/log/pm2/smart-aoi-error.log",
      out_file: "/var/log/pm2/smart-aoi-out.log",
      merge_logs: true,
      time: true,                            // Tambahkan timestamp di log
    },
  ],

  // ======================================================
  // Log Rotation (opsional tapi sangat direkomendasikan)
  // ======================================================
  deploy: {}, // tidak dipakai tapi harus ada di ESM export
};
