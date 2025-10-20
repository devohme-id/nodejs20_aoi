/**
 * @file Defines the event-related API endpoints for the Smart AOI Dashboard.
 * Handles server-sent events (SSE) to push real-time updates to connected clients.
 */
import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();
const router = express.Router();

/** @const {mysql.Pool} pool Database connection pool for polling events */
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

// Fungsi untuk mengirim update ke semua client yang terhubung
/**
 * Sends an event to all connected clients.
 * @param {object} data - The data to send to the clients.
 */
function sendEventToClients(data) {
  clients.forEach((client) => {
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

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

/**
 * SSE endpoint that keeps a persistent connection open with clients.
 */
const pollingInterval = setInterval(pollDatabase, 1500);
/** @const {setInterval} pollingInterval - Interval to poll the database */
// Endpoint utama SSE
router.get("/", (req, res) => {
  // Set header untuk koneksi SSE
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    Connection: "keep-alive",
    "Cache-Control": "no-cache",
  });

  // Kirim pesan "connected"
  res.write('data: {"type":"connected"}\n\n');

  // Simpan koneksi client
  const clientId = Date.now();
  const newClient = { id: clientId, res: res };
  clients.push(newClient);
  console.log(`✅ Client SSE terhubung: ${clientId}. Total: ${clients.length}`);

  // ✨ OPTIMASI: Kirim "heartbeat" setiap 20 detik untuk menjaga koneksi tetap hidup
  // Beberapa proxy atau load balancer akan memutus koneksi yang idle.
  const keepAliveInterval = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 20000);

  // Saat client disconnect
  req.on("close", () => {
    // Hentikan interval heartbeat untuk client ini
    clearInterval(keepAliveInterval);

    clients = clients.filter((client) => client.id !== clientId);
    console.log(
      `🔌 Client SSE terputus: ${clientId}. Total: ${clients.length}`
    );
  });
});

/**
 * Gracefully shuts down the SSE module.
 */
export async function shutdownEvents() {
  console.log("🔌 Shutting down SSE module...");
  // 1. Hentikan polling database
  clearInterval(pollingInterval);
  // 2. Tutup semua koneksi client SSE yang aktif
  clients.forEach((client) => client.res.end());
  clients = []; // Kosongkan array
  // 3. Tutup koneksi pool database
  await pool.end();
  console.log("✅ SSE module shut down gracefully.");
}

export default router;
