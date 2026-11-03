import { useState } from "react";
import { AlertTriangle, Bell, Database, Globe, Save, Server, Settings, Shield, ToggleLeft, ToggleRight, Zap } from "lucide-react";

export default function PlatformSettingsPage() {
  const [settings, setSettings] = useState({
    maintenanceMode: false,
    allowRegistration: true,
    requireEmailVerification: false,
    enableBluetooth: true,
    enableVideoAnalysis: true,
    enableChatbot: true,
    maxUploadSize: 5,
    sessionTimeout: 30,
    enableNotifications: true,
    enableAuditLogs: true,
  });

  const [saved, setSaved] = useState(false);

  const toggleSetting = (key) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
    setSaved(false);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const Toggle = ({ active, onClick }) => (
    <button onClick={onClick} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
      {active ? (
        <ToggleRight style={{ width: 28, height: 28, color: 'var(--cyan)' }} />
      ) : (
        <ToggleLeft style={{ width: 28, height: 28, color: 'var(--text-muted)' }} />
      )}
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Platform Settings</div>
          <div className="page-subtitle">Configure system behavior, features, and security settings</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={handleSave}>
          <Save style={{ width: 13, height: 13 }} /> {saved ? '✓ Saved!' : 'Save Changes'}
        </button>
      </div>

      {settings.maintenanceMode && (
        <div className="alert alert-warn">
          <AlertTriangle style={{ width: 14, height: 14, flexShrink: 0 }} />
          <span>Maintenance mode is active. Users will see a maintenance page when accessing the platform.</span>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* General */}
        <div className="card card-accent-cyan" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Settings style={{ width: 15, height: 15, color: 'var(--cyan)' }} />
            <div className="section-title" style={{ marginBottom: 0 }}>General</div>
          </div>
          {[
            { key: 'maintenanceMode', label: 'Maintenance Mode', desc: 'Show maintenance page to all users' },
            { key: 'allowRegistration', label: 'Allow Registration', desc: 'Allow new users to create accounts' },
            { key: 'requireEmailVerification', label: 'Email Verification', desc: 'Require email verification on signup' },
          ].map(item => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.desc}</div>
              </div>
              <Toggle active={settings[item.key]} onClick={() => toggleSetting(item.key)} />
            </div>
          ))}
        </div>

        {/* Features */}
        <div className="card card-accent-emerald" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Zap style={{ width: 15, height: 15, color: 'var(--emerald)' }} />
            <div className="section-title" style={{ marginBottom: 0 }}>Feature Flags</div>
          </div>
          {[
            { key: 'enableBluetooth', label: 'Bluetooth Integration', desc: 'Enable wearable device connections' },
            { key: 'enableVideoAnalysis', label: 'Video Analysis', desc: 'Enable emotion detection from video' },
            { key: 'enableChatbot', label: 'AI Chatbot', desc: 'Enable AI companion chat feature' },
          ].map(item => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.desc}</div>
              </div>
              <Toggle active={settings[item.key]} onClick={() => toggleSetting(item.key)} />
            </div>
          ))}
        </div>

        {/* Security */}
        <div className="card card-accent-violet" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield style={{ width: 15, height: 15, color: 'var(--violet)' }} />
            <div className="section-title" style={{ marginBottom: 0 }}>Security</div>
          </div>
          {[
            { key: 'enableAuditLogs', label: 'Audit Logging', desc: 'Record all user actions' },
            { key: 'enableNotifications', label: 'Notifications', desc: 'Enable system notifications' },
          ].map(item => (
            <div key={item.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{item.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{item.desc}</div>
              </div>
              <Toggle active={settings[item.key]} onClick={() => toggleSetting(item.key)} />
            </div>
          ))}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase' }}>Session Timeout (min)</label>
            <input className="input-field" type="number" value={settings.sessionTimeout} onChange={(e) => { setSettings(prev => ({ ...prev, sessionTimeout: parseInt(e.target.value) || 30 })); setSaved(false); }} />
          </div>
        </div>

        {/* Storage */}
        <div className="card card-accent-blue" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Database style={{ width: 15, height: 15, color: 'var(--blue)' }} />
            <div className="section-title" style={{ marginBottom: 0 }}>Storage & Data</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase' }}>Max Upload Size (MB)</label>
            <input className="input-field" type="number" value={settings.maxUploadSize} onChange={(e) => { setSettings(prev => ({ ...prev, maxUploadSize: parseInt(e.target.value) || 5 })); setSaved(false); }} />
          </div>
          <div style={{ padding: '12px 0 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>Database Size</span><span>12.4 MB</span>
            </div>
            <div className="meter-bar" style={{ height: 4 }}>
              <div className="meter-fill" style={{ width: '12%' }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontFamily: 'IBM Plex Mono' }}>12.4 MB / 100 MB allocated</div>
          </div>
        </div>
      </div>
    </div>
  );
}
