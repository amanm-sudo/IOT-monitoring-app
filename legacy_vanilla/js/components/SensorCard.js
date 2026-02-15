export function renderSensorCards(data) {
    const container = document.getElementById('sensor-grid');
    if (!container) return;

    container.innerHTML = ''; // Clear existing

    Object.entries(data).forEach(([key, sensor]) => {
        const card = document.createElement('div');
        card.className = 'sensor-card';

        const trendIcon = sensor.trend === 'up'
            ? '<i data-lucide="trending-up" class="trend-up"></i>'
            : '<i data-lucide="trending-down" class="trend-down"></i>';

        card.innerHTML = `
            <div class="sensor-header">
                <span class="sensor-title">${key.toUpperCase()}</span>
                <i data-lucide="${getIconByKey(key)}" style="color: var(--text-muted)"></i>
            </div>
            <div class="sensor-value-container">
                <span class="sensor-value">${sensor.value}</span>
                <span class="sensor-unit">${sensor.unit}</span>
            </div>
            <div class="trend-indicator">
                ${trendIcon}
                <span>${sensor.trend === 'up' ? '+2.4%' : '-1.2%'} vs last hr</span>
            </div>
            <!-- Sparkline placeholder -->
            <div class="sparkline-container" style="height: 40px; width: 100%; margin-top: 10px;">
                <canvas id="spark-${key}"></canvas>
            </div>
        `;

        container.appendChild(card);

        // Render mini sparkline
        renderSparkline(`spark-${key}`, sensor.trend);
    });

    // Re-init icons for new DOM elements
    lucide.createIcons();
}

function getIconByKey(key) {
    const map = {
        temperature: 'thermometer',
        humidity: 'droplets',
        co2: 'wind',
        energy: 'zap'
    };
    return map[key] || 'activity';
}

function renderSparkline(canvasId, trend) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    const color = trend === 'up' ? '#ffc107' : '#66FCF1';

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: Array(10).fill(''),
            datasets: [{
                data: Array.from({ length: 10 }, () => Math.random() * 10),
                borderColor: color,
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: true,
                backgroundColor: (context) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 40);
                    gradient.addColorStop(0, color + '40'); // 25% opacity
                    gradient.addColorStop(1, color + '00'); // 0% opacity
                    return gradient;
                }
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { display: false }, y: { display: false } }
        }
    });
}
