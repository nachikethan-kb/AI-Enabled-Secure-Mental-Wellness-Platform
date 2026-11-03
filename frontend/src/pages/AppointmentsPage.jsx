import { useState } from "react";
import { Calendar, ChevronLeft, ChevronRight, Clock, Plus, User, X } from "lucide-react";

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 10 }, (_, i) => i + 8); // 8 AM to 5 PM

const MOCK_APPOINTMENTS = [
  { id: 1, patient: "Sarah Johnson", date: "2026-06-22", time: "10:00", duration: 30, type: "Follow-up", status: "scheduled" },
  { id: 2, patient: "Michael Chen", date: "2026-06-22", time: "11:30", duration: 45, type: "Initial Consultation", status: "in-progress" },
  { id: 3, patient: "Emily Davis", date: "2026-06-22", time: "14:00", duration: 30, type: "PHQ-9 Review", status: "scheduled" },
  { id: 4, patient: "James Wilson", date: "2026-06-23", time: "09:00", duration: 60, type: "Comprehensive Assessment", status: "scheduled" },
  { id: 5, patient: "Anna Rodriguez", date: "2026-06-23", time: "11:00", duration: 30, type: "Sensor Review", status: "scheduled" },
  { id: 6, patient: "Robert Kim", date: "2026-06-24", time: "10:00", duration: 45, type: "Follow-up", status: "scheduled" },
];

export default function AppointmentsPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState(MOCK_APPOINTMENTS);
  const [view, setView] = useState("week"); // 'week' or 'day'
  const [showNewModal, setShowNewModal] = useState(false);

  const today = new Date().toISOString().split('T')[0];
  const currentDateStr = currentDate.toISOString().split('T')[0];

  // Get week dates
  const getWeekDates = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  };

  const weekDates = getWeekDates();

  const getAppointmentsForDate = (dateStr) =>
    appointments.filter(a => a.date === dateStr);

  const todayAppointments = getAppointmentsForDate(today);
  const selectedDateAppointments = getAppointmentsForDate(currentDateStr);

  const navigate = (dir) => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + (dir === 'next' ? 7 : -7));
    setCurrentDate(next);
  };

  const getStatusColor = (status) => {
    if (status === 'completed') return 'var(--emerald)';
    if (status === 'in-progress') return 'var(--cyan)';
    if (status === 'cancelled') return 'var(--rose)';
    return 'var(--blue)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Appointments</div>
          <div className="page-subtitle">Manage your consultation schedule and patient appointments</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowNewModal(true)}>
          <Plus style={{ width: 13, height: 13 }} /> New Appointment
        </button>
      </div>

      {/* Calendar Navigation */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('prev')}>
          <ChevronLeft style={{ width: 14, height: 14 }} /> Previous
        </button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
            Week of {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('next')}>
          Next <ChevronRight style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Week View */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
        {weekDates.map(date => {
          const dateStr = date.toISOString().split('T')[0];
          const dayAppts = getAppointmentsForDate(dateStr);
          const isToday = dateStr === today;
          const isSelected = dateStr === currentDateStr;

          return (
            <div
              key={dateStr}
              onClick={() => setCurrentDate(date)}
              style={{
                cursor: 'pointer', borderRadius: 12, padding: '12px 10px',
                background: isSelected ? 'var(--cyan-dim)' : 'var(--bg-surface)',
                border: `1.5px solid ${isToday ? 'var(--cyan)' : isSelected ? 'rgba(6,182,212,0.3)' : 'var(--bg-border)'}`,
                transition: 'all 0.2s ease',
                minHeight: 100,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono' }}>
                  {DAYS[date.getDay()]}
                </span>
                <span style={{
                  fontSize: 14, fontWeight: 700,
                  color: isToday ? 'var(--cyan)' : 'var(--text-primary)',
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: isToday ? 'var(--cyan)' : 'transparent',
                  ...(isToday ? { color: '#0B1020' } : {}),
                }}>
                  {date.getDate()}
                </span>
              </div>
              {dayAppts.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {dayAppts.slice(0, 3).map(apt => (
                    <div key={apt.id} style={{
                      fontSize: 9, padding: '3px 6px', borderRadius: 4,
                      background: `${getStatusColor(apt.status)}15`,
                      borderLeft: `2px solid ${getStatusColor(apt.status)}`,
                      color: 'var(--text-secondary)',
                    }}>
                      <div style={{ fontWeight: 600, fontSize: 10 }}>{apt.time}</div>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{apt.patient}</div>
                    </div>
                  ))}
                  {dayAppts.length > 3 && (
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center' }}>+{dayAppts.length - 3} more</div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'center', paddingTop: 8 }}>No appts</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected Day Detail */}
      <div className="card card-accent-blue" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="section-title" style={{ marginBottom: 0 }}>
            {currentDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <span className="badge badge-cyan">{selectedDateAppointments.length} appointments</span>
        </div>

        {selectedDateAppointments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {selectedDateAppointments.map(apt => (
              <div key={apt.id} className="agent-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 3, height: 36, borderRadius: 2,
                    background: getStatusColor(apt.status),
                  }} />
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--emerald), var(--blue))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>
                    {apt.patient.charAt(0)}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{apt.patient}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{apt.type}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                      <Clock style={{ width: 11, height: 11 }} /> {apt.time}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>{apt.duration} min</div>
                  </div>
                  <span className={`badge ${
                    apt.status === 'completed' ? 'badge-live' :
                    apt.status === 'in-progress' ? 'badge-cyan' :
                    apt.status === 'cancelled' ? 'badge-rose' : 'badge-muted'
                  }`}>
                    {apt.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
            No appointments scheduled for this day.
          </div>
        )}
      </div>
    </div>
  );
}
