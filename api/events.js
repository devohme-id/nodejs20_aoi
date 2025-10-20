// File: api/events.js
import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();
const router = express.Router();

// ======================================================
// Database Pool (khusus untuk polling event)
// ======================================================
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "aoi_dashboard",
  waitForConnections: true,
  connectionLimit: 3, // Cukup 3 koneksi untuk polling
  timezone: "Z",
});

// ======================================================
// Logika SSE (Server-Sent Events)
// ======================================================

let clients = []; // Menyimpan semua koneksi frontend
let lastTimestamps = new Map(); // Menyimpan timestamp terakhir yang kita lihat

// Fungsi untuk mengirim update ke semua client yang terhubung
function sendEventToClients(data) {
  clients.forEach((client) => {
    // Format SSE: "data: {json_string}\n\n"
    client.res.write(`data: ${JSON.stringify(data)}\n\n`);
  });
}

// Fungsi untuk mem-polling database (hanya 1x dari server)
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
        // Ada update!
        hasUpdate = true;
        lastTimestamps.set(lineID, dbTimestamp);
        console.log(`⚡ Event: Update terdeteksi di Line ${lineID}`);
      }
    }

    if (hasUpdate) {
      // Kirim sinyal "update" ke semua client
      sendEventToClients({ type: "data_update", timestamp: Date.now() });
    }
  } catch (err) {
    console.error("❌ Error polling DashboardEvents:", err.message);
  } finally {
    if (conn) conn.release();
  }
}

// Mulai server-side polling (sangat ringan)
// Cukup cek setiap 2 detik. Jauh lebih ringan daripada N klien x 5 detik.
setInterval(pollDatabase, 1500);

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

  // Saat client disconnect
  req.on("close", () => {
    clients = clients.filter((client) => client.id !== clientId);
    console.log(
      `🔌 Client SSE terputus: ${clientId}. Total: ${clients.length}`
    );
  });
});

export default router;
