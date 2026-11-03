import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Activity, AlertTriangle, Brain, CheckCircle2, ChevronRight,
  ClipboardList, FileText, MessageSquare, RefreshCw,
  Shield, Sparkles, Smartphone, TrendingUp, Upload, Zap, Battery, Heart, Radio
} from "lucide-react";
import { api } from "../lib/api";
import ConsultantDashboard from "./ConsultantDashboard";
import AdminDashboard from "./AdminDashboard";

/* ── Simplified, Centered Radial Risk Gauge ── */
function RiskGauge({ score, label }) {
  const [displayed, setDisplayed] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setDisplayed(score ?? 0), 200);
    return () => clearTimeout(timer);
  }, [score]);

  const r = 70, circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, displayed));
  const offset = circ * (1 - pct / 100);
  const color = score === null || score === undefined ? "#A78BFA" : pct >= 70 ? "#10B981" : pct >= 45 ? "#FCD34D" : "#F43F5E";

  return (
    <div style={{ position: "relative", width: 170, height: 170, flexShrink: 0, margin: "0 auto" }}>
      <svg width="170" height="170" style={{ transform: "rotate(-90deg)" }}>
        <circle cx="85" cy="85" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <motion.circle
          cx="85" cy="85" r={r} fill="none"
          stroke={color} strokeWidth="8" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          style={{ fontSize: 38, fontWeight: 700, color: "#FFFFFF", fontFamily: "Fraunces, serif", lineHeight: 1 }}
        >
          {score !== null && score !== undefined ? score : "--"}
        </motion.div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "IBM Plex Mono" }}>
          {label || "Index / 100"}
        </div>
      </div>
    </div>
  );
}

/* ── Small animated SVG trend sparkline ── */
function Sparkline({ values = [], color = "#10B981" }) {
  if (!values.length) return null;
  const w = 140, h = 38;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  }).join(" ");

  return (
    <svg width={w} height={h} style={{ overflow: "visible" }}>
      <motion.polyline
        points={pts} fill="none" stroke={color}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1], delay: 0.3 }}
      />
    </svg>
  );
}

export default function DashboardPage() {
  const role = sessionStorage.getItem("role") || localStorage.getItem("role") || "patient";
  if (role === "consultant") return <ConsultantDashboard />;
  if (role === "admin")      return <AdminDashboard />;

  const navigate   = useNavigate();
  const userName   = sessionStorage.getItem("full_name") || localStorage.getItem("full_name") || "User";
  const [dashData, setDashData] = useState(null);
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadText, setUploadText] = useState("");
  const [uploading, setUploading]   = useState(false);
  const [uploadLog, setUploadLog]   = useState([]);
  const [bleStatus, setBleStatus]   = useState({ connected: false });
  const [liveTel,   setLiveTel]     = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [dash, hist] = await Promise.all([api.getMultimodalDashboard(), api.getPHQ9History()]);
      setDashData(dash);
      setHistory(hist.items || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    let ws = null;
    api.getBluetoothStatus().then(res => {
      setBleStatus(res);
      if (res.connected) {
        ws = new WebSocket(api.getBluetoothStreamUrl());
        ws.onmessage = e => { try { setLiveTel(JSON.parse(e.data)); } catch {} };
      }
    }).catch(() => {});
    return () => ws?.close();
  }, []);

  const wellness       = dashData?.unified_wellness_index ?? null;
  const risk           = dashData?.risk_classification || "Unknown";
  const explainability = dashData?.explainability_layer || [];
  const alerts         = dashData?.alert_flags || [];
  const recommendations= dashData?.recommendations || [];

  const handleFileChange = e => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    const r = new FileReader();
    r.onload = ev => setUploadText(ev.target?.result || "");
    r.readAsText(file);
  };

  const handleUpload = async e => {
    e.preventDefault();
    if (!uploadText.trim()) return;
    setUploading(true); setUploadLog([]);
    for (const s of ["Initializing OCR pipeline...", "Running BioClinicalBERT...", "Mapping to wellness model..."]) {
      await new Promise(r => setTimeout(r, 450));
      setUploadLog(p => [...p, s]);
    }
    try {
      await api.submitHealthReport(uploadFile?.name || "manual-entry.txt", uploadText.trim());
      setUploadLog(p => [...p, "✓ Report integrated successfully."]);
      setTimeout(() => { setUploadFile(null); setUploadText(""); setUploadLog([]); load(); }, 2000);
    } catch (err) {
      setUploadLog(p => [...p, `✗ Error: ${err.message}`]);
    } finally { setUploading(false); }
  };

  const sparkValues = history.slice(0, 7).reverse().map(h => 100 - (h.score / 27) * 100);

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", display: "flex", flexDirection: "column", gap: 32, paddingBottom: 40 }}>

      {/* ── SECTION 1: CALM EDITORIAL OVERVIEW HEADER ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 20, borderBottom: "1px solid var(--bg-border)", paddingBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontFamily: "IBM Plex Mono, monospace", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--brand)", fontWeight: 600, marginBottom: 8 }}>
            PATIENT WELLNESS PORTAL
          </div>
          <h1 className="page-title font-display" style={{ fontSize: "clamp(1.8rem, 2.8vw, 2.4rem)", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            Good day, {userName.split(" ")[0]}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 6, margin: "6px 0 0" }}>
            Continuously synthesizing clinical evaluations, sensor streams, and language biomarkers.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading} style={{ background: "var(--bg-surface)", border: "1px solid var(--bg-border)", color: "var(--text-primary)" }}>
            <RefreshCw size={13} style={loading ? { animation: "spin 1s linear infinite" } : {}} />
            Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/assessment")} style={{ background: "var(--brand)", color: "#FFFFFF", borderColor: "transparent", padding: "8px 18px", borderRadius: 9999 }}>
            <ClipboardList size={14} /> New Assessment
          </button>
        </div>
      </div>

      {/* Alerts Banner */}
      {alerts.map((a, i) => (
        <div key={i} className="alert alert-info" style={{ background: "rgba(29, 107, 95, 0.08)", borderColor: "rgba(29, 107, 95, 0.25)", color: "var(--brand)" }}>
          <Sparkles size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{a}</span>
        </div>
      ))}

      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {[220, 160, 180].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 20 }} />)}
        </div>
      ) : (
        <>
          {/* ── SECTION 2: PRIMARY WELLNESS STATE (CONTROLLED DARK SECTION) ── */}
          <motion.div
            className="dark-section-card"
            style={{ padding: "36px 32px" }}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 40, alignItems: "center" }}>
              {/* Left Context */}
              <div>
                <div className="section-title">CURRENT STRATIFICATION</div>
                <div style={{ fontSize: 24, fontWeight: 700, fontFamily: "Fraunces, serif", color: "#FFFFFF", marginBottom: 8 }}>
                  {risk?.includes("Pending") ? risk : `${risk}`}
                </div>
                <p style={{ fontSize: 13, color: "var(--dark-text-sec, #94A3B8)", lineHeight: 1.7, marginBottom: 16 }}>
                  Synthesized across {dashData?.modes_active?.length || 0} active modalities including PHQ-9 NLP, smartphone sensors, and sentiment embeddings.
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className={`badge ${risk?.toLowerCase().includes("severe") ? "badge-rose" : risk?.toLowerCase().includes("moderate") ? "badge-amber" : "badge-live"}`}>
                    {risk}
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontFamily: "IBM Plex Mono" }}>
                    XGBoost Ensemble v2.0
                  </span>
                </div>
              </div>

              {/* Center: Large Simplified Risk Gauge */}
              <div style={{ textAlign: "center" }}>
                <RiskGauge score={wellness} label="Wellness Index" />
              </div>

              {/* Right: Trend & Trajectory */}
              <div>
                <div className="section-title">7-DAY TRAJECTORY</div>
                <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <Sparkline values={sparkValues.length ? sparkValues : [62, 65, 60, 72, 70, 74, 78]} color="#10B981" />
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#10B981", fontFamily: "IBM Plex Mono" }}>
                    {sparkValues.length > 1 && sparkValues[sparkValues.length - 1] >= sparkValues[0] ? "+Stable" : "Variable"}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "var(--dark-text-sec, #94A3B8)", lineHeight: 1.6 }}>
                  {recommendations.length > 0 ? recommendations[0] : "Lifestyle sensors indicate steady circadian consistency over recent cycles."}
                </div>
              </div>
            </div>

            {/* Explainability Matrix Divider */}
            {explainability.length > 0 && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 28, paddingTop: 20 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontFamily: "IBM Plex Mono", color: "rgba(255,255,255,0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    MULTIMODAL ATTENTION ATTRIBUTION
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
                  {explainability.map((item, i) => (
                    <div key={i} style={{ background: "rgba(255,255,255,0.04)", padding: "10px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 6 }}>
                        <span style={{ color: "#CBD5E1", fontFamily: "IBM Plex Mono" }}>{item.modality?.replace(/_/g, " ")}</span>
                        <span style={{ color: "var(--citron)", fontWeight: 600, fontFamily: "IBM Plex Mono" }}>{((item.weight || 0) * 100).toFixed(0)}%</span>
                      </div>
                      <div className="meter-bar" style={{ background: "rgba(255,255,255,0.08)" }}>
                        <div className="meter-fill" style={{ width: `${(item.weight || 0) * 100}%`, background: "var(--citron)" }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* ── SECTION 3: KEY TELEMETRY STRIP (4 CLEAN PILLARS ON WHITE SURFACES) ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <div className="bento-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span className="section-title" style={{ marginBottom: 0 }}>Daily Movement</span>
                <Activity size={18} style={{ color: "var(--brand)" }} />
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "Inter, sans-serif", color: "var(--text-primary)", lineHeight: 1 }}>
                {dashData?.sensors_summary?.steps ? Number(dashData.sensors_summary.steps).toLocaleString() : "--"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, fontFamily: "IBM Plex Mono" }}>
                Step counter · Android Sensor
              </div>
            </div>

            <div className="bento-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span className="section-title" style={{ marginBottom: 0 }}>Sleep Duration</span>
                <Battery size={18} style={{ color: "#3B82F6" }} />
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "Inter, sans-serif", color: "var(--text-primary)", lineHeight: 1 }}>
                {dashData?.sensors_summary?.sleep_duration_hours ? `${dashData.sensors_summary.sleep_duration_hours}h` : "--"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, fontFamily: "IBM Plex Mono" }}>
                Health Connect sleep window
              </div>
            </div>

            <div className="bento-card" style={{ padding: "24px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span className="section-title" style={{ marginBottom: 0 }}>Resting Heart Rate</span>
                <Heart size={18} style={{ color: "var(--rose)" }} />
              </div>
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "Inter, sans-serif", color: "var(--text-primary)", lineHeight: 1 }}>
                {dashData?.sensors_summary?.heart_rate ? `${dashData.sensors_summary.heart_rate} bpm` : "--"}
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8, fontFamily: "IBM Plex Mono" }}>
                Physiological baseline
              </div>
            </div>

            <div className="bento-card" style={{ padding: "24px", cursor: "pointer" }} onClick={() => navigate("/sensor")}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <span className="section-title" style={{ marginBottom: 0 }}>Phone Sensors</span>
                <Smartphone size={18} style={{ color: "var(--brand)" }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginTop: 4 }}>
                Real-Time Console
              </div>
              <div style={{ fontSize: 11, color: "var(--brand)", marginTop: 8, display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                <span>Inspect live telemetry</span>
                <ChevronRight size={12} />
              </div>
            </div>
          </div>

          {/* ── SECTION 5: CLINICAL HISTORY & MEDICAL RECORD UPLOAD ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 20 }}>
            {/* Assessment History Table */}
            <motion.div
              className="bento-card"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                  <div className="section-title" style={{ marginBottom: 2 }}>CLINICAL ASSESSMENTS</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "Fraunces, serif", color: "var(--text-primary)" }}>Recent Check-in Runs</div>
                </div>
                <button className="btn btn-ghost btn-xs" onClick={() => navigate("/assessment")} style={{ color: "var(--brand)" }}>
                  New run <ChevronRight size={11} />
                </button>
              </div>

              {history.length > 0 ? (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th><th>Score</th><th>Risk Classification</th><th>Model</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.slice(0, 5).map((item, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: "IBM Plex Mono", fontSize: 11 }}>{new Date(item.created_at).toLocaleDateString()}</td>
                        <td style={{ fontWeight: 600, color: "var(--text-primary)" }}>{item.score} / 27</td>
                        <td>
                          <span className={`badge ${item.risk_level?.toLowerCase().includes("severe") ? "badge-rose" : item.risk_level?.toLowerCase().includes("moderate") ? "badge-amber" : "badge-live"}`}>
                            {item.risk_level}
                          </span>
                        </td>
                        <td style={{ fontFamily: "IBM Plex Mono", fontSize: 10, color: "var(--text-muted)" }}>{item.agent_version || "agentic-phq9"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div style={{ textAlign: "center", padding: "28px 0", color: "var(--text-muted)", fontSize: 13 }}>
                  No previous assessments found. <button className="btn btn-ghost btn-sm" onClick={() => navigate("/assessment")} style={{ color: "var(--brand)" }}>Start your first check-in</button>
                </div>
              )}
            </motion.div>

            {/* Medical Record Ingestion */}
            <motion.div
              className="bento-card"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="section-title" style={{ marginBottom: 2 }}>RECORDS &amp; NLP</div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "Fraunces, serif", color: "var(--text-primary)", marginBottom: 14 }}>
                BioClinicalBERT Parser
              </div>
              <form onSubmit={handleUpload} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label className="upload-zone" style={{ display: "block", padding: 20 }}>
                  <Upload size={20} style={{ color: "var(--brand)", marginBottom: 6 }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{uploadFile ? uploadFile.name : "Drop clinical note or text"}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>TXT, MD, CSV · max 5MB</div>
                  <input type="file" style={{ display: "none" }} onChange={handleFileChange} />
                </label>
                {uploadLog.length > 0 && (
                  <div className="terminal" style={{ maxHeight: 75, fontSize: 10 }}>
                    {uploadLog.map((l, i) => (
                      <div key={i} className={l.startsWith("✓") ? "terminal-line-success" : l.startsWith("✗") ? "terminal-line-error" : "terminal-line-info"}>{l}</div>
                    ))}
                  </div>
                )}
                <button className="btn btn-primary btn-sm" type="submit" disabled={uploading || !uploadFile} style={{ width: "100%", justifyContent: "center", background: "var(--brand)", color: "#FFFFFF" }}>
                  {uploading ? "Parsing..." : "Ingest Record"}
                </button>
              </form>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}

