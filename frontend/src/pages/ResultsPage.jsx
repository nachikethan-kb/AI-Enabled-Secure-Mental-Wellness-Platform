
import { motion } from "framer-motion";
import { AlertTriangle, Activity, Brain, CheckCircle2, ChevronRight, Cpu, Shield, TrendingUp, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const R = 52;
const CIRC = 2 * Math.PI * R;

function useCount(target) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let cur = 0;
    const step = Math.max(1, Math.round(target / 20));
    const id = setInterval(() => {
      cur = Math.min(cur + step, target);
      setV(cur);
      if (cur >= target) clearInterval(id);
    }, 35);
    return () => clearInterval(id);
  }, [target]);
  return v;
}

export default function ResultsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const raw = localStorage.getItem("latest_result");
  const result = location.state?.result || (raw ? JSON.parse(raw) : null);

  const score = result?.score || 0;
  const risk = result?.risk_level || "Minimal";
  const recommendation = result?.recommended_action || "Continue self-care and regular weekly check-ins to maintain wellbeing.";
  const dominantEmotion = result?.dominant_emotion || "stable";
  const emotionConf = result?.emotion_confidence != null ? Math.round(result.emotion_confidence * 100) : null;
  const secondaryEmotions = result?.secondary_emotions || [];
  const concernAreas = result?.concern_areas || [];
  const emotionSummary = result?.emotion_summary || "Emotion patterns inferred from PHQ-9 symptom clusters.";
  const emotionRationale = result?.emotion_rationale || "";
  const needsReview = Boolean(result?.needs_human_review);
  const riskFlags = result?.risk_flags || [];
  const agentVersion = result?.agent_version;
  const mentalState = result?.mental_state_label || "stable";
  const mentalConf = result?.mental_state_confidence != null ? Math.round(result.mental_state_confidence * 100) : null;
  const riskProb = result?.risk_probability;

  const sub = {
    emotional: result?.emotional_score ?? Math.min(score, 9),
    cognitive: result?.cognitive_score ?? Math.max(0, Math.min(score - 3, 9)),
    physical: result?.physical_score ?? Math.max(0, Math.min(score - 6, 9)),
    functional: result?.functional_score ?? Math.max(0, Math.min(score - 8, 9)),
  };

  const animated = useCount(score);
  const offset = useMemo(() => CIRC * (1 - Math.min(score / 27, 1)), [score]);
  const riskColor = risk.toLowerCase().includes('severe') ? 'var(--rose)' : risk.toLowerCase().includes('moderate') ? 'var(--amber)' : 'var(--emerald)';

  if (!result) {
    return (
      <div style={{ maxWidth: 500, margin: '60px auto', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
        <Cpu style={{ width: 36, height: 36, color: 'var(--text-muted)' }} />
        <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>No assessment data found</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Complete a clinical assessment to view your diagnostic report.</div>
        <button className="btn btn-primary" onClick={() => navigate('/assessment')}>
          Start Assessment <ChevronRight style={{ width: 14, height: 14 }} />
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 960, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div className="page-title">Diagnostic Report</div>
          <div className="page-subtitle">PHQ-9 assessment results · AI-generated clinical insights · {agentVersion || 'Agentic AI v1'}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/assessment')}>
            Reassess
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard')}>
            Dashboard <ChevronRight style={{ width: 13, height: 13 }} />
          </button>
        </div>
      </div>

      {needsReview && (
        <div className="alert alert-warn">
          <AlertTriangle style={{ width: 14, height: 14 }} />
          <span>Complex or safety-sensitive signals detected. Clinical review recommended.</span>
        </div>
      )}

      {/* Score Banner */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="card" style={{ display: 'flex', alignItems: 'center', gap: 28, padding: 24 }}>
        {/* Ring */}
        <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }}>
          <svg width="120" height="120" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            <circle cx="60" cy="60" r={R} fill="none" stroke={riskColor} strokeWidth="8"
              strokeLinecap="round" strokeDasharray={CIRC} strokeDashoffset={offset}
              style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)', filter: `drop-shadow(0 0 5px ${riskColor}60)` }} />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans', lineHeight: 1 }}>{animated}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, fontFamily: 'IBM Plex Mono' }}>/ 27</div>
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 6 }}>PHQ-9 SYMPTOM SCORE</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>{risk} Risk</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, maxWidth: 500 }}>
            {emotionSummary}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>DOMINANT SIGNAL</div>
          <span className={`badge ${risk.toLowerCase().includes('severe') ? 'badge-rose' : risk.toLowerCase().includes('moderate') ? 'badge-amber' : 'badge-live'}`} style={{ fontSize: 12, padding: '4px 12px' }}>
            {dominantEmotion?.toUpperCase()}
            {emotionConf != null && ` · ${emotionConf}%`}
          </span>
          {riskProb != null && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 4 }}>XGBOOST RISK</div>
              <div className="meter-bar"><div className={`meter-fill ${riskProb > 0.6 ? 'rose' : riskProb > 0.3 ? 'amber' : 'emerald'}`} style={{ width: `${riskProb * 100}%` }} /></div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginTop: 2, textAlign: 'right' }}>{Math.round(riskProb * 100)}%</div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Sub-dimension grid */}
      <div className="grid-4">
        {[
          { label: 'Emotional', value: sub.emotional, icon: Brain, color: 'var(--violet)' },
          { label: 'Cognitive', value: sub.cognitive, icon: Cpu, color: 'var(--cyan)' },
          { label: 'Physical', value: sub.physical, icon: Activity, color: 'var(--amber)' },
          { label: 'Functional', value: sub.functional, icon: CheckCircle2, color: 'var(--emerald)' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card card-sm" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase' }}>{label}</span>
              <Icon style={{ width: 13, height: 13, color }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
              <span style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'IBM Plex Sans' }}>{value}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono' }}>/9</span>
            </div>
            <div className="meter-bar"><div className="meter-fill" style={{ width: `${(value / 9) * 100}%`, background: color }} /></div>
          </div>
        ))}
      </div>

      {/* AI Analysis + Recommendations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="section-title">AI Clinical Rationale</div>

          {emotionRationale && (
            <div style={{ padding: '12px 14px', background: 'var(--bg-elevated)', borderRadius: 8, borderLeft: '3px solid var(--cyan)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7, fontStyle: 'italic' }}>
              "{emotionRationale}"
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              ['Mental State', `${mentalState}${mentalConf ? ` (${mentalConf}%)` : ''}`],
              ['Dominant Emotion', dominantEmotion],
              ...(secondaryEmotions.length ? [['Secondary Signals', secondaryEmotions.join(', ')]] : []),
              ...(riskFlags.length ? [['Risk Flags', riskFlags.join(', ')]] : []),
            ].map(([k, v]) => (
              <div key={k} style={{ padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
                <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', textTransform: 'uppercase', marginBottom: 4 }}>{k}</div>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-primary)', textTransform: 'capitalize' }}>{v}</div>
              </div>
            ))}
          </div>

          {concernAreas.length > 0 && (
            <div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'IBM Plex Mono', marginBottom: 8 }}>CONCERN AREAS</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {concernAreas.map((c, i) => <span key={i} className="badge badge-amber">{c}</span>)}
              </div>
            </div>
          )}
        </div>

        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="section-title">Clinical Recommendations</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              "Practice 10–15 min resonant breathing daily",
              "Schedule a follow-up with a licensed clinician",
              recommendation,
            ].map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <CheckCircle2 style={{ width: 13, height: 13, color: 'var(--emerald)', flexShrink: 0, marginTop: 2 }} />
                <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{r}</span>
              </div>
            ))}
          </div>
          <div className="divider" />
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/chat')}>
            Talk to AI Companion
          </button>
        </div>
      </div>
    </div>
  );
}
