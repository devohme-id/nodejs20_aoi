// File: api/get_image.js
import express from "express";
import fs from "fs";
import path from "path";
import os from "os";

const router = express.Router();

// Path mapping Linux & macOS
const LINUX_PATHS = {
  1: "/mnt/qx600_1",
  2: "/mnt/qx600_2",
  3: "/mnt/qx600_3",
  4: "/mnt/qx600_4",
  5: "/mnt/qx600_5",
  6: "/mnt/qx600_6",
};

// Path mapping Windows (jika nanti server pindah OS)
const WINDOWS_PATHS = {
  1: "\\\\192.168.0.19\\qx600\\QX600\\Images\\ExportedImages",
  2: "\\\\192.168.0.21\\qx600\\Images\\ExportedImages\\ExportedImages",
  3: "\\\\192.168.0.29\\qx600\\Images\\ExportedImages",
  4: "\\\\192.168.0.25\\qx600\\Images\\ExportedImages",
  5: "\\\\192.168.0.35\\D_Drive\\QX600\\Images\\ExportedImages",
  6: "\\\\192.168.0.23\\D_Drive\\QX600\\Images\\ExportedImages",
};

// Deteksi OS
const isWindows = os.platform().startsWith("win");

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

  const basePath = isWindows ? WINDOWS_PATHS[line] : LINUX_PATHS[line];
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
    console.error("Error reading image:", err);
    res.status(500).type("text/plain").send("Error reading image");
  });
});

export default router;
