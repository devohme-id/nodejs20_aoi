// ======================================================
// Smart AOI Dashboard - Fastify Server
// ======================================================
import Fastify from "fastify"; // FASTIFY: Import Fastify
import "dotenv/config";
import path from "path";
import { fileURLToPath } from "url";
import logger from "./utils/logger.js";

// FASTIFY: Import plugin-plugin
import fastifyCors from "@fastify/cors";
import fastifyRateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";

// FASTIFY: 1. Import plugin mysql
import fastifyMySql from "@fastify/mysql";

// Import API routes (Ini JUGA harus dikonversi ke format plugin Fastify)
import dashboardRouter from "./api/dashboard.js";
import imageRouter from "./api/images.js";
import eventRouter, { shutdownEvents } from "./api/events.js"; // IMPORT shutdown function

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const isProduction = process.env.NODE_ENV === "production";

// FASTIFY: Inisialisasi Fastify.
// Kita nonaktifkan logger bawaan Fastify (pino) karena Anda punya logger kustom (winston/dll)
const fastify = Fastify({
  logger: false,
});

// =================================================================
// ✨ Graceful Shutdown Logic (Fastify Version)
// =================================================================
// Didefinisikan di awal agar bisa di-attach sebelum server start
const gracefulShutdown = async (signal) => {
  logger.warn(`🚦 ${signal} received. Shutting down gracefully...`);
  try {
    // FASTIFY: Gunakan fastify.close()
    await fastify.close();
    logger.info("✅ HTTP server closed.");

    // Tutup semua koneksi persisten (SSE, DB Pool, etc)
    await shutdownEvents(); // Logika ini tetap sama
    logger.info("🏁 All resources cleaned up. Exiting.");
    process.exit(0);
  } catch (err) {
    logger.error("💥 Error during graceful shutdown", err);
    process.exit(1);
  }
};

// ======================================================
// Fungsi Start Server Utama
// ======================================================
const startServer = async () => {
  try {
    // ======================================================
    // Middleware (Plugins)
    // ======================================================
    // FASTIFY: express.json() sudah built-in, tidak perlu plugin.
    await fastify.register(fastifyCors);

    // FASTIFY: 2. Daftarkan plugin @fastify/mysql
    // Ini harus dilakukan di 'fastify' instance utama,
    // SEBELUM mendaftarkan 'apiInstance'
    await fastify.register(fastifyMySql, {
      promise: true, // <-- PENTING! Agar bisa pakai async/await (seperti mysql2/promise)
      host: process.env.DB_HOST || "127.0.0.1",
      user: process.env.DB_USER || "root",
      password: process.env.DB_PASS || "",
      database: process.env.DB_NAME || "aoi_dashboard",
      waitForConnections: true,
      connectionLimit: parseInt(process.env.DB_CONN_LIMIT || "10", 10),
      queueLimit: 0,
      timezone: "Z",
    });

    // ======================================================
    // API Routes & Rate Limiter
    // ======================================================
    // FASTIFY: Cara terbaik untuk menerapkan middleware/plugin ke grup rute
    // adalah dengan mendaftarkan plugin baru yang di-"encapsulate".
    await fastify.register(
      async (apiInstance, opts) => {
        // 1. Terapkan Rate Limiter HANYA untuk plugin ini (semua di bawah /api)
        await apiInstance.register(fastifyRateLimit, {
          windowMs: 5000, // 5 detik
          max: 300, // max 300 request/5 detik/IP
          // standardHeaders: true, // (Opsi di @fastify/rate-limit sedikit berbeda)
          // legacyHeaders: false,
        });

        // 2. Daftarkan rute API Anda di dalam instance ini
        // PENTING: Lihat Peringatan di bawah. File-file ini harus diubah!
        await apiInstance.register(dashboardRouter, { prefix: "/dashboard" });
        await apiInstance.register(imageRouter, { prefix: "/image" });
        await apiInstance.register(eventRouter, { prefix: "/events" });
      },
      { prefix: "/api" } // Terapkan prefix /api ke semua rute di atas
    );

    // ======================================================
    // Serve Static Frontend (Hanya untuk Produksi)
    // ======================================================
    if (isProduction) {
      const clientBuildPath = path.join(__dirname, "dist");

      // 1. Sajikan aset yang sudah di-build dari folder 'dist'
      await fastify.register(fastifyStatic, {
        root: clientBuildPath,
        prefix: "/", // Sajikan dari root
      });

      // 2. Untuk permintaan lain yang bukan API, sajikan index.html
      // FASTIFY: Menggunakan setNotFoundHandler untuk fallback client-side routing
      fastify.setNotFoundHandler(async (request, reply) => {
        // Hanya lakukan fallback untuk request non-API
        if (!request.raw.url.startsWith("/api")) {
          return reply.sendFile("index.html", clientBuildPath);
        }
        // Biarkan API 404
        reply.code(404).send({ error: "Not Found" });
      });
    }

    // ======================================================
    // Global Error Handler
    // ======================================================
    // FASTIFY: Gunakan setErrorHandler
    fastify.setErrorHandler((error, request, reply) => {
      logger.error("💥 Uncaught error", error, { url: request.raw.url });

      const errorResponse = {
        error: isProduction ? "Internal Server Error" : error.message,
      };

      // Gunakan status code dari error jika ada, atau 500
      const statusCode = error.statusCode || 500;
      reply.status(statusCode).send(errorResponse);
    });

    // ======================================================
    // Attach Graceful Shutdown Handlers
    // ======================================================
    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    // ======================================================
    // Start Server
    // ======================================================
    const PORT = process.env.PORT || 3000;
    await fastify.listen({ port: PORT, host: "0.0.0.0" });

    logger.info("==========================================");
    logger.info("✅ Smart AOI Dashboard Server is running! (Fastify)");
    logger.info(`🌐 Listening on http://0.0.0.0:${PORT}`);
    logger.info("------------------------------------------");
  } catch (err) {
    logger.error("💥 Error starting server", err);
    process.exit(1);
  }
};

// Jalankan server
startServer();
