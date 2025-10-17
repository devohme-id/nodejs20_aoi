import express from "express";
import fs from "fs";
import os from "os";
import path from "path";

const router = express.Router();

// ======================================================
//  get_image.js - Cross Platform SMB / Local Access
// ======================================================

// Mapping path Windows
const windowsPaths = {
  1: "\\\\192.168.0.19\\qx600\\QX600\\Images\\ExportedImages",
  2: "\\\\192.168.0.21\\qx600\\Images\\ExportedImages\\ExportedImages",
  3: "\\\\192.168.0.29\\qx600\\Images\\ExportedImages",
  4: "\\\\192.168.0.25\\qx600\\Images\\ExportedImages",
  5: "\\\\192.168.0.35\\D_Drive\\QX600\\Images\\ExportedImages",
  6: "\\\\192.168.0.23\\D_Drive\\QX600\\Images\\ExportedImages",
};

// Mapping path Linux
const linuxPaths = {
  1: "/mnt/qx600_1",
  2: "/mnt/qx600_2",
  3: "/mnt/qx600_3",
  4: "/mnt/qx600_4",
  5: "/mnt/qx600_5",
  6: "/mnt/qx600_6",
};

// Deteksi OS sekali saja
const isWindows = os.platform().startsWith("win");

// Pilih mapping sesuai OS
const PATH_MAP = isWindows ? windowsPaths : linuxPaths;

// MIME helper
const mimeTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
};

// ======================================================
//  Route utama: /api/image?line=5&date=20251017&file=xxx.jpg
// ======================================================
router.get(["/image", "/get_image.php"], async (req, res) => {
  try {
    const line = parseInt(req.query.line || 0);
    const date = (req.query.date || "").replace(/[^0-9]/g, "");
    const file = path.basename(req.query.file || "");

    if (!line || !file) {
      return res.status(400).send("Invalid parameters: line and file are required.");
    }

    const basePath = PATH_MAP[line];
    if (!basePath) {
      return res.status(404).send(`Invalid line ID: ${line}`);
    }

    // Rangkai path gambar
    let imagePath = path.join(basePath);
    const datePath = path.join(imagePath, date);
    if (date && fs.existsSync(datePath)) {
      imagePath = datePath;
    }
    imagePath = path.join(imagePath, file);

    // Cek file
    if (!fs.existsSync(imagePath)) {
      console.warn(`❌ Image not found: ${imagePath}`);
      return res.status(404).send("Image not found");
    }

    // Tentukan MIME
    const ext = path.extname(file).toLowerCase();
    const mime = mimeTypes[ext] || "application/octet-stream";
    res.setHeader("Content-Type", mime);

    // Stream file langsung ke response
    fs.createReadStream(imagePath).pipe(res);
  } catch (err) {
    console.error("⚠️ Error serving image:", err);
    res.status(500).send("Internal Server Error");
  }
});

export default router;
