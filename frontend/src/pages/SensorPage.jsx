import React, { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Battery, Radio, Shield, RefreshCw, Zap,
  AlertTriangle, AlertCircle, CheckCircle2, Wifi, Layers,
  Footprints, Flame, TrendingUp, Power, Compass, MapPin,
  Gauge, Ruler, Weight, Dumbbell
} from "lucide-react";
import { api } from "../lib/api";

export default function SensorPage() {
  // WiFi pairing state
  const [pairing, setPairing] = useState(null); // { pairing_code, server_ip, server_port }
  const [pairingLoading, setPairingLoading] = useState(false);
  const [connectedDevice, setConnectedDevice] = useState(null);

  // Real-time Telemetry state (Health Connect activity + body measurements)
  const [telemetry, setTelemetry] = useState({
    steps: 0,
    distance_meters: 0,
    speed_avg_mps: 0,
    active_calories: 0,
    total_calories: 0,
    exercise_sessions_count: 0,
    exercise_minutes: 0,
    activity_level: "Sedentary",
    bmr_kcal: null,
    height_cm: null,
    weight_kg: null
  });

  // AI Inference & Fusion state
  const [aiAnalysis, setAiAnalysis] = useState({
    stress_index: 0.5,
    risk_classification: "Medium",
    stress_pattern: "Awaiting telemetry to generate diagnostic insights.",
    anomaly_flags: [],
    confidence_score: 0.75
  });

  const [fusion, setFusion] = useState({
    sensor_weight: 0.30,
    sensor_contribution: "positive_influence"
  });

  // UI States
  const [systemLogs, setSystemLogs] = useState([]);
  const [errorMsg, setErrorMsg] = useState(null);
  const [wsStatus, setWsStatus] = useState("disconnected"); // disconnected, connecting, connected

  const websocketRef = useRef(null);
  const pollRef = useRef(null);

  // Add a line to the dashboard terminal log
  const addLog = (msg, type = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    setSystemLogs(prev => [
      { text: `[${timestamp}] ${msg}`, type },
      ...prev.slice(0, 15)
    ]);
  };

  // 1. Fetch current status on mount, then poll while waiting for the phone to pair
  useEffect(() => {
    addLog("System initialized. Awaiting wearable synchronization.", "info");
    checkConnectionStatus();

    return () => {
      closeWebSocket();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const checkConnectionStatus = async () => {
    try {
      const res = await api.getBluetoothStatus();
      if (res.connected) {
        setConnectedDevice(res.device);
        addLog(`Synchronized active connection with ${res.device.name}.`, "success");
        connectWebSocket();
      } else if (res.pairing_code) {
        setPairing({ pairing_code: res.pairing_code, server_ip: res.server_ip });
      }
    } catch (err) {
      setErrorMsg("Failed to synchronize wearable status with backend API.");
      addLog("API Error: Unable to fetch connection status.", "error");
    }
  };

  // 2. Generate a WiFi pairing code for the phone to use
  const handleStartPairing = async () => {
    setPairingLoading(true);
    setErrorMsg(null);
    addLog("Generating WiFi pairing code...", "info");
    try {
      const res = await api.startWifiPairing();
      setPairing(res);
      addLog(`Pairing code ${res.pairing_code} ready. Enter it in the SensorApp on your phone.`, "success");

      // Poll status every 3s until the phone connects
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const status = await api.getBluetoothStatus();
          if (status.connected) {
            clearInterval(pollRef.current);
            setConnectedDevice(status.device);
            setPairing(null);
            addLog(`✓ Phone connected: ${status.device.name}.`, "success");
            connectWebSocket();
          }
        } catch (e) { /* keep polling */ }
      }, 3000);
    } catch (err) {
      setErrorMsg(err.message || "Failed to generate pairing code.");
      addLog("Pairing code generation failed.", "error");
    } finally {
      setPairingLoading(false);
    }
  };

  // 3. Disconnect
  const handleDisconnect = async () => {
    if (pollRef.current) clearInterval(pollRef.current);
    addLog(`Terminating connection with ${connectedDevice?.name || "phone"}...`, "info");
    closeWebSocket();
    try {
      await api.disconnectBluetoothDevice();
      addLog(`Wearable disconnected cleanly. System on standby.`, "success");
    } catch (err) {
      addLog("Failed to disconnect cleanly. Resetting interface.", "error");
    } finally {
      setConnectedDevice(null);
      setPairing(null);
    }
  };

  // 4. WebSocket Telemetry Stream Management
  const connectWebSocket = () => {
    closeWebSocket();
    setWsStatus("connecting");
    const wsUrl = api.getBluetoothStreamUrl();
    addLog(`Opening real-time sensor WebSocket pipeline...`, "info");

    const ws = new WebSocket(wsUrl);
    websocketRef.current = ws;

    ws.onopen = () => {
      setWsStatus("connected");
      addLog("✓ WebSocket pipeline status: ACTIVE", "success");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setTelemetry(data.telemetry);
        setAiAnalysis(data.ai_analysis);
        setFusion(data.fusion_contribution);
      } catch (err) {
        console.error("Error parsing WebSocket JSON telemetry:", err);
      }
    };

    ws.onerror = () => {
      addLog("WebSocket interface experienced a data-transport exception.", "error");
      setWsStatus("disconnected");
    };

    ws.onclose = () => {
      addLog("WebSocket telemetry stream closed.", "info");
      setWsStatus("disconnected");
    };
  };

  const closeWebSocket = () => {
    if (websocketRef.current) {
      websocketRef.current.close();
      websocketRef.current = null;
    }
    setWsStatus("disconnected");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title">Physiological Intelligence Console</div>
          <div className="page-subtitle">
            WiFi-linked Health Connect telemetry ingestion and activity-based wellness estimation
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className={`badge ${wsStatus === 'connected' ? 'badge-live' : wsStatus === 'connecting' ? 'badge-amber' : 'badge-muted'}`}>
            <span className={`status-dot ${wsStatus === 'connected' ? 'live' : wsStatus === 'connecting' ? 'warn' : 'idle'}`} />
            WS: {wsStatus}
          </span>
          <button className="btn btn-secondary btn-sm" onClick={checkConnectionStatus} disabled={pairingLoading}>
            <RefreshCw style={{ width: 13, height: 13, ...(pairingLoading ? { animation: 'spin 1s linear infinite' } : {}) }} />
            Refresh Status
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="alert alert-error">
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Three Column Console Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 340px', gap: 16 }}>

        {/* ================= COLUMN 1: WIFI PAIRING CENTER ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Connection Status Card */}
          <div className="card card-accent-cyan" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Device Status</div>

            {connectedDevice ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ padding: 10, borderRadius: 8, background: 'rgba(6,182,212,0.1)', color: 'var(--cyan)' }}>
                    <Wifi style={{ width: 22, height: 22, animation: 'pulse 1.5s infinite' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {connectedDevice.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                      {connectedDevice.address}
                    </div>
                  </div>
                </div>

                <div className="divider" style={{ margin: '4px 0' }} />

                <div className="card card-xs" style={{ background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>Link</span>
                  <span className="badge badge-cyan" style={{ width: 'fit-content', padding: '1px 6px', fontSize: 9 }}>
                    WiFi (Health Connect)
                  </span>
                </div>

                <button className="btn btn-secondary btn-sm" onClick={handleDisconnect} style={{ color: '#F87171', borderColor: 'rgba(248,113,113,0.2)', width: '100%', justifyContent: 'center' }}>
                  <Power style={{ width: 13, height: 13 }} />
                  Terminate Connection
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                <Radio style={{ width: 32, height: 32, color: 'var(--text-muted)', opacity: 0.5, animation: 'pulse 2.5s infinite' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>No Active Wearable</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                    Generate a pairing code and connect the SensorApp on your phone over WiFi.
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* WiFi Pairing Card */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span className="section-title" style={{ marginBottom: 0 }}>WiFi Pairing</span>
              {pairing && <span style={{ fontSize: 10, color: 'var(--cyan)', fontFamily: 'IBM Plex Mono' }}>Waiting...</span>}
            </div>

            {!connectedDevice && (
              <>
                {pairing ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="card card-xs" style={{ background: 'var(--bg-elevated)', textAlign: 'center', padding: 16 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>Pairing Code</div>
                      <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '0.15em', color: 'var(--cyan)', fontFamily: 'IBM Plex Mono', marginTop: 4 }}>
                        {pairing.pairing_code}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11, color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Server IP</span>
                        <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)' }}>{pairing.server_ip}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>Port</span>
                        <span style={{ fontFamily: 'IBM Plex Mono', color: 'var(--text-primary)' }}>8000</span>
                      </div>
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      Open the SensorApp on your phone (same WiFi network), enter the IP, port and this
                      code in the WiFi Sync panel, then tap Connect &amp; Sync.
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={handleStartPairing} disabled={pairingLoading}>
                      <RefreshCw style={{ width: 13, height: 13 }} /> Generate New Code
                    </button>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: '20px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                    <Shield style={{ width: 28, height: 28, color: 'var(--text-muted)', opacity: 0.5 }} />
                    <button className="btn btn-primary btn-sm" onClick={handleStartPairing} disabled={pairingLoading}>
                      {pairingLoading ? "Generating..." : "Generate Pairing Code"}
                    </button>
                  </div>
                )}
              </>
            )}

            {connectedDevice && (
              <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                Phone is connected and streaming over WiFi.
              </div>
            )}
          </div>
        </div>

        {/* ================= COLUMN 2: LIVE ACTIVITY MONITORING ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Quick Metrics Grid */}
          <div className="grid-3" style={{ gap: 12 }}>

            {/* Steps Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Steps Today</span>
                <Footprints style={{ width: 14, height: 14, color: 'var(--emerald)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                  {connectedDevice ? telemetry.steps?.toLocaleString() : '--'}
                </span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                Activity: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{connectedDevice ? telemetry.activity_level : 'Idle'}</span>
              </div>
            </div>

            {/* Distance Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Distance</span>
                <MapPin style={{ width: 14, height: 14, color: 'var(--cyan)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                  {connectedDevice ? (telemetry.distance_meters / 1000).toFixed(2) : '--'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>km</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                Avg speed: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{connectedDevice ? `${telemetry.speed_avg_mps} m/s` : '--'}</span>
              </div>
            </div>

            {/* Calories Card */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="stat-label">Calories</span>
                <Flame style={{ width: 14, height: 14, color: 'var(--amber)' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontSize: 32, fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                  {connectedDevice ? telemetry.total_calories : '--'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>kcal total</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                Exercise: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{connectedDevice ? `${telemetry.exercise_sessions_count} sessions · ${telemetry.exercise_minutes} min` : '--'}</span>
              </div>
            </div>
          </div>

          {/* Exercise & Body Measurements row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

            {/* Exercise Sessions */}
            <div className="card" style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ padding: 12, borderRadius: 10, background: 'rgba(16,185,129,0.1)', color: 'var(--emerald)' }}>
                <Dumbbell style={{ width: 20, height: 20 }} />
              </div>
              <div style={{ flex: 1 }}>
                <span className="stat-label" style={{ display: 'block' }}>Exercise Sessions</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                  {connectedDevice ? telemetry.exercise_sessions_count : '--'}
                </span>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                  {connectedDevice ? `${telemetry.exercise_minutes} min total` : ''}
                </div>
              </div>
            </div>

            {/* Body Measurements */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="stat-label">Body Measurements</span>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Gauge style={{ width: 12, height: 12 }} /> BMR
                </span>
                <span style={{ fontWeight: 600 }}>{connectedDevice && telemetry.bmr_kcal ? `${telemetry.bmr_kcal} kcal` : '--'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Ruler style={{ width: 12, height: 12 }} /> Height
                </span>
                <span style={{ fontWeight: 600 }}>{connectedDevice && telemetry.height_cm ? `${telemetry.height_cm} cm` : '--'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Weight style={{ width: 12, height: 12 }} /> Weight
                </span>
                <span style={{ fontWeight: 600 }}>{connectedDevice && telemetry.weight_kg ? `${telemetry.weight_kg} kg` : '--'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Activity style={{ width: 12, height: 12 }} /> BMI
                </span>
                <span style={{ fontWeight: 600 }}>
                  {connectedDevice && telemetry.height_cm && telemetry.weight_kg
                    ? (telemetry.weight_kg / ((telemetry.height_cm / 100) ** 2)).toFixed(1)
                    : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* Console Terminal Logs */}
          <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 130 }}>
            <span className="section-title" style={{ marginBottom: 0 }}>WiFi Telemetry Stream Log</span>
            <div className="terminal" style={{ flex: 1, maxHeight: 150 }}>
              {systemLogs.map((log, idx) => (
                <div key={idx} className={
                  log.type === 'success' ? 'terminal-line-success' :
                  log.type === 'error' ? 'terminal-line-error' :
                  'terminal-line-info'
                }>
                  {log.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ================= COLUMN 3: AI ACTIVITY ANALYSIS & FUSION ================= */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Activity Wellness Card */}
          <div className="card card-accent-rose" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="section-title" style={{ marginBottom: 0 }}>Activity-Derived Wellness Signal</span>
              <span className="badge badge-rose" style={{ fontSize: 9 }}>Heuristic Model</span>
            </div>

            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'IBM Plex Mono' }}>
                Sedentary Risk Index
              </span>
              <div style={{
                fontSize: 42,
                fontWeight: 800,
                color: aiAnalysis.stress_index >= 0.70 ? 'var(--rose)' : aiAnalysis.stress_index >= 0.40 ? 'var(--amber)' : 'var(--emerald)',
                fontFamily: 'IBM Plex Sans',
                lineHeight: 1.1,
                marginTop: 4
              }}>
                {connectedDevice ? `${Math.round(aiAnalysis.stress_index * 100)}%` : '--'}
              </div>
              <span className={`badge ${
                aiAnalysis.risk_classification?.toLowerCase() === 'high' ? 'badge-rose' :
                aiAnalysis.risk_classification?.toLowerCase() === 'medium' ? 'badge-amber' :
                'badge-live'
              }`} style={{ marginTop: 6 }}>
                {connectedDevice ? `${aiAnalysis.risk_classification} sedentary risk` : 'No Signal'}
              </span>
            </div>

            {/* Visual index meter */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-secondary)' }}>
                <span>Active</span>
                <span>Sedentary</span>
              </div>
              <div className="meter-bar" style={{ height: 6 }}>
                <div
                  className={`meter-fill ${
                    aiAnalysis.stress_index >= 0.70 ? 'rose' :
                    aiAnalysis.stress_index >= 0.40 ? 'amber' :
                    'emerald'
                  }`}
                  style={{ width: connectedDevice ? `${aiAnalysis.stress_index * 100}%` : '0%' }}
                />
              </div>
            </div>

            <div className="divider" style={{ margin: '4px 0' }} />

            {/* Insights */}
            <div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono', display: 'block', marginBottom: 4 }}>
                Activity Insights
              </span>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, background: 'rgba(21,23,22,0.02)', padding: 10, borderRadius: 6, border: '1px solid var(--bg-border)' }}>
                {connectedDevice ? aiAnalysis.stress_pattern : "System idle. Awaiting Health Connect telemetry to generate insights."}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
              <span>Model confidence:</span>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)', fontFamily: 'IBM Plex Mono' }}>
                {connectedDevice ? `${Math.round(aiAnalysis.confidence_score * 100)}%` : '--'}
              </span>
            </div>
          </div>

          {/* Anomalies Card */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="section-title" style={{ marginBottom: 0 }}>Anomalies Detected</span>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {connectedDevice ? (
                aiAnalysis.anomaly_flags.length > 0 ? (
                  aiAnalysis.anomaly_flags.map((anomaly, idx) => (
                    <div key={idx} className="alert alert-error" style={{ padding: '8px 12px', fontSize: 11, borderRadius: 8 }}>
                      <AlertCircle style={{ width: 13, height: 13, flexShrink: 0, marginTop: 1 }} />
                      <span>{anomaly}</span>
                    </div>
                  ))
                ) : (
                  <div className="alert alert-success" style={{ padding: '8px 12px', fontSize: 11, borderRadius: 8, background: 'rgba(16,185,129,0.06)' }}>
                    <CheckCircle2 style={{ width: 13, height: 13, color: 'var(--emerald)', flexShrink: 0, marginTop: 1 }} />
                    <span>Activity levels within expected norms.</span>
                  </div>
                )
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                  Awaiting wearable connection...
                </div>
              )}
            </div>
          </div>

          {/* Attention Fusion Card */}
          <div className="card card-accent-violet" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <span className="section-title" style={{ marginBottom: 0 }}>Central Attention Fusion</span>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ padding: 10, borderRadius: 8, background: 'rgba(124,58,237,0.1)', color: 'var(--violet)' }}>
                <Layers style={{ width: 20, height: 20 }} />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono', display: 'block' }}>
                  Attention Weight Contribution
                </span>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                  {connectedDevice ? `${Math.round(fusion.sensor_weight * 100)}%` : '--'}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
              <div className="meter-bar" style={{ height: 4 }}>
                <div className="meter-fill violet" style={{ width: connectedDevice ? `${fusion.sensor_weight * 100}%` : '0%' }} />
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 4 }}>
              The Attention Fusion engine allocates <span style={{ color: 'var(--violet)', fontWeight: 600 }}>{connectedDevice ? `${Math.round(fusion.sensor_weight * 100)}%` : '0%'}</span> of the overall patient wellness score weighting to this stream, generating a
              <span style={{
                color: fusion.sensor_contribution === 'positive_influence' ? 'var(--emerald)' : 'var(--rose)',
                fontWeight: 600
              }}>
                {" "}{fusion.sensor_contribution === 'positive_influence' ? 'positive wellness boost' : 'negative clinical warning'}
              </span> in the unified metrics matrix.
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
