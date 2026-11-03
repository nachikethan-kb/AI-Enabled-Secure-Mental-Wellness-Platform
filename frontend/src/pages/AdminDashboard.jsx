import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, AlertTriangle, BarChart2, CheckCircle, ChevronRight, Clock,
  Database, FileText, RefreshCw, Search, Server, Settings, Shield,
  TrendingUp, User, UserCog, Users, XCircle, Zap
} from "lucide-react";
import { api } from "../lib/api";

function StatCard({ label, value, icon: Icon, color, subtitle }) {
  return (
    <div className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="stat-label">{label}</span>
        <div style={{ padding: 6, borderRadius: 6, background: `${color}18` }}>
          <Icon style={{ width: 14, height: 14, color }} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="stat-value">{value}</span>
      </div>
      {subtitle && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{subtitle}</div>
      )}
    </div>
  );
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editingRole, setEditingRole] = useState(null);
  const [consultants, setConsultants] = useState([]);
  const [patients, setPatients] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [pickedDoctor, setPickedDoctor] = useState({});
  const userName = localStorage.getItem("full_name") || "Admin";

  const load = async () => {
    setLoading(true);
    try {
      // allSettled: one failing request must not blank the whole dashboard (e.g. consultant list).
      const results = await Promise.allSettled([
        api.getAdminStats(),
        api.getAdminUsers(),
        api.getConsultants(),
        api.getPatients(),
        api.getAssignments(),
      ]);
      const [statsData, usersData, consultantsData, patientsData, assignmentsData] =
        results.map((r) => (r.status === "fulfilled" ? r.value : null));
      results.forEach((r, i) => {
        if (r.status === "rejected") console.error(`Admin load error (request ${i + 1}):`, r.reason);
      });
      if (statsData) setStats(statsData);
      if (usersData) setUsers(usersData.users || []);
      if (consultantsData) setConsultants(consultantsData.consultants || []);
      if (patientsData) setPatients(patientsData.patients || []);
      if (assignmentsData) setAssignments(assignmentsData.assignments || []);
    } catch (e) {
      console.error("Admin load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (doctorId, status) => {
    try {
      await api.verifyConsultant(doctorId, status);
      load();
    } catch (e) {
      alert("Failed to update verification: " + e.message);
    }
  };

  const handleOpenCredential = async (doctorId) => {
    try {
      await api.openCredential(doctorId);
    } catch (e) {
      alert("Could not open credential PDF: " + e.message);
    }
  };

  const handleAssign = async (patientId) => {
    const doctorId = pickedDoctor[patientId];
    if (!doctorId) return;
    try {
      await api.createAssignment(patientId, Number(doctorId));
      load();
    } catch (e) {
      alert("Failed to assign: " + e.message);
    }
  };

  const handleUnassign = async (assignmentId) => {
    try {
      await api.deleteAssignment(assignmentId);
      load();
    } catch (e) {
      alert("Failed to remove mapping: " + e.message);
    }
  };

  const unassignedPatients = patients.filter(p => !p.assignment_id);
  const approvedDoctors = consultants.filter(c => c.verification_status === "approved");

  useEffect(() => { load(); }, []);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.updateUserRole(userId, newRole);
      setEditingRole(null);
      load();
    } catch (e) {
      alert("Failed to update role: " + e.message);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  // Mock system health data
  const systemHealth = {
    apiLatency: '42ms',
    uptime: '99.97%',
    activeConnections: 12,
    errorRate: '0.02%',
  };

  const recentActivity = [
    { user: 'Sarah Johnson', action: 'Completed PHQ-9 assessment', time: '5 min ago', type: 'assessment' },
    { user: 'Dr. Michael Chen', action: 'Reviewed patient sensor data', time: '12 min ago', type: 'review' },
    { user: 'Emily Davis', action: 'New user registered as patient', time: '28 min ago', type: 'register' },
    { user: 'James Wilson', action: 'Uploaded health record', time: '45 min ago', type: 'upload' },
    { user: 'Dr. Lisa Park', action: 'Updated consultation notes', time: '1 hr ago', type: 'notes' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title">Platform Administration</div>
          <div className="page-subtitle">System overview and user management — {userName}</div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="btn btn-secondary btn-sm" onClick={load} disabled={loading}>
            <RefreshCw style={{ width: 13, height: 13, ...(loading ? { animation: 'spin 1s linear infinite' } : {}) }} />
            Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/platform-settings')}>
            <Settings style={{ width: 13, height: 13 }} /> Settings
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[200, 120, 80].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 14 }} />)}
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid-4" style={{ gap: 12 }}>
            <StatCard label="Total Users" value={stats?.total_users || 0} icon={Users} color="var(--cyan)" subtitle="All registered accounts" />
            <StatCard label="Patients" value={stats?.patients || 0} icon={User} color="var(--emerald)" subtitle="Active patient profiles" />
            <StatCard label="Consultants" value={stats?.consultants || 0} icon={Activity} color="var(--blue)" subtitle="Clinical staff" />
            <StatCard label="Assessments" value={stats?.total_assessments || 0} icon={BarChart2} color="var(--violet)" subtitle="PHQ-9 submissions" />
          </div>

          {/* Main Content: User Management + System Health */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>

            {/* User Management Table */}
            <div className="card card-accent-violet" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div className="section-title" style={{ marginBottom: 0 }}>User Management</div>
                <button className="btn btn-ghost btn-xs" onClick={() => navigate('/user-management')}>
                  Full View <ChevronRight style={{ width: 11, height: 11 }} />
                </button>
              </div>

              {/* Filters */}
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
                  <input
                    className="input-field"
                    style={{ paddingLeft: 38 }}
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <select
                  className="input-field"
                  style={{ width: 130 }}
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  <option value="patient">Patients</option>
                  <option value="consultant">Consultants</option>
                  <option value="admin">Admins</option>
                </select>
              </div>

              {/* Table */}
              <div style={{ maxHeight: 380, overflowY: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.slice(0, 10).map(user => (
                      <tr key={user.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{
                              width: 26, height: 26, borderRadius: '50%',
                              background: user.role === 'admin' ? 'linear-gradient(135deg, var(--violet), var(--rose))'
                                : user.role === 'consultant' ? 'linear-gradient(135deg, var(--emerald), var(--blue))'
                                : 'linear-gradient(135deg, var(--cyan), var(--blue))',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0
                            }}>
                              {user.full_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>{user.full_name}</span>
                          </div>
                        </td>
                        <td style={{ fontSize: 11, fontFamily: 'IBM Plex Mono' }}>{user.email}</td>
                        <td>
                          {editingRole === user.id ? (
                            <select
                              className="input-field"
                              style={{ padding: '3px 6px', fontSize: 11, width: 110 }}
                              defaultValue={user.role}
                              onChange={(e) => handleRoleChange(user.id, e.target.value)}
                              onBlur={() => setEditingRole(null)}
                              autoFocus
                            >
                              <option value="patient">Patient</option>
                              <option value="consultant">Consultant</option>
                              <option value="admin">Admin</option>
                            </select>
                          ) : (
                            <span
                              className={`badge ${user.role === 'admin' ? 'badge-violet' : user.role === 'consultant' ? 'badge-cyan' : 'badge-live'}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setEditingRole(user.id)}
                              title="Click to change role"
                            >
                              {user.role}
                            </span>
                          )}
                        </td>
                        <td style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)' }}>
                          {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          <button
                            className="btn btn-ghost btn-xs"
                            onClick={() => setEditingRole(editingRole === user.id ? null : user.id)}
                          >
                            <UserCog style={{ width: 11, height: 11 }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Role Distribution */}
              <div style={{ display: 'flex', gap: 12, padding: '12px 0 0', borderTop: '1px solid var(--bg-border)' }}>
                {[
                  { label: 'Patients', count: stats?.patients || 0, color: 'var(--emerald)' },
                  { label: 'Consultants', count: stats?.consultants || 0, color: 'var(--cyan)' },
                  { label: 'Admins', count: stats?.admins || 0, color: 'var(--violet)' },
                ].map(item => (
                  <div key={item.label} style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: item.color, fontFamily: 'IBM Plex Sans' }}>{item.count}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'IBM Plex Mono' }}>{item.label}</div>
                    <div className="meter-bar" style={{ height: 3, marginTop: 6 }}>
                      <div className="meter-fill" style={{
                        width: `${(stats?.total_users ? (item.count / stats.total_users) * 100 : 0)}%`,
                        background: item.color,
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* System Health */}
              <div className="card card-accent-cyan" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>System Health</div>
                {[
                  { label: 'API Latency', value: systemHealth.apiLatency, icon: Zap, color: 'var(--emerald)' },
                  { label: 'Uptime', value: systemHealth.uptime, icon: Server, color: 'var(--cyan)' },
                  { label: 'Active Connections', value: systemHealth.activeConnections, icon: Activity, color: 'var(--blue)' },
                  { label: 'Error Rate', value: systemHealth.errorRate, icon: Shield, color: 'var(--emerald)' },
                ].map(item => (
                  <div key={item.label} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 10px', borderRadius: 6, background: 'rgba(21,23,22,0.02)',
                    border: '1px solid var(--bg-border)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <item.icon style={{ width: 12, height: 12, color: item.color }} />
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{item.label}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: item.color, fontFamily: 'IBM Plex Mono' }}>{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Recent Activity */}
              <div className="card card-accent-rose" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="section-title" style={{ marginBottom: 0 }}>Recent Activity</div>
                  <button className="btn btn-ghost btn-xs" onClick={() => navigate('/audit-logs')}>
                    Logs <ChevronRight style={{ width: 11, height: 11 }} />
                  </button>
                </div>
                {recentActivity.map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 10, padding: '6px 0',
                    borderBottom: i < recentActivity.length - 1 ? '1px solid rgba(21,23,22,0.03)' : 'none',
                  }}>
                    <div style={{
                      width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                      background: item.type === 'assessment' ? 'var(--cyan)'
                        : item.type === 'register' ? 'var(--emerald)'
                        : item.type === 'review' ? 'var(--blue)'
                        : 'var(--violet)',
                    }} />
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text-primary)' }}>
                        <span style={{ fontWeight: 600 }}>{item.user}</span> {item.action}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Admin Actions */}
              <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Admin Tools</div>
                {[
                  { label: 'User Management', icon: Users, path: '/user-management' },
                  { label: 'System Analytics', icon: BarChart2, path: '/system-analytics' },
                  { label: 'Audit Logs', icon: Shield, path: '/audit-logs' },
                  { label: 'Platform Settings', icon: Settings, path: '/platform-settings' },
                ].map(action => (
                  <button
                    key={action.label}
                    className="agent-card"
                    style={{ cursor: 'pointer', background: 'none', width: '100%', textAlign: 'left' }}
                    onClick={() => navigate(action.path)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <action.icon style={{ width: 13, height: 13, color: 'var(--violet)' }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)' }}>{action.label}</span>
                    </div>
                    <ChevronRight style={{ width: 12, height: 12, color: 'var(--text-muted)' }} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Doctor Verification & One-to-One Patient Mapping */}
          <div className="card card-accent-emerald" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="section-title" style={{ marginBottom: 0 }}>Doctor Verification &amp; Patient Mapping</div>

            {/* Pending / all consultants */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {consultants.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No consultants registered yet.</div>
              )}
              {consultants.map(c => (
                <div key={c.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: '10px 12px', borderRadius: 10, background: 'rgba(21,23,22,0.02)',
                  border: '1px solid var(--bg-border)',
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 12, fontWeight: 600 }}>{c.full_name}</span>
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{c.email}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`badge ${c.verification_status === 'approved' ? 'badge-live' : c.verification_status === 'rejected' ? 'badge-rose' : 'badge-amber'}`}>
                      {c.verification_status}
                    </span>
                    {c.has_credential && (
                      <button type="button" onClick={() => handleOpenCredential(c.id)} className="btn btn-ghost btn-xs">
                        <FileText style={{ width: 11, height: 11 }} /> PDF
                      </button>
                    )}
                    {c.verification_status !== 'approved' && (
                      <button className="btn btn-secondary btn-xs" onClick={() => handleVerify(c.id, 'approved')} disabled={!c.has_credential}>
                        <CheckCircle style={{ width: 11, height: 11 }} /> Approve
                      </button>
                    )}
                    {c.verification_status !== 'rejected' && (
                      <button className="btn btn-ghost btn-xs" onClick={() => handleVerify(c.id, 'rejected')}>
                        <XCircle style={{ width: 11, height: 11 }} /> Reject
                      </button>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                      {c.assigned_patients.length}/{c.capacity} patients
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Current mappings */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'IBM Plex Mono' }}>
                Active Mappings
              </div>
              {assignments.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No patient-doctor mappings yet.</div>
              )}
              {assignments.map(a => (
                <div key={a.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                  padding: '8px 12px', borderRadius: 10, background: 'rgba(21,23,22,0.02)',
                  border: '1px solid var(--bg-border)', fontSize: 12,
                }}>
                  <span>
                    <strong>{a.patient?.patient_code}</strong> ({a.patient?.full_name}) → Dr. {a.doctor?.full_name}
                  </span>
                  <button className="btn btn-ghost btn-xs" onClick={() => handleUnassign(a.id)}>Remove</button>
                </div>
              ))}
            </div>

            {/* Assign an unassigned patient */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontFamily: 'IBM Plex Mono' }}>
                Assign Unmapped Patients
              </div>
              {unassignedPatients.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Every patient is mapped to a doctor.</div>
              )}
              {unassignedPatients.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                  <span style={{ minWidth: 140 }}><strong>{p.patient_code}</strong> ({p.full_name})</span>
                  <select
                    className="input-field"
                    style={{ padding: '3px 6px', fontSize: 11, width: 200 }}
                    value={pickedDoctor[p.id] || ""}
                    onChange={(e) => setPickedDoctor(prev => ({ ...prev, [p.id]: e.target.value }))}
                  >
                    <option value="">Select doctor…</option>
                    {approvedDoctors.filter(d => d.assigned_patients.length < d.capacity).map(d => (
                      <option key={d.id} value={d.id}>{d.full_name}</option>
                    ))}
                  </select>
                  <button className="btn btn-primary btn-xs" disabled={!pickedDoctor[p.id]} onClick={() => handleAssign(p.id)}>
                    Assign
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
