import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, BarChart2, Bell, Brain, Calendar, ChevronRight, ClipboardList,
  FileText, Home, Lock, LogOut, MessageSquare, Mic, Radio,
  Settings, Shield, Sliders, Stethoscope, User, UserCog, Users, Video, Zap
} from 'lucide-react';

const PATIENT_NAV = [
  {
    group: 'Core',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: Home },
      { label: 'Assessment', path: '/assessment', icon: ClipboardList },
      { label: 'AI Companion', path: '/chat', icon: MessageSquare },
      { label: 'Health Records', path: '/health-report', icon: FileText },
    ]
  },
  {
    group: 'Intelligence',
    items: [
      { label: 'Sensor Monitor', path: '/sensor', icon: Activity },
      { label: 'Video Analysis', path: '/video', icon: Video },
    ]
  },
  {
    group: 'Workspace',
    items: [
      { label: 'Community', path: '/forum', icon: Users },
      { label: 'Results', path: '/results', icon: Zap },
    ]
  },
];

const CONSULTANT_NAV = [
  {
    group: 'Clinical',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: Home },
      { label: 'Patient Queue', path: '/patient-queue', icon: Users },
      { label: 'Sensor Analysis', path: '/patient-sensor-view', icon: Activity },
      { label: 'Health Records', path: '/health-report', icon: FileText },
    ]
  },
  {
    group: 'Practice',
    items: [
      { label: 'Consultation Notes', path: '/consultation-notes', icon: FileText },
      { label: 'Appointments', path: '/appointments', icon: Calendar },
    ]
  },
  {
    group: 'Workspace',
    items: [
      { label: 'Community', path: '/forum', icon: Users },
      { label: 'Results', path: '/results', icon: Zap },
    ]
  },
];

const ADMIN_NAV = [
  {
    group: 'Overview',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: Home },
      { label: 'User Management', path: '/user-management', icon: UserCog },
    ]
  },
  {
    group: 'Operations',
    items: [
      { label: 'System Analytics', path: '/system-analytics', icon: BarChart2 },
      { label: 'Audit Logs', path: '/audit-logs', icon: Shield },
      { label: 'Platform Settings', path: '/platform-settings', icon: Settings },
    ]
  },
  {
    group: 'Workspace',
    items: [
      { label: 'Community', path: '/forum', icon: Users },
    ]
  },
];

const ROLE_CONFIG = {
  patient: { nav: PATIENT_NAV, color: 'var(--teal)', label: 'Patient', subtitle: 'Mental Wellness Platform' },
  consultant: { nav: CONSULTANT_NAV, color: 'var(--emerald)', label: 'Consultant', subtitle: 'Clinical Workspace' },
  admin: { nav: ADMIN_NAV, color: 'var(--lav)', label: 'Admin', subtitle: 'Platform Control' },
};

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const role = localStorage.getItem('role') || 'patient';
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.patient;
  const NAV = config.nav;

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const userName = localStorage.getItem('full_name') || 'User';
  const userEmail = localStorage.getItem('email') || '';

  return (
    <aside className="app-sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <div className="sidebar-logo-mark" style={{
          background: role === 'admin'
            ? 'linear-gradient(135deg, var(--lav), var(--violet))'
            : role === 'consultant'
            ? 'linear-gradient(135deg, var(--emerald), var(--blue))'
            : 'linear-gradient(135deg, var(--teal-dark), var(--lav))',
        }}>H</div>
        <div>
          <div className="sidebar-logo-text">HEALTHLY</div>
          <div style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '0.08em', marginTop: '1px' }}>
            {config.subtitle}
          </div>
        </div>
      </div>

      {/* Nav Sections */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }}>
        {NAV.map(section => (
          <div key={section.group} className="sidebar-section">
            <div className="sidebar-section-label">{section.group}</div>
            {section.items.map(item => {
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  className={`sidebar-item ${active ? 'active' : ''}`}
                  style={{
                    width: '100%', background: 'none', border: '1px solid transparent', textAlign: 'left',
                    ...(active ? {
                      background: `${config.color}12`,
                      color: config.color,
                      borderColor: `${config.color}30`,
                    } : {}),
                  }}
                  onClick={() => !item.soon && navigate(item.path)}
                  title={item.soon ? 'Coming soon' : item.label}
                >
                  <item.icon style={{ width: 15, height: 15, flexShrink: 0, ...(active ? { color: config.color } : {}) }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.soon && (
                    <span style={{
                      fontSize: '9px', padding: '1px 5px', borderRadius: '3px',
                      background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)',
                      fontFamily: 'IBM Plex Mono', letterSpacing: '0.06em'
                    }}>SOON</span>
                  )}
                  {active && !item.soon && <span className="sidebar-indicator" style={{ background: config.color }} />}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* User footer */}
      <div style={{ borderTop: '1px solid var(--bg-border)', padding: '12px 8px 8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px', borderRadius: 'var(--radius-md)',
          marginBottom: '4px'
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: role === 'admin'
              ? 'linear-gradient(135deg, var(--lav), var(--violet))'
              : role === 'consultant'
              ? 'linear-gradient(135deg, var(--emerald), var(--blue))'
              : 'linear-gradient(135deg, var(--teal-dark), var(--lav))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0
          }}>
            {userName.charAt(0).toUpperCase()}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userName}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {userEmail}
            </div>
          </div>
          <span className={`badge ${role === 'admin' ? 'badge-lav' : role === 'consultant' ? 'badge-live' : 'badge-teal'}`} style={{ fontSize: 8, flexShrink: 0 }}>
            {config.label}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="sidebar-item"
          style={{ width: '100%', color: '#F87171', background: 'none', border: '1px solid transparent' }}
        >
          <LogOut style={{ width: 14, height: 14 }} />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}
