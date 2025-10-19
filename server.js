// ======================================================
// Smart AOI Dashboard - Node.js Server
// ======================================================
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";

// Import API routes
import dashboardRouter from "./api/dashboard.js";
import imageRouter from "./api/images.js";
import eventRouter from "./api/events.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
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
  console.error("💥 Uncaught error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// ======================================================
// Start Server
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log("==========================================");
  console.log("✅ Smart AOI Dashboard Server is running!");
  console.log(`🌐 http://localhost:${PORT}`);
  console.log("------------------------------------------");
});

// ======================================================
// Graceful Shutdown
// ======================================================
process.on("SIGTERM", () => {
  console.log("🛑 Server shutting down gracefully...");
  process.exit(0);
});
