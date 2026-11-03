import { useState } from "react";
import { Clock, Filter, Search, Shield, User } from "lucide-react";

const MOCK_LOGS = [
  { id: 1, user: "Sarah Johnson", role: "patient", action: "Completed PHQ-9 assessment", detail: "Score: 9, Risk: Mild", timestamp: "2026-06-22T10:15:00", type: "assessment" },
  { id: 2, user: "Dr. Michael Chen", role: "consultant", action: "Reviewed patient sensor data", detail: "Patient: Emily Davis", timestamp: "2026-06-22T10:02:00", type: "review" },
  { id: 3, user: "Emily Davis", role: "patient", action: "Registered account", detail: "Role: patient", timestamp: "2026-06-22T09:45:00", type: "auth" },
  { id: 4, user: "James Wilson", role: "patient", action: "Uploaded health record", detail: "File: blood_test_report.pdf", timestamp: "2026-06-22T09:30:00", type: "upload" },
  { id: 5, user: "Dr. Lisa Park", role: "consultant", action: "Updated consultation notes", detail: "Patient: Sarah Johnson", timestamp: "2026-06-22T09:15:00", type: "notes" },
  { id: 6, user: "Admin User", role: "admin", action: "Changed user role", detail: "Michael Chen: patient → consultant", timestamp: "2026-06-22T08:50:00", type: "admin" },
  { id: 7, user: "Anna Rodriguez", role: "patient", action: "Started AI chat session", detail: "Duration: 12 minutes", timestamp: "2026-06-22T08:30:00", type: "chat" },
  { id: 8, user: "Robert Kim", role: "patient", action: "Connected wearable device", detail: "Device: Fitbit Charge 5", timestamp: "2026-06-22T08:15:00", type: "device" },
  { id: 9, user: "Dr. Michael Chen", role: "consultant", action: "Created appointment", detail: "With: Sarah Johnson, 10:00 AM", timestamp: "2026-06-22T07:45:00", type: "appointment" },
  { id: 10, user: "System", role: "system", action: "ML model retrained", detail: "DistilBERT emotion classifier v2.1", timestamp: "2026-06-22T06:00:00", type: "system" },
];

const TYPE_COLORS = {
  assessment: 'var(--cyan)',
  review: 'var(--blue)',
  auth: 'var(--emerald)',
  upload: 'var(--violet)',
  notes: 'var(--amber)',
  admin: 'var(--rose)',
  chat: 'var(--cyan)',
  device: 'var(--blue)',
  appointment: 'var(--emerald)',
  system: 'var(--text-muted)',
};

export default function AuditLogsPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const filtered = MOCK_LOGS.filter(log => {
    const matchSearch = log.user.toLowerCase().includes(searchTerm.toLowerCase()) || log.action.toLowerCase().includes(searchTerm.toLowerCase());
    const matchType = typeFilter === "all" || log.type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div className="page-title">Audit Logs</div>
        <div className="page-subtitle">Comprehensive activity trail across the platform</div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
          <input className="input-field" style={{ paddingLeft: 38 }} placeholder="Search logs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <select className="input-field" style={{ width: 160 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All Types</option>
          <option value="assessment">Assessment</option>
          <option value="review">Review</option>
          <option value="auth">Authentication</option>
          <option value="upload">Upload</option>
          <option value="notes">Notes</option>
          <option value="admin">Admin</option>
          <option value="system">System</option>
        </select>
      </div>

      {/* Logs */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 0, padding: 0 }}>
        {filtered.map((log, i) => (
          <div key={log.id} style={{
            display: 'flex', gap: 14, padding: '14px 20px',
            borderBottom: i < filtered.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
            alignItems: 'flex-start',
          }}>
            {/* Timeline dot */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: TYPE_COLORS[log.type] || 'var(--text-muted)',
                boxShadow: `0 0 6px ${TYPE_COLORS[log.type] || 'transparent'}40`,
              }} />
              {i < filtered.length - 1 && (
                <div style={{ width: 1, flex: 1, background: 'rgba(255,255,255,0.06)', marginTop: 4, minHeight: 20 }} />
              )}
            </div>

            {/* Content */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{log.user}</span>
                <span className={`badge ${log.role === 'admin' ? 'badge-violet' : log.role === 'consultant' ? 'badge-cyan' : log.role === 'system' ? 'badge-muted' : 'badge-live'}`} style={{ fontSize: 8 }}>
                  {log.role}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 2 }}>{log.action}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{log.detail}</div>
            </div>

            {/* Timestamp */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', flexShrink: 0 }}>
              <Clock style={{ width: 10, height: 10 }} />
              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
