export function renderAlerts(anomalies) {
    if (!anomalies.detected) return;

    const list = document.getElementById('alerts-list');
    const item = document.createElement('li');

    const now = new Date().toLocaleTimeString();

    item.className = 'alert-item';
    item.style.padding = '8px 0';
    item.style.borderBottom = '1px solid rgba(255,255,255,0.05)';
    item.style.display = 'flex';
    item.style.gap = '10px';
    item.style.alignItems = 'center';

    const color = anomalies.severity === 'critical' ? '#ff4d4d' : '#ffc107';

    item.innerHTML = `
        <i data-lucide="alert-triangle" style="color: ${color}; width: 16px;"></i>
        <div style="flex: 1">
            <div style="font-size: 0.9rem; color: var(--text-primary)">${anomalies.type}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted)">${now}</div>
        </div>
        <div style="width: 8px; height: 8px; background: ${color}; border-radius: 50%;"></div>
    `;

    list.prepend(item);

    // Keep list short
    if (list.children.length > 5) {
        list.removeChild(list.lastChild);
    }

    lucide.createIcons();
}
