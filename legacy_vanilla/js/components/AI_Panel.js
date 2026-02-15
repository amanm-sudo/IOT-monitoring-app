export function updateAIInsights(anomalies, predictions) {
    // Update Anomaly Panel
    const anomalyPanel = document.getElementById('anomaly-panel');
    const statusText = document.getElementById('anomaly-status');
    const scoreText = document.getElementById('anomaly-score');

    if (anomalies.detected) {
        anomalyPanel.style.borderLeftColor = 'var(--status-critical)';
        statusText.textContent = `ALERT: ${anomalies.type}`;
        statusText.style.background = 'rgba(255, 77, 77, 0.2)';
        statusText.style.color = '#ff4d4d';
    } else {
        anomalyPanel.style.borderLeftColor = 'var(--status-normal)';
        statusText.textContent = 'System Normal';
        statusText.style.background = 'rgba(102, 252, 241, 0.1)';
        statusText.style.color = '#66FCF1';
    }

    scoreText.textContent = anomalies.score;

    // Update Forecasts
    if (predictions.temperature) {
        const nextTemp = predictions.temperature[0].toFixed(1);
        document.getElementById('temp-forecast').textContent = `${nextTemp}°C`;

        // Update bar
        const confidence = predictions.confidence;
        document.querySelector('.confidence-bar .fill').style.width = `${confidence}%`;
        document.querySelector('.confidence-bar .fill').style.backgroundColor =
            confidence > 80 ? 'var(--status-normal)' : 'var(--status-warning)';
    }

    if (predictions.energy) {
        const nextEnergy = predictions.energy[0].toFixed(2);
        document.getElementById('energy-forecast').textContent = `${nextEnergy} kWh`;
    }
}
