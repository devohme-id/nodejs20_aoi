// File: api/images.js (Fastify Version)
// FASTIFY: Hapus import express
import fs from "fs";
import path from "path";
import sharp from "sharp"; // ✨ NEW: Import sharp untuk konversi gambar
import logger from "../utils/logger.js";

// FASTIFY: 'router' tidak lagi digunakan

// Cache untuk path check agar gak sering I/O
// (Logika cache ini TIDAK BERUBAH)
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

// FASTIFY: Definisikan rute sebagai Plugin
async function imageRoutes(fastify, options) {
  // FASTIFY: 'router.get' -> 'fastify.get'
  // Handler tidak perlu 'async' karena kita mendelegasikan stream
  fastify.get("/", (request, reply) => {
    // ✨ NEW: Set timeout 1 detik untuk request gambar.
    // FASTIFY: 'res.setTimeout' -> 'reply.raw.setTimeout'
    reply.raw.setTimeout(1000, () => {
      // FASTIFY: 'req.query' -> 'request.query'
      logger.warn("Image request timed out after 1 seconds", {
        query: request.query,
      });

      // FASTIFY: 'res.headersSent' -> 'reply.sent'
      if (!reply.sent) {
        // Jika belum ada data terkirim, kirim status error yang sesuai.
        // FASTIFY: 'res.status().type().send()' -> 'reply.code().type().send()'
        reply.code(504).type("text/plain").send("Image processing timed out.");
      } else {
        // FASTIFY: 'res.socket.destroy()' -> 'reply.raw.socket.destroy()'
        // Jika data sudah mulai dikirim, hancurkan koneksi.
        reply.raw.socket.destroy();
      }
    });

    // FASTIFY: 'req.query' -> 'request.query'
    const line = parseInt(request.query.line, 10);
    const date = (request.query.date || "").replace(/[^0-9]/g, "");
    const file = path.basename(request.query.file || "");

    if (!line || !file) {
      // FASTIFY: 'res.status().send()' -> 'reply.code().send()'
      return reply.code(400).send("Invalid parameters.");
    }

    // *** PERBAIKAN: Baca path dari environment variables ***
    const basePath = process.env[`LINE_${line}_IMAGE_PATH`];
    if (!basePath) {
      return reply.code(404).send("Invalid line ID.");
    }

    let imagePath = path.join(basePath, date || "", file);

    if (!getCachedStat(imagePath)) {
      // Kadang folder tanggal belum sinkron → coba tanpa date
      const fallbackPath = path.join(basePath, file);
      if (!getCachedStat(fallbackPath)) {
        return reply.code(404).type("text/plain").send("Image not found");
      }
      imagePath = fallbackPath;
    }

    // ✨ NEW: Konversi gambar ke WebP on-the-fly menggunakan sharp
    // FASTIFY: 'res.setHeader' -> 'reply.header'
    reply.header("Content-Type", "image/webp");
    // Cache di browser selama 1 jam, karena gambar lama tidak berubah
    reply.header("Cache-Control", "public, max-age=3600");

    const converter = sharp(imagePath).webp({ quality: 80 }); // Kualitas 80 adalah kompromi yang baik

    // FASTIFY: Blok 'converter.on("error", ...)' DIHAPUS.
    // Fastify akan menangani error stream secara otomatis
    // dan meneruskannya ke 'setErrorHandler' global Anda.

    // FASTIFY: 'converter.pipe(res)' -> 'reply.send(converter)'
    // Cukup kirim stream-nya, Fastify akan menanganinya.
    return reply.send(converter);
  });
}

// FASTIFY: Ekspor fungsi plugin-nya
export default imageRoutes;
