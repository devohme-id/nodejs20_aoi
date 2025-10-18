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
import dashboardRouter from "./api/get_dashboard_data.js";
import imageRouter from "./api/get_image.js";

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();

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
  max: 300,       // max 200 request/5 detik/IP
  standardHeaders: true,
  legacyHeaders: false,
});

// ======================================================
// API Routes
// ======================================================
app.use("/api/dashboard", apiLimiter, dashboardRouter);
app.use("/api/image", imageRouter);

// ======================================================
// Serve Static Frontend
// ======================================================
app.use(express.static(path.join(__dirname, "public")));

// ======================================================
// Default Route
// ======================================================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

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
  console.log("📊 API (Dashboard): /api/dashboard");
  console.log("🖼️  API (Images):   /api/image?line=5&date=20251017&file=xxx.jpg");
  console.log("==========================================");
});

// ======================================================
// Graceful Shutdown
// ======================================================
process.on("SIGTERM", () => {
  console.log("🛑 Server shutting down gracefully...");
  process.exit(0);
});
