import { lazy, Suspense, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  ArrowRight, Shield, Lock, Zap, Brain,
  ClipboardList, BarChart2, MessageSquare, Star,
  Activity, Smartphone, Stethoscope, CheckCircle2, ChevronRight,
  Database, RefreshCw, Cpu, Layers, Heart, Users
} from "lucide-react";

const HeroScene = lazy(() => import("../components/HeroScene"));

/* ── Reusable fade-up wrapper ── */
function FadeUp({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y: 28 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ── Interactive Risk Simulator Demo ── */
function RiskDemo() {
  const [steps, setSteps] = useState(7500);
  const [sleep, setSleep] = useState(7.5);
  const score = Math.max(10, Math.min(96, Math.round(52 + (steps - 5000) / 220 + (sleep - 6) * 4.5)));
  const status = score >= 75 ? "Optimal / Low Risk" : score >= 50 ? "Moderate / Monitor" : "Elevated Strain";
  const color = score >= 75 ? "#10B981" : score >= 50 ? "#FCD34D" : "#F43F5E";
  const r = 58, circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return (
    <div style={{
      background: "#181B19",
      borderRadius: 24,
      padding: "36px 32px",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 12px 40px rgba(0,0,0,0.4)"
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div style={{ fontSize: 11, color: "var(--citron)", fontFamily: "IBM Plex Mono", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          LIVE RISK SYNTHESIS DEMO
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#9CA3AF", fontFamily: "IBM Plex Mono" }}>
          <span className="status-dot live" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
          <span>{status}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 36, alignItems: "center" }}>
        {/* Gauge */}
        <div style={{ position: "relative", width: 140, height: 140, flexShrink: 0, margin: "0 auto" }}>
          <svg width="140" height="140" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
            <circle
              cx="70" cy="70" r={r} fill="none" stroke={color} strokeWidth="8"
              strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 0.6s cubic-bezier(0.16,1,0.3,1), stroke 0.6s ease" }}
            />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 34, fontWeight: 700, color: "#FFFFFF", fontFamily: "Inter, sans-serif", lineHeight: 1 }}>{score}</div>
            <div style={{ fontSize: 9, color: "#9CA3AF", marginTop: 4, textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "IBM Plex Mono" }}>Index / 100</div>
          </div>
        </div>

        {/* Sliders */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: "#9CA3AF" }}>Daily Steps (SensorManager)</span>
              <span style={{ color: "var(--citron)", fontFamily: "IBM Plex Mono", fontWeight: 600 }}>{steps.toLocaleString()}</span>
            </div>
            <input
              type="range" min="1000" max="15000" step="500" value={steps}
              onChange={e => setSteps(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--citron)", cursor: "pointer" }}
            />
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontSize: 13 }}>
              <span style={{ color: "#9CA3AF" }}>Sleep Duration (Health Connect)</span>
              <span style={{ color: "var(--lav)", fontFamily: "IBM Plex Mono", fontWeight: 600 }}>{sleep}h</span>
            </div>
            <input
              type="range" min="3" max="10" step="0.5" value={sleep}
              onChange={e => setSleep(Number(e.target.value))}
              style={{ width: "100%", accentColor: "var(--lav)", cursor: "pointer" }}
            />
          </div>
          <div style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.6, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 12 }}>
            Simulating client-side XGBoost weights alongside PHQ-9 item weights and chat affective valence.
          </div>
        </div>
      </div>
    </div>
  );
}

const QUOTES = [
  {
    quote: "Healthly transforms clinical depression screening from a stressful questionnaire into an integrated, longitudinal clinical picture. It gives clinicians tangible context before a session even starts.",
    name: "Dr. Aisha R.",
    role: "Clinical Psychologist & Health Systems Advisor"
  },
  {
    quote: "Seeing the direct correlation between my sleep fragmentation and low mood scores made my mental health tangible. It removed the guesswork and helped me seek support early.",
    name: "Marcus T.",
    role: "Patient & Software Engineer"
  },
  {
    quote: "The single-question breathing assessment and AI companion feel dignified and genuinely therapeutic, not cold or bureaucratic.",
    name: "Priya K.",
    role: "University Student & Wellness Advocate"
  },
];

export default function LandingPage() {
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [activeStep, setActiveStep] = useState(0);

  const stepsData = [
    {
      num: "01",
      title: "ASSESS",
      subtitle: "Guided Clinical PHQ-9 Check-ins",
      detail: "One serene question at a time with subtle breathing cadence. Built-in automatic safety protocols detect acute distress immediately and escalate to emergency resources without shame or delay.",
      badge: "Clinical Standard"
    },
    {
      num: "02",
      title: "UNDERSTAND",
      subtitle: "Multimodal AI Emotion Synthesis",
      detail: "DistilBERT analyzes emotional semantics in chat, while optional in-browser facial and voice biomarkers measure affective arousal, creating an objective picture beyond self-reporting alone.",
      badge: "Transformer AI"
    },
    {
      num: "03",
      title: "MONITOR",
      subtitle: "Continuous Sensor Telemetry",
      detail: "Passive background tracking of daily steps, sleep regularity, and digital activity via Google Fit and the native Healthly Android companion pipeline, buffered securely through SQLite/Room.",
      badge: "Passive Telemetry"
    },
    {
      num: "04",
      title: "SUPPORT",
      subtitle: "Encrypted Clinical Consultations",
      detail: "When risk metrics trend toward elevated thresholds, patients seamlessly connect with licensed professionals via peer-to-peer WebRTC video consultations with live clinical summary dossiers.",
      badge: "Encrypted WebRTC"
    }
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-light)", color: "var(--text-ink)", fontFamily: "Inter, sans-serif" }}>

      {/* ── 1. MINIMAL FLOATING PILL NAVBAR ── */}
      <div className="nav-pill-container">
        <nav className="nav-pill-shell">
          {/* Brand */}
          <Link to="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: "var(--brand)",
              display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF"
            }}>
              <Heart size={16} strokeWidth={2.5} />
            </div>
            <span style={{ fontFamily: "Fraunces, serif", fontSize: 18, fontWeight: 700, letterSpacing: "-0.03em", color: "var(--text-ink)" }}>
              Healthly
            </span>
          </Link>

          {/* Navigation Links */}
          <div style={{ display: "flex", alignItems: "center", gap: 4 }} className="hidden md:flex">
            <a href="#signals" className="nav-pill-link">Signals</a>
            <a href="#how" className="nav-pill-link">How It Works</a>
            <a href="#ai" className="nav-pill-link">AI Engine</a>
            <a href="#product" className="nav-pill-link">Product</a>
            <a href="#clinical" className="nav-pill-link">Consultants</a>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Link to="/login" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-ink-sec)", textDecoration: "none", padding: "6px 14px" }}>
              Sign In
            </Link>
            <Link to="/login" style={{ textDecoration: "none" }}>
              <button className="btn-editorial-brand" style={{ padding: "8px 18px", fontSize: 13 }}>
                Get Started <ArrowRight size={13} />
              </button>
            </Link>
          </div>
        </nav>
      </div>

      {/* ── 2. HERO SECTION (LIGHT) ── */}
      <section style={{
        position: "relative",
        minHeight: "92vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 110,
        paddingBottom: 70,
        background: "var(--bg-light)",
        overflow: "hidden"
      }}>
        {/* Subtle, restrained 3D Anatomical Visual in Background */}
        <div style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          opacity: 0.22,
          filter: "grayscale(10%) contrast(1.05)",
          pointerEvents: "none"
        }}>
          {!prefersReduced ? (
            <Suspense fallback={null}>
              <HeroScene />
            </Suspense>
          ) : null}
        </div>

        {/* Hero Editorial Content */}
        <div style={{ position: "relative", zIndex: 2, maxWidth: 940, margin: "0 auto", padding: "0 24px", textAlign: "center" }}>
          <FadeUp>
            <div className="editorial-eyebrow" style={{ marginBottom: 20 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--brand)" }} />
              AI-POWERED MENTAL WELLNESS
            </div>
          </FadeUp>

          <FadeUp delay={0.1}>
            <h1 className="editorial-heading-huge" style={{ margin: "0 0 24px" }}>
              Understand your wellbeing before it becomes a crisis.
            </h1>
          </FadeUp>

          <FadeUp delay={0.2}>
            <p className="editorial-lead" style={{ maxWidth: 660, margin: "0 auto 36px" }}>
              Healthly synthesizes clinical PHQ-9 assessments, continuous lifestyle sensors, AI emotion analysis, and licensed therapist support into one calm, objective picture of your mental health.
            </p>
          </FadeUp>

          <FadeUp delay={0.3}>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
              <Link to="/login" style={{ textDecoration: "none" }}>
                <button className="btn-editorial-brand">
                  Explore Healthly <ArrowRight size={15} />
                </button>
              </Link>
              <a href="#how" style={{ textDecoration: "none" }}>
                <button className="btn-editorial-outline">
                  See How It Works
                </button>
              </a>
            </div>
          </FadeUp>
        </div>
      </section>

      {/* ── 3. TRUST / SIGNAL STRIP (LIGHT) ── */}
      <div style={{ borderTop: "1px solid var(--border-light)", borderBottom: "1px solid var(--border-light)", background: "var(--surface-white)", padding: "24px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 16,
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.12em",
            color: "var(--text-ink-sec)",
            textTransform: "uppercase"
          }}>
            <span>PHQ-9 CLINICAL PROTOCOL</span>
            <span style={{ color: "var(--border-light)" }}>/</span>
            <span>EMOTION AI (DISTILBERT)</span>
            <span style={{ color: "var(--border-light)" }}>/</span>
            <span>BEHAVIORAL SENSORS</span>
            <span style={{ color: "var(--border-light)" }}>/</span>
            <span>GOOGLE FIT &amp; HEALTH CONNECT</span>
            <span style={{ color: "var(--border-light)" }}>/</span>
            <span>LICENSED CONSULTANT TELEHEALTH</span>
          </div>
        </div>
      </div>

      {/* ── 4. THE CORE IDEA (LIGHT BACKGROUND) ── */}
      <section id="signals" style={{ padding: "110px 24px", maxWidth: 1140, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "flex-start" }}>
          <div>
            <div className="editorial-eyebrow" style={{ marginBottom: 16 }}>THE CORE THESIS</div>
            <h2 className="editorial-heading-lg" style={{ marginBottom: 24 }}>
              Mental wellness isn't one signal.
            </h2>
            <p className="editorial-lead" style={{ marginBottom: 28 }}>
              Traditional mental health relies on sporadic self-reporting after symptoms have already intensified. By the time someone fills out a paper clinic form, weeks of warning signs have slipped by unaddressed.
            </p>
            <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--text-ink-sec)" }}>
              Healthly approaches psychological wellbeing as a dynamic, multimodal system. By continuously weaving together clinical instruments, linguistic semantics, and physiological rhythms, we construct a reliable baseline that surfaces subtle shifts early.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {[
              { label: "Clinical Assessment", desc: "Gold-standard PHQ-9 depression screening with gentle pacing.", icon: ClipboardList, tag: "Diagnostic Baseline" },
              { label: "Affective Conversation", desc: "DistilBERT semantic extraction on journal & chat interactions.", icon: MessageSquare, tag: "Linguistic Semantics" },
              { label: "Behavioral Rhythms", desc: "Screen time, unlock counts, and sleep fragmentation tracking.", icon: Smartphone, tag: "Passive Telemetry" },
              { label: "Physiological Context", desc: "Resting heart rate, steps, and activity via Health Connect.", icon: Activity, tag: "Physiological Sync" },
              { label: "Professional Escalation", desc: "Instant clinical handoff to consultants via encrypted WebRTC.", icon: Stethoscope, tag: "Telehealth Bridge" }
            ].map((item, idx) => (
              <div key={item.label} className="card-editorial-light" style={{ padding: 22, display: "flex", alignItems: "flex-start", gap: 18 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12, background: "var(--brand-dim)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)", flexShrink: 0
                }}>
                  <item.icon size={19} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-ink)" }}>{item.label}</div>
                    <span style={{ fontSize: 10, fontFamily: "IBM Plex Mono", color: "var(--brand)", background: "var(--brand-light)", padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>
                      {item.tag}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-ink-sec)", lineHeight: 1.6 }}>{item.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 5. NUMBER / PROOF SECTION (DARK SECTION #111312) ── */}
      <section style={{ background: "var(--bg-dark-section)", color: "#FFFFFF", padding: "120px 24px" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <FadeUp>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 70, flexWrap: "wrap", gap: 20 }}>
              <div>
                <div className="editorial-eyebrow dark" style={{ marginBottom: 16 }}>SYSTEM ARCHITECTURE</div>
                <h2 className="editorial-heading-lg dark" style={{ margin: 0 }}>
                  Built for precision. Designed for calm.
                </h2>
              </div>
              <p style={{ maxWidth: 440, fontSize: 15, color: "#9CA3AF", lineHeight: 1.7, margin: 0 }}>
                Every data stream in Healthly is handled with strict medical rigor, patient agency, and minimal cognitive friction.
              </p>
            </div>
          </FadeUp>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 28 }}>
            {[
              {
                num: "01",
                title: "Structured Assessment",
                detail: "PHQ-9 questionnaire presented one prompt at a time. Evaluated by rule-based and XGBoost classifiers."
              },
              {
                num: "02",
                title: "Emotion Analysis",
                detail: "DistilBERT and BioClinicalBERT classify emotional valence, linguistic despair, and sentiment markers."
              },
              {
                num: "03",
                title: "Behavioral Signals",
                detail: "Native Android background services synchronize step counts, mobility intervals, and sleep consistency."
              },
              {
                num: "04",
                title: "Professional Support",
                detail: "Encrypted peer-to-peer WebRTC consultations with complete clinical historical dossiers."
              }
            ].map((card, i) => (
              <FadeUp key={card.num} delay={i * 0.1}>
                <div className="card-editorial-dark" style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div className="editorial-num dark" style={{ marginBottom: 24 }}>{card.num}</div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: "#FFFFFF", marginBottom: 12, letterSpacing: "-0.02em" }}>
                      {card.title}
                    </div>
                    <div style={{ fontSize: 14, color: "#9CA3AF", lineHeight: 1.75 }}>
                      {card.detail}
                    </div>
                  </div>
                </div>
              </FadeUp>
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. HOW HEALTHLY WORKS (LIGHT BACKGROUND) ── */}
      <section id="how" style={{ padding: "120px 24px", maxWidth: 1140, margin: "0 auto" }}>
        <FadeUp>
          <div style={{ marginBottom: 60 }}>
            <div className="editorial-eyebrow" style={{ marginBottom: 16 }}>WORKFLOW</div>
            <h2 className="editorial-heading-lg">
              Four deliberate phases to clinical clarity.
            </h2>
          </div>
        </FadeUp>

        <div style={{ borderTop: "1px solid var(--border-light)" }}>
          {stepsData.map((step, idx) => {
            const isSelected = activeStep === idx;
            return (
              <div
                key={step.num}
                className="editorial-step-row"
                style={{ cursor: "pointer", background: isSelected ? "rgba(29,107,95,0.03)" : "transparent" }}
                onClick={() => setActiveStep(idx)}
              >
                <div className="editorial-num" style={{ fontSize: "2.4rem", color: isSelected ? "var(--brand)" : "var(--text-ink-sec)" }}>
                  {step.num}
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 11, fontFamily: "IBM Plex Mono", color: "var(--brand)", letterSpacing: "0.1em" }}>{step.title}</span>
                    <span style={{ fontSize: 10, background: "var(--border-light)", padding: "1px 6px", borderRadius: 3, color: "var(--text-ink-sec)" }}>{step.badge}</span>
                  </div>
                  <div style={{ fontSize: 19, fontWeight: 700, marginTop: 4, letterSpacing: "-0.02em", color: "var(--text-ink)" }}>
                    {step.subtitle}
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <p style={{ fontSize: 14, color: "var(--text-ink-sec)", lineHeight: 1.75, margin: 0, maxWidth: 480 }}>
                    {step.detail}
                  </p>
                  <ChevronRight size={18} style={{ color: isSelected ? "var(--brand)" : "var(--border-light)", transition: "transform 0.2s", transform: isSelected ? "rotate(90deg)" : "none" }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── 7. AI ENGINE & INTERACTIVE DEMO (DARK SECTION #111312) ── */}
      <section id="ai" style={{ background: "var(--bg-dark-section)", color: "#FFFFFF", padding: "120px 24px" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
            <div>
              <div className="editorial-eyebrow dark" style={{ marginBottom: 16 }}>THE AI ENGINE</div>
              <h2 className="editorial-heading-lg dark" style={{ marginBottom: 24 }}>
                Transparent feature fusion, not a black box.
              </h2>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: "#9CA3AF", marginBottom: 32 }}>
                Under the hood, Healthly combines specialized models tailored to each modality:
              </p>

              {/* Technical Pipeline Breakdown */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 32 }}>
                {[
                  { step: "DistilBERT", label: "Semantic Sentiment Classifier", desc: "Tokenizes chat messages to isolate affective distress, cognitive distortion, and valence." },
                  { step: "BioClinicalBERT", label: "Medical Text Parser", desc: "Extracts clinical terminology from health record uploads and consultation summaries." },
                  { step: "XGBoost", label: "Ensemble Risk Stratification", desc: "Fuses PHQ-9 item weights with wearable telemetry into a 0–100 Unified Wellness Index." }
                ].map((item) => (
                  <div key={item.step} style={{ padding: "16px 20px", borderRadius: 12, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, fontFamily: "IBM Plex Mono", color: "var(--citron)" }}>{item.step}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#FFFFFF" }}>— {item.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Live Interactive Simulator Demo */}
            <div>
              <RiskDemo />
            </div>
          </div>
        </div>
      </section>

      {/* ── 8. PRODUCT EXPERIENCE (LIGHT BACKGROUND) ── */}
      <section id="product" style={{ padding: "120px 24px", maxWidth: 1140, margin: "0 auto" }}>
        <FadeUp>
          <div style={{ textAlign: "center", maxWidth: 680, margin: "0 auto 60px" }}>
            <div className="editorial-eyebrow" style={{ marginBottom: 16 }}>PRODUCT EXPERIENCE</div>
            <h2 className="editorial-heading-lg" style={{ marginBottom: 16 }}>
              A calm command center for your wellbeing.
            </h2>
            <p className="editorial-lead">
              No cluttered graphs or overwhelming alarms. Just clean, actionable insights presented in generous whitespace.
            </p>
          </div>
        </FadeUp>

        {/* Premium Product Preview Frame of the Healthly Dashboard */}
        <FadeUp delay={0.15}>
          <div style={{
            background: "var(--surface-white)",
            border: "1px solid var(--border-light)",
            borderRadius: 28,
            padding: "36px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.06)",
            overflow: "hidden"
          }}>
            {/* Mock Dashboard Topbar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-light)", paddingBottom: 20, marginBottom: 32 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#10B981" }} />
                <span style={{ fontFamily: "IBM Plex Mono", fontSize: 12, color: "var(--text-ink-sec)" }}>
                  PATIENT PORTAL · LIVE WEARABLE SYNC ACTIVE
                </span>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 11, fontFamily: "IBM Plex Mono", background: "var(--bg-light)", padding: "4px 10px", borderRadius: 6, color: "var(--text-ink)" }}>
                  LAST SYNC: JUST NOW
                </span>
              </div>
            </div>

            {/* Mock Dashboard Bento Layout */}
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr", gap: 24 }}>
              {/* Primary Gauge Mock */}
              <div style={{ background: "var(--bg-light)", borderRadius: 20, padding: 28, border: "1px solid var(--border-light)" }}>
                <div style={{ fontSize: 11, fontFamily: "IBM Plex Mono", color: "var(--text-ink-sec)", letterSpacing: "0.08em" }}>UNIFIED WELLNESS INDEX</div>
                <div style={{ display: "flex", alignItems: "center", gap: 24, marginTop: 20 }}>
                  <div style={{ fontSize: 56, fontWeight: 700, fontFamily: "Fraunces, serif", color: "var(--brand)", lineHeight: 1 }}>78</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>Minimal Risk</div>
                    <div style={{ fontSize: 12, color: "var(--text-ink-sec)", marginTop: 2 }}>Trending +4% vs last week</div>
                  </div>
                </div>
                <div style={{ marginTop: 24, fontSize: 12, color: "var(--text-ink-sec)", lineHeight: 1.6, borderTop: "1px solid var(--border-light)", paddingTop: 16 }}>
                  Optimal sleep continuity (7.8h) buffered recent academic workload stress.
                </div>
              </div>

              {/* Modality Metrics */}
              <div style={{ background: "var(--bg-light)", borderRadius: 20, padding: 28, border: "1px solid var(--border-light)" }}>
                <div style={{ fontSize: 11, fontFamily: "IBM Plex Mono", color: "var(--text-ink-sec)", letterSpacing: "0.08em" }}>PHYSIOLOGICAL CONTEXT</div>
                <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 14 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--text-ink-sec)" }}>Daily Movement</span>
                      <span style={{ fontWeight: 600, fontFamily: "IBM Plex Mono" }}>8,420 steps</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "var(--border-light)", overflow: "hidden" }}>
                      <div style={{ width: "75%", height: "100%", background: "var(--brand)" }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                      <span style={{ color: "var(--text-ink-sec)" }}>Resting HR</span>
                      <span style={{ fontWeight: 600, fontFamily: "IBM Plex Mono" }}>64 bpm (Calm)</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "var(--border-light)", overflow: "hidden" }}>
                      <div style={{ width: "65%", height: "100%", background: "#10B981" }} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Assessment Status */}
              <div style={{ background: "var(--bg-light)", borderRadius: 20, padding: 28, border: "1px solid var(--border-light)" }}>
                <div style={{ fontSize: 11, fontFamily: "IBM Plex Mono", color: "var(--text-ink-sec)", letterSpacing: "0.08em" }}>CLINICAL ASSESSMENTS</div>
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: "var(--text-ink)", fontFamily: "Fraunces, serif" }}>PHQ-9: 4 / 27</div>
                  <div style={{ fontSize: 12, color: "#10B981", fontWeight: 600, marginTop: 4 }}>Minimal Depression</div>
                  <div style={{ marginTop: 20, fontSize: 11, color: "var(--text-ink-sec)", fontFamily: "IBM Plex Mono" }}>
                    Next scheduled evaluation in 12 days.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </FadeUp>
      </section>

      {/* ── 9. MOBILE COMPANION ARCHITECTURE (LIGHT SECONDARY #EEF1EC) ── */}
      <section style={{ background: "var(--bg-light-sec)", padding: "110px 24px", borderTop: "1px solid var(--border-light)", borderBottom: "1px solid var(--border-light)" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 56px" }}>
            <div className="editorial-eyebrow" style={{ marginBottom: 16 }}>MOBILE PIPELINE</div>
            <h2 className="editorial-heading-lg" style={{ marginBottom: 16 }}>
              Native Android telemetry, zero battery drain.
            </h2>
            <p className="editorial-lead">
              Our native Android companion app buffers sensor data offline and securely synchronizes with the Healthly cloud backend.
            </p>
          </div>

          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: 16,
            alignItems: "center"
          }}>
            {[
              { icon: Smartphone, title: "Android Sensors", sub: "SensorManager & GPS", tech: "Hardware Step & Light" },
              { icon: Database, title: "Encrypted Room DB", sub: "Local SQLite Buffering", tech: "Zero Data Loss Offline" },
              { icon: RefreshCw, title: "Sync Queue", sub: "Exponential Backoff", tech: "WorkManager Lifecycle" },
              { icon: Cpu, title: "FastAPI Backend", sub: "Multimodal Fusion Engine", tech: "Async Python 3.12" },
              { icon: BarChart2, title: "Web Dashboard", sub: "Real-time Telemetry UI", tech: "WebSocket + React 19" }
            ].map((node, i) => (
              <div key={node.title} className="card-editorial-light" style={{ padding: 24, textAlign: "center", position: "relative" }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 14, background: "var(--brand-dim)",
                  display: "flex", alignItems: "center", justifyContent: "center", color: "var(--brand)", margin: "0 auto 16px"
                }}>
                  <node.icon size={20} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-ink)", marginBottom: 4 }}>{node.title}</div>
                <div style={{ fontSize: 12, color: "var(--text-ink-sec)", marginBottom: 10 }}>{node.sub}</div>
                <div style={{ fontSize: 10, fontFamily: "IBM Plex Mono", color: "var(--brand)", background: "var(--brand-light)", padding: "2px 6px", borderRadius: 4, display: "inline-block" }}>
                  {node.tech}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 10. PROFESSIONAL SUPPORT & TELEHEALTH (LIGHT SECTION) ── */}
      <section id="clinical" style={{ padding: "120px 24px", maxWidth: 1140, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }}>
          <div>
            <div className="editorial-eyebrow" style={{ marginBottom: 16 }}>CLINICAL CARE</div>
            <h2 className="editorial-heading-lg" style={{ marginBottom: 24 }}>
              Humans in the loop. Verified clinicians by your side.
            </h2>
            <p className="editorial-lead" style={{ marginBottom: 28 }}>
              AI never diagnoses alone. When wellness indicators show prolonged distress, Healthly connects patients directly to verified clinical psychologists and licensed therapists.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                "Clinician triage queue sorted by real-time risk severity.",
                "Longitudinal sensor graphs ready prior to each consultation.",
                "End-to-end encrypted WebRTC 1:1 video rooms with zero recording.",
                "Clinical consultation notes filed securely to patient health records."
              ].map((point, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: "var(--text-ink-sec)" }}>
                  <CheckCircle2 size={18} style={{ color: "var(--brand)", flexShrink: 0 }} />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-editorial-light" style={{ padding: 36 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 24 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 14, background: "var(--brand)",
                display: "flex", alignItems: "center", justifyContent: "center", color: "#FFFFFF"
              }}>
                <Stethoscope size={22} />
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-ink)" }}>Consultant Workspace</div>
                <div style={{ fontSize: 12, color: "var(--text-ink-sec)", fontFamily: "IBM Plex Mono" }}>Triage &amp; Telehealth Suite</div>
              </div>
            </div>
            <div style={{ background: "var(--bg-light)", borderRadius: 14, padding: 18, border: "1px solid var(--border-light)", marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "var(--text-ink-sec)" }}>
                <span>Patient Queue</span>
                <span style={{ color: "#F43F5E", fontWeight: 700, fontFamily: "IBM Plex Mono" }}>1 High Priority</span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, marginTop: 8, color: "var(--text-ink)" }}>
                Sarah M. · PHQ-9 Score: 18 (Severe)
              </div>
              <div style={{ fontSize: 12, color: "var(--text-ink-sec)", marginTop: 4 }}>
                Sleep fragmentation flagged for 4 consecutive nights.
              </div>
            </div>
            <Link to="/login" style={{ textDecoration: "none" }}>
              <button className="btn-editorial-brand" style={{ width: "100%", justifyContent: "center" }}>
                Consultant Portal Login <ArrowRight size={14} />
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── 11. SECURITY BUILT AROUND TRUST (DARK SECTION #111312) ── */}
      <section style={{ background: "var(--bg-dark-section)", color: "#FFFFFF", padding: "100px 24px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        <div style={{ maxWidth: 1140, margin: "0 auto" }}>
          <FadeUp>
            <div style={{ textAlign: "center", maxWidth: 640, margin: "0 auto 60px" }}>
              <div className="editorial-eyebrow dark" style={{ marginBottom: 16 }}>SECURITY &amp; PRIVACY</div>
              <h2 className="editorial-heading-lg dark" style={{ marginBottom: 16 }}>
                Built around absolute trust.
              </h2>
              <p style={{ color: "#9CA3AF", fontSize: 15, lineHeight: 1.75 }}>
                Mental health telemetry is sensitive personal data. We engineer for privacy at the protocol layer.
              </p>
            </div>
          </FadeUp>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 20 }}>
            {[
              { title: "JWT & RBAC", desc: "Granular role-based access ensuring patient data is never cross-visible." },
              { title: "Zero Video Recording", desc: "WebRTC peer-to-peer streams are ephemeral and never recorded to disk." },
              { title: "Client-Side Diagnostics", desc: "Facial expression CNN inference executes client-side in the browser." },
              { title: "Encrypted Storage", desc: "All longitudinal records are secured with AES-256 encryption at rest." },
            ].map((item) => (
              <div key={item.title} style={{ padding: 24, borderRadius: 16, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <Lock size={18} style={{ color: "var(--citron)", marginBottom: 12 }} />
                <div style={{ fontSize: 15, fontWeight: 700, color: "#FFFFFF", marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.6 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 12. TESTIMONIALS (LIGHT SECTION) ── */}
      <section style={{ padding: "120px 24px", maxWidth: 1140, margin: "0 auto" }}>
        <FadeUp>
          <div style={{ marginBottom: 60 }}>
            <div className="editorial-eyebrow" style={{ marginBottom: 16 }}>PERSPECTIVES</div>
            <h2 className="editorial-heading-lg">
              Trusted by clinicians and individuals alike.
            </h2>
          </div>
        </FadeUp>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
          {QUOTES.map((q) => (
            <div key={q.name} className="card-editorial-light" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <div style={{ display: "flex", gap: 2, marginBottom: 20 }}>
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} size={14} fill="#FCD34D" color="#FCD34D" />
                  ))}
                </div>
                <p style={{ fontFamily: "Fraunces, serif", fontSize: 17, lineHeight: 1.6, color: "var(--text-ink)", fontStyle: "italic", marginBottom: 24 }}>
                  "{q.quote}"
                </p>
              </div>
              <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-ink)" }}>{q.name}</div>
                <div style={{ fontSize: 12, color: "var(--text-ink-sec)", marginTop: 2 }}>{q.role}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 13. FINAL CTA & FOOTER (DARK SECTION #111312) ── */}
      <section style={{ background: "var(--bg-dark-section)", color: "#FFFFFF", padding: "120px 24px 60px", textAlign: "center" }}>
        <FadeUp>
          <div style={{ maxWidth: 620, margin: "0 auto" }}>
            <div className="editorial-eyebrow dark" style={{ marginBottom: 20 }}>START TODAY</div>
            <h2 className="editorial-heading-huge dark" style={{ marginBottom: 20 }}>
              Your wellbeing is more than a number.
            </h2>
            <p style={{ color: "#9CA3AF", fontSize: 16, lineHeight: 1.75, marginBottom: 40 }}>
              Take your first calm step toward longitudinal psychological self-awareness. No complex setup, no judgment.
            </p>
            <Link to="/login" style={{ textDecoration: "none" }}>
              <button className="btn-editorial-citron" style={{ fontSize: 15, padding: "14px 34px" }}>
                Get Started with Healthly <ArrowRight size={16} />
              </button>
            </Link>
          </div>
        </FadeUp>

        {/* Minimalist Footer */}
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", marginTop: 100, paddingTop: 32, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Heart size={16} style={{ color: "var(--citron)" }} />
            <span style={{ fontFamily: "Fraunces, serif", fontSize: 16, fontWeight: 700, color: "#FFFFFF" }}>Healthly</span>
            <span style={{ fontSize: 11, color: "#6B7280", fontFamily: "IBM Plex Mono", marginLeft: 8 }}>v2.0 · Clinical Edition</span>
          </div>
          <div style={{ display: "flex", gap: 24, fontSize: 12, color: "#9CA3AF" }}>
            <span style={{ cursor: "pointer" }}>Privacy Policy</span>
            <span style={{ cursor: "pointer" }}>Terms of Service</span>
            <span style={{ cursor: "pointer" }}>Clinical Evidence</span>
            <span style={{ cursor: "pointer" }}>HIPAA Attestation</span>
          </div>
          <div style={{ fontSize: 11, color: "#6B7280", fontFamily: "IBM Plex Mono" }}>
            © 2026 Healthly Inc. All rights reserved.
          </div>
        </div>
      </section>

    </div>
  );
}

