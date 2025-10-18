// File: api/get_dashboard_data.js
import express from "express";
import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const router = express.Router();
const debugMode = process.env.DEBUG_MODE === "true";

// ======================================================
// Config: Database Pool (use env vars, jangan hardcode creds)
// ======================================================
const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "aoi_dashboard",
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONN_LIMIT || "10", 10),
  queueLimit: 0,
  timezone: "Z", // store as UTC in node; format when returning
});

// ======================================================
// Simple in-memory cache (optional)
// ======================================================
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS || 5000); // default 5s
let cache = { value: null, expiresAt: 0 };

function getFromCache(key) {
  if (cache.value && Date.now() < cache.expiresAt) {
    if (debugMode) console.log("🔁 cache hit");
    return cache.value;
  }
  if (debugMode) console.log("❌ cache miss");
  return null;
}

function setCache(key, value, ttl = CACHE_TTL_MS) {
  cache.value = value;
  cache.expiresAt = Date.now() + ttl;
}

// ======================================================
// Constants & Helpers
// ======================================================
const CRITICAL_DEFECTS = [
  "SHORT SOLDER",
  "POOR SOLDER",
  "BALL SOLDER",
  "NO SOLDER",
  "WRONG POLARITY",
  "WRONG COMPONENT",
];

const jakartaFormatter = new Intl.DateTimeFormat("id-ID", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
  timeZone: "Asia/Jakarta",
});

function createDefaultDetails() {
  return {
    time: "N/A",
    component_ref: "N/A",
    part_number: "N/A",
    machine_defect: "N/A",
    inspection_result: "N/A",
    review_result: "N/A",
  };
}

function createDefaultKpi() {
  return {
    assembly: "N/A",
    lot_code: "N/A",
    total_inspected: 0,
    total_pass: 0,
    total_defect: 0,
    total_false_call: 0,
    pass_rate: 0,
    ppm: 0,
  };
}

function createDefaultComparison() {
  return {
    before: createDefaultKpi(),
    current: createDefaultKpi(),
  };
}

function calculateKpiMetrics(result) {
  const inspected = Number(result.Inspected || 0);
  const pass = Number(result.Pass || 0);
  const defect = Number(result.Defect || 0);
  const falseCall = Number(result.FalseCall || 0);

  return {
    assembly: result.Assembly || "N/A",
    lot_code: result.LotCode || "N/A",
    total_inspected: inspected,
    total_pass: pass,
    total_defect: defect,
    total_false_call: falseCall,
    pass_rate: inspected > 0 ? Number(((pass / inspected) * 100).toFixed(2)) : 0,
    ppm: inspected > 0 ? Math.round((defect / inspected) * 1000000) : 0,
  };
}

// ======================================================
// DB Queries (as constants to keep code tidy)
// ======================================================
const LATEST_PANELS_SQL = `
  WITH LatestPanel AS (
    SELECT i.*, d.ComponentRef, d.PartNumber, d.ReworkDefectCode, d.MachineDefectCode, d.ImageFileName,
           ROW_NUMBER() OVER(PARTITION BY i.LineID ORDER BY i.EndTime DESC) AS rn
    FROM Inspections i
    LEFT JOIN Defects d ON i.InspectionID = d.InspectionID
  )
  SELECT * FROM LatestPanel WHERE rn = 1;
`;

const KPI_AGG_SQL = `
  SELECT Assembly, LotCode, COUNT(InspectionID) AS Inspected,
         SUM(CASE WHEN FinalResult = 'Pass' THEN 1 ELSE 0 END) AS Pass,
         SUM(CASE WHEN FinalResult = 'Defective' THEN 1 ELSE 0 END) AS Defect,
         SUM(CASE WHEN FinalResult IN ('False Fail', 'Unreviewed') THEN 1 ELSE 0 END) AS FalseCall
  FROM Inspections
  WHERE LineID = ? AND Assembly = ? AND LotCode = ? AND TuningCycleID = ?
  GROUP BY Assembly, LotCode
`;

// ======================================================
// Helper: Process one line (can be run in parallel)
// ======================================================
async function processLine(lineNumber, panelData, conn) {
  const lineData = {
    status: "INACTIVE",
    details: createDefaultDetails(),
    kpi: createDefaultKpi(),
    comparison_data: createDefaultComparison(),
    image_url: null,
    is_critical_alert: false,
  };

  try {
    if (!panelData) return lineData;

    lineData.status = panelData.FinalResult || "INACTIVE";
    lineData.details = {
      time: panelData.EndTime
        ? jakartaFormatter.format(new Date(panelData.EndTime))
        : "N/A",
      component_ref: panelData.ComponentRef || "N/A",
      part_number: panelData.PartNumber || "N/A",
      machine_defect: panelData.MachineDefectCode || "N/A",
      inspection_result: panelData.InitialResult || "N/A",
      review_result: panelData.FinalResult || "N/A",
    };

    lineData.is_critical_alert = CRITICAL_DEFECTS.includes(
      (panelData.MachineDefectCode || "").toUpperCase()
    );

    if (panelData.ImageFileName) {
      // Support both backslash and forward slash paths
      const parts = panelData.ImageFileName.split(/\\|\//);
      const dateFolder = parts[0];
      const actualFile = parts[parts.length - 1];
      lineData.image_url = `/api/image?line=${lineNumber}&date=${encodeURIComponent(
        dateFolder
      )}&file=${encodeURIComponent(actualFile)}`;
    }

    // KPI now
    const currentAssembly = panelData.Assembly;
    const currentLot = panelData.LotCode;
    const currentCycle = Number(panelData.TuningCycleID) || 0;

    if (currentAssembly && currentLot && currentCycle > 0) {
      const [kpiRows] = await conn.execute(KPI_AGG_SQL, [
        lineNumber,
        currentAssembly,
        currentLot,
        currentCycle,
      ]);

      if (kpiRows.length > 0) {
        lineData.kpi = calculateKpiMetrics(kpiRows[0]);
      }

      // comparison: previous cycle
      lineData.comparison_data.current = lineData.kpi;
      if (currentCycle > 1) {
        const prevCycle = currentCycle - 1;
        const [beforeRows] = await conn.execute(KPI_AGG_SQL, [
          lineNumber,
          currentAssembly,
          currentLot,
          prevCycle,
        ]);
        if (beforeRows.length > 0) {
          lineData.comparison_data.before = calculateKpiMetrics(beforeRows[0]);
        }
      }
    } else {
      // If cycle/lot/assembly not available, we leave KPI defaults
      if (debugMode) console.log(`Line ${lineNumber} missing assembly/lot/cycle.`);
    }
  } catch (err) {
    // Per-line errors shouldn't break whole payload — log and return defaults/enhanced info
    console.error(`Error processing line ${lineNumber}:`, err.stack || err.message);
  }

  return lineData;
}

// ======================================================
// Main: getDashboardData (using parallel processing)
// ======================================================
async function getDashboardData(conn) {
  const response = { lines: {} };

  // 1) Fetch the latest panel per line (single query)
  const [panelRows] = await conn.query(LATEST_PANELS_SQL);

  const latestPanels = {};
  for (const row of panelRows) {
    latestPanels[row.LineID] = row;
  }

  // 2) Prepare an array of promises (one per line), run in parallel
  const linePromises = [];
  for (let i = 1; i <= 6; i++) {
    linePromises.push(
      processLine(i, latestPanels[i] || null, conn).then((lineData) => {
        response.lines[`line_${i}`] = lineData;
      })
    );
  }

  await Promise.all(linePromises);
  return response;
}

// ======================================================
// Route: GET / (with pool & caching)
// ======================================================
router.get("/", async (req, res) => {
  // Try cache first
  const cached = getFromCache("dashboard");
  if (cached) return res.json(cached);

  let conn;
  try {
    conn = await pool.getConnection();

    // Run main data fetch
    const data = await getDashboardData(conn);

    // Set cache (if TTL > 0)
    if (CACHE_TTL_MS > 0) setCache("dashboard", data, CACHE_TTL_MS);

    return res.json(data);
  } catch (err) {
    console.error("❌ API Error:", err.stack || err.message);
    return res.status(500).json({ error: `API Error: ${err.message}` });
  } finally {
    if (conn) conn.release();
  }
});

export default router;
