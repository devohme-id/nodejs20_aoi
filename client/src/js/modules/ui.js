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
    <div class="bg-slate-800 border border-slate-700 rounded-xl py-4 px-5 shadow-lg shadow-black/20 grid grid-rows-[auto_1fr_auto_auto] gap-2 min-h-0 overflow-hidden">
        <div class="flex justify-between items-center">
            <h2 class="text-xl font-bold font-headline text-slate-300">LINE ${lineNumber}</h2>
            <span id="panel_status_${lineNumber}" class="py-1 px-4 rounded-lg text-sm font-bold uppercase text-slate-200 bg-slate-600">INACTIVE</span>
        </div>
        <div class="grid grid-cols-2 gap-4 items-center min-h-0">
            <div class="text-xs flex flex-col gap-1 min-w-0">
                <div class="grid grid-cols-[85px_1fr] items-center gap-3"><span class="text-slate-300">Assembly</span><strong id="detail_assembly_${lineNumber}" class="font-semibold text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">N/A</strong></div>
                <hr class="border-slate-700 my-1">
                <div class="grid grid-cols-[85px_1fr] items-center gap-3"><span class="text-slate-300">Time</span><span id="detail_time_${lineNumber}" class="font-semibold text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">N/A</span></div>
                <div class="grid grid-cols-[85px_1fr] items-center gap-3"><span class="text-slate-300">Reference</span><span id="detail_ref_${lineNumber}" class="font-semibold text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">N/A</span></div>
                <div class="grid grid-cols-[85px_1fr] items-center gap-3"><span class="text-slate-300">Partnumber</span><span id="detail_part_${lineNumber}" class="font-semibold text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">N/A</span></div>
                <div class="grid grid-cols-[85px_1fr] items-center gap-3"><span class="text-slate-300">Defect</span><span id="detail_machine_defect_${lineNumber}" class="font-semibold text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">N/A</span></div>
                <div class="grid grid-cols-[85px_1fr] items-center gap-3"><span class="text-slate-300">Inspection</span><span id="detail_inspect_${lineNumber}" class="font-semibold text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">N/A</span></div>
                <div class="grid grid-cols-[85px_1fr] items-center gap-3"><span class="text-slate-300">Review</span><span id="detail_review_${lineNumber}" class="font-semibold text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">N/A</span></div>
            </div>
            <div id="image_container_${lineNumber}" class="relative size-full object-center object-scale-down bg-black/20 rounded-lg border-[3px] border-slate-700 shadow-transparent transition-all duration-300 ease-in-out cursor-pointer hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]" data-line="${lineNumber}"></div>
        </div>
        <div class="grid grid-cols-5 gap-2">
            <div class="bg-slate-900/50 rounded p-1 text-center"><div id="kpi_pass_rate_${lineNumber}" class="text-md font-bold transition-colors duration-300">0%</div><div class="text-[0.65rem] uppercase text-slate-300">Pass Rate</div></div>
            <div class="bg-slate-900/50 rounded p-1 text-center"><div id="kpi_ppm_${lineNumber}" class="text-md font-bold transition-colors duration-300">0</div><div class="text-[0.65rem] uppercase text-slate-300">PPM</div></div>
            <div class="bg-slate-900/50 rounded p-1 text-center"><div id="kpi_inspected_${lineNumber}" class="text-md font-bold text-slate-300">0</div><div class="text-[0.65rem] uppercase text-slate-300">Inspected</div></div>
            <div class="bg-slate-900/50 rounded p-1 text-center"><div id="kpi_pass_${lineNumber}" class="text-md font-bold text-green-500">0</div><div class="text-[0.65rem] uppercase text-slate-300">Pass</div></div>
            <div class="bg-slate-900/50 rounded p-1 text-center"><div id="kpi_false_call_${lineNumber}" class="text-md font-bold text-yellow-400">0</div><div class="text-[0.65rem] uppercase text-slate-300">False Call</div></div>
        </div>
        <div class="relative w-full h-20">
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

const statusColorClasses = {
    pass: 'bg-green-500 text-slate-900',
    defective: 'bg-red-500 text-slate-900',
    false_fail: 'bg-yellow-400 text-slate-900',
    unreviewed: 'bg-blue-500 text-slate-900',
    inactive: 'bg-slate-600 text-slate-200'
};

const imageStatusClasses = {
    pass: 'border-green-500 shadow-green-500',
    defective: 'border-red-500 shadow-red-500',
    false_fail: 'border-yellow-400 shadow-yellow-400',
    unreviewed: 'border-blue-500 shadow-blue-500',
    inactive: 'border-slate-700 shadow-transparent'
};

const placeholderBgClasses = {
    pass: 'bg-gradient-to-br from-green-900 to-green-600 text-white',
    defective: 'bg-gradient-to-br from-red-950 to-red-700 text-white',
    false_fail: 'bg-gradient-to-br from-amber-900 to-amber-500 text-white',
    unreviewed: 'bg-gradient-to-br from-blue-800 to-blue-500 text-white',
    inactive: 'bg-slate-800 border-2 border-dashed border-slate-700 text-slate-300'
};

function updateSinglePanel(lineNumber, data) {
    const status_normalized = normalizeStatus(data.is_critical_alert ? 'Defective' : data.status);
    const statusElement = document.getElementById(`panel_status_${lineNumber}`);
    statusElement.textContent = data.status;
    statusElement.className = `py-1 px-4 rounded-lg text-sm font-bold uppercase ${statusColorClasses[status_normalized] || statusColorClasses.inactive}`;

    const { details, kpi } = data;
    document.getElementById(`detail_assembly_${lineNumber}`).textContent = kpi.assembly;
    document.getElementById(`detail_time_${lineNumber}`).textContent = details.time;
    document.getElementById(`detail_ref_${lineNumber}`).textContent = details.component_ref;
    document.getElementById(`detail_part_${lineNumber}`).textContent = details.part_number;
    document.getElementById(`detail_machine_defect_${lineNumber}`).textContent = details.machine_defect;
    document.getElementById(`detail_inspect_${lineNumber}`).textContent = details.inspection_result;
    document.getElementById(`detail_review_${lineNumber}`).textContent = details.review_result;

    const imageContainer = document.getElementById(`image_container_${lineNumber}`);
    const baseImageContainerClass = 'relative w-full h-full bg-black/20 rounded-lg overflow-hidden border-[3px] transition-all duration-300 ease-in-out cursor-pointer hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.2)]';
    const statusImageClasses = imageStatusClasses[status_normalized] || imageStatusClasses.inactive;
    const shadowEffectClass = status_normalized !== 'inactive' ? 'shadow-[0_0_15px_var(--tw-shadow-color)]' : '';
    imageContainer.className = `${baseImageContainerClass} ${statusImageClasses} ${shadowEffectClass}`;

    // ✨ NEW: Tambahkan penanganan error jika gambar gagal dimuat (misalnya karena timeout)
    const errorHtml = `<div class='flex items-center justify-center h-full bg-gray-800/50 text-red-400 text-xs font-semibold p-2 text-center'>Gagal memuat gambar</div>`;
    const placeholderBaseClass = 'w-full h-full flex justify-center items-center font-headline text-xl font-black uppercase tracking-widest';
    const statusPlaceholderClass = placeholderBgClasses[status_normalized] || placeholderBgClasses.inactive;
    const imageContent = data.image_url
      ? `<img src="${data.image_url}" alt="Defect" class="defect-image" onerror="this.outerHTML=\`${errorHtml}\`">`
      : `<div class="${placeholderBaseClass} ${statusPlaceholderClass}"><span>${
          data.status === "INACTIVE" ? "NO SIGNAL" : data.status
        }</span></div>`;
    imageContainer.innerHTML = imageContent;

    // Critical alert overrides shadow and adds animation
    imageContainer.classList.toggle('critical-alert', data.is_critical_alert);

    const passRateEl = document.getElementById(`kpi_pass_rate_${lineNumber}`);
    passRateEl.textContent = `${kpi.pass_rate}%`;
    passRateEl.classList.toggle('text-green-500', kpi.pass_rate >= TARGET_PASS_RATE);
    passRateEl.classList.toggle('text-red-500', kpi.pass_rate < TARGET_PASS_RATE);

    const ppmEl = document.getElementById(`kpi_ppm_${lineNumber}`);
    ppmEl.textContent = kpi.ppm;
    ppmEl.classList.toggle('text-green-500', kpi.ppm <= TARGET_PPM);
    ppmEl.classList.toggle('text-red-500', kpi.ppm > TARGET_PPM);

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