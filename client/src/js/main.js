// /public/js/main.js
// ==========================================================================
// Entry Point Aplikasi
// ==========================================================================

import { TOTAL_LINES, SOUND_DELAY } from './modules/config.js';
import { Chart } from 'chart.js/auto';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import * as state from './modules/state.js';
import { fetchData } from './modules/api.js';
import { initializeEventSource } from './modules/sse.js';
import { createPanelHTML, updateClock, updateDashboardUI, createDefaultLineData } from './modules/ui.js';
import { manageAlertSound, playAlertSound } from './modules/sound.js';

// ==========================================================================
// Inisialisasi Aplikasi
// ==========================================================================

/**
 * Mengatur semua event listener untuk elemen UI.
 */
function setupEventListeners() {
    const soundToggleBtn = document.getElementById('sound-toggle-btn');
    const panelArea = document.getElementById('panel-area');

    if (state.alertAudio) {
        state.alertAudio.addEventListener('ended', () => {
            if (state.isSoundLooping) setTimeout(playAlertSound, SOUND_DELAY);
        });
    }

    soundToggleBtn?.addEventListener('click', () => {
        if (!state.soundUnlocked) {
            state.setSoundUnlocked(true);
            // Coba mainkan dan jeda audio untuk 'membuka' izin di browser
            state.alertAudio.play().then(() => state.alertAudio.pause()).catch(() => {});
        }
        state.setMuted(!state.isMuted);
        soundToggleBtn.classList.toggle('muted', state.isMuted);
        const isCriticalActive = document.querySelector('.critical-alert') !== null;
        manageAlertSound(isCriticalActive);
    });

    panelArea.addEventListener('click', function(event) {
        const imageContainer = event.target.closest('.image-container');
        if (imageContainer && imageContainer.dataset.line) {
            const lineNumber = imageContainer.dataset.line;
            // ✅ FIX: Mengarahkan ke halaman HTML, bukan file PHP yang tidak ada.
            window.location.href = `feedback.html?line=${lineNumber}`;
        }
    });
}

/**
 * Membuat panel-panel awal untuk setiap line.
 */
function initializeDashboard() {
    const panelArea = document.getElementById('panel-area');
    let content = '';
    const initialLinesData = {};

    for (let i = 1; i <= TOTAL_LINES; i++) {
        content += createPanelHTML(i);
        initialLinesData[`line_${i}`] = createDefaultLineData();
    }
    panelArea.innerHTML = content;
    updateDashboardUI(initialLinesData); // Tampilkan panel kosong awal
}

/**
 * Fungsi utama untuk menjalankan aplikasi.
 */
function main() {
    Chart.register(ChartDataLabels);
    state.setAlertAudio(document.getElementById('alert-sound'));

    initializeDashboard();
    setupEventListeners();

    updateClock();
    setInterval(updateClock, 1000);

    fetchData();
    initializeEventSource();
}

document.addEventListener('DOMContentLoaded', main);