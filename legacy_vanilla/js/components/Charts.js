let mainChartInstance = null;
let energyChartInstance = null;

export function initCharts() {
    initMainChart();
    initEnergyChart();
}

function initMainChart() {
    const ctx = document.getElementById('mainChart').getContext('2d');

    mainChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array.from({ length: 20 }, (_, i) => i),
            datasets: [
                {
                    label: 'Actual',
                    data: [], // Filled dynamically
                    borderColor: '#66FCF1', // Cyan
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 0
                },
                {
                    label: 'Predicted',
                    data: [], // Filled dynamically
                    borderColor: '#45A29E', // Teal
                    borderDash: [5, 5],
                    tension: 0.4,
                    pointRadius: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { display: false },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#888' }
                }
            }
        }
    });
}

function initEnergyChart() {
    const ctx = document.getElementById('energyChart').getContext('2d');

    energyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['00:00', '04:00', '08:00', '12:00', '16:00', '20:00'],
            datasets: [{
                label: 'Energy (kWh)',
                data: [1.2, 1.5, 3.2, 4.5, 3.8, 2.1],
                backgroundColor: 'rgba(102, 252, 241, 0.5)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#888' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#888' }
                }
            }
        }
    });
}

export function updateCharts(latestData, predictions) {
    if (!mainChartInstance) return;

    // Slide window for main chart
    const currentTemp = parseFloat(latestData.temperature.value);

    // Add new data point
    const currentData = mainChartInstance.data.datasets[0].data;
    if (currentData.length > 20) currentData.shift();
    currentData.push(currentTemp);

    // Update Predicted
    // In a real app, this would be time-aligned. Here we just take the first prediction point
    const predData = mainChartInstance.data.datasets[1].data;
    if (predData.length > 20) predData.shift();
    predData.push(predictions.temperature[0]);

    mainChartInstance.update('none'); // 'none' for performance
}
