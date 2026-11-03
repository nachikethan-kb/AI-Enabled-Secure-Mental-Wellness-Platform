import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, AlertTriangle, Calendar, ChevronRight, Clock,
  ClipboardList, FileText, Heart, Search, Stethoscope,
  TrendingUp, User, Users, Video, Zap, PhoneIncoming, PhoneOff, PhoneCall
} from "lucide-react";
import { api } from "../lib/api";

// Mock data for features not yet backed by API
const MOCK_APPOINTMENTS = [
  { id: 1, patient: "Sarah Johnson", time: "10:00 AM", type: "Follow-up", status: "scheduled" },
  { id: 2, patient: "Michael Chen", time: "11:30 AM", type: "Initial Consultation", status: "in-progress" },
  { id: 3, patient: "Emily Davis", time: "2:00 PM", type: "PHQ-9 Review", status: "scheduled" },
  { id: 4, patient: "James Wilson", time: "3:30 PM", type: "Sensor Review", status: "scheduled" },
];

const MOCK_RECENT_NOTES = [
  { id: 1, patient: "Sarah Johnson", snippet: "Patient shows improvement in sleep patterns. Continue current treatment plan...", date: "2026-06-22" },
  { id: 2, patient: "Michael Chen", snippet: "Elevated stress index noted. Recommend mindfulness intervention...", date: "2026-06-21" },
  { id: 3, patient: "Emily Davis", snippet: "PHQ-9 score decreased from 14 to 9. Positive trajectory...", date: "2026-06-20" },
];

function getRiskColor(risk) {
  if (!risk) return 'var(--text-muted)';
  const r = risk.toLowerCase();
  if (r.includes('severe') || r.includes('high')) return 'var(--rose)';
  if (r.includes('moderate') || r.includes('medium')) return 'var(--amber)';
  return 'var(--emerald)';
}

function getRiskBadge(risk) {
  if (!risk) return 'badge-muted';
  const r = risk.toLowerCase();
  if (r.includes('severe') || r.includes('high')) return 'badge-rose';
  if (r.includes('moderate') || r.includes('medium')) return 'badge-amber';
  return 'badge-live';
}

export default function ConsultantDashboard() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [incomingCalls, setIncomingCalls] = useState([]);
  const [respondingCallId, setRespondingCallId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [credentialFile, setCredentialFile] = useState(null);
  const [credentialBusy, setCredentialBusy] = useState(false);
  const [credentialMessage, setCredentialMessage] = useState("");
  const [credentialError, setCredentialError] = useState("");
  const userName = localStorage.getItem("full_name") || "Doctor";

  useEffect(() => {
    const load = async () => {
      // Load profile and patient list independently. A consultant whose credential is still pending
      // gets 403 on the patient list; that must NOT hide their profile / credential panel.
      const [patientsResult, meResult] = await Promise.allSettled([api.getPatients(), api.me()]);
      if (patientsResult.status === "fulfilled") {
        setPatients(patientsResult.value.patients || []);
      } else {
        console.error("Failed to load patients:", patientsResult.reason);
      }
      if (meResult.status === "fulfilled") {
        setProfile(meResult.value);
        if (meResult.value?.verification_status) {
          localStorage.setItem("verification_status", meResult.value.verification_status);
        }
      } else {
        console.error("Failed to load consultant profile:", meResult.reason);
      }
      setLoading(false);
    };
    load();
  }, []);

  // While waiting for admin approval, re-check the profile so the doctor sees the approval (and their
  // assigned patient) without having to reload the page.
  useEffect(() => {
    if (!profile || profile.role !== "consultant" || profile.verification_status === "approved") return undefined;
    const id = setInterval(async () => {
      try {
        const me = await api.me();
        setProfile(me);
        if (me.verification_status === "approved") {
          localStorage.setItem("verification_status", "approved");
          const data = await api.getPatients();
          setPatients(data.patients || []);
        }
      } catch (e) {
        /* keep waiting */
      }
    }, 10000);
    return () => clearInterval(id);
  }, [profile?.verification_status, profile?.role]);

  const handleCredentialUpload = async (event) => {
    event.preventDefault();
    setCredentialMessage("");
    setCredentialError("");
    if (!credentialFile) {
      setCredentialError("Choose your professional credential PDF first.");
      return;
    }
    if (credentialFile.type !== "application/pdf" && !credentialFile.name.toLowerCase().endsWith(".pdf")) {
      setCredentialError("Only PDF files are accepted.");
      return;
    }
    const formData = new FormData();
    formData.append("credential", credentialFile);
    setCredentialBusy(true);
    try {
      const updatedProfile = await api.uploadCredential(formData);
      setProfile(updatedProfile);
      setCredentialFile(null);
      event.target.reset();
      setCredentialMessage("Credential submitted successfully. Your account is pending admin verification.");
    } catch (e) {
      setCredentialError(e.message || "Credential upload failed. Please try again.");
    } finally {
      setCredentialBusy(false);
    }
  };

  // Poll for patients requesting a video consultation
  useEffect(() => {
    const pollCalls = async () => {
      try {
        const data = await api.getPendingCalls();
        setIncomingCalls(data.items || []);
      } catch (e) {
        console.error("Failed to load pending calls:", e);
      }
    };
    pollCalls();
    const id = setInterval(pollCalls, 4000);
    return () => clearInterval(id);
  }, []);

  const handleAcceptCall = async (call) => {
    try {
      setRespondingCallId(call.id);
      await api.acceptCall(call.id);
      navigate(`/call/${call.room_id}`);
    } catch (e) {
      console.error("Failed to accept call:", e);
      setRespondingCallId(null);
    }
  };

  const handleRejectCall = async (call) => {
    try {
      setRespondingCallId(call.id);
      await api.rejectCall(call.id);
      setIncomingCalls((prev) => prev.filter((c) => c.id !== call.id));
    } catch (e) {
      console.error("Failed to reject call:", e);
    } finally {
      setRespondingCallId(null);
    }
  };

  const filteredPatients = patients.filter(p =>
    (p.patient_code || p.full_name || "").toLowerCase().includes(searchTerm.toLowerCase())
  );

  const highRiskCount = patients.filter(p => {
    const r = p.last_assessment?.risk_level?.toLowerCase() || '';
    return r.includes('severe') || r.includes('high');
  }).length;

  const mediumRiskCount = patients.filter(p => {
    const r = p.last_assessment?.risk_level?.toLowerCase() || '';
    return r.includes('moderate') || r.includes('medium');
  }).length;

  const lowRiskCount = patients.filter(p => {
    const r = p.last_assessment?.risk_level?.toLowerCase() || '';
    return r.includes('minimal') || r.includes('low') || r.includes('none');
  }).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title">Consultant Dashboard</div>
          <div className="page-subtitle">Welcome back, Dr. {userName} — manage your patients and consultations</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/patient-queue')}>
            <Users style={{ width: 13, height: 13 }} /> Patient Queue
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/patient-sensor-view')}>
            <Activity style={{ width: 13, height: 13 }} /> Sensor Analysis
          </button>
        </div>
      </div>

      {/* Professional credential verification for existing and newly created consultant accounts */}
      {profile && profile.role === "consultant" && profile.verification_status !== "approved" && (
        <div className="card card-accent-emerald" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Professional Credential Verification</div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {profile.has_credential
              ? `Credential uploaded. Current status: ${profile.verification_status || "pending"}. You can upload a replacement PDF if needed.`
              : "Your consultant account is created, but a professional credential PDF is required before an admin can approve it. Upload it here without creating another account."}
          </div>
          <form onSubmit={handleCredentialUpload} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setCredentialFile(e.target.files?.[0] || null)}
              aria-label="Professional credential PDF"
              style={{ maxWidth: 360, fontSize: 12 }}
            />
            <button className="btn btn-primary btn-sm" type="submit" disabled={!credentialFile || credentialBusy}>
              {credentialBusy ? "Uploading…" : "Upload credential PDF"}
            </button>
          </form>
          {credentialMessage && <div role="status" style={{ fontSize: 12, color: "var(--emerald)" }}>{credentialMessage}</div>}
          {credentialError && <div role="alert" style={{ fontSize: 12, color: "var(--rose)" }}>{credentialError}</div>}
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>PDF only; maximum size is 5 MB. Uploading submits the account for admin review.</div>
        </div>
      )}

      {profile && profile.role === "consultant" && profile.verification_status === "approved" && !profile.has_credential && (
        <div className="card" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          Your consultant account is approved. Please contact the administrator if a credential document needs to be added to your record.
        </div>
      )}

      {/* Incoming Patient Video Calls */}
      {incomingCalls.length > 0 && (
        <div className="card card-accent-rose" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="section-title" style={{ marginBottom: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
            <PhoneIncoming style={{ width: 14, height: 14, color: 'var(--rose)' }} /> Incoming Video Calls
          </span>
          {incomingCalls.map((call) => (
            <div
              key={call.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 12px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--bg-border)', background: 'rgba(244,63,94,0.05)'
              }}
            >
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'var(--rose-dim)', color: 'var(--rose)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <User style={{ width: 16, height: 16 }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>{call.patient_name || 'Patient'}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>wants to start a video consultation</div>
              </div>
              <button
                className="btn"
                style={{ fontSize: 11 }}
                onClick={() => handleRejectCall(call)}
                disabled={respondingCallId === call.id}
              >
                <PhoneOff style={{ width: 12, height: 12 }} /> Decline
              </button>
              <button
                className="btn btn-primary"
                style={{ fontSize: 11 }}
                onClick={() => handleAcceptCall(call)}
                disabled={respondingCallId === call.id}
              >
                <PhoneCall style={{ width: 12, height: 12 }} /> Join Call
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Stats Row */}
      <div className="grid-4" style={{ gap: 12 }}>
        <div className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">Total Patients</span>
            <div style={{ padding: 6, borderRadius: 6, background: 'var(--cyan-dim)' }}>
              <Users style={{ width: 14, height: 14, color: 'var(--cyan)' }} />
            </div>
          </div>
          <span className="stat-value">{patients.length}</span>
        </div>

        <div className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">High Risk</span>
            <div style={{ padding: 6, borderRadius: 6, background: 'var(--rose-dim)' }}>
              <AlertTriangle style={{ width: 14, height: 14, color: 'var(--rose)' }} />
            </div>
          </div>
          <span className="stat-value" style={{ color: highRiskCount > 0 ? 'var(--rose)' : 'var(--text-primary)' }}>{highRiskCount}</span>
        </div>

        <div className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">Moderate Risk</span>
            <div style={{ padding: 6, borderRadius: 6, background: 'var(--amber-dim)' }}>
              <TrendingUp style={{ width: 14, height: 14, color: 'var(--amber)' }} />
            </div>
          </div>
          <span className="stat-value" style={{ color: 'var(--amber)' }}>{mediumRiskCount}</span>
        </div>

        <div className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span className="stat-label">Low Risk</span>
            <div style={{ padding: 6, borderRadius: 6, background: 'var(--emerald-dim)' }}>
              <Heart style={{ width: 14, height: 14, color: 'var(--emerald)' }} />
            </div>
          </div>
          <span className="stat-value" style={{ color: 'var(--emerald)' }}>{lowRiskCount}</span>
        </div>
      </div>

      {/* Main Content: Patient Queue + Appointments */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
        {/* Patient Queue */}
        <div className="card card-accent-emerald" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Patient Overview</div>
            <button className="btn btn-ghost btn-xs" onClick={() => navigate('/patient-queue')}>
              View All <ChevronRight style={{ width: 11, height: 11 }} />
            </button>
          </div>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
            <input
              className="input-field"
              style={{ paddingLeft: 38 }}
              placeholder="Search patients by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: 52, borderRadius: 10 }} />)}
            </div>
          ) : filteredPatients.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
              {filteredPatients.slice(0, 8).map(patient => (
                <div
                  key={patient.id}
                  className="agent-card"
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/patient-sensor-view?patient=${patient.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: `linear-gradient(135deg, ${getRiskColor(patient.last_assessment?.risk_level)}, var(--blue))`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0
                    }}>
                      {(patient.patient_code || patient.full_name)?.charAt(0)?.toUpperCase() || 'P'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {patient.patient_code || patient.full_name}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                        {patient.sensor_records} sensor records
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {patient.last_assessment ? (
                      <span className={`badge ${getRiskBadge(patient.last_assessment.risk_level)}`}>
                        {patient.last_assessment.risk_level}
                      </span>
                    ) : (
                      <span className="badge badge-muted">No assessment</span>
                    )}
                    <ChevronRight style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {searchTerm ? 'No patients match your search.' : 'No patients registered yet.'}
            </div>
          )}
        </div>

        {/* Appointments & Quick Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Today's Appointments */}
          <div className="card card-accent-blue" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="section-title" style={{ marginBottom: 0 }}>Today's Schedule</div>
              <button className="btn btn-ghost btn-xs" onClick={() => navigate('/appointments')}>
                Calendar <ChevronRight style={{ width: 11, height: 11 }} />
              </button>
            </div>
            {MOCK_APPOINTMENTS.map(apt => (
              <div key={apt.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                background: apt.status === 'in-progress' ? 'rgba(16,185,129,0.06)' : 'rgba(21,23,22,0.02)',
                border: `1px solid ${apt.status === 'in-progress' ? 'rgba(16,185,129,0.15)' : 'var(--bg-border)'}`,
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: apt.status === 'in-progress' ? 'var(--emerald)' : 'var(--text-muted)',
                  boxShadow: apt.status === 'in-progress' ? '0 0 6px var(--emerald)' : 'none',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{apt.patient}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{apt.type}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text-secondary)' }}>
                  <Clock style={{ width: 10, height: 10 }} />
                  {apt.time}
                </div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Quick Actions</div>
            {[
              { label: 'View Patient Sensors', icon: Activity, path: '/patient-sensor-view', color: 'var(--cyan)' },
              { label: 'Consultation Notes', icon: FileText, path: '/consultation-notes', color: 'var(--emerald)' },
              { label: 'Patient Queue', icon: ClipboardList, path: '/patient-queue', color: 'var(--blue)' },
              { label: 'Appointments', icon: Calendar, path: '/appointments', color: 'var(--violet)' },
            ].map(action => (
              <button
                key={action.label}
                className="agent-card"
                style={{ cursor: 'pointer', background: 'none', width: '100%', textAlign: 'left' }}
                onClick={() => navigate(action.path)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ padding: 5, borderRadius: 6, background: `${action.color}15` }}>
                    <action.icon style={{ width: 13, height: 13, color: action.color }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{action.label}</span>
                </div>
                <ChevronRight style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Clinical Notes */}
      <div className="card card-accent-violet" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="section-title" style={{ marginBottom: 0 }}>Recent Clinical Notes</div>
          <button className="btn btn-ghost btn-xs" onClick={() => navigate('/consultation-notes')}>
            View All <ChevronRight style={{ width: 11, height: 11 }} />
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {MOCK_RECENT_NOTES.map(note => (
            <div key={note.id} className="card card-xs" style={{ background: 'var(--bg-elevated)', cursor: 'pointer' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{note.patient}</span>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{note.date}</span>
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {note.snippet}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
