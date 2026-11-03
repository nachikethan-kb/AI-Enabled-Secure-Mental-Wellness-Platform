import { useState } from "react";
import { FileText, Plus, Save, Search, User, Clock, ChevronRight } from "lucide-react";

const MOCK_NOTES = [
  { id: 1, patient: "Sarah Johnson", date: "2026-06-22", summary: "Patient shows improvement in sleep patterns. PHQ-9 score decreased from 14 to 9 over 4 weeks. Continue current SSRI dosage. Recommend continued mindfulness practice.", tags: ["Follow-up", "Improvement"] },
  { id: 2, patient: "Michael Chen", date: "2026-06-21", summary: "Elevated stress index (0.78) observed from sensor data. HRV below normal range. Patient reports workplace stress. Recommend cognitive behavioral therapy referral.", tags: ["Urgent", "Stress"] },
  { id: 3, patient: "Emily Davis", date: "2026-06-20", summary: "Initial consultation completed. Patient presents with generalized anxiety and disturbed sleep. Baseline PHQ-9: 12 (Moderate). Ordered comprehensive sensor monitoring.", tags: ["Initial", "Anxiety"] },
  { id: 4, patient: "James Wilson", date: "2026-06-19", summary: "Sensor data review: sleep quality improved to 7.2 hrs average. GSR normalized. Stress index down to 0.32. Continue current treatment plan.", tags: ["Review", "Positive"] },
  { id: 5, patient: "Anna Rodriguez", date: "2026-06-18", summary: "PHQ-9 review session. Score stable at 6 (Mild). Patient engaged well in therapy. No medication changes needed. Schedule follow-up in 3 weeks.", tags: ["Stable", "Follow-up"] },
];

export default function ConsultationNotesPage() {
  const [notes, setNotes] = useState(MOCK_NOTES);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCompose, setShowCompose] = useState(false);
  const [newNote, setNewNote] = useState({ patient: "", summary: "" });

  const filtered = notes.filter(n =>
    n.patient.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.summary.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSave = () => {
    if (!newNote.patient.trim() || !newNote.summary.trim()) return;
    const note = {
      id: Date.now(),
      patient: newNote.patient,
      date: new Date().toISOString().split('T')[0],
      summary: newNote.summary,
      tags: ["New"],
    };
    setNotes([note, ...notes]);
    setNewNote({ patient: "", summary: "" });
    setShowCompose(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div className="page-title">Consultation Notes</div>
          <div className="page-subtitle">Clinical notes and observations for patient consultations</div>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCompose(!showCompose)}>
          <Plus style={{ width: 13, height: 13 }} /> New Note
        </button>
      </div>

      {/* Compose */}
      {showCompose && (
        <div className="card card-accent-emerald" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="section-title" style={{ marginBottom: 0 }}>New Clinical Note</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase' }}>Patient Name</label>
            <div style={{ position: 'relative' }}>
              <User style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
              <input className="input-field" style={{ paddingLeft: 38 }} placeholder="Enter patient name" value={newNote.patient} onChange={(e) => setNewNote({ ...newNote, patient: e.target.value })} />
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase' }}>Clinical Notes</label>
            <textarea
              className="input-field"
              rows={4}
              placeholder="Enter consultation notes, observations, and recommendations..."
              value={newNote.summary}
              onChange={(e) => setNewNote({ ...newNote, summary: e.target.value })}
            />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowCompose(false)}>Cancel</button>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>
              <Save style={{ width: 12, height: 12 }} /> Save Note
            </button>
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{ position: 'relative' }}>
        <Search style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-muted)' }} />
        <input className="input-field" style={{ paddingLeft: 38 }} placeholder="Search notes by patient or content..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
      </div>

      {/* Notes List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {filtered.map(note => (
          <div key={note.id} className="card" style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--emerald), var(--blue))',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
                  }}>
                    {note.patient.charAt(0)}
                  </div>
                  <div>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{note.patient}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>
                      <Clock style={{ width: 10, height: 10 }} /> {note.date}
                    </div>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{note.summary}</p>
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  {note.tags.map(tag => (
                    <span key={tag} className="badge badge-cyan" style={{ fontSize: 9 }}>{tag}</span>
                  ))}
                </div>
              </div>
              <FileText style={{ width: 16, height: 16, color: 'var(--text-muted)', flexShrink: 0 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
