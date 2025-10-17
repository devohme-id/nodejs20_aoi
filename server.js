// ======================================================
// Smart AOI Dashboard - Node.js Server
// ======================================================
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// Import API routes
import dashboardRouter from "./api/get_dashboard_data.js";
import imageRouter from "./api/get_image.js";

// Setup base path references
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ======================================================
// Middleware
// ======================================================
app.use(cors());
app.use(express.json());

// Serve static frontend (HTML, CSS, JS, assets)
app.use(express.static(path.join(__dirname, "public")));

// ======================================================
// API Routes
// ======================================================
app.use("/api/dashboard", dashboardRouter); // Data API
app.use("/api", imageRouter);               // Image API (/api/image & /api/get_image.php)

// ======================================================
// Default Route (serve index.html for SPA/frontpage)
// ======================================================
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ======================================================
// Start Server
// ======================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("==========================================");
  console.log("✅ Smart AOI Dashboard Server is running!");
  console.log(`🌐 http://localhost:${PORT}`);
  console.log("------------------------------------------");
  console.log("📊 API (Dashboard): /api/dashboard");
  console.log("🖼️  API (Images):   /api/image?line=5&date=20251017&file=xxx.jpg");
  console.log("==========================================");
});
