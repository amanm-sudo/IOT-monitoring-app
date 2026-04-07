import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import SensorGrid from './components/Sensors/SensorGrid';
import AnomalyPanel from './components/AI/AnomalyPanel';
import PredictionPanel from './components/AI/PredictionPanel';
import RiskGauge from './components/AI/RiskGauge';
import MainChart from './components/Charts/MainChart';
import EnergyChart from './components/Charts/EnergyChart';
import AQIChart from './components/Charts/AQIChart';
import AlertsList from './components/Lists/AlertsList';
import HistoryTable from './components/Lists/HistoryTable';
import AQIOverview from './components/AQI/AQIOverview';
import { APIService } from './services/api';

function App() {
  const [data, setData] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [anomalies, setAnomalies] = useState(null);
  const [history, setHistory] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [status, setStatus] = useState('Online');

  // AQI State
  const [aqiData, setAqiData] = useState({ indoor: null, outdoor: null });
  const [aqiHistory, setAqiHistory] = useState([]);

  const updateDashboard = async () => {
    try {
      const [latest, historyData, preds, anoms, aqiLatest, aqiHist] = await Promise.all([
        APIService.getLatestData(),
        APIService.getHistory(),
        APIService.getPredictions(),
        APIService.getAnomalies(),
        APIService.getAQILatest(),
        APIService.getAQIHistory()
      ]);

      if (latest) setData(latest);

      if (historyData && Array.isArray(historyData) && historyData.length > 0) {
        const formattedHistory = historyData.map(record => ({
          time: new Date(record.timestamp).toLocaleTimeString(),
          temperature: { value: record.temperature ?? '--', unit: '°C' },
          humidity:    { value: record.humidity    ?? '--', unit: '%' },
          co2:         { value: record.co2_ppm     ?? '--', unit: 'ppm' },
          energy:      { value: record.energy_kwh  ?? '--', unit: 'kWh' },
          voltage:     { value: record.voltage     ?? '--', unit: 'V' },
          current:     { value: record.current     ?? '--', unit: 'A' },
          isAnomaly: false
        }));
        setHistory(formattedHistory);
      }

      setPredictions(preds);
      setAnomalies(anoms);
      if (aqiLatest) setAqiData(aqiLatest);
      if (aqiHist) setAqiHistory(aqiHist);
      setStatus('Online');
    } catch (error) {
      console.error("Fetch failed", error);
      setStatus('Offline');
    }
  };

  useEffect(() => {
    updateDashboard();

    const socket = APIService.socket;

    socket.on('connect', () => {
      console.log("Connected to Backend WebSocket");
      setStatus('Online');
    });

    socket.on('disconnect', () => {
      console.log("Disconnected from Backend");
      setStatus('Offline');
    });

    // Energy meter readings
    socket.on('new_reading', (newData) => {
      console.log("New Energy Data:", newData);
      const formattedData = {
        temperature: { value: newData.temperature, unit: '°C', trend: 'flat' },
        humidity: { value: newData.humidity, unit: '%', trend: 'flat' },
        co2: { value: newData.co2_ppm, unit: 'ppm', trend: 'flat' },
        energy: { value: newData.energy_kwh, unit: 'kWh', trend: 'flat' }
      };
      setData(formattedData);
      const now = new Date().toLocaleTimeString();
      const newRecord = { time: now, ...formattedData, isAnomaly: false };
      setHistory(prev => [newRecord, ...prev].slice(0, 50));
    });

    // AQI readings
    socket.on('new_aqi_reading', (newAqi) => {
      console.log("New AQI Data:", newAqi);
      setAqiData(prev => ({
        ...prev,
        [newAqi.location]: newAqi
      }));
      setAqiHistory(prev => [newAqi, ...prev].slice(0, 100));
    });

    // Poll predictions/anomalies + AQI
    const interval = setInterval(async () => {
      try {
        const [preds, anoms, aqiLatest, aqiHist, historyData] = await Promise.all([
          APIService.getPredictions(),
          APIService.getAnomalies(),
          APIService.getAQILatest(),
          APIService.getAQIHistory(),
          APIService.getHistory()
        ]);
        setPredictions(preds);
        setAnomalies(anoms);
        if (aqiLatest) setAqiData(aqiLatest);
        if (aqiHist) setAqiHistory(aqiHist);
        // Re-format and update energy history every poll
        if (historyData && Array.isArray(historyData) && historyData.length > 0) {
          const formattedHistory = historyData.map(record => ({
            time: new Date(record.timestamp).toLocaleTimeString(),
            temperature: { value: record.temperature ?? '--', unit: '°C' },
            humidity:    { value: record.humidity    ?? '--', unit: '%' },
            co2:         { value: record.co2_ppm     ?? '--', unit: 'ppm' },
            energy:      { value: record.energy_kwh  ?? '--', unit: 'kWh' },
            voltage:     { value: record.voltage     ?? '--', unit: 'V' },
            current:     { value: record.current     ?? '--', unit: 'A' },
            isAnomaly: false
          }));
          setHistory(formattedHistory);
        }
      } catch (error) {
        console.error("Failed to update", error);
      }
    }, 10000);

    return () => {
      clearInterval(interval);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('new_reading');
      socket.off('new_aqi_reading');
    };
  }, []);

  return (
    <div className="app-container">
      <Navbar status={status} />

      <main className="dashboard-grid">
        {/* Section 1: AQI Overview (NEW) */}
        <section className="aqi-overview-section">
          <AQIOverview indoor={aqiData.indoor} outdoor={aqiData.outdoor} />
        </section>

        {/* Section 2: AQI Chart (NEW) */}
        <section className="aqi-chart-section">
          <AQIChart history={aqiHistory} />
        </section>

        {/* Section 3: Energy Sensor Overview */}
        <section className="sensor-overview">
          {data && <SensorGrid sensors={data} />}
        </section>

        {/* Section 4: AI Insights */}
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

        {/* Section 5: Energy Charts */}
        <section className="charts-section">
          {data && predictions && (
            <MainChart data={data} predictions={predictions} />
          )}
          <EnergyChart predictions={predictions} />
        </section>

        {/* Section 6: Alerts & Risk */}
        <section className="bottom-panel">
          {anomalies && <RiskGauge score={anomalies.score} data={data} />}
          <AlertsList alerts={alerts} />
        </section>

        {/* Section 7: History */}
        <section className="history-section">
          <HistoryTable history={history} />
        </section>
      </main>
    </div>
  );
}

export default App;
