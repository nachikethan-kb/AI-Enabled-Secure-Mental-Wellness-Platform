import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Zap, AlertTriangle, ShieldCheck, Heart } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

const QUESTIONS = [
  "Little interest or pleasure in doing things",
  "Feeling down, depressed, or hopeless",
  "Trouble falling or staying asleep, or sleeping too much",
  "Feeling tired or having little energy",
  "Poor appetite or overeating",
  "Feeling bad about yourself — or that you are a failure",
  "Trouble concentrating on things",
  "Moving or speaking slowly, or being very restless",
  "Thoughts that you would be better off dead, or of hurting yourself",
];

const LABELS = [
  { label: "Not at all",            sub: "0 days in the past 2 weeks" },
  { label: "Several days",          sub: "1–6 days" },
  { label: "More than half the days", sub: "7–11 days" },
  { label: "Nearly every day",      sub: "12–14 days" },
];

const OPTION_COLORS = ["#10B981", "#5EEAD4", "#FCD34D", "#A78BFA"];

const slideVariants = {
  enter: (dir) => ({ opacity: 0, y: dir > 0 ? 20 : -20 }),
  center: { opacity: 1, y: 0 },
  exit:  (dir) => ({ opacity: 0, y: dir > 0 ? -20 : 20 }),
};

export default function AssessmentPage() {
  const navigate = useNavigate();
  const [answers, setAnswers] = useState(Array(9).fill(null));
  const [current, setCurrent] = useState(0);
  const [dir, setDir] = useState(1);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const answered = useMemo(() => answers.filter(a => a !== null).length, [answers]);
  const progress  = (current / (QUESTIONS.length - 1)) * 100;
  const isLast    = current === QUESTIONS.length - 1;

  const goTo = (next) => {
    setDir(next > current ? 1 : -1);
    setCurrent(next);
  };

  const update = (val) => {
    const next = [...answers];
    next[current] = val;
    setAnswers(next);
  };

  const submit = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      const data = await api.submitPHQ9(answers);
      sessionStorage.setItem("latest_result", JSON.stringify(data));
      localStorage.setItem("latest_result", JSON.stringify(data));
      navigate("/results", { state: { result: data } });
    } catch (e) {
      setError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isQuestion9Positive = current === 8 && answers[8] !== null && answers[8] > 0;

  return (
    <div style={{ maxWidth: 740, margin: "0 auto", display: "flex", flexDirection: "column", gap: 36, padding: "20px 0 60px" }}>

      {/* Header */}
      <div style={{ textAlign: "center", borderBottom: "1px solid var(--bg-border)", paddingBottom: 28 }}>
        <div className="editorial-eyebrow dark" style={{ marginBottom: 12 }}>
          CLINICAL QUESTIONNAIRE · DSM-V PROTOCOL
        </div>
        <h1 className="page-title font-display" style={{ fontSize: "clamp(2rem, 3.2vw, 2.6rem)", fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          PHQ-9 Depression Screening
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 8, maxWidth: 540, margin: "8px auto 0" }}>
          Reflect calmly on your emotional baseline over the last 2 weeks. One prompt at a time.
        </p>
      </div>

      {/* Progress & Stepper Bar */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontFamily: "IBM Plex Mono", color: "var(--text-muted)" }}>
          <span>ITEM {current + 1} OF {QUESTIONS.length}</span>
          <span>{answered} OF {QUESTIONS.length} COMPLETED</span>
        </div>
        <div className="breath-line">
          <motion.div
            className="breath-line-fill"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          />
        </div>
      </div>

      {/* Question Card with AnimatePresence */}
      <div style={{ position: "relative" }}>
        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={current}
            custom={dir}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="bento-card" style={{ padding: "40px 36px", display: "flex", flexDirection: "column", gap: 32, border: "1px solid var(--bg-border)" }}>
              {/* Question Text */}
              <div>
                <div style={{ fontSize: 11, color: "var(--citron)", fontFamily: "IBM Plex Mono", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>
                  OVER THE LAST 2 WEEKS, HOW OFTEN HAVE YOU BEEN BOTHERED BY:
                </div>
                <div style={{ fontFamily: "Fraunces, serif", fontSize: "clamp(1.4rem, 2.4vw, 1.85rem)", fontWeight: 600, lineHeight: 1.35, color: "var(--text-primary)", letterSpacing: "-0.03em" }}>
                  "{QUESTIONS[current]}"
                </div>
              </div>

              {/* Crisis Intervention Alert on Question 9 */}
              {isQuestion9Positive && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                  style={{
                    padding: "16px 20px", borderRadius: 12, background: "rgba(244, 63, 94, 0.12)",
                    border: "1px solid rgba(244, 63, 94, 0.3)", display: "flex", alignItems: "flex-start", gap: 14
                  }}
                >
                  <Heart size={20} style={{ color: "#F43F5E", flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#FDA4AF" }}>Support is available right now.</div>
                    <div style={{ fontSize: 12, color: "var(--text-primary)", marginTop: 2, lineHeight: 1.6 }}>
                      If you are feeling overwhelmed, you are never alone. Free, confidential support is available 24/7 by dialing or texting <strong>988</strong> (Suicide &amp; Crisis Lifeline).
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Answer options */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {LABELS.map(({ label, sub }, score) => {
                  const selected = answers[current] === score;
                  const color = OPTION_COLORS[score];
                  return (
                    <motion.button
                      key={score}
                      onClick={() => update(score)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      transition={{ duration: 0.3 }}
                      className={`answer-option ${selected ? "selected" : ""}`}
                      style={{
                        padding: "18px 24px",
                        border: selected ? `1.5px solid ${color}` : "1px solid var(--bg-border)",
                        background: selected ? "rgba(29, 107, 95, 0.14)" : "var(--bg-elevated)",
                        display: "flex", alignItems: "center", gap: 16
                      }}
                    >
                      {/* Custom radio circle */}
                      <div style={{
                        width: 20, height: 20, borderRadius: "50%", flexShrink: 0,
                        border: `2px solid ${selected ? color : "var(--bg-border-h)"}`,
                        background: selected ? `${color}25` : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        {selected && (
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                        )}
                      </div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontSize: 15, fontWeight: selected ? 600 : 500, color: selected ? "var(--text-primary)" : "var(--text-secondary)" }}>
                          {label}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>
                      </div>
                      {selected && <CheckCircle2 size={18} style={{ color, flexShrink: 0 }} />}
                    </motion.button>
                  );
                })}
              </div>

              {/* Navigation */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 16, borderTop: "1px solid var(--bg-border)" }}>
                <button
                  className="btn btn-secondary btn-sm"
                  disabled={current === 0}
                  onClick={() => goTo(current - 1)}
                  style={{ opacity: current === 0 ? 0.3 : 1 }}
                >
                  <ArrowLeft size={13} /> Back
                </button>

                {!isLast ? (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={answers[current] === null}
                    onClick={() => goTo(current + 1)}
                    style={{ background: "var(--brand)", color: "#FFFFFF", borderColor: "transparent", opacity: answers[current] === null ? 0.4 : 1 }}
                  >
                    Next Prompt <ArrowRight size={13} />
                  </button>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={answered !== 9 || isSubmitting}
                    onClick={submit}
                    style={{ background: "var(--citron)", color: "#151716", borderColor: "transparent", fontWeight: 700 }}
                  >
                    {isSubmitting ? "Synthesizing..." : "Complete & Stratify Risk"} <Zap size={13} />
                  </button>
                )}
              </div>

              {error && (
                <div className="alert alert-warn">
                  <AlertTriangle size={13} /> <span>{error}</span>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Trust & Privacy Notice */}
      <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <ShieldCheck size={14} style={{ color: "var(--emerald)" }} />
        <span>Client-side encryption. Results are used solely to establish your longitudinal wellness baseline.</span>
      </div>

    </div>
  );
}

