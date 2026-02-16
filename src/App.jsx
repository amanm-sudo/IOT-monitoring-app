import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import SensorGrid from './components/Sensors/SensorGrid';
import AnomalyPanel from './components/AI/AnomalyPanel';
import PredictionPanel from './components/AI/PredictionPanel';
import RiskGauge from './components/AI/RiskGauge';
import MainChart from './components/Charts/MainChart';
import EnergyChart from './components/Charts/EnergyChart';
import AlertsList from './components/Lists/AlertsList';
import HistoryTable from './components/Lists/HistoryTable';
import { APIService } from './services/api';

function App() {
  const [data, setData] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [anomalies, setAnomalies] = useState(null);

  // History state for table and charts
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState('Online');

  const updateDashboard = async () => {
    try {
      const [latest, historyData, preds, anoms] = await Promise.all([
        APIService.getLatestData(),
        APIService.getHistory(),
        APIService.getPredictions(),
        APIService.getAnomalies()
      ]);

      if (latest) {
        setData(latest);
      }

      if (historyData && Array.isArray(historyData)) {
        const formattedHistory = historyData.map(record => ({
          time: new Date(record.created_at).toLocaleTimeString(),
          temperature: { value: record.temperature, unit: '°C' },
          humidity: { value: record.humidity, unit: '%' },
          co2: { value: record.co2_ppm, unit: 'ppm' },
          energy: { value: record.energy_kwh, unit: 'kWh' },
          isAnomaly: false // Default to false for historical data
        }));
        setHistory(formattedHistory);
      } else if (latest) {
        // Fallback if no history (fresh DB)
        const now = new Date().toLocaleTimeString();
        const newRecord = {
          time: now,
          ...latest,
          isAnomaly: anoms.detected
        };
        setHistory([newRecord]);
      }

      setPredictions(preds);
      setAnomalies(anoms);
      setStatus('Online');
    } catch (error) {
      console.error("Fetch failed", error);
      setStatus('Offline');
    }
  };

  useEffect(() => {
    // Initial Fetch for static/prediction data
    updateDashboard();

    // Socket.io Listener for Real-Time Sensor Data
    const socket = APIService.socket;

    socket.on('connect', () => {
      console.log("Connected to Backend WebSocket");
      setStatus('Online');
    });

    socket.on('disconnect', () => {
      console.log("Disconnected from Backend");
      setStatus('Offline');
    });

    socket.on('new_reading', (newData) => {
      console.log("New Data Received:", newData);

      // Format incoming data to match expected shape
      const formattedData = {
        temperature: { value: newData.temperature, unit: '°C', trend: 'flat' },
        humidity: { value: newData.humidity, unit: '%', trend: 'flat' },
        co2: { value: newData.co2_ppm, unit: 'ppm', trend: 'flat' },
        energy: { value: newData.energy_kwh, unit: 'kWh', trend: 'flat' }
      };

      setData(formattedData);

      // Update History
      const now = new Date().toLocaleTimeString();
      const newRecord = {
        time: now,
        ...formattedData,
        isAnomaly: false
      };
      setHistory(prev => [newRecord, ...prev].slice(0, 50));
    });

    // Poll ONLY for predictions/anomalies (not sensor data)
    // Sensor data comes from WebSocket only
    const interval = setInterval(async () => {
      try {
        const [preds, anoms] = await Promise.all([
          APIService.getPredictions(),
          APIService.getAnomalies()
        ]);
        setPredictions(preds);
        setAnomalies(anoms);
      } catch (error) {
        console.error("Failed to update predictions/anomalies", error);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('new_reading');
    };
  }, []);

  return (
    <div className="app-container">
      <Navbar status={status} />

      <main className="dashboard-grid">
        {/* Section 1: Sensor Overview */}
        <section className="sensor-overview">
          {data && <SensorGrid sensors={data} />}
        </section>

        {/* Section 2: AI Insights */}
        <section className="ai-insights-panel">
          <div className="panel-header glass-panel" style={{ padding: '1rem', marginBottom: 0, justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <h2>AI INSIGHTS</h2>
            <span className="badge text-neon" style={{ background: 'rgba(0, 243, 255, 0.1)', border: '1px solid var(--neon-cyan)' }}>LIVE ANALYSIS</span>
          </div>

          <div className="ai-grid" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {anomalies && <AnomalyPanel anomalies={anomalies} />}
            {predictions && <PredictionPanel predictions={predictions} />}
          </div>
        </section>

        {/* Section 3: Charts */}
        <section className="charts-section">
          {data && predictions && (
            <MainChart
              data={data}
              predictions={predictions}
            />
          )}
          <EnergyChart predictions={predictions} />
        </section>

        {/* Section 4: Alerts & Risk */}
        <section className="bottom-panel">
          {anomalies && <RiskGauge score={anomalies.score} data={data} />}
          <AlertsList alerts={alerts} />
        </section>

        {/* Section 5: History */}
        <section className="history-section">
          <HistoryTable history={history} />
        </section>
      </main>
    </div>
  );
}

export default App;
