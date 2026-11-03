"""End-to-end test for ALL implemented ML models across all 4 modes.

Tests: DistilBERT, XGBoost, LSTM mental state, BioClinicalBERT NER,
       Trained SensorBiLSTM, Trained DeepFace CNN, Trained Wav2Vec2 CNN,
       Chat DistilBERT Tracker, Central Attention Fusion Engine,
       Safety Agent, Bias Detection, SHAP/LIME Explainability.
"""
import sys

SEP = "=" * 72

print(SEP)
print("  HEALTHLY COMPLETE ML PIPELINE VERIFICATION")
print("  Testing every model mentioned in the architecture")
print(SEP, flush=True)

passed = 0
failed = 0

def check(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  [PASS] {name}" + (f" -- {detail}" if detail else ""), flush=True)
    else:
        failed += 1
        print(f"  [FAIL] {name}" + (f" -- {detail}" if detail else ""), flush=True)


# ── MODE 1: DistilBERT Emotion ──
print(f"\n--- MODE 1: PHQ-9 TEXT ANALYSIS ---", flush=True)

print("  Loading DistilBERT emotion classifier...", flush=True)
from app.services.emotion_classifier import analyze_emotion
emotion, conf = analyze_emotion("I feel very sad and hopeless about everything")
check("DistilBERT emotion inference", emotion != "" and conf > 0, f"emotion={emotion}, conf={conf:.4f}")

# ── MODE 1: XGBoost Risk ──
print("  Loading XGBoost risk classifier...", flush=True)
from app.services.risk_classifier import classify_assessment_risk
risk = classify_assessment_risk([3,2,3,2,1,3,2,2,1], 19)
check("XGBoost risk prediction", risk.probability > 0, f"prob={risk.probability:.4f}, tier={risk.tier}, source={risk.model_source}")

# ── MODE 1: LSTM Mental State ──
print("  Loading LSTM mental state model...", flush=True)
from app.services.mental_state_classifier import analyze_mental_state
ms = analyze_mental_state([3,2,3,2,1,3,2,2,1])
check("LSTM mental state prediction", ms.label != "", f"state={ms.label}, conf={ms.confidence:.4f}")

# ── MODE 1: Agentic AI Orchestrator ──
print("  Running Agentic AI Orchestrator...", flush=True)
from app.services.phq9_emotion_agent import analyze_phq9_emotions
agent_result = analyze_phq9_emotions([3,2,3,2,1,3,2,2,1])
check("Agentic Orchestrator fusion", agent_result.dominant_emotion != "", f"emotion={agent_result.dominant_emotion}, conf={agent_result.confidence:.4f}")
check("Agent specialist votes", len(agent_result.rationale) > 0, f"version={agent_result.agent_version}")
check("Safety agent risk flags", isinstance(agent_result.risk_flags, list), f"flags={agent_result.risk_flags}")

# ── MODE 2: BioClinicalBERT NER ──
print(f"\n--- MODE 2: MEDICAL RECORD ANALYSIS ---", flush=True)

from app.services.bioclinicalbert import bioclinical_analyzer
clinical_text = (
    "Patient has a history of Major Depressive Disorder and GAD. "
    "Currently on Sertraline 100mg and Alprazolam 0.5mg PRN. "
    "Previous hospitalization for acute depressive episode. "
    "History of suicidal ideation in 2023."
)
bio_result = bioclinical_analyzer.analyze_record(clinical_text)
check("BioClinicalBERT diagnosis extraction", len(bio_result.diagnoses) >= 2, f"diagnoses={bio_result.diagnoses}")
check("BioClinicalBERT medication detection", len(bio_result.medications) >= 2, f"meds={bio_result.medications}")
check("BioClinicalBERT risk signals", len(bio_result.risk_signals) >= 1, f"risks={bio_result.risk_signals}")
check("BioClinicalBERT ICD-10 codes", any(e.icd_code for e in bio_result.entities), f"entities={len(bio_result.entities)}")
check("Clinical vulnerability score", bio_result.history_risk_score > 0, f"score={bio_result.history_risk_score:.4f}")

# ── MODE 3: Trained SensorBiLSTM ──
print(f"\n--- MODE 3: SENSOR & WEARABLE ANALYSIS ---", flush=True)

from app.services.wearable_lstm import wearable_lstm_analyzer
sensor = wearable_lstm_analyzer.analyze(heart_rate=95.0, hrv=28.0, sleep_hours=4.0, steps=600.0)
check("SensorBiLSTM stress inference", sensor.stress_index > 0, f"stress={sensor.stress_index:.4f}, source={sensor.model_source}")
check("Statistical anomaly detection", len(sensor.anomaly_flags) >= 1, f"anomalies={sensor.anomaly_flags}")
check("Physiological risk rating", sensor.physiological_risk in ["Low", "Medium", "High"], f"risk={sensor.physiological_risk}")
check("Model uses trained weights", sensor.model_source == "trained_bilstm", f"source={sensor.model_source}")

# Test low-stress profile too
sensor_low = wearable_lstm_analyzer.analyze(heart_rate=65.0, hrv=68.0, sleep_hours=8.0, steps=9000.0)
check("BiLSTM low-stress profile", sensor_low.stress_index < 0.5, f"stress={sensor_low.stress_index:.4f}")

# ── MODE 4A: Chat Sentiment Tracker ──
print(f"\n--- MODE 4A: CHAT ANALYSIS ---", flush=True)

from app.services.chat_sentiment import chat_sentiment_tracker
chat = chat_sentiment_tracker.analyze_conversation([
    "I've been feeling really down lately",
    "Nothing seems to matter anymore",
    "I feel so lonely and hopeless",
    "Maybe things will never get better",
    "I don't know what to do"
])
check("Chat DistilBERT analysis", chat.messages_analyzed == 5, f"analyzed={chat.messages_analyzed}")
check("Chat dominant emotion", chat.dominant_emotion != "", f"emotion={chat.dominant_emotion}")
check("Chat sentiment tracking", isinstance(chat.average_sentiment, float), f"avg_sentiment={chat.average_sentiment:.4f}")
check("Emotional drift detection", isinstance(chat.emotional_drift, float), f"drift={chat.emotional_drift:.4f}")
check("Hopelessness scoring", chat.hopelessness_score > 0, f"hopelessness={chat.hopelessness_score:.4f}")
check("Conversational risk classification", chat.conversational_risk in ["Low", "Medium", "High"], f"risk={chat.conversational_risk}")

# ── MODE 4B: Trained DeepFace CNN ──
print(f"\n--- MODE 4B: VIDEO & SPEECH ANALYSIS ---", flush=True)

from app.services.media_analyzers import deepface_service, wav2vec2_service
face = deepface_service.analyze_expression("sad")
check("DeepFace CNN inference", face.dominant_expression != "", f"expr={face.dominant_expression}, conf={face.confidence:.4f}")
check("DeepFace valence output", isinstance(face.facial_valence, float), f"valence={face.facial_valence:.2f}")
check("DeepFace arousal output", isinstance(face.facial_arousal, float), f"arousal={face.facial_arousal:.2f}")
check("DeepFace uses trained model", face.model_source == "trained_deepface_cnn", f"source={face.model_source}")

# ── MODE 4B: Trained Wav2Vec2 Speech CNN ──
speech = wav2vec2_service.analyze_speech("I feel so lonely and hopeless, I can't go on", vocal_tremolo=0.7)
check("Wav2Vec2 CNN inference", speech.voice_emotion != "", f"emotion={speech.voice_emotion}, conf={speech.confidence:.4f}")
check("Wav2Vec2 voice stress", speech.voice_stress_score > 0, f"stress={speech.voice_stress_score:.4f}")
check("Wav2Vec2 keyword extraction", len(speech.high_risk_words) >= 1, f"keywords={speech.high_risk_words}")
check("Wav2Vec2 uses trained model", speech.model_source == "trained_wav2vec2_cnn", f"source={speech.model_source}")

# ── CENTRAL FUSION ENGINE ──
print(f"\n--- CENTRAL FUSION SYSTEM ---", flush=True)

from app.services.attention_fusion import attention_fusion_engine
dashboard = attention_fusion_engine.fuse(
    # Mode 1
    phq9_score=19, phq9_emotion="sadness", phq9_risk_prob=0.92, phq9_mental_state="severe_distress",
    # Mode 2
    medical_text=clinical_text,
    # Mode 3
    heart_rate=95.0, hrv=28.0, sleep_hours=4.0, steps=600.0,
    # Mode 4A
    chat_messages=["I feel hopeless", "Nothing matters", "I'm so lonely"],
    # Mode 4B
    facial_expression="sad", spoken_text="I feel so lonely and hopeless", vocal_tremolo=0.7,
)

check("Fusion: all 5 modes engaged", len(dashboard.modes_engaged) == 5, f"modes={dashboard.modes_engaged}")
check("Unified Wellness Index", 0 <= dashboard.unified_wellness_index <= 100, f"index={dashboard.unified_wellness_index}")
check("Risk classification", dashboard.risk_classification in ["Low", "Medium", "High"], f"risk={dashboard.risk_classification}")
check("Safety alerts generated", len(dashboard.safety_alerts) >= 1, f"alerts={len(dashboard.safety_alerts)}")
check("Bias detection layer", len(dashboard.bias_flags) >= 1, f"bias={dashboard.bias_flags}")
check("SHAP/LIME explainability", len(dashboard.explainability) >= 3, f"factors={len(dashboard.explainability)}")
check("Recommendations generated", len(dashboard.recommendations) >= 2, f"recs={len(dashboard.recommendations)}")
check("Model sources tracked", len(dashboard.model_sources) >= 3, f"sources={list(dashboard.model_sources.keys())}")

print(f"\n  Unified Wellness Index : {dashboard.unified_wellness_index}/100")
print(f"  Risk Classification   : {dashboard.risk_classification}")
print(f"  Models Used           :")
for k, v in dashboard.model_sources.items():
    print(f"    {k}: {v}")

print(f"\n  SHAP/LIME Explainability:")
for e in dashboard.explainability:
    print(f"    {e.modality}: weight={e.attention_weight:.3f}, impact={e.point_impact:+.1f}pts")
    print(f"      {e.reason}")

print(f"\n  Safety Alerts:")
for a in dashboard.safety_alerts:
    print(f"    [!] {a}")

# ── SUMMARY ──
print(f"\n{SEP}")
print(f"  RESULTS: {passed} passed, {failed} failed out of {passed+failed} checks")
print(SEP, flush=True)

if failed > 0:
    sys.exit(1)
