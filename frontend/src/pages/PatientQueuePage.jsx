import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Activity, AlertTriangle, ChevronRight, Search, User, Users
} from "lucide-react";
import { api } from "../lib/api";

export default function PatientQueuePage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("name");

  useEffect(() => {
    const load = async () => {
      try {
        const data = await api.getPatients();
        setPatients(data.patients || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = patients
    .filter(p => (p.patient_code || p.full_name || "").toLowerCase().includes(searchTerm.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return (a.patient_code || a.full_name || "").localeCompare(b.patient_code || b.full_name || "");
      if (sortBy === "risk") {
        const riskOrder = { 'severe': 0, 'high': 0, 'moderately severe': 1, 'moderate': 2, 'mild': 3, 'minimal': 4, 'none': 5 };
        const aRisk = Object.entries(riskOrder).find(([k]) => (a.last_assessment?.risk_level || 'none').toLowerCase().includes(k))?.[1] ?? 5;
        const bRisk = Object.entries(riskOrder).find(([k]) => (b.last_assessment?.risk_level || 'none').toLowerCase().includes(k))?.[1] ?? 5;
        return aRisk - bRisk;
      }
      if (sortBy === "records") return (b.sensor_records || 0) - (a.sensor_records || 0);
      return 0;
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div className="page-title">Patient Queue</div>
        <div className="page-subtitle">Complete list of all registered patients and their clinical status</div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
          <input className="input-field" style={{ paddingLeft: 38 }} placeholder="Search patients..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <select className="input-field" style={{ width: 160 }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          <option value="name">Sort by Name</option>
          <option value="risk">Sort by Risk Level</option>
          <option value="records">Sort by Records</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: 60, borderRadius: 10 }} />)}
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Patient</th>
                <th>Risk Level</th>
                <th>Last Score</th>
                <th>Sensor Records</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(patient => (
                <tr key={patient.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--emerald), var(--blue))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0
                      }}>
                        {(patient.patient_code || patient.full_name || 'P')?.charAt(3) || (patient.patient_code || patient.full_name)?.charAt(0)?.toUpperCase()}
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 12 }}>{patient.patient_code || patient.full_name}</span>
                    </div>
                  </td>
                  <td>
                    {patient.last_assessment ? (
                      <span className={`badge ${
                        patient.last_assessment.risk_level?.toLowerCase().includes('severe') ? 'badge-rose' :
                        patient.last_assessment.risk_level?.toLowerCase().includes('moderate') ? 'badge-amber' : 'badge-live'
                      }`}>{patient.last_assessment.risk_level}</span>
                    ) : <span className="badge badge-muted">No data</span>}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'IBM Plex Mono' }}>
                    {patient.last_assessment ? `${patient.last_assessment.score}/27` : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Activity style={{ width: 11, height: 11, color: 'var(--cyan)' }} />
                      <span style={{ fontSize: 12, fontFamily: 'IBM Plex Mono' }}>{patient.sensor_records}</span>
                    </div>
                  </td>
                  <td style={{ fontSize: 10, fontFamily: 'IBM Plex Mono', color: 'var(--text-muted)' }}>
                    {patient.created_at ? new Date(patient.created_at).toLocaleDateString() : '—'}
                  </td>
                  <td>
                    <button className="btn btn-primary btn-xs" onClick={() => navigate(`/patient-sensor-view?patient=${patient.id}`)}>
                      View Sensors <ChevronRight style={{ width: 10, height: 10 }} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: 13 }}>
              {searchTerm ? 'No patients match your search.' : 'No patients registered yet.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
