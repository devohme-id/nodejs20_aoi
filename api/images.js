// File: api/get_image.js
import express from "express";
import fs from "fs";
import path from "path";
import logger from "../utils/logger.js";

const router = express.Router();

// Cache untuk path check agar gak sering I/O
const cache = new Map();
const CACHE_TTL = 5000; // ms

function getCachedStat(filePath) {
  const now = Date.now();
  const entry = cache.get(filePath);
  if (entry && now - entry.time < CACHE_TTL) return entry.exists;
  const exists = fs.existsSync(filePath);
  cache.set(filePath, { exists, time: now });
  return exists;
}

router.get("/", (req, res) => {
  const line = parseInt(req.query.line, 10);
  const date = (req.query.date || "").replace(/[^0-9]/g, "");
  const file = path.basename(req.query.file || "");

  if (!line || !file) {
    return res.status(400).send("Invalid parameters.");
  }

  // *** PERBAIKAN: Baca path dari environment variables ***
  const basePath = process.env[`LINE_${line}_IMAGE_PATH`];
  if (!basePath) {
    return res.status(404).send("Invalid line ID.");
  }

  let imagePath = path.join(basePath, date || "", file);

  if (!getCachedStat(imagePath)) {
    // Kadang folder tanggal belum sinkron → coba tanpa date
    const fallbackPath = path.join(basePath, file);
    if (!getCachedStat(fallbackPath)) {
      res.status(404).type("text/plain").send("Image not found");
      return;
    }
    imagePath = fallbackPath;
  }

  const stream = fs.createReadStream(imagePath);
  const ext = path.extname(file).toLowerCase();
  const mime =
    ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : ext === ".png"
      ? "image/png"
      : "application/octet-stream";

  res.setHeader("Content-Type", mime);
  res.setHeader("Cache-Control", "no-store");
  stream.pipe(res);

  stream.on("error", (err) => {
    logger.error("Error reading image stream", err, { imagePath });
    res.status(500).type("text/plain").send("Error reading image");
  });
});

export default router;
