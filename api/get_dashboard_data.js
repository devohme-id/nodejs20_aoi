// File: api/get_dashboard_data.js
import express from "express";
import mysql from "mysql2/promise";

const router = express.Router();
const debugMode = false;

// ======================================================
// Konfigurasi Database — gunakan Pool untuk efisiensi
// ======================================================
const pool = mysql.createPool({
  host: "192.168.12.204",
  user: "db_admin",
  password: "ohm@2025",
  database: "aoi_dashboard",
  waitForConnections: true,
  connectionLimit: 10, // batas maksimal koneksi aktif
  queueLimit: 0,       // antrean tak terbatas
});

// ======================================================
// Konstanta & Helper Functions
// ======================================================
const CRITICAL_DEFECTS = [
  "SHORT SOLDER",
  "POOR SOLDER",
  "BALL SOLDER",
  "NO SOLDER",
  "WRONG POLARITY",
  "WRONG COMPONENT",
];

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
    pass_rate: inspected > 0 ? ((pass / inspected) * 100).toFixed(2) : 0,
    ppm: inspected > 0 ? Math.round((defect / inspected) * 1000000) : 0,
  };
}

// ======================================================
// Fungsi Utama: Ambil Data Dashboard
// ======================================================
async function getDashboardData(conn) {
  const response = { lines: {} };

  const [panelRows] = await conn.query(`
    WITH LatestPanel AS (
      SELECT i.*, d.ComponentRef, d.PartNumber, d.ReworkDefectCode, d.MachineDefectCode, d.ImageFileName,
             ROW_NUMBER() OVER(PARTITION BY i.LineID ORDER BY i.EndTime DESC) AS rn
      FROM Inspections i
      LEFT JOIN Defects d ON i.InspectionID = d.InspectionID
    )
    SELECT * FROM LatestPanel WHERE rn = 1;
  `);

  const latestPanels = {};
  for (const row of panelRows) {
    latestPanels[row.LineID] = row;
  }

  for (let i = 1; i <= 6; i++) {
    const panelData = latestPanels[i];
    const lineData = {
      status: "INACTIVE",
      details: createDefaultDetails(),
      kpi: createDefaultKpi(),
      comparison_data: createDefaultComparison(),
      image_url: null,
      is_critical_alert: false,
    };

    if (panelData) {
      lineData.status = panelData.FinalResult || "INACTIVE";
      lineData.details = {
        time: panelData.EndTime
          ? new Date(panelData.EndTime).toLocaleTimeString("id-ID", { hour12: false })
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

      // URL gambar pakai route Node.js
      if (panelData.ImageFileName) {
        const parts = panelData.ImageFileName.split("\\");
        if (parts.length >= 2) {
          const dateFolder = parts[0];
          const actualFile = parts[parts.length - 1];
          lineData.image_url = `/api/image?line=${i}&date=${encodeURIComponent(
            dateFolder
          )}&file=${encodeURIComponent(actualFile)}`;
        }
      }

      // KPI sekarang
      const currentAssembly = panelData.Assembly;
      const currentLot = panelData.LotCode;
      const currentCycle = Number(panelData.TuningCycleID);

      const [kpiRows] = await conn.execute(
        `
        SELECT Assembly, LotCode, COUNT(InspectionID) AS Inspected,
               SUM(CASE WHEN FinalResult = 'Pass' THEN 1 ELSE 0 END) AS Pass,
               SUM(CASE WHEN FinalResult = 'Defective' THEN 1 ELSE 0 END) AS Defect,
               SUM(CASE WHEN FinalResult IN ('False Fail', 'Unreviewed') THEN 1 ELSE 0 END) AS FalseCall
        FROM Inspections
        WHERE LineID = ? AND Assembly = ? AND LotCode = ? AND TuningCycleID = ?
        GROUP BY Assembly, LotCode
      `,
        [i, currentAssembly, currentLot, currentCycle]
      );

      if (kpiRows.length > 0) {
        lineData.kpi = calculateKpiMetrics(kpiRows[0]);
      }

      // KPI sebelumnya (perbandingan)
      lineData.comparison_data.current = lineData.kpi;
      if (currentCycle > 1) {
        const prevCycle = currentCycle - 1;
        const [beforeRows] = await conn.execute(
          `
          SELECT Assembly, LotCode, COUNT(InspectionID) AS Inspected,
                 SUM(CASE WHEN FinalResult = 'Pass' THEN 1 ELSE 0 END) AS Pass,
                 SUM(CASE WHEN FinalResult = 'Defective' THEN 1 ELSE 0 END) AS Defect,
                 SUM(CASE WHEN FinalResult IN ('False Fail', 'Unreviewed') THEN 1 ELSE 0 END) AS FalseCall
          FROM Inspections
          WHERE LineID = ? AND Assembly = ? AND LotCode = ? AND TuningCycleID = ?
          GROUP BY Assembly, LotCode
        `,
          [i, currentAssembly, currentLot, prevCycle]
        );

        if (beforeRows.length > 0) {
          lineData.comparison_data.before = calculateKpiMetrics(beforeRows[0]);
        }
      }
    }

    response.lines[`line_${i}`] = lineData;
  }

  return response;
}

// ======================================================
// Route Handler — gunakan Pool
// ======================================================
router.get("/", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    conn.config.namedPlaceholders = true;

    const data = await getDashboardData(conn);
    res.json(data);
  } catch (err) {
    console.error("❌ API Error:", err.message);
    res.status(500).json({ error: `API Error: ${err.message}` });
  } finally {
    if (conn) conn.release();
  }
});

export default router;
