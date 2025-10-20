/**
 * @file Defines the event-related API endpoints for the Smart AOI Dashboard.
 * Handles server-sent events (SSE) to push real-time updates to connected clients.
 * (Fastify Version)
 */
// FASTIFY: Hapus import express
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();
// FASTIFY: 'router' tidak lagi digunakan.

/** @const {mysql.Pool} pool Database connection pool for polling events */
// (TIDAK BERUBAH)
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "aoi_dashboard",
  waitForConnections: true,
  connectionLimit: 3, // Cukup 3 koneksi untuk polling
  timezone: "Z",
});

/** @type {Array} clients - Stores all connected frontend clients */
let clients = [];
/** @type {Map} lastTimestamps - Stores the last seen timestamp for each line */
let lastTimestamps = new Map();

/**
 * Sends an event to all connected clients.
 * @param {object} data - The data to send to the clients.
 */
function sendEventToClients(data) {
  // FASTIFY: Menggunakan client.reply.raw untuk menulis ke stream
  clients.forEach((client) => {
    client.reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// (Fungsi pollDatabase TIDAK BERUBAH karena logikanya independen dari framework)
async function pollDatabase() {
  let conn;
  try {
    conn = await pool.getConnection();
    const [rows] = await conn.query(
      "SELECT LineID, LastUpdated FROM DashboardEvents"
    );
    let hasUpdate = false;
    for (const row of rows) {
      const lineID = row.LineID;
      const dbTimestamp = new Date(row.LastUpdated).getTime();
      const lastSeenTimestamp = lastTimestamps.get(lineID) || 0;
      if (dbTimestamp > lastSeenTimestamp) {
        hasUpdate = true;
        lastTimestamps.set(lineID, dbTimestamp);
        console.log(`⚡ Event: Update terdeteksi di Line ${lineID}`);
      }
    }
    if (hasUpdate) {
      sendEventToClients({ type: "data_update", timestamp: Date.now() });
    }
  } catch (err) {
    console.error("❌ Error polling DashboardEvents:", err.message);
  } finally {
    if (conn) conn.release();
  }
}

/** @const {setInterval} pollingInterval - Interval to poll the database */
const pollingInterval = setInterval(pollDatabase, 1500);

// ======================================================
// FASTIFY: Definisikan rute sebagai Plugin
// ======================================================
async function eventRoutes(fastify, options) {
  // Endpoint utama SSE
  // FASTIFY: Rute tidak mengembalikan apa-apa karena koneksi tetap terbuka
  fastify.get("/", (request, reply) => {
    // FASTIFY: Set header secara manual menggunakan objek 'raw' response dari Node.js
    const headers = {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache",
    };
    reply.raw.writeHead(200, headers);

    // Kirim pesan "connected"
    reply.raw.write('data: {"type":"connected"}\n\n');

    // Simpan koneksi client
    const clientId = Date.now();
    // FASTIFY: Simpan objek 'reply' dari Fastify, bukan 'res' dari Express
    const newClient = { id: clientId, reply: reply };
    clients.push(newClient);
    console.log(
      `✅ Client SSE terhubung: ${clientId}. Total: ${clients.length}`
    );

    // ✨ OPTIMASI: Kirim "heartbeat" setiap 20 detik untuk menjaga koneksi tetap hidup
    const keepAliveInterval = setInterval(() => {
      // Pastikan koneksi masih terbuka sebelum menulis
      if (!reply.raw.writableEnded) {
        reply.raw.write(": keep-alive\n\n");
      }
    }, 20000);

    // Saat client disconnect
    // FASTIFY: Gunakan 'request.raw' untuk mengakses event 'close' dari Node.js
    request.raw.on("close", () => {
      // Hentikan interval heartbeat untuk client ini
      clearInterval(keepAliveInterval);

      clients = clients.filter((client) => client.id !== clientId);
      console.log(
        `🔌 Client SSE terputus: ${clientId}. Total: ${clients.length}`
      );
    });
  });
}

/**
 * Gracefully shuts down the SSE module.
 */
export async function shutdownEvents() {
  console.log("🔌 Shutting down SSE module...");
  // 1. Hentikan polling database
  clearInterval(pollingInterval);
  // 2. Tutup semua koneksi client SSE yang aktif
  // FASTIFY: Gunakan client.reply.raw.end()
  clients.forEach((client) => {
    if (!client.reply.raw.writableEnded) {
      client.reply.raw.end();
    }
  });
  clients = []; // Kosongkan array
  // 3. Tutup koneksi pool database
  await pool.end();
  console.log("✅ SSE module shut down gracefully.");
}

// FASTIFY: Ekspor fungsi plugin sebagai default
export default eventRoutes;
