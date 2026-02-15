import { APIService } from '../services/api.js';
import { renderSensorCards } from '../components/SensorCard.js';
import { updateAIInsights } from '../components/AI_Panel.js';
import { initCharts, updateCharts } from '../components/Charts.js';
import { renderAlerts } from '../components/Alerts.js';
import { updateRiskGauge } from '../components/RiskGauge.js';
import { renderHistoryTable } from '../components/HistoryTable.js';

// Configuration
const REFRESH_RATE = 5000; // 5 seconds

// State
let dashboardState = {
    sensors: {},
    predictions: {},
    anomalies: [],
    history: []
};

// Initialize Dashboard
async function initDashboard() {
    console.log("Initializing IoT Dashboard...");

    // Initial Fetch
    await updateDashboard();

    // Initialize Charts
    initCharts();

    // Start Polling
    setInterval(updateDashboard, REFRESH_RATE);

    // Update Time
    setInterval(updateTime, 1000);
}

async function updateDashboard() {
    try {
        // Fetch all data in parallel
        const [latestData, predictions, anomalyData] = await Promise.all([
            APIService.getLatestData(),
            APIService.getPredictions(),
            APIService.getAnomalies()
        ]);

        // Update State
        dashboardState.sensors = latestData;
        dashboardState.predictions = predictions;

        // Update UI Components
        renderSensorCards(latestData);
        updateAIInsights(anomalyData, predictions);
        updateCharts(latestData, predictions);
        renderAlerts(anomalyData);
        updateRiskGauge(anomalyData.score);

        // Update Status Indicator
        document.querySelector('.status-text').textContent = "System Online";
        document.querySelector('.status-dot').style.backgroundColor = "var(--status-normal)";

    } catch (error) {
        console.error("Dashboard Update Failed:", error);
        document.querySelector('.status-text').textContent = "Connection Lost";
        document.querySelector('.status-dot').style.backgroundColor = "var(--status-critical)";
    }
}

function updateTime() {
    const now = new Date();
    document.getElementById('current-time').textContent = now.toLocaleTimeString();
}

// Start Application
document.addEventListener('DOMContentLoaded', initDashboard);
