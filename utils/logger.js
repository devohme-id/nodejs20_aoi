// /utils/logger.js

const isProduction = process.env.NODE_ENV === "production";

// Kode warna untuk log di development
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

/**
 * Fungsi log dasar.
 * @param {'info' | 'warn' | 'error' | 'debug'} level - Level log.
 * @param {string} color - Kode warna untuk konsol.
 * @param {string} message - Pesan log.
 * @param {object} [context] - Objek konteks tambahan.
 */
const log = (level, color, message, context) => {
  const timestamp = new Date().toISOString();

  if (isProduction) {
    // Di produksi, log sebagai JSON agar mudah diproses oleh sistem lain
    console.log(JSON.stringify({ level, timestamp, message, ...context }));
  } else {
    // Di development, gunakan log berwarna agar mudah dibaca
    const contextString = context ? `\n${JSON.stringify(context, null, 2)}` : "";
    const levelString = `[${level.toUpperCase()}]`.padEnd(7);
    console.log(
      `${color}${levelString}${colors.reset} ${timestamp} - ${message}${contextString}`
    );
  }
};

const logger = {
  info: (message, context) => log("info", colors.cyan, message, context),
  warn: (message, context) => log("warn", colors.yellow, message, context),
  error: (message, err, context) => {
    log("error", colors.red, err ? err.message : message, { ...context, stack: err ? err.stack : undefined });
  },
};

export default logger;