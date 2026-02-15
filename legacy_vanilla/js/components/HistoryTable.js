export function renderHistoryTable(data, anomalies) {
    const tbody = document.getElementById('history-table-body');
    if (!tbody) return;

    const row = document.createElement('tr');
    const now = new Date().toLocaleTimeString();

    // Determine status based on anomalies
    const isAnomaly = anomalies.detected;
    const statusClass = isAnomaly ? 'status-critical' : 'status-normal';
    const statusText = isAnomaly ? 'Anomaly' : 'Normal';

    if (isAnomaly) {
        row.classList.add('row-anomaly');
    }

    row.innerHTML = `
        <td>${now}</td>
        <td>${data.temperature.value}</td>
        <td>${data.humidity.value}</td>
        <td>${data.co2.value}</td>
        <td>${data.energy.value}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
    `;

    tbody.prepend(row);

    // Limit to 50 rows
    if (tbody.children.length > 50) {
        tbody.removeChild(tbody.lastChild);
    }
}
