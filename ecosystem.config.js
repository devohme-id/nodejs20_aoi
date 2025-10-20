// ======================================================
// Smart AOI Dashboard - PM2 Ecosystem Configuration
// ======================================================

export default {
  apps: [
    {
      name: "smart-aoi", // Nama proses di PM2
      script: "./server.js", // Entry point
      instances: "max", // Gunakan semua core CPU
      exec_mode: "cluster", // Mode cluster untuk load balancing
      watch: false, // Nonaktifkan watch (lebih stabil di production)
      max_memory_restart: "1G", // Restart jika > 1GB RAM
      autorestart: true, // Auto restart kalau crash
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      // ✅ BEST PRACTICE: Hapus path log absolut. Biarkan PM2 mengelola log di ~/.pm2/logs.
      // Ini lebih portabel dan menghindari masalah izin pada /var/log.
      // Log dari logger kustom kita akan otomatis ditangkap oleh PM2.
      merge_logs: true,
      time: true, // Tambahkan timestamp di log
    },
  ],

  // ======================================================
  // Log Rotation: Untuk rotasi log otomatis, install `pm2-logrotate`
  // > pm2 install pm2-logrotate
  // ======================================================
  deploy: {}, // tidak dipakai tapi harus ada di ESM export
};
