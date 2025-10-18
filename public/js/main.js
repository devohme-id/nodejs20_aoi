// ==========================================================================
// Konfigurasi Aplikasi
// ==========================================================================
// const API_URL = 'api/get_dashboard_data.php';
const API_URL = '/api/dashboard';
// const REFRESH_INTERVAL = 5000; // <-- DIHAPUS (Tidak dipakai lagi)
const TARGET_PASS_RATE = 90;
const TARGET_PPM = 2100;
const SOUND_DELAY = 2000;
const lineCharts = {};
let alertAudio;
let isSoundLooping = false;
let isMuted = true;
let soundUnlocked = false;

// ==========================================================================
// Inisialisasi Aplikasi
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    Chart.register(ChartDataLabels);
    alertAudio = document.getElementById('alert-sound');
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    const panelArea = document.getElementById('panel-area');

    if (alertAudio) {
        alertAudio.addEventListener('ended', () => {
            if (isSoundLooping) setTimeout(playAlertSound, SOUND_DELAY);
        });
    }

    if (soundToggleBtn) {
        soundToggleBtn.addEventListener('click', () => {
            if (!soundUnlocked) {
                soundUnlocked = true;
                alertAudio.play().then(() => alertAudio.pause()).catch(() => {});
            }
            isMuted = !isMuted;
            soundToggleBtn.classList.toggle('muted', isMuted);
            const isCriticalActive = document.querySelector('.critical-alert') !== null;
            manageAlertSound(isCriticalActive);
        });
    }

    // Buat struktur HTML awal
    let content = '';
    for (let i = 1; i <= 6; i++) {
        content += createPanelHTML(i);
    }
    panelArea.innerHTML = content;

    // *** PERBAIKAN: Menggunakan Event Delegation untuk klik yang lebih andal ***
    panelArea.addEventListener('click', function(event) {
        // Cari elemen .image-container terdekat dari elemen yang di-klik
        const imageContainer = event.target.closest('.image-container');

        // Jika ditemukan dan memiliki atribut data-line, lakukan navigasi
        if (imageContainer && imageContainer.dataset.line) {
            const lineNumber = imageContainer.dataset.line;
            window.location.href = `feedback.php?line=${lineNumber}`;
        }
    });

    // Mulai pengambilan data
    fetchData(); // <-- Panggil 1x saat halaman dibuka
    // setInterval(fetchData, REFRESH_INTERVAL); // <-- DIHAPUS

    // Panggil fungsi untuk mendengarkan event dari server
    initializeEventSource(); // <-- DITAMBAHKAN

    updateClock();
    setInterval(updateClock, 1000);
});

// ==========================================================================
// Fungsi Baru: Server-Sent Events (SSE)
// ==========================================================================
function initializeEventSource() {
    console.log("Menghubungkan ke server events...");
    const eventSource = new EventSource('/api/events');

    // Terhubung
    eventSource.onopen = () => {
        console.log("✅ Terhubung ke Server-Sent Events.");
    };

    // Menerima pesan
    eventSource.onmessage = (event) => {
        try {
            const eventData = JSON.parse(event.data);

            // Hanya refresh jika itu adalah sinyal "data_update"
            if (eventData.type === "data_update") {
                console.log("🔔 Menerima sinyal update dari server. Mengambil data baru...");
                fetchData(); // <-- INI INTINYA! Hanya fetch saat ada update
            } else if (eventData.type === "connected") {
                console.log("🔌 Pesan koneksi SSE diterima.");
            }
        } catch (err) {
            console.warn("Menerima data SSE non-JSON:", event.data);
        }
    };

    // Error
    eventSource.onerror = (err) => {
        console.error("❌ Koneksi SSE error, mencoba menghubungkan ulang...", err);
        eventSource.close();
        // Coba konek ulang setelah 5 detik
        setTimeout(initializeEventSource, 5000);
    };
}


// ==========================================================================
// Fungsi Pengambilan & Pembaruan Data
// (Fungsi ini tidak berubah, hanya cara pemanggilannya yang berubah)
// ==========================================================================
async function fetchData() {
    try {
        const response = await fetch(`${API_URL}?t=${new Date().getTime()}`);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        updateDashboardUI(data.lines || {});
    } catch (error) {
        console.error('Failed to fetch data:', error);
    }
}

function updateDashboardUI(linesData) {
    let isAnyCriticalAlertActive = false;
    for (let i = 1; i <= 6; i++) {
        const lineKey = `line_${i}`;
        const lineData = linesData[lineKey] || createDefaultLineData();
        updateSinglePanel(i, lineData);
        if (lineData.is_critical_alert) isAnyCriticalAlertActive = true;
    }
    manageAlertSound(isAnyCriticalAlertActive);
}

// ==========================================================================
// Manajemen Suara
// (Tidak ada perubahan di sini)
// ==========================================================================
function manageAlertSound(shouldPlay) {
    if (shouldPlay && !isMuted && soundUnlocked && !isSoundLooping) {
        isSoundLooping = true;
        playAlertSound();
    } else if ((!shouldPlay || isMuted) && isSoundLooping) {
        isSoundLooping = false;
        if (alertAudio) {
            alertAudio.pause();
            alertAudio.currentTime = 0;
        }
    }
}

function playAlertSound() {
    if (isSoundLooping && alertAudio) {
        alertAudio.play().catch(e => {
            if (e.name === 'NotAllowedError') isSoundLooping = false;
        });
    }
}

// ==========================================================================
// Fungsi Pembaruan UI per Panel
// (Tidak ada perubahan di sini)
// ==========================================================================
function updateSinglePanel(lineNumber, data) {
    const status_normalized = normalizeStatus(data.is_critical_alert ? 'Defective' : data.status);
    const statusElement = document.getElementById(`panel_status_${lineNumber}`);
    statusElement.textContent = data.status;
    statusElement.className = `panel-status status-${status_normalized}`;

    const { details, kpi } = data;
    document.getElementById(`detail_assembly_${lineNumber}`).textContent = kpi.assembly;
    document.getElementById(`detail_time_${lineNumber}`).textContent = details.time;
    document.getElementById(`detail_ref_${lineNumber}`).textContent = details.component_ref;
    document.getElementById(`detail_part_${lineNumber}`).textContent = details.part_number;
    document.getElementById(`detail_machine_defect_${lineNumber}`).textContent = details.machine_defect;
    document.getElementById(`detail_inspect_${lineNumber}`).textContent = details.inspection_result;
    document.getElementById(`detail_review_${lineNumber}`).textContent = details.review_result;

    const imageContainer = document.getElementById(`image_container_${lineNumber}`);
    imageContainer.className = `image-container status-${status_normalized}`;
    const imageContent = data.image_url ?
        `<img src="${data.image_url}" alt="Defect" class="defect-image">` :
        `<div class="pcb-visual-placeholder pcb-visual-${status_normalized}"><span>${data.status === 'INACTIVE' ? 'NO SIGNAL' : data.status}</span></div>`;
    imageContainer.innerHTML = imageContent;
    imageContainer.classList.toggle('critical-alert', data.is_critical_alert);

    // Update KPI values
    const passRateEl = document.getElementById(`kpi_pass_rate_${lineNumber}`);
    passRateEl.textContent = `${kpi.pass_rate}%`;
    passRateEl.classList.toggle('kpi-good', kpi.pass_rate >= TARGET_PASS_RATE);
    passRateEl.classList.toggle('kpi-bad', kpi.pass_rate < TARGET_PASS_RATE);

    const ppmEl = document.getElementById(`kpi_ppm_${lineNumber}`);
    ppmEl.textContent = kpi.ppm;
    ppmEl.classList.toggle('kpi-good', kpi.ppm <= TARGET_PPM);
    ppmEl.classList.toggle('kpi-bad', kpi.ppm > TARGET_PPM);

    document.getElementById(`kpi_inspected_${lineNumber}`).textContent = kpi.total_inspected;
    document.getElementById(`kpi_pass_${lineNumber}`).textContent = kpi.total_pass;
    document.getElementById(`kpi_false_call_${lineNumber}`).textContent = kpi.total_false_call;

    // Panggil fungsi untuk update grafik
    updateComparisonChart(lineNumber, data.comparison_data);
}

// *** FUNGSI CHART DIPERBARUI ***
// (Tidak ada perubahan di sini)
function updateComparisonChart(lineNumber, data) {
    const chartId = `comparisonChart_${lineNumber}`;
    const canvas = document.getElementById(chartId);
    if (!canvas) return;

    const beforeValue = data.before.pass_rate;
    const currentValue = data.current.pass_rate;

    if (lineCharts[chartId]) {
        // Hanya update data, tidak perlu membuat chart baru
        lineCharts[chartId].data.datasets[0].data = [beforeValue, currentValue];
        lineCharts[chartId].update();
    } else {
        // Buat chart baru jika belum ada
        lineCharts[chartId] = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Before', 'Current'],
                datasets: [{
                    label: 'Pass Rate',
                    data: [beforeValue, currentValue],
                    backgroundColor: ['#475569', '#22d3ee'], // Abu-abu untuk 'Before', Cyan untuk 'Current'
                    borderColor: ['#475569', '#22d3ee'],
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.6, // Membuat bar lebih ramping
                    categoryPercentage: 0.7
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#e2e8f0', font: { size: 12 } }, grid: { display: false } },
                    y: {
                        display: true, // Tampilkan sumbu Y
                        beginAtZero: true,
                        max: 100, // Skala 0-100%
                        ticks: { color: '#94a3b8', stepSize: 25 },
                        grid: { color: '#ffffff20', drawBorder: false }
                    }
                },
                plugins: {
                    legend: { display: false }, // Sembunyikan legenda
                    title: {
                        display: true,
                        text: 'Pass Rate (%) Comparison',
                        color: '#e2e8f0',
                        font: { size: 14, family: 'MyFontHeadline' },
                        padding: { bottom: 10 }
                    },
                    datalabels: {
                        anchor: 'end',
                        align: 'top',
                        color: '#e2e8f0',
                        font: { size: 14, weight: 'bold' },
                        formatter: (value) => `${value}%` // Format sebagai persentase
                    }
                }
            }
        });
    }
}


// ==========================================================================
// Fungsi Utilitas
// (Tidak ada perubahan di sini)
// ==========================================================================
function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent = now.toLocaleTimeString('id-ID', { hour12: false });
    document.getElementById('date').textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function normalizeStatus(status) { return (status || 'inactive').toLowerCase().replace(' ', '_'); }

function createDefaultLineData() {
    return {
        status: 'INACTIVE',
        details: createDefaultDetails(),
        kpi: createDefaultKpi(),
        comparison_data: createDefaultComparison(),
        image_url: null, is_critical_alert: false
    };
}
function createDefaultDetails() { return { time: 'N/A', component_ref: 'N/A', part_number: 'N/A', machine_defect: 'N/A', inspection_result: 'N/A', review_result: 'N/A' }; }
function createDefaultKpi() { return { assembly: 'N/A', total_inspected: 0, total_pass: 0, total_defect: 0, total_false_call: 0, pass_rate: 0, ppm: 0 }; }
function createDefaultComparison() { return { before: createDefaultKpi(), current: createDefaultKpi() }; }

function createPanelHTML(lineNumber) {
    // Kembali ke struktur HTML asli yang stabil
    return `
    <div class="card-ui">
        <div class="panel-header">
            <h2 class="panel-title">LINE ${lineNumber}</h2>
            <span id="panel_status_${lineNumber}" class="panel-status status-inactive">INACTIVE</span>
        </div>
        <div class="panel-content">
            <div class="panel-details">
                <div class="detail-item"><span class="detail-label">Assembly</span><strong id="detail_assembly_${lineNumber}" class="detail-value">N/A</strong></div>
                <hr style="border-color: var(--border-color); margin: 0.2rem 0;">
                <div class="detail-item"><span class="detail-label">Time</span><span id="detail_time_${lineNumber}" class="detail-value">N/A</span></div>
                <div class="detail-item"><span class="detail-label">Reference</span><span id="detail_ref_${lineNumber}" class="detail-value">N/A</span></div>
                <div class="detail-item"><span class="detail-label">Partnumber</span><span id="detail_part_${lineNumber}" class="detail-value">N/A</span></div>
                <div class="detail-item"><span class="detail-label">Defect</span><span id="detail_machine_defect_${lineNumber}" class="detail-value">N/A</span></div>
                <div class="detail-item"><span class="detail-label">Inspection</span><span id="detail_inspect_${lineNumber}" class="detail-value">N/A</span></div>
                <div class="detail-item"><span class="detail-label">Review</span><span id="detail_review_${lineNumber}" class="detail-value">N/A</span></div>
            </div>
            <div id="image_container_${lineNumber}" class="image-container status-inactive" data-line="${lineNumber}"></div>
        </div>
        <div class="panel-kpi-grid">
            <div class="kpi-item"><div id="kpi_pass_rate_${lineNumber}" class="kpi-value">0%</div><div class="kpi-label">Pass Rate</div></div>
            <div class="kpi-item"><div id="kpi_ppm_${lineNumber}" class="kpi-value">0</div><div class="kpi-label">PPM</div></div>
            <div class="kpi-item"><div id="kpi_inspected_${lineNumber}" class="kpi-value">0</div><div class="kpi-label">Inspected</div></div>
            <div class="kpi-item"><div id="kpi_pass_${lineNumber}" class="kpi-value kpi-pass-color">0</div><div class="kpi-label">Pass</div></div>
            <div class="kpi-item"><div id="kpi_false_call_${lineNumber}" class="kpi-value kpi-false_call-color">0</div><div class="kpi-label">False Call</div></div>
        </div>
        <div class="chart-container">
            <canvas id="comparisonChart_${lineNumber}"></canvas>
        </div>
    </div>`;
}