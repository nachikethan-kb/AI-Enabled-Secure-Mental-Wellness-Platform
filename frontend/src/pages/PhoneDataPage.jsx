import React, { useEffect, useMemo, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, Smartphone, RefreshCw, Wifi, Battery, Heart, Moon, ShieldAlert,
  CheckCircle, AlertTriangle, AlertOctagon, Sparkles, Send, Signal, Info, WifiOff, FileText
} from "lucide-react";
import { api } from "../lib/api";

// --- CUSTOM SVG LINE CHART COMPONENT ---
function SVGLineChart({ data, dataKey, color, label }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: "flex", height: 140, alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 12, border: "1px dashed rgba(21,23,22,0.08)", borderRadius: 8 }}>
        No historical trend data available.
      </div>
    );
  }

  const values = data.map(d => Number(d[dataKey]) || 0);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const valRange = maxVal - minVal || 1;

  const width = 500;
  const height = 130;
  const padding = 15;

  const points = data.map((d, index) => {
    const x = padding + (index / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - (((Number(d[dataKey]) || 0) - minVal) / valRange) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div style={{ background: "var(--bg-elevated)", border: "1px solid rgba(21,23,22,0.05)", padding: 12, borderRadius: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 11 }}>
        <span style={{ fontWeight: 600, color: "var(--text-muted)" }}>{label}</span>
        <span style={{ color: color, fontWeight: 700 }}>Peak: {maxVal}</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: "auto" }}>
        {/* Horizontal reference lines */}
        <line x1={padding} y1={padding} x2={width - padding} y2={padding} stroke="rgba(21,23,22,0.03)" strokeDasharray="3" />
        <line x1={padding} y1={height / 2} x2={width - padding} y2={height / 2} stroke="rgba(21,23,22,0.03)" strokeDasharray="3" />
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="rgba(21,23,22,0.08)" />

        {/* Gradient Fill under line */}
        {data.length > 1 && (
          <polygon
            points={`${padding},${height - padding} ${points} ${width - padding},${height - padding}`}
            fill={`url(#grad-${dataKey})`}
            opacity="0.12"
          />
        )}

        {/* The data line */}
        {data.length > 1 ? (
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            points={points}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : (
          <circle cx={width / 2} cy={height / 2} r="4" fill={color} />
        )}

        {/* Gradient Definitions */}
        <defs>
          <linearGradient id={`grad-${dataKey}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 9, color: "var(--text-muted)" }}>
        <span>{data[0]?.date || "Start"}</span>
        <span>{data[data.length - 1]?.date || "Latest"}</span>
      </div>
    </div>
  );
}

// --- MAIN WEB COMPONENT ---
export default function PhoneDataPage() {
  const [deviceList, setDeviceList] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("synthetic_test_phone_001");
  const [customDeviceInput, setCustomDeviceInput] = useState("");
  
  // Connection states
  const [connectionStatus, setConnectionStatus] = useState("disconnected"); // connected, disconnected, reconnecting, fallback_polling
  const [lastHeartbeat, setLastHeartbeat] = useState(null);
  
  // Telemetry & Assessment states
  const [liveTelemetry, setLiveTelemetry] = useState(null);
  const [riskAssessment, setRiskAssessment] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [historicalData, setHistoricalData] = useState([]);
  const [trendData, setTrendData] = useState([]);

  // PHQ-9 inline assessment state
  const [phq9Answers, setPhq9Answers] = useState(Array(9).fill(0));
  const [phq9Submitting, setPhq9Submitting] = useState(false);
  const [phq9Success, setPhq9Success] = useState(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // WebSockets ref
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const pollingIntervalRef = useRef(null);

  // 1. Fetch historical & static data for selected user/device
  const loadDeviceStaticData = async (deviceId) => {
    if (!deviceId) return;
    try {
      setLoading(true);
      setError(null);
      
      // Fetch history, risk assessment, recommendations, aggregates
      const [historyRes, riskRes, recsRes, trendsRes] = await Promise.allSettled([
        api.getWifiHistory(deviceId, 20),
        api.getWifiRisk(deviceId),
        api.getWifiRecommendations(deviceId),
        api.getWifiTrends(deviceId)
      ]);

      if (historyRes.status === "fulfilled") {
        setHistoricalData(historyRes.value || []);
        if (historyRes.value && historyRes.value.length > 0) {
          // Set latest reading as baseline live telemetry
          const latest = historyRes.value[historyRes.value.length - 1];
          setLiveTelemetry(latest);
        }
      }
      if (riskRes.status === "fulfilled") setRiskAssessment(riskRes.value);
      if (recsRes.status === "fulfilled") setRecommendations(recsRes.value || []);
      if (trendsRes.status === "fulfilled") setTrendData(trendsRes.value || []);

    } catch (err) {
      console.error("Error loading static data: ", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch device list
  const loadDeviceList = async () => {
    try {
      const list = await api.getWifiUsers();
      setDeviceList(list || []);
    } catch (err) {
      console.error("Failed to load device list: ", err);
    }
  };

  // 2. Establish WebSocket connection
  const connectWebSocket = (deviceId) => {
    if (!deviceId) return;

    // Clear any existing WebSockets & timers
    cleanupConnections();

    const wsUrl = api.getWifiStreamUrl(deviceId);
    console.log(`[*] Connecting WebSocket to: ${wsUrl}`);
    setConnectionStatus("connecting");

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("[+] WebSocket connection established.");
        setConnectionStatus("connected");
        reconnectAttemptsRef.current = 0;
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const packet = JSON.parse(event.data);
          
          if (packet.event === "heartbeat") {
            setLastHeartbeat(packet.timestamp);
            return;
          }

          if (packet.event === "sensor_update" || packet.event === "phq9_update") {
            console.log("[WebSocket] Received update packet", packet);
            if (packet.latest_telemetry) {
              setLiveTelemetry(packet.latest_telemetry);
              // Append to history list
              setHistoricalData(prev => {
                const updated = [...prev, packet.latest_telemetry];
                if (updated.length > 40) updated.shift();
                return updated;
              });
            }
            if (packet.risk_assessment) {
              setRiskAssessment(packet.risk_assessment);
            }
            // Trigger refresh of recommendations
            api.getWifiRecommendations(deviceId).then(setRecommendations).catch(console.error);
            api.getWifiTrends(deviceId).then(setTrendData).catch(console.error);
          }
        } catch (err) {
          console.error("Error parsing WebSocket JSON: ", err);
        }
      };

      ws.onclose = (event) => {
        console.warn(`[-] WebSocket closed. Code: ${event.code}. Reason: ${event.reason}`);
        wsRef.current = null;
        
        // Handle reconnect / fallback
        if (reconnectAttemptsRef.current < 5) {
          setConnectionStatus("reconnecting");
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 15000);
          console.log(`[*] Retrying connection in ${delay}ms...`);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current += 1;
            connectWebSocket(deviceId);
          }, delay);
        } else {
          // Fall back to REST polling
          console.log("[-] WebSocket failed 5 times. Falling back to REST API polling.");
          setConnectionStatus("fallback_polling");
          startRESTPolling(deviceId);
        }
      };

      ws.onerror = (err) => {
        console.error("[-] WebSocket encountered an error:", err);
      };

    } catch (err) {
      console.error("Failed to construct WebSocket client: ", err);
      setConnectionStatus("disconnected");
    }
  };

  // REST API polling fallback
  const startRESTPolling = (deviceId) => {
    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current);
    
    // Poll immediately, then every 5 seconds
    const fetchLatest = async () => {
      try {
        const latest = await api.getWifiLatest(deviceId);
        setLiveTelemetry(latest);
        
        const [risk, recs, trends] = await Promise.all([
          api.getWifiRisk(deviceId),
          api.getWifiRecommendations(deviceId),
          api.getWifiTrends(deviceId)
        ]);
        setRiskAssessment(risk);
        setRecommendations(recs);
        setTrendData(trends);
      } catch (err) {
        console.error("Polling fetch failed: ", err);
      }
    };
    
    fetchLatest();
    pollingIntervalRef.current = setInterval(fetchLatest, 5000);
  };

  // Connection cleaners
  const cleanupConnections = () => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  // Triggered on device change
  useEffect(() => {
    loadDeviceList();
    if (selectedDevice) {
      loadDeviceStaticData(selectedDevice);
      connectWebSocket(selectedDevice);
    }
    return () => cleanupConnections();
  }, [selectedDevice]);

  // Handle custom device monitor
  const handleMonitorCustomDevice = (e) => {
    e.preventDefault();
    if (customDeviceInput.trim()) {
      setSelectedDevice(customDeviceInput.trim());
      setCustomDeviceInput("");
    }
  };

  // PHQ-9 Submit Handler
  const handlePHQ9Submit = async (e) => {
    e.preventDefault();
    setPhq9Submitting(true);
    setPhq9Success(null);
    try {
      const response = await api.submitWifiPHQ9(selectedDevice, phq9Answers);
      setPhq9Success(`Assessment submitted! Score: ${response.score} (${response.severity})`);
      setPhq9Answers(Array(9).fill(0));
      // Refresh current risk
      loadDeviceStaticData(selectedDevice);
    } catch (err) {
      setError(err.message || "Failed to submit PHQ-9 self-assessment.");
    } finally {
      setPhq9Submitting(false);
    }
  };

  // UI Colors & Details depending on risk level
  const riskTheme = useMemo(() => {
    if (!riskAssessment) return { color: "var(--cyan)", text: "Unknown", bg: "rgba(6, 182, 212, 0.1)", icon: Info };
    const score = riskAssessment.risk_score || 0;
    if (score < 0.35) {
      return { color: "var(--emerald)", text: "Low Risk", bg: "rgba(16, 185, 129, 0.12)", icon: CheckCircle };
    } else if (score < 0.65) {
      return { color: "var(--amber)", text: "Medium Risk", bg: "rgba(245, 158, 11, 0.12)", icon: AlertTriangle };
    } else {
      return { color: "var(--rose)", text: "High Risk", bg: "rgba(239, 68, 68, 0.12)", icon: AlertOctagon };
    }
  }, [riskAssessment]);

  // Connection Indicator Styling
  const connectionIndicator = useMemo(() => {
    switch (connectionStatus) {
      case "connected":
        return { label: "Connected (WS)", color: "var(--emerald)", pulse: true };
      case "connecting":
      case "reconnecting":
        return { label: `Reconnecting (Attempt ${reconnectAttemptsRef.current})`, color: "var(--amber)", pulse: true };
      case "fallback_polling":
        return { label: "Polling REST Fallback", color: "var(--cyan)", pulse: false };
      default:
        return { label: "Disconnected", color: "var(--rose)", pulse: false };
    }
  }, [connectionStatus]);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Top Header Section */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <div className="page-title">WiFi Telemetry & Socket Console</div>
          <div className="page-subtitle">Real-time socket-level continuous data monitoring system.</div>
        </div>
        
        {/* Connection status badge */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--bg-elevated)", padding: "8px 16px", borderRadius: 12, border: "1px solid rgba(21,23,22,0.06)" }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Status:</span>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{
              width: 8, height: 8, borderRadius: "50%",
              backgroundColor: connectionIndicator.color,
              boxShadow: connectionIndicator.pulse ? `0 0 8px ${connectionIndicator.color}` : "none",
              animation: connectionIndicator.pulse ? "pulse 1.5s infinite" : "none"
            }} />
            <strong style={{ fontSize: 12, color: connectionIndicator.color }}>{connectionIndicator.label}</strong>
          </div>
        </div>
      </div>

      {/* Control bar / Selector */}
      <div className="card" style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 16, background: "linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 280 }}>
          <Smartphone style={{ color: "var(--cyan)", width: 18, height: 18 }} />
          <span style={{ fontSize: 13, fontWeight: 600 }}>Active Device Monitor:</span>
          <select 
            value={selectedDevice} 
            onChange={(e) => setSelectedDevice(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, background: "var(--bg-base)", border: "1px solid rgba(21,23,22,0.1)", color: "var(--text-main)", fontSize: 13, cursor: "pointer", minWidth: 200 }}
          >
            <option value="synthetic_test_phone_001">Synthetic Mock Phone (Default)</option>
            {deviceList.map(dev => (
              <option key={dev.device_id} value={dev.device_id}>
                {dev.name} ({dev.device_id.substring(0,8)})
              </option>
            ))}
          </select>
          <button className="btn btn-secondary btn-xs" onClick={loadDeviceList} title="Refresh device list">
            <RefreshCw style={{ width: 12, height: 12 }} />
          </button>
        </div>

        {/* Custom device monitoring registration */}
        <form onSubmit={handleMonitorCustomDevice} style={{ display: "flex", gap: 8 }}>
          <input
            type="text"
            placeholder="Monitor Device ID (e.g. android_id)"
            value={customDeviceInput}
            onChange={(e) => setCustomDeviceInput(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, background: "var(--bg-base)", border: "1px solid rgba(21,23,22,0.1)", color: "var(--text-main)", fontSize: 12, width: 220 }}
          />
          <button type="submit" className="btn btn-primary btn-sm" style={{ display: "flex", alignItems: "center", gap: 4 }}>
            Monitor
          </button>
        </form>
      </div>

      {/* Main 3-column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 20, alignItems: "start" }}>
        
        {/* COLUMN 1: LIVE SENSOR GRID */}
        <div style={{ display: "grid", gap: 20 }}>
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 0 }}>
            <Signal style={{ width: 16, height: 16, color: "var(--cyan)" }} /> Real-time Sensor Metrics
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Steps & Activity */}
            <div className="card" style={{ display: "grid", gap: 8, borderLeft: "4px solid var(--emerald)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Activity</span>
                <Activity style={{ width: 16, height: 16, color: "var(--emerald)" }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{liveTelemetry?.steps ?? "--"}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Steps Today</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, borderTop: "1px solid rgba(21,23,22,0.05)", paddingTop: 6, marginTop: 4 }}>
                <span>Dist: {liveTelemetry?.distance_meters ? `${liveTelemetry.distance_meters}m` : "--"}</span>
                <span>Cal: {liveTelemetry?.calories ? `${liveTelemetry.calories}kcal` : "--"}</span>
              </div>
            </div>

            {/* Screen Usage */}
            <div className="card" style={{ display: "grid", gap: 8, borderLeft: "4px solid var(--cyan)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Screen Time</span>
                <Smartphone style={{ width: 16, height: 16, color: "var(--cyan)" }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{liveTelemetry?.screen_time_minutes ?? "--"}m</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Active Screentime</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, borderTop: "1px solid rgba(21,23,22,0.05)", paddingTop: 6, marginTop: 4 }}>
                <span>Unlocks: {liveTelemetry?.unlock_count ?? "--"}</span>
                <span style={{ color: liveTelemetry?.is_screen_on ? "var(--cyan)" : "var(--text-muted)", fontWeight: 700 }}>
                  {liveTelemetry?.is_screen_on ? "Screen ON" : "Screen OFF"}
                </span>
              </div>
            </div>

            {/* Heart Rate / HRV */}
            <div className="card" style={{ display: "grid", gap: 8, borderLeft: "4px solid var(--rose)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Heart metrics</span>
                <Heart style={{ width: 16, height: 16, color: "var(--rose)", animation: "heartbeat-pulse 1.2s infinite" }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800, display: "flex", alignItems: "baseline", gap: 4 }}>
                  {liveTelemetry?.heart_rate ?? "--"}
                  <span style={{ fontSize: 11, fontWeight: 500, color: "var(--text-muted)" }}>BPM</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Real-time Heart Rate</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, borderTop: "1px solid rgba(21,23,22,0.05)", paddingTop: 6, marginTop: 4 }}>
                <span>Resting: {liveTelemetry?.resting_heart_rate ?? "--"} BPM</span>
                <span>HRV: {liveTelemetry?.hrv ? `${liveTelemetry.hrv}ms` : "--"}</span>
              </div>
            </div>

            {/* Sleep details */}
            <div className="card" style={{ display: "grid", gap: 8, borderLeft: "4px solid var(--violet)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Sleep Duration</span>
                <Moon style={{ width: 16, height: 16, color: "var(--violet)" }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{liveTelemetry?.sleep_hours ?? "--"}h</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Last Night's Sleep</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, borderTop: "1px solid rgba(21,23,22,0.05)", paddingTop: 6, marginTop: 4 }}>
                <span>Quality: {liveTelemetry?.sleep_quality ? `${liveTelemetry.sleep_quality}%` : "--"}</span>
                <span>Wake: {liveTelemetry?.wake_time ? new Date(liveTelemetry.wake_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--"}</span>
              </div>
            </div>

            {/* Battery state */}
            <div className="card" style={{ display: "grid", gap: 8, borderLeft: "4px solid var(--orange)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Battery Status</span>
                <Battery style={{ width: 16, height: 16, color: "var(--orange)" }} />
              </div>
              <div>
                <div style={{ fontSize: 24, fontWeight: 800 }}>{liveTelemetry?.battery_level ?? "--"}%</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Device Battery Level</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, borderTop: "1px solid rgba(21,23,22,0.05)", paddingTop: 6, marginTop: 4 }}>
                <span>Temp: {liveTelemetry?.battery_temperature ? `${liveTelemetry.battery_temperature}°C` : "--"}</span>
                <span style={{ color: "var(--orange)", fontWeight: 700 }}>{liveTelemetry?.is_charging ? "Charging" : "Discharging"}</span>
              </div>
            </div>

            {/* Network / SSID */}
            <div className="card" style={{ display: "grid", gap: 8, borderLeft: "4px solid #3b82f6" }}>
              <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>Network</span>
                <Wifi style={{ width: 16, height: 16, color: "#3b82f6" }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {liveTelemetry?.wifi_ssid || "Not connected"}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Current SSID</div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, borderTop: "1px solid rgba(21,23,22,0.05)", paddingTop: 6, marginTop: 4 }}>
                <span>Type: {liveTelemetry?.connection_type?.toUpperCase() || "--"}</span>
                <span>Notifs/hr: {liveTelemetry?.notification_count ?? "--"}</span>
              </div>
            </div>
          </div>

          {/* Social Notification / Current App Details */}
          <div className="card" style={{ background: "var(--bg-elevated)", border: "1px solid rgba(21,23,22,0.05)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>Active Process Details</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Current Foreground App:</span>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--cyan)" }}>
                  {liveTelemetry?.current_app || "--"}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Social App usage:</span>
                <div style={{ fontSize: 13, fontWeight: 700 }}>
                  {liveTelemetry?.social_app_minutes ? `${liveTelemetry.social_app_minutes} minutes today` : "--"}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* COLUMN 2: RISK ASSESSMENT & RECOMMENDATIONS */}
        <div style={{ display: "grid", gap: 20 }}>
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 0 }}>
            <ShieldAlert style={{ width: 16, height: 16, color: riskTheme.color }} /> Mental Health Risk Profile
          </div>

          {/* Risk assessment card */}
          <div className="card" style={{ display: "grid", gap: 16, background: `linear-gradient(135deg, var(--bg-card) 0%, ${riskTheme.bg} 100%)`, border: `1px solid ${riskTheme.color}33` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase" }}>Calculated State</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: riskTheme.color }}>{riskTheme.text}</div>
              </div>
              <div style={{ padding: 12, borderRadius: "50%", background: riskTheme.bg, color: riskTheme.color }}>
                <riskTheme.icon style={{ width: 24, height: 24 }} />
              </div>
            </div>

            {/* Progress/Score Bar */}
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                <span>Risk Indicator Score:</span>
                <strong>{riskAssessment?.risk_score ? Math.round(riskAssessment.risk_score * 100) : 0}%</strong>
              </div>
              <div style={{ height: 8, borderRadius: 4, background: "rgba(21,23,22,0.06)", overflow: "hidden" }}>
                <div style={{
                  height: "100%", width: `${riskAssessment?.risk_score ? (riskAssessment.risk_score * 100) : 0}%`,
                  backgroundColor: riskTheme.color,
                  boxShadow: `0 0 10px ${riskTheme.color}`,
                  transition: "width 0.8s ease"
                }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--text-muted)" }}>
                <span>Low Risk</span>
                <span>Elevated</span>
                <span>Critical</span>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(21,23,22,0.05)", paddingTop: 10, fontSize: 11 }}>
              <span>Engine Confidence:</span>
              <strong style={{ color: "var(--cyan)" }}>
                {riskAssessment?.confidence ? `${Math.round(riskAssessment.confidence * 100)}%` : "80%"}
              </strong>
            </div>
          </div>

          {/* Contributing factors */}
          <div className="card" style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
              <Info style={{ width: 14, height: 14 }} /> Contributing Anomalies
            </div>
            
            <div style={{ display: "grid", gap: 6 }}>
              {riskAssessment?.contributing_factors && Object.keys(riskAssessment.contributing_factors).length > 0 ? (
                Object.entries(riskAssessment.contributing_factors).map(([key, desc]) => (
                  <div key={key} style={{ display: "flex", gap: 8, alignItems: "flex-start", background: "rgba(21,23,22,0.02)", padding: 8, borderRadius: 6, fontSize: 11, borderLeft: "2.5px solid var(--amber)" }}>
                    <AlertTriangle style={{ width: 14, height: 14, color: "var(--amber)", marginTop: 1, flexShrink: 0 }} />
                    <div>{desc}</div>
                  </div>
                ))
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center", background: "rgba(16, 185, 129, 0.05)", padding: 8, borderRadius: 6, fontSize: 11, color: "var(--emerald)" }}>
                  <CheckCircle style={{ width: 14, height: 14, flexShrink: 0 }} />
                  No significant health risk factors detected today.
                </div>
              )}
            </div>
          </div>

          {/* Recommendations List */}
          <div className="card" style={{ display: "grid", gap: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              <Sparkles style={{ width: 14, height: 14, color: "var(--cyan)" }} /> Clinical Recommendations
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {recommendations.map(rec => (
                <div key={rec.id} style={{ display: "grid", gap: 2, background: "rgba(6, 182, 212, 0.03)", border: "1px solid rgba(6, 182, 212, 0.06)", padding: "10px 12px", borderRadius: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--cyan)" }}>{rec.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.4 }}>{rec.message}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COLUMN 3: PHQ-9 TEST & TRENDS */}
        <div style={{ display: "grid", gap: 20 }}>
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 0 }}>
            <FileText style={{ width: 16, height: 16, color: "var(--violet)" }} /> Self-Assessment & History
          </div>

          {/* Inline PHQ-9 Submission */}
          <div className="card" style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>Submit PHQ-9 Check-in</div>
            
            {phq9Success && <div className="alert alert-success" style={{ padding: 8, fontSize: 11, marginBottom: 0 }}>{phq9Success}</div>}
            
            <form onSubmit={handlePHQ9Submit} style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "grid", gap: 6, maxHeight: 180, overflowY: "auto", paddingRight: 6 }}>
                {[
                  "Little interest or pleasure in doing things?",
                  "Feeling down, depressed, or hopeless?",
                  "Trouble falling or staying asleep, or sleeping too much?",
                  "Feeling tired or having little energy?",
                  "Poor appetite or overeating?",
                  "Feeling bad about yourself, or that you are a failure?",
                  "Trouble concentrating on things, such as reading?",
                  "Moving or speaking so slowly that other people notice?",
                  "Thoughts that you would be better off dead?"
                ].map((q, idx) => (
                  <div key={idx} style={{ display: "grid", gap: 4, background: "rgba(21,23,22,0.01)", padding: 6, borderRadius: 6 }}>
                    <div style={{ fontSize: 10.5, lineHeight: 1.3 }}>{idx+1}. {q}</div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 4 }}>
                      {["Not at all", "Several days", "More than half", "Nearly every day"].map((lbl, val) => (
                        <label key={val} style={{ fontSize: 8.5, display: "flex", alignItems: "center", gap: 2, cursor: "pointer", color: phq9Answers[idx] === val ? "var(--cyan)" : "var(--text-muted)" }}>
                          <input
                            type="radio"
                            name={`q-${idx}`}
                            value={val}
                            checked={phq9Answers[idx] === val}
                            onChange={() => {
                              const newAns = [...phq9Answers];
                              newAns[idx] = val;
                              setPhq9Answers(newAns);
                            }}
                          />
                          {lbl}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <button type="submit" className="btn btn-primary btn-sm" disabled={phq9Submitting} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                <Send style={{ width: 12, height: 12 }} /> Submit PHQ-9 Response
              </button>
            </form>
          </div>

          {/* SVG Trend charts */}
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)" }}>30-Day Health Trends</div>
            <SVGLineChart
              data={trendData}
              dataKey="total_steps"
              color="var(--emerald)"
              label="Daily Step Count"
            />
            <SVGLineChart
              data={trendData}
              dataKey="avg_screen_time"
              color="var(--cyan)"
              label="Avg Screen Time (mins)"
            />
            <SVGLineChart
              data={trendData}
              dataKey="avg_sleep_hours"
              color="var(--violet)"
              label="Avg Sleep Duration (hours)"
            />
          </div>
        </div>

      </div>

      {/* Row: Recent Telemetry Samples */}
      <div className="card" style={{ display: "grid", gap: 10 }}>
        <div className="section-title" style={{ marginBottom: 0, fontSize: 13 }}>Live Packet Streaming Logs</div>
        <div style={{ maxHeight: 150, overflowY: "auto", display: "grid", gap: 6, paddingRight: 6 }}>
          {historicalData.slice().reverse().map((item, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(21,23,22,0.02)", padding: "6px 12px", borderRadius: 6, fontSize: 11, fontFamily: "monospace" }}>
              <span style={{ color: "var(--cyan)" }}>
                {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString()}
              </span>
              <span style={{ color: "var(--emerald)" }}>Steps: {item.steps}</span>
              <span style={{ color: "var(--rose)" }}>Heart Rate: {item.heart_rate ?? "N/A"} BPM</span>
              <span style={{ color: "var(--violet)" }}>HRV: {item.hrv ?? "N/A"} ms</span>
              <span style={{ color: "var(--orange)" }}>Battery: {item.battery_level}%</span>
              <span style={{ color: "var(--text-muted)" }}>App: {item.current_app}</span>
            </div>
          ))}
          {historicalData.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 8 }}>
              Waiting for incoming WiFi telemetry packages...
            </div>
          )}
        </div>
      </div>
      
      {/* Pulse Keyframes style injector */}
      <style>{`
        @keyframes heartbeat-pulse {
          0% { transform: scale(1); }
          25% { transform: scale(1.15); }
          40% { transform: scale(1); }
          60% { transform: scale(1.15); }
          100% { transform: scale(1); }
        }
        @keyframes pulse {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
}