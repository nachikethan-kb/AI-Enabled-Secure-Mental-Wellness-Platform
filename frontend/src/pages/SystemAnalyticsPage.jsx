import { Activity, BarChart2, Clock, Cpu, Database, Server, TrendingUp, Zap } from "lucide-react";

const MOCK_METRICS = {
  api: [
    { endpoint: '/api/v1/auth/login', avgLatency: '38ms', calls: 1247, errorRate: '0.1%' },
    { endpoint: '/api/v1/assessment/phq9', avgLatency: '125ms', calls: 856, errorRate: '0.3%' },
    { endpoint: '/api/v1/multimodal/dashboard', avgLatency: '215ms', calls: 2341, errorRate: '0.0%' },
    { endpoint: '/api/v1/chat/message', avgLatency: '340ms', calls: 1532, errorRate: '0.2%' },
    { endpoint: '/api/v1/bluetooth/stream', avgLatency: '12ms', calls: 8920, errorRate: '0.0%' },
    { endpoint: '/api/v1/multimodal/sensor', avgLatency: '89ms', calls: 645, errorRate: '0.1%' },
  ],
  models: [
    { name: 'DistilBERT Emotion', status: 'online', latency: '145ms', accuracy: '94.2%' },
    { name: 'XGBoost Risk', status: 'online', latency: '12ms', accuracy: '91.8%' },
    { name: 'BioClinicalBERT', status: 'online', latency: '230ms', accuracy: '89.5%' },
    { name: 'BiLSTM Stress', status: 'online', latency: '85ms', accuracy: '88.1%' },
  ],
  performance: [
    { time: '00:00', cpu: 12, memory: 45, requests: 23 },
    { time: '04:00', cpu: 8, memory: 42, requests: 11 },
    { time: '08:00', cpu: 34, memory: 52, requests: 156 },
    { time: '12:00', cpu: 56, memory: 61, requests: 289 },
    { time: '16:00', cpu: 48, memory: 58, requests: 234 },
    { time: '20:00', cpu: 25, memory: 49, requests: 87 },
  ],
};

export default function SystemAnalyticsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div className="page-title">System Analytics</div>
        <div className="page-subtitle">Real-time platform performance monitoring and diagnostics</div>
      </div>

      {/* Overview Stats */}
      <div className="grid-4" style={{ gap: 12 }}>
        {[
          { label: 'Uptime', value: '99.97%', icon: Server, color: 'var(--emerald)' },
          { label: 'Avg Latency', value: '42ms', icon: Zap, color: 'var(--cyan)' },
          { label: 'Total Requests', value: '15.5K', icon: Activity, color: 'var(--blue)' },
          { label: 'Error Rate', value: '0.02%', icon: TrendingUp, color: 'var(--emerald)' },
        ].map(stat => (
          <div key={stat.label} className="card card-sm">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span className="stat-label">{stat.label}</span>
              <div style={{ padding: 6, borderRadius: 6, background: `${stat.color}18` }}>
                <stat.icon style={{ width: 14, height: 14, color: stat.color }} />
              </div>
            </div>
            <span className="stat-value" style={{ color: stat.color }}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* API Endpoints + ML Models */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
        {/* API Performance */}
        <div className="card card-accent-cyan" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>API Endpoint Performance</div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Avg Latency</th>
                <th>Calls (24h)</th>
                <th>Error Rate</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_METRICS.api.map((ep, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'IBM Plex Mono', fontSize: 11, color: 'var(--cyan)' }}>{ep.endpoint}</td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ep.avgLatency}</td>
                  <td>{ep.calls.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${parseFloat(ep.errorRate) > 0.2 ? 'badge-amber' : 'badge-live'}`}>
                      {ep.errorRate}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ML Model Status */}
        <div className="card card-accent-violet" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>ML Model Status</div>
          {MOCK_METRICS.models.map((model, i) => (
            <div key={i} className="agent-card">
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{model.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                  Latency: {model.latency} · Accuracy: {model.accuracy}
                </div>
              </div>
              <span className="badge badge-live">
                <span className="status-dot live" style={{ width: 5, height: 5 }} />
                {model.status}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Load Distribution */}
      <div className="card card-accent-blue" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="section-title" style={{ marginBottom: 0 }}>24-Hour Load Distribution</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12 }}>
          {MOCK_METRICS.performance.map((p, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 8 }}>{p.time}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)' }}>
                    <span>CPU</span><span>{p.cpu}%</span>
                  </div>
                  <div className="meter-bar" style={{ height: 3 }}>
                    <div className="meter-fill" style={{ width: `${p.cpu}%`, background: p.cpu > 50 ? 'var(--amber)' : 'var(--cyan)' }} />
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--text-muted)' }}>
                    <span>MEM</span><span>{p.memory}%</span>
                  </div>
                  <div className="meter-bar" style={{ height: 3 }}>
                    <div className="meter-fill violet" style={{ width: `${p.memory}%` }} />
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', marginTop: 4 }}>{p.requests}</div>
                <div style={{ fontSize: 8, color: 'var(--text-muted)' }}>requests</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
