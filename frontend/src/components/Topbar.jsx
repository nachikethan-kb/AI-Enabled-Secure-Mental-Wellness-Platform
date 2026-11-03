import { useLocation } from 'react-router-dom';
import { Bell, ChevronRight, Cpu, Search, Stethoscope, Shield, User } from 'lucide-react';

const BREADCRUMB_MAP = {
  '/dashboard': ['Platform', 'Dashboard'],
  '/assessment': ['Platform', 'Clinical Assessment'],
  '/chat': ['Platform', 'AI Companion'],
  '/health-report': ['Platform', 'Health Records'],
  '/results': ['Platform', 'Assessment Results'],
  '/forum': ['Platform', 'Community'],
  '/sensor': ['Platform', 'Sensor Monitor'],
  '/video': ['Platform', 'Video Analysis'],
  '/comprehensive-assessment': ['Platform', 'Comprehensive Assessment'],
  // Consultant routes
  '/patient-queue': ['Consultant', 'Patient Queue'],
  '/patient-sensor-view': ['Consultant', 'Patient Sensor Analysis'],
  '/consultation-notes': ['Consultant', 'Consultation Notes'],
  '/appointments': ['Consultant', 'Appointments'],
  // Admin routes
  '/user-management': ['Admin', 'User Management'],
  '/system-analytics': ['Admin', 'System Analytics'],
  '/audit-logs': ['Admin', 'Audit Logs'],
  '/platform-settings': ['Admin', 'Platform Settings'],
};

const ROLE_ICONS = {
  patient: User,
  consultant: Stethoscope,
  admin: Shield,
};

const ROLE_COLORS = {
  patient: 'var(--cyan)',
  consultant: 'var(--emerald)',
  admin: 'var(--violet)',
};

export default function Topbar() {
  const location = useLocation();
  const crumbs = BREADCRUMB_MAP[location.pathname] || ['Platform'];
  const role = localStorage.getItem('role') || 'patient';
  const RoleIcon = ROLE_ICONS[role] || User;
  const roleColor = ROLE_COLORS[role] || 'var(--cyan)';

  return (
    <header className="app-topbar">
      {/* Breadcrumb */}
      <div className="topbar-breadcrumb">
        {crumbs.map((crumb, i) => (
          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && <ChevronRight style={{ width: 13, height: 13, color: 'var(--text-muted)' }} />}
            <span className={i === crumbs.length - 1 ? 'topbar-breadcrumb-current' : ''}>
              {crumb}
            </span>
          </span>
        ))}
      </div>

      {/* System Status + Role Badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        {/* Role indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 6,
          background: `${roleColor}12`,
          border: `1px solid ${roleColor}25`,
        }}>
          <RoleIcon style={{ width: 12, height: 12, color: roleColor }} />
          <span style={{ fontSize: 10, fontWeight: 600, color: roleColor, textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'IBM Plex Mono' }}>
            {role}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
          <Cpu style={{ width: 12, height: 12, color: 'var(--emerald)' }} />
          <span>All systems operational</span>
          <span className="status-dot live" />
        </div>

        <div className="topbar-actions">
          <button className="topbar-icon-btn" title="Search">
            <Search style={{ width: 14, height: 14 }} />
          </button>
          <button className="topbar-icon-btn" title="Notifications">
            <Bell style={{ width: 14, height: 14 }} />
          </button>
        </div>
      </div>
    </header>
  );
}
