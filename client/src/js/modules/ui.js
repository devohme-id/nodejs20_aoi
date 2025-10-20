// /public/js/modules/ui.js

import { Chart } from 'chart.js/auto';
import { TARGET_PASS_RATE, TARGET_PPM, TOTAL_LINES } from './config.js';
import * as state from './state.js';
import { manageAlertSound } from './sound.js';

function normalizeStatus(status) {
    return (status || 'inactive').toLowerCase().replace(' ', '_');
}

function createDefaultDetails() { return { time: 'N/A', component_ref: 'N/A', part_number: 'N/A', machine_defect: 'N/A', inspection_result: 'N/A', review_result: 'N/A' }; }
function createDefaultKpi() { return { assembly: 'N/A', total_inspected: 0, total_pass: 0, total_defect: 0, total_false_call: 0, pass_rate: 0, ppm: 0 }; }
function createDefaultComparison() { return { before: createDefaultKpi(), current: createDefaultKpi() }; }

export function createDefaultLineData() {
    return {
        status: 'INACTIVE',
        details: createDefaultDetails(),
        kpi: createDefaultKpi(),
        comparison_data: createDefaultComparison(),
        image_url: null, is_critical_alert: false
    };
}

export function createPanelHTML(lineNumber) {
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

function updateComparisonChart(lineNumber, data) {
    const chartId = `comparisonChart_${lineNumber}`;
    const canvas = document.getElementById(chartId);
    if (!canvas) return;

    const beforeValue = data.before.pass_rate;
    const currentValue = data.current.pass_rate;

    if (state.lineCharts[chartId]) {
        state.lineCharts[chartId].data.datasets[0].data = [beforeValue, currentValue];
        state.lineCharts[chartId].update();
    } else {
        state.lineCharts[chartId] = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Before', 'Current'],
                datasets: [{
                    label: 'Pass Rate',
                    data: [beforeValue, currentValue],
                    backgroundColor: ['#475569', '#22d3ee'],
                    borderColor: ['#475569', '#22d3ee'],
                    borderWidth: 1,
                    borderRadius: 4,
                    barPercentage: 0.6,
                    categoryPercentage: 0.7
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#e2e8f0', font: { size: 12 } }, grid: { display: false } },
                    y: { display: true, beginAtZero: true, max: 100, ticks: { color: '#94a3b8', stepSize: 25 }, grid: { color: '#ffffff20', drawBorder: false } }
                },
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: 'Pass Rate (%) Comparison', color: '#e2e8f0', font: { size: 14, family: 'MyFontHeadline' }, padding: { bottom: 10 } },
                    datalabels: { anchor: 'end', align: 'top', color: '#e2e8f0', font: { size: 14, weight: 'bold' }, formatter: (value) => `${value}%` }
                }
            }
        });
    }
}

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

    updateComparisonChart(lineNumber, data.comparison_data);
}

export function updateDashboardUI(linesData) {
    let isAnyCriticalAlertActive = false;
    for (let i = 1; i <= TOTAL_LINES; i++) {
        const lineKey = `line_${i}`;
        const lineData = linesData[lineKey] || createDefaultLineData();
        updateSinglePanel(i, lineData);
        if (lineData.is_critical_alert) isAnyCriticalAlertActive = true;
    }
    manageAlertSound(isAnyCriticalAlertActive);
}

export function updateClock() {
    const now = new Date();
    const clockEl = document.getElementById('clock');
    const dateEl = document.getElementById('date');

    // ✅ FIX: Periksa apakah elemen ada sebelum mengubah isinya
    // Ini mencegah error jika elemen 'clock' atau 'date' tidak ditemukan di HTML.
    if (clockEl) {
        clockEl.textContent = now.toLocaleTimeString('id-ID', { hour12: false });
    }

    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    }
}