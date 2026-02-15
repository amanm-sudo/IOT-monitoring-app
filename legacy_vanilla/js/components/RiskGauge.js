export function updateRiskGauge(score) {
    const gauge = document.querySelector('.gauge-value');
    if (gauge) {
        gauge.textContent = score;
        gauge.style.color = score > 50 ? 'var(--status-critical)' : 'var(--status-normal)';
    }

    // Optional: Update CSS conic gradient for the gauge arch if we had a more complex one.
    // simpler CSS implementation for now.
    const arch = document.querySelector('.gauge-arch');
    if (arch) {
        // Conic gradient to show percentage
        const color = score > 50 ? '#ff4d4d' : '#66FCF1';
        arch.style.background = `conic-gradient(${color} ${score}%, rgba(255,255,255,0.1) 0)`;
        arch.style.width = '100px';
        arch.style.height = '50px';
        arch.style.borderRadius = '100px 100px 0 0';
        arch.style.margin = '0 auto';
    }
}
