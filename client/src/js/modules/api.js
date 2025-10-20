// /public/js/modules/api.js

import { API_URL } from './config.js';
import { updateDashboardUI } from './ui.js';

export async function fetchData() {
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