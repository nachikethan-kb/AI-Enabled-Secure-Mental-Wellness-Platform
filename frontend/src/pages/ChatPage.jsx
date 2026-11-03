import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, AlertTriangle, HeartPulse, PhoneCall, Send, Shield } from "lucide-react";
import { api } from "../lib/api";

// Wellbeing percentage (derived from the latest PHQ-9 score, 100 = best) → ring color
function wellnessColor(pct) {
  if (pct == null) return "var(--text-muted)";
  if (pct >= 75) return "var(--teal)";
  if (pct >= 50) return "var(--amber, #F59E0B)";
  if (pct >= 25) return "#FB923C";
  return "#F87171";
}

function WellnessBadge({ pct, riskLevel }) {
  const color = wellnessColor(pct);
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 12px", borderRadius: 999,
        border: `1px solid ${color}55`, background: `${color}14`,
      }}
      title={riskLevel ? `Latest PHQ-9 risk level: ${riskLevel}` : "Take a PHQ-9 assessment to see this"}
    >
      <HeartPulse size={13} style={{ color }} />
      <span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, fontWeight: 700, color }}>
        {pct != null ? `${pct}%` : "—"}
      </span>
      <span style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {riskLevel || "wellbeing"}
      </span>
    </motion.div>
  );
}

const EMOTION_MAP = {
  anger:   { emoji: "😠", color: "#F87171",        label: "Anger" },
  fear:    { emoji: "😨", color: "var(--amber)",   label: "Fear" },
  sadness: { emoji: "🌧️", color: "var(--lav)",     label: "Sadness" },
  joy:     { emoji: "☀️", color: "var(--teal)",    label: "Joy" },
  surprise:{ emoji: "✨", color: "var(--teal-dark)",label: "Surprise" },
  disgust: { emoji: "😶", color: "#94A3B8",         label: "Disgust" },
  neutral: { emoji: "○",  color: "var(--text-muted)",label: "Neutral" },
};

function EmotionIndicator({ emotion, confidence }) {
  const meta = EMOTION_MAP[emotion?.toLowerCase()] || EMOTION_MAP.neutral;
  return (
    <motion.div
      style={{ display: "flex", alignItems: "center", gap: 6 }}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {/* Animated color dot — reflects detected emotion */}
      <motion.div
        animate={{ backgroundColor: meta.color, boxShadow: `0 0 8px ${meta.color}80` }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        style={{ width: 7, height: 7, borderRadius: "50%", flexShrink: 0 }}
      />
      <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {meta.emoji} {meta.label}
        {confidence != null && ` · ${(confidence * 100).toFixed(0)}%`}
      </span>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", padding: "8px 14px", background: "var(--teal-dim)", borderRadius: "14px 14px 14px 2px", width: "fit-content", border: "1px solid rgba(94,234,212,0.15)" }}>
      {[0, 1, 2].map(i => (
        <motion.div
          key={i}
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
          style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--teal)" }}
        />
      ))}
    </div>
  );
}

export default function ChatPage() {
  const navigate = useNavigate();
  const [message, setMessage]         = useState("");
  const [history, setHistory]         = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending]         = useState(false);
  const [error, setError]             = useState("");
  const [companion, setCompanion]     = useState(null); // latest PHQ-9 + sensor derived status
  const [requestingCall, setRequestingCall] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    api.getChatHistory()
      .then(d => setHistory(d.items || []))
      .catch(e => setError(e.message))
      .finally(() => setLoadingHistory(false));

    api.getCompanionStatus()
      .then(setCompanion)
      .catch(() => {}); // non-critical widget; ignore failures silently
  }, []);

  const connectDoctor = async () => {
    setRequestingCall(true);
    try {
      const doctors = await api.listDoctors();
      if (doctors && doctors.length > 0) {
        await api.requestCall(doctors[0].id);
      }
    } catch (e) {
      // fall through — the video page lets the user retry / pick a doctor manually
    } finally {
      setRequestingCall(false);
      navigate("/video");
    }
  };

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [history, sending]);

  const send = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true); setError("");
    const msg = message;
    setMessage("");
    try {
      const res = await api.sendMessage(msg);
      setHistory(prev => [{
        id: Date.now(), user_message: msg,
        bot_response: res.response, emotion: res.emotion,
        confidence: res.confidence, escalation_required: res.escalation_required,
        created_at: new Date().toISOString(),
      }, ...prev]);
      // Refresh the wellbeing widget from the same PHQ-9 + sensor context the reply used
      setCompanion({
        risk_level: res.risk_level,
        wellness_percentage: res.wellness_percentage,
        suggest_doctor: res.suggest_doctor,
        urgent_doctor: res.urgent_doctor,
        sensor_connected: res.sensor_connected,
        steps_today: res.steps_today,
        active_minutes_today: res.active_minutes_today,
        activity_suggestion: res.activity_suggestion,
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const emotions     = history.map(h => h.emotion?.toLowerCase()).filter(Boolean).slice(0, 10);
  const emotionCounts= emotions.reduce((acc, e) => { acc[e] = (acc[e] || 0) + 1; return acc; }, {});
  const topEmotion   = Object.entries(emotionCounts).sort((a,b)=>b[1]-a[1])[0]?.[0];
  const escalations  = history.filter(h => h.escalation_required).length;
  const topMeta      = topEmotion ? EMOTION_MAP[topEmotion] || EMOTION_MAP.neutral : null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <div className="page-title">AI Cognitive Companion</div>
          <div className="page-subtitle">CBT-aligned · Real-time emotion recognition · Fully encrypted</div>
        </div>
        {/* Top-right PHQ-9-derived wellbeing percentage */}
        <WellnessBadge pct={companion?.wellness_percentage} riskLevel={companion?.risk_level} />
      </div>

      {/* Urgent doctor-contact banner — shown for severe / moderately severe PHQ-9 risk */}
      {companion?.urgent_doctor && (
        <motion.div
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="alert alert-warn"
          style={{ display: "flex", alignItems: "center", gap: 12, borderColor: "#F87171", background: "rgba(248,113,113,0.08)" }}
        >
          <AlertTriangle size={16} style={{ color: "#F87171", flexShrink: 0 }} />
          <div style={{ flex: 1, fontSize: 12.5, lineHeight: 1.6 }}>
            Your latest assessment indicates <strong>severe</strong> risk. Please contact a doctor immediately —
            I can arrange a video meeting right now.
          </div>
          <motion.button
            className="btn btn-primary"
            onClick={connectDoctor}
            disabled={requestingCall}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            style={{ flexShrink: 0, background: "#F87171", borderColor: "#F87171" }}
          >
            <PhoneCall size={13} /> {requestingCall ? "Connecting…" : "Connect now"}
          </motion.button>
        </motion.div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 264px", gap: 16, alignItems: "start" }}>

        {/* ── MAIN CHAT PANEL ── */}
        <div className="bento-card" style={{ padding: 0, display: "flex", flexDirection: "column", height: "calc(100vh - 230px)", overflow: "hidden" }}>
          {/* Chat header */}
          <div style={{ padding: "14px 20px", borderBottom: "1px solid var(--bg-border)", display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 10, background: "var(--lav-dim)", border: "1px solid rgba(167,139,250,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 16 }}>🌿</span>
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>Healthly Companion</div>
              <div style={{ fontSize: 10, color: "var(--teal)", fontFamily: "IBM Plex Mono", display: "flex", alignItems: "center", gap: 5 }}>
                <span className="status-dot live" style={{ width: 5, height: 5 }} />
                CBT · NLP · Emotion Analysis
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 18 }}>
            {loadingHistory ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[80, 120, 60].map((h, i) => <div key={i} className="skeleton" style={{ height: h, borderRadius: 12 }} />)}
              </div>
            ) : history.length === 0 ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
                <span style={{ fontSize: 36 }}>🌿</span>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-secondary)" }}>Begin your session</div>
                <div style={{ fontSize: 13, maxWidth: 300, lineHeight: 1.7 }}>
                  Share what's on your mind. I'll listen, reflect, and help you understand your patterns — no judgment.
                </div>
              </div>
            ) : (
              <AnimatePresence>
                {[...history].reverse().map(item => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    style={{ display: "flex", flexDirection: "column", gap: 10 }}
                  >
                    {/* User bubble */}
                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <div className="chat-bubble-user">{item.user_message}</div>
                    </div>
                    {/* Bot bubble + emotion indicator */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div className="chat-bubble-bot">{item.bot_response}</div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 4 }}>
                        {item.emotion && <EmotionIndicator emotion={item.emotion} confidence={item.confidence} />}
                        {item.escalation_required && (
                          <span className="badge badge-amber">
                            <AlertTriangle size={9} /> Support suggested
                          </span>
                        )}
                        <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "IBM Plex Mono", marginLeft: "auto" }}>
                          {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
            {/* Typing indicator */}
            {sending && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <TypingIndicator />
              </motion.div>
            )}
            <div ref={endRef} />
          </div>

          {/* Error */}
          {error && (
            <div className="alert alert-warn" style={{ margin: "0 16px", borderRadius: 8 }}>
              <AlertTriangle size={13} /> <span>{error}</span>
            </div>
          )}

          {/* Input */}
          <form onSubmit={send} style={{ padding: "12px 16px", borderTop: "1px solid var(--bg-border)", display: "flex", gap: 8 }}>
            <input
              className="input-field"
              placeholder="Share how you're feeling…"
              value={message}
              onChange={e => setMessage(e.target.value)}
              disabled={sending}
              style={{ flex: 1 }}
            />
            <motion.button
              className="btn btn-primary"
              type="submit"
              disabled={sending || !message.trim()}
              whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              transition={{ duration: 0.4 }}
              style={{ flexShrink: 0 }}
            >
              {sending ? "…" : <Send size={14} />}
            </motion.button>
          </form>
        </div>

        {/* ── SIDE ANALYTICS ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* Activity / sensor-derived nudge */}
          {companion && (companion.activity_suggestion || companion.sensor_connected !== undefined) && (
            <div className="bento-card card-accent-teal" style={{ padding: 16 }}>
              <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Activity size={12} /> Physical Activity
              </div>
              {companion.sensor_connected ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Steps today</span>
                    <span style={{ fontWeight: 600, fontFamily: "IBM Plex Mono" }}>
                      {companion.steps_today != null ? companion.steps_today.toLocaleString() : "—"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--text-muted)" }}>Active minutes</span>
                    <span style={{ fontWeight: 600, fontFamily: "IBM Plex Mono" }}>
                      {companion.active_minutes_today ?? "—"}
                    </span>
                  </div>
                  {companion.activity_suggestion && (
                    <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.6, paddingTop: 4, borderTop: "1px solid var(--bg-border)" }}>
                      {companion.activity_suggestion}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.6 }}>
                    No connected sensor yet. Pair your wearable/phone to let your companion track steps and
                    activity automatically.
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => navigate("/sensor")}
                    style={{ fontSize: 11, width: "fit-content" }}
                  >
                    Connect a sensor
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Doctor connect (non-urgent, mild/moderate) */}
          {companion?.suggest_doctor && !companion?.urgent_doctor && (
            <div className="bento-card" style={{ padding: 16 }}>
              <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <PhoneCall size={12} /> Talk to a Doctor
              </div>
              <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 10 }}>
                Based on your recent check-in, connecting with a specialist could help.
              </div>
              <motion.button
                className="btn btn-primary"
                onClick={connectDoctor}
                disabled={requestingCall}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                style={{ width: "100%", justifyContent: "center" }}
              >
                {requestingCall ? "Connecting…" : "Connect with a doctor"}
              </motion.button>
            </div>
          )}

          {/* Session summary */}
          <div className="bento-card card-accent-lav" style={{ padding: 16 }}>
            <div className="section-title">Session Analytics</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, fontSize: 12 }}>
              {[
                ["Sessions", history.length],
                ["Escalations", escalations],
              ].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>{k}</span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)", fontFamily: "IBM Plex Mono" }}>{v}</span>
                </div>
              ))}
              {topMeta && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "var(--text-muted)" }}>Dominant mood</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11 }}>
                    <span style={{ fontSize: 14 }}>{topMeta.emoji}</span>
                    <span style={{ color: topMeta.color, fontWeight: 600, textTransform: "capitalize" }}>{topEmotion}</span>
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Emotion breakdown bars */}
          {Object.entries(emotionCounts).length > 0 && (
            <div className="bento-card" style={{ padding: 16 }}>
              <div className="section-title">Emotion Trend</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {Object.entries(emotionCounts).slice(0, 5).map(([emotion, count]) => {
                  const m = EMOTION_MAP[emotion] || EMOTION_MAP.neutral;
                  return (
                    <div key={emotion} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                        <span style={{ color: m.color, textTransform: "capitalize" }}>{m.emoji} {emotion}</span>
                        <span style={{ fontFamily: "IBM Plex Mono", color: "var(--text-muted)" }}>{count}</span>
                      </div>
                      <div className="meter-bar" style={{ height: 3 }}>
                        <motion.div
                          style={{ height: "100%", borderRadius: 2, background: m.color, opacity: 0.7 }}
                          initial={{ width: 0 }}
                          animate={{ width: `${(count / history.length) * 100}%` }}
                          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Privacy note */}
          <div className="bento-card" style={{ padding: 16, background: "rgba(94,234,212,0.04)", borderColor: "rgba(94,234,212,0.15)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <Shield size={14} style={{ color: "var(--teal)", flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                Conversations are encrypted end-to-end and processed with clinical-grade confidentiality. Nothing is shared.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
