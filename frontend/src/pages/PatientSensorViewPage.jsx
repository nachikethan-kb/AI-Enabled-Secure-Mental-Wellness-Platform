import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowLeft, Brain, ChevronDown, Dumbbell,
  Flame, Footprints, MapPin, Search, User
} from "lucide-react";
import { api } from "../lib/api";

const POLL_MS = 5000; // refresh the assigned patient's sensor data while the page is open

// Doctors only receive the anonymised Patient ID (never a name); admins receive both.
const patientLabel = (p) => p?.full_name || p?.patient_code || (p?.id != null ? `Patient #${p.id}` : "Patient");

const num = (v) => (v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
const fmt = (v, digits = 0) => (num(v) === null ? "—" : Number(v).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits }));
const average = (records, pick) => {
  const vals = records.map(pick).map(num).filter((v) => v !== null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
};
const bmiOf = (r) => {
  const h = num(r?.height_cm), w = num(r?.weight_kg);
  return h && w ? w / ((h / 100) ** 2) : null;
};

function SensorGauge({ label, value, unit, min, max, color, icon: Icon, digits = 1 }) {
  const pct = Math.min(100, Math.max(0, (((value ?? 0) - min) / (max - min)) * 100));
  return (
    <div className="card card-xs" style={{ background: 'var(--bg-elevated)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono', letterSpacing: '0.06em' }}>{label}</span>
        <Icon style={{ width: 14, height: 14, color }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>{num(value) === null ? '—' : Number(value).toLocaleString(undefined, { minimumFractionDigits: digits, maximumFractionDigits: digits })}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{unit}</span>
      </div>
      <div className="meter-bar" style={{ height: 4 }}>
        <div className="meter-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export default function PatientSensorViewPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState(searchParams.get('patient') || '');
  const [sensorData, setSensorData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sensorLoading, setSensorLoading] = useState(false);
  const [sensorError, setSensorError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [timeRange, setTimeRange] = useState('7d');
  const [metricTab, setMetricTab] = useState('steps'); // 'steps', 'distance', 'exercise', 'sedentary'
  const activeIdRef = useRef('');

  // Load patient list (a doctor only receives the patient assigned to them)
  useEffect(() => {
    const loadPatients = async () => {
      try {
        const data = await api.getPatients();
        const list = data.patients || [];
        setPatients(list);
        // One-to-one mapping: open the assigned patient straight away.
        if (!searchParams.get('patient') && list.length === 1) {
          setSelectedPatientId(String(list[0].id));
        }
      } catch (e) {
        console.error("Failed to load patients:", e);
        setSensorError(e.message || "Failed to load patients.");
      } finally {
        setLoading(false);
      }
    };
    loadPatients();
  }, []);

  // Load sensor data when a patient is selected, then keep refreshing so newly synced
  // phone data shows up without a manual reload.
  useEffect(() => {
    activeIdRef.current = selectedPatientId;
    if (!selectedPatientId) {
      setSensorData(null);
      return undefined;
    }
    let cancelled = false;
    const loadSensor = async (silent) => {
      if (!silent) setSensorLoading(true);
      try {
        const data = await api.getPatientSensorData(selectedPatientId);
        if (cancelled || activeIdRef.current !== selectedPatientId) return;
        setSensorData(data);
        setSensorError("");
      } catch (e) {
        if (cancelled) return;
        console.error("Failed to load sensor data:", e);
        if (!silent) setSensorData(null);
        setSensorError(e.message || "Failed to load sensor data.");
      } finally {
        if (!cancelled && !silent) setSensorLoading(false);
      }
    };
    loadSensor(false);
    setSearchParams({ patient: selectedPatientId });
    const id = setInterval(() => loadSensor(true), POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [selectedPatientId]);

  const filteredPatients = patients.filter(p =>
    `${patientLabel(p)} ${p.patient_code || ""}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedPatient = patients.find(p => String(p.id) === String(selectedPatientId));

  // Latest reading & history (newest first)
  const latestSensor = sensorData?.sensor_records?.[0] || null;
  const sensorHistory = sensorData?.sensor_records || [];
  const live = sensorData?.live || null;

  // Averages over the loaded history (fields sent by the updated SensorApp / Health Connect)
  const avgSteps = average(sensorHistory, r => r.steps);
  const avgDistanceKm = average(sensorHistory, r => (num(r.distance_meters) === null ? null : r.distance_meters / 1000));
  const avgCalories = average(sensorHistory, r => r.total_calories ?? r.calories);
  const avgExercise = average(sensorHistory, r => r.exercise_minutes ?? r.active_minutes);

  // GPS and activity session data (legacy; only rendered when present)
  const gpsSessions = sensorData?.gps_sessions || [];
  const activitySessions = sensorData?.activity_sessions || [];

  const SOURCE_LABELS = {
    health_connect: 'Health Connect (SensorApp)', android_sensor: 'Android Sensor',
    activity_recognition: 'Activity Recognition', gps: 'GPS',
    usage_stats: 'Usage Statistics', manual: 'Manual Entry',
    google_fit: 'Historical: Google Fit', wifi: 'WiFi Sensor (Legacy)',
  };

  const getRiskColor = (level) => {
    if (!level) return 'var(--text-muted)';
    const l = level.toLowerCase();
    if (l.includes('severe') || l.includes('high')) return 'var(--rose)';
    if (l.includes('moderate') || l.includes('medium')) return 'var(--amber)';
    return 'var(--emerald)';
  };

  const syncedAgo = (() => {
    const secs = live?.last_seen_seconds_ago;
    if (secs === null || secs === undefined) return "";
    if (secs < 60) return `${Math.round(secs)}s ago`;
    return `${Math.round(secs / 60)} min ago`;
  })();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <button 
            className="btn btn-ghost btn-xs" 
            onClick={() => navigate('/dashboard')}
            style={{ marginBottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-secondary)' }}
          >
            <ArrowLeft style={{ width: 14, height: 14 }} /> Return to Dashboard
          </button>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 'clamp(1.75rem, 3vw, 2.25rem)', fontWeight: 600, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.15 }}>
            Patient Physiological Telemetry
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 }}>
            Health Connect activity and body measurements streamed live from the patient's SensorApp
          </div>
        </div>
      </div>

      {/* Patient Selector */}
      <div className="card card-accent-cyan" style={{ position: 'relative' }}>
        <div className="section-title" style={{ marginBottom: 10 }}>Select Patient</div>
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => setDropdownOpen(!dropdownOpen)}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 10,
              background: 'var(--bg-elevated)',
              border: `1.5px solid ${dropdownOpen ? 'var(--cyan)' : 'var(--bg-border)'}`,
              cursor: 'pointer', transition: 'all 0.2s ease',
              boxShadow: dropdownOpen ? '0 0 12px var(--cyan-dim)' : 'none',
            }}
          >
            {selectedPatient ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'linear-gradient(135deg, var(--cyan), var(--blue))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, color: '#fff',
                }}>
                  {patientLabel(selectedPatient).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {patientLabel(selectedPatient)}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                    {selectedPatient.email ? `${selectedPatient.email} · ` : ''}{selectedPatient.sensor_records} records
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <User style={{ width: 14, height: 14, color: 'var(--text-muted)' }} />
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Click to select a patient...</span>
              </div>
            )}
            <ChevronDown style={{
              width: 16, height: 16, color: 'var(--text-muted)',
              transition: 'transform 0.2s ease',
              transform: dropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            }} />
          </div>

          {/* Dropdown */}
          {dropdownOpen && (
            <div style={{
              position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
              background: 'var(--bg-surface)', border: '1px solid var(--bg-border)',
              borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
              zIndex: 100, overflow: 'hidden',
              maxHeight: 320,
            }}>
              {/* Search */}
              <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--bg-border)' }}>
                <div style={{ position: 'relative' }}>
                  <Search style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', width: 13, height: 13, color: 'var(--text-muted)' }} />
                  <input
                    className="input-field"
                    style={{ paddingLeft: 32, fontSize: 12, padding: '7px 10px 7px 32px' }}
                    placeholder="Search by Patient ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>

              {/* Patient List */}
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>Loading patients...</div>
                ) : filteredPatients.length > 0 ? (
                  filteredPatients.map(patient => (
                    <button
                      key={patient.id}
                      onClick={() => {
                        setSelectedPatientId(String(patient.id));
                        setDropdownOpen(false);
                        setSearchTerm("");
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        width: '100%', padding: '10px 14px',
                        background: String(patient.id) === String(selectedPatientId) ? 'var(--cyan-dim)' : 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left',
                        borderBottom: '1px solid var(--bg-border)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => { if (String(patient.id) !== String(selectedPatientId)) e.target.style.background = 'var(--bg-elevated)'; }}
                      onMouseLeave={(e) => { if (String(patient.id) !== String(selectedPatientId)) e.target.style.background = 'transparent'; }}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--emerald), var(--blue))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                      }}>
                        {patientLabel(patient).charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{patientLabel(patient)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                          {patient.sensor_records} sensor records · {patient.last_assessment?.risk_level || 'No assessment'}
                        </div>
                      </div>
                      {String(patient.id) === String(selectedPatientId) && (
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--cyan)', flexShrink: 0 }} />
                      )}
                    </button>
                  ))
                ) : (
                  <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                    {searchTerm ? 'No patients found matching your search.' : 'No patient has been assigned to you yet. Ask the administrator to assign one.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {sensorError && !selectedPatientId && (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
          <span>{sensorError}</span>
        </div>
      )}

      {/* Sensor Data Display */}
      {sensorLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[160, 100, 80].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 14 }} />)}
        </div>
      ) : sensorData ? (
        <>
          {/* Patient Info Banner */}
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--cyan), var(--violet))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, fontWeight: 700, color: '#fff',
              }}>
                {patientLabel(sensorData.patient).charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  {patientLabel(sensorData.patient)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {sensorData.patient?.email || (sensorData.patient?.patient_code ? `Patient ID ${sensorData.patient.patient_code}` : '')}
                </div>
                <div style={{ marginTop: 6 }}>
                  {live?.connected ? (
                    <span className="badge badge-live"><span className="status-dot live" /> Phone connected{syncedAgo ? ` · synced ${syncedAgo}` : ''}</span>
                  ) : (
                    <span className="badge badge-muted"><span className="status-dot idle" /> Phone not connected</span>
                  )}
                </div>
                {sensorData.patient?.device_id && (
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginTop: 2 }}>
                    Device: {sensorData.patient.device_id.slice(0, 20)}…
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {sensorData.last_assessment && (
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>Last Assessment</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>
                      {sensorData.last_assessment.score}/27
                    </span>
                    <span className={`badge ${
                      sensorData.last_assessment.risk_level?.toLowerCase().includes('severe') ? 'badge-rose' :
                      sensorData.last_assessment.risk_level?.toLowerCase().includes('moderate') ? 'badge-amber' : 'badge-live'
                    }`}>
                      {sensorData.last_assessment.risk_level}
                    </span>
                  </div>
                </div>
              )}
              <div style={{ width: 1, height: 36, background: 'var(--bg-border)' }} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>Sensor Records</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--cyan)', fontFamily: 'IBM Plex Sans', marginTop: 2 }}>
                  {sensorHistory.length}
                </div>
              </div>
            </div>
          </div>

          {/* AI Disclaimer */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)' }}>
            <AlertTriangle style={{ width: 13, height: 13, color: '#FBBF24', flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              <strong style={{ color: '#FBBF24' }}>Prototype / Experimental</strong> — Sensor metrics are not clinically validated. Use as supplementary context only.
            </span>
          </div>

          {/* Sensor Timeline Analysis with 7d / 30d / Custom Time Filters */}
          <div className="card" style={{ padding: '24px 28px', background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Physiological Longitudinal Timeline
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                  Activity progression across the most recent sensor syncs
                </div>
              </div>

              {/* Time Range Filter Pills */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-elevated)', padding: '4px 6px', borderRadius: 9999, border: '1px solid var(--bg-border)' }}>
                {[
                  { id: '7d', label: '7 days' },
                  { id: '30d', label: '30 days' },
                  { id: 'custom', label: 'Custom' },
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setTimeRange(tab.id)}
                    style={{
                      padding: '5px 14px',
                      borderRadius: 9999,
                      fontSize: 11,
                      fontWeight: 600,
                      fontFamily: 'IBM Plex Mono, monospace',
                      border: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      background: timeRange === tab.id ? 'var(--brand)' : 'transparent',
                      color: timeRange === tab.id ? '#ffffff' : 'var(--text-secondary)',
                      boxShadow: timeRange === tab.id ? '0 2px 8px rgba(29, 107, 95, 0.25)' : 'none',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Metric Switcher */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, borderBottom: '1px solid var(--bg-border)', paddingBottom: 12 }}>
              {[
                { id: 'steps', label: 'Step Activity', unit: 'steps' },
                { id: 'distance', label: 'Distance', unit: 'km' },
                { id: 'exercise', label: 'Exercise', unit: 'min' },
                { id: 'sedentary', label: 'Sedentary Index', unit: '%' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setMetricTab(tab.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: metricTab === tab.id ? '2px solid var(--brand)' : '2px solid transparent',
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: metricTab === tab.id ? 600 : 500,
                    color: metricTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span>{tab.label}</span>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>({tab.unit})</span>
                </button>
              ))}
            </div>

            {/* Large Visual Graph with Generous Whitespace */}
            {sensorHistory.length > 0 ? (() => {
              const count = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : sensorHistory.length;
              const records = sensorHistory.slice(0, count).slice().reverse();
              
              // Extract series based on metricTab
              let values = [];
              let labelUnit = '';
              let strokeColor = 'var(--teal)';
              
              if (metricTab === 'steps') {
                values = records.map(r => num(r.steps) ?? 0);
                labelUnit = 'steps';
                strokeColor = 'var(--brand)';
              } else if (metricTab === 'distance') {
                values = records.map(r => (num(r.distance_meters) ?? 0) / 1000);
                labelUnit = 'km';
                strokeColor = '#06B6D4';
              } else if (metricTab === 'exercise') {
                values = records.map(r => num(r.exercise_minutes ?? r.active_minutes) ?? 0);
                labelUnit = 'min';
                strokeColor = '#F59E0B';
              } else {
                values = records.map(r => (num(r.stress_index) ?? 0) * 100);
                labelUnit = '%';
                strokeColor = '#A78BFA';
              }

              const maxVal = Math.max(...values, metricTab === 'distance' ? 1 : 10);
              const minVal = Math.min(...values, 0);
              const range = maxVal - minVal || 1;
              const width = 800;
              const height = 220;
              const padding = 40;

              const points = values.map((val, idx) => {
                const x = padding + (idx / Math.max(1, values.length - 1)) * (width - 2 * padding);
                const y = height - padding - ((val - minVal) / range) * (height - 2 * padding);
                return { x, y, val };
              });

              const pathString = points.length > 0
                ? `M ${points.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' L ')}`
                : '';
              
              const areaString = points.length > 0
                ? `${pathString} L ${points[points.length - 1].x},${height - padding} L ${points[0].x},${height - padding} Z`
                : '';

              return (
                <div style={{ width: '100%', overflowX: 'auto', padding: '10px 0' }}>
                  <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 240, overflow: 'visible' }}>
                    <defs>
                      <linearGradient id="sensorTimelineGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={strokeColor} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Horizontal gridlines */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                      const yPos = height - padding - ratio * (height - 2 * padding);
                      const rawGrid = minVal + ratio * range;
                      const gridVal = rawGrid >= 10 ? Math.round(rawGrid) : Number(rawGrid.toFixed(1));
                      return (
                        <g key={i}>
                          <line
                            x1={padding}
                            y1={yPos}
                            x2={width - padding}
                            y2={yPos}
                            stroke="var(--bg-border)"
                            strokeDasharray="4 4"
                            strokeWidth="1"
                          />
                          <text
                            x={padding - 8}
                            y={yPos + 3}
                            fill="var(--text-muted)"
                            fontSize="9"
                            fontFamily="IBM Plex Mono"
                            textAnchor="end"
                          >
                            {gridVal}
                          </text>
                        </g>
                      );
                    })}

                    {/* Gradient Area Fill */}
                    {areaString && (
                      <path d={areaString} fill="url(#sensorTimelineGrad)" />
                    )}

                    {/* Main Line */}
                    {pathString && (
                      <path
                        d={pathString}
                        fill="none"
                        stroke={strokeColor}
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Data Points */}
                    {points.map((p, i) => (
                      <g key={i}>
                        <circle
                          cx={p.x}
                          cy={p.y}
                          r="4"
                          fill="var(--bg-surface)"
                          stroke={strokeColor}
                          strokeWidth="2"
                        />
                        {/* Date label at bottom */}
                        <text
                          x={p.x}
                          y={height - padding + 18}
                          fill="var(--text-muted)"
                          fontSize="9"
                          fontFamily="IBM Plex Mono"
                          textAnchor="middle"
                        >
                          {i % Math.ceil(points.length / 6) === 0 || i === points.length - 1
                            ? (records[i]?.created_at
                                ? new Date(records[i].created_at).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                : `R${i + 1}`)
                            : ''}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              );
            })() : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                No historical records available for the selected range.
              </div>
            )}
          </div>

          {/* Latest Reading Gauges & Telemetry Cards */}
          {latestSensor ? (
            <>
              <div>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>
                  Latest Reading
                </div>
                <div className="grid-4" style={{ gap: 14 }}>
                  <SensorGauge label="Steps Today" value={latestSensor.steps} unit="steps" min={0} max={10000} digits={0} color="var(--emerald)" icon={Footprints} />
                  <SensorGauge label="Distance" value={num(latestSensor.distance_meters) === null ? null : latestSensor.distance_meters / 1000} unit="km" min={0} max={8} digits={2} color="var(--cyan)" icon={MapPin} />
                  <SensorGauge label="Exercise" value={latestSensor.exercise_minutes ?? latestSensor.active_minutes} unit="min" min={0} max={60} digits={0} color="var(--blue)" icon={Dumbbell} />
                  <SensorGauge
                    label="Sedentary Index"
                    value={latestSensor.stress_index}
                    unit="" min={0} max={1} digits={2}
                    color={latestSensor.stress_index >= 0.7 ? 'var(--rose)' : latestSensor.stress_index >= 0.4 ? 'var(--amber)' : 'var(--emerald)'}
                    icon={Brain}
                  />
                </div>
              </div>

              {/* Health Connect metrics sent by the SensorApp */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16, background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Device Telemetry Summary</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {latestSensor?.created_at && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                        Last sync {new Date(latestSensor.created_at).toLocaleString()}
                      </span>
                    )}
                    {latestSensor?.data_source && (
                      <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', padding: '3px 8px', borderRadius: 4, background: 'var(--bg-elevated)' }}>
                        Source: {SOURCE_LABELS[latestSensor.data_source] || latestSensor.data_source}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
                  {[
                    { label: 'Steps', value: fmt(latestSensor.steps), unit: '', color: 'var(--teal)' },
                    { label: 'Distance', value: num(latestSensor.distance_meters) === null ? '—' : fmt(latestSensor.distance_meters / 1000, 2), unit: 'km', color: 'var(--cyan)' },
                    { label: 'Avg Speed', value: fmt(latestSensor.speed_avg_mps, 2), unit: 'm/s', color: '#06B6D4' },
                    { label: 'Total Calories', value: fmt(latestSensor.total_calories ?? latestSensor.calories, 1), unit: 'kcal', color: 'var(--amber)' },
                    { label: 'Exercise Sessions', value: fmt(latestSensor.exercise_sessions_count), unit: '', color: 'var(--emerald)' },
                    { label: 'Exercise Time', value: fmt(latestSensor.exercise_minutes ?? latestSensor.active_minutes), unit: 'min', color: 'var(--blue)' },
                    { label: 'BMR', value: fmt(latestSensor.bmr_kcal), unit: 'kcal/day', color: '#F87171' },
                    { label: 'Height', value: fmt(latestSensor.height_cm, 1), unit: 'cm', color: 'var(--lav)' },
                    { label: 'Weight', value: fmt(latestSensor.weight_kg, 1), unit: 'kg', color: '#A78BFA' },
                    { label: 'BMI', value: bmiOf(latestSensor) === null ? '—' : fmt(bmiOf(latestSensor), 1), unit: '', color: 'var(--rose)' },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: 'center', padding: '12px 8px', borderRadius: 8, background: 'var(--bg-elevated)' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono', letterSpacing: '0.06em', marginBottom: 6 }}>
                        {item.label}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3 }}>
                        <span style={{ fontSize: 22, fontWeight: 700, color: item.value !== '—' ? item.color : 'var(--text-muted)', fontFamily: 'IBM Plex Sans' }}>
                          {item.value}
                        </span>
                        {item.unit && item.value !== '—' && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.unit}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {latestSensor.activity_level && (
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    Activity level: <strong style={{ color: 'var(--text-primary)' }}>{latestSensor.activity_level}</strong>
                  </div>
                )}
              </div>

              {/* Historical Averages */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14, background: 'var(--bg-surface)', border: '1px solid var(--bg-border)' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Historical Aggregates ({sensorHistory.length} readings)</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 16 }}>
                  {[
                    { label: 'Avg Steps', value: avgSteps === null ? null : Math.round(avgSteps).toLocaleString(), unit: '', color: 'var(--teal)' },
                    { label: 'Avg Distance', value: avgDistanceKm === null ? null : avgDistanceKm.toFixed(2), unit: 'km', color: 'var(--cyan)' },
                    { label: 'Avg Calories', value: avgCalories === null ? null : Math.round(avgCalories).toLocaleString(), unit: 'kcal', color: 'var(--amber)' },
                    { label: 'Avg Exercise', value: avgExercise === null ? null : Math.round(avgExercise), unit: 'min', color: 'var(--blue)' },
                  ].map(item => (
                    <div key={item.label} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono', letterSpacing: '0.06em', marginBottom: 4 }}>
                        {item.label}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 3 }}>
                        <span style={{ fontSize: 22, fontWeight: 700, color: item.value != null ? item.color : 'var(--text-muted)', fontFamily: 'IBM Plex Sans' }}>
                          {item.value ?? '—'}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px', background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
              <Activity style={{ width: 32, height: 32, color: 'var(--text-muted)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>No Sensor Data Yet</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                {live?.connected
                  ? 'The patient\'s phone is connected — the first readings will appear here in a few seconds.'
                  : 'As soon as the patient pairs the SensorApp from their Sensor Monitor page, their readings will appear here automatically.'}
              </div>
            </div>
          )}

          {/* GPS Sessions */}
          {gpsSessions.length > 0 && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>GPS Sessions</div>
              {gpsSessions.map(g => (
                <div key={g.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{g.distance_km} km</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{g.duration_minutes} min · {g.average_speed_kmh ?? '—'} km/h avg</div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                    {new Date(g.start_time).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Activity Sessions */}
          {activitySessions.length > 0 && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--bg-surface)', border: '1px solid var(--bg-border)', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Activity Sessions</div>
              {activitySessions.slice(0, 8).map(a => (
                <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 16 }}>{{ walking: '🚶', running: '🏃', cycling: '🚴', vehicle: '🚗', still: '🧘', unknown: '❓' }[a.activity_type] || '❓'}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{a.activity_type}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.duration_minutes} min · {a.confidence}% confidence</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                    {new Date(a.start_time).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Sensor History Table */}
          {sensorHistory.length > 0 && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Sensor Data History</div>
              <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Source</th>
                      <th>Steps</th>
                      <th>Distance</th>
                      <th>Avg Speed</th>
                      <th>Calories</th>
                      <th>Exercise</th>
                      <th>Sedentary</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sensorHistory.map((record, i) => (
                      <tr key={record.id || i}>
                        <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11 }}>
                          {record.created_at ? new Date(record.created_at).toLocaleString() : '—'}
                        </td>
                        <td>
                          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 3, background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                            {SOURCE_LABELS[record.data_source] || record.data_source || '—'}
                          </span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmt(record.steps)}</td>
                        <td>{num(record.distance_meters) === null ? '—' : `${fmt(record.distance_meters / 1000, 2)} km`}</td>
                        <td>{num(record.speed_avg_mps) === null ? '—' : `${fmt(record.speed_avg_mps, 2)} m/s`}</td>
                        <td>{num(record.total_calories ?? record.calories) === null ? '—' : `${fmt(record.total_calories ?? record.calories, 0)} kcal`}</td>
                        <td>
                          {num(record.exercise_minutes ?? record.active_minutes) === null ? '—' : `${fmt(record.exercise_minutes ?? record.active_minutes)} min`}
                          {num(record.exercise_sessions_count) !== null ? ` · ${record.exercise_sessions_count} sess.` : ''}
                        </td>
                        <td>
                          {record.stress_index != null ? (
                            <span className={`badge ${
                              record.stress_index >= 0.7 ? 'badge-rose' :
                              record.stress_index >= 0.4 ? 'badge-amber' : 'badge-live'
                            }`}>
                              {(record.stress_index * 100).toFixed(0)}%
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : !selectedPatientId ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px' }}>
          <div style={{
            width: 56, height: 56, borderRadius: '50%',
            background: 'var(--cyan-dim)', border: '1px solid rgba(6,182,212,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <User style={{ width: 24, height: 24, color: 'var(--cyan)' }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>
            Select a Patient
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', maxWidth: 400, margin: '0 auto', lineHeight: 1.6 }}>
            Use the patient selector above to choose a patient by name. Once selected, their full physiological sensor telemetry will be displayed here.
          </div>
        </div>
      ) : (
        <div className="alert alert-error" style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0, marginTop: 1 }} />
          <span>{sensorError || 'Unable to load this patient\'s sensor data.'}</span>
        </div>
      )}
    </div>
  );
}
