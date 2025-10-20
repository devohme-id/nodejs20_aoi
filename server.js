// ======================================================
// Smart AOI Dashboard - Node.js Server
// ======================================================
import express from "express";
import "dotenv/config"; // ✅ BEST PRACTICE: Load env vars di paling awal
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import logger from "./utils/logger.js"; // ✨ NEW: Import logger terpusat

// Import API routes
import dashboardRouter from "./api/dashboard.js";
import imageRouter from "./api/images.js";
import eventRouter, { shutdownEvents } from "./api/events.js"; // ✨ IMPORT shutdown function

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === "production";

// ======================================================
// Middleware
// ======================================================
app.use(cors());
app.use(express.json());

// ======================================================
// Rate Limiter (before API)
// ======================================================
const apiLimiter = rateLimit({
  windowMs: 5000, // 5 detik
  max: 300, // max 300 request/5 detik/IP
  standardHeaders: true,
  legacyHeaders: false,
});

// ======================================================
// API Routes
// ======================================================
app.use("/api", apiLimiter); // Terapkan rate limiter ke semua rute API
app.use("/api/dashboard", dashboardRouter);
app.use("/api/image", imageRouter);
app.use("/api/events", eventRouter);

// ======================================================
// Serve Static Frontend (Hanya untuk Produksi)
// ======================================================
if (isProduction) {
  const clientBuildPath = path.join(__dirname, "dist");

  // 1. Sajikan aset yang sudah di-build dari folder 'dist'
  app.use(express.static(clientBuildPath));

  // 2. Untuk permintaan lain yang bukan API, sajikan index.html
  // Ini memungkinkan routing sisi klien (client-side routing) berfungsi.
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

// ======================================================
// Global Error Handler
// ======================================================
app.use((err, req, res, next) => {
  logger.error("💥 Uncaught error", err, { url: req.originalUrl });

  const errorResponse = {
    error: isProduction ? "Internal Server Error" : err.message,
  };
  res.status(500).json(errorResponse);
});

// ======================================================
// Start Server
// ======================================================
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, "0.0.0.0", () => {
  logger.info("==========================================");
  logger.info("✅ Smart AOI Dashboard Server is running!");
  logger.info(`🌐 Listening on http://0.0.0.0:${PORT}`);
  logger.info("------------------------------------------");
});

// =================================================================
// ✨ NEW: Graceful Shutdown Logic
// =================================================================
const gracefulShutdown = (signal) => {
  logger.warn(`🚦 ${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    logger.info("✅ HTTP server closed.");
    try {
      // Tutup semua koneksi persisten (SSE, DB Pool, etc)
      await shutdownEvents();
      logger.info("🏁 All resources cleaned up. Exiting.");
      process.exit(0);
    } catch (err) {
      logger.error("💥 Error during graceful shutdown", err);
      process.exit(1);
    }
  });
};

process.on("SIGTERM", () => gracefulShutdown("SIGTERM")); // Diterima dari PM2 stop/restart
process.on("SIGINT", () => gracefulShutdown("SIGINT")); // Diterima dari PM2 reload atau Ctrl+C
