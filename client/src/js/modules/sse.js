// /public/js/modules/sse.js

import { SSE_URL } from './config.js';
import { fetchData } from './api.js';

export function initializeEventSource() {
    console.log("Menghubungkan ke server events...");
    const eventSource = new EventSource(SSE_URL);

    eventSource.onopen = () => {
        console.log("✅ Terhubung ke Server-Sent Events.");
    };

    eventSource.onmessage = (event) => {
        try {
            const eventData = JSON.parse(event.data);

            if (eventData.type === "data_update") {
                console.log("🔔 Menerima sinyal update dari server. Mengambil data baru...");
                fetchData();
            } else if (eventData.type === "connected") {
                console.log("🔌 Pesan koneksi SSE diterima.");
            }
        } catch (err) {
            console.warn("Menerima data SSE non-JSON:", event.data);
        }
    };

    eventSource.onerror = (err) => {
        console.error("❌ Koneksi SSE error, mencoba menghubungkan ulang...", err);
        eventSource.close();
        setTimeout(initializeEventSource, 5000);
    };
}