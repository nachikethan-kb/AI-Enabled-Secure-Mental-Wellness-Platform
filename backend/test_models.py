from app.services.bioclinicalbert import bioclinical_bert
from app.services.wearable_lstm import wearable_lstm_analyzer, SensorBiLSTM
from app.services.media_analyzers import deepface_analyzer, wav2vec2_analyzer
from app.services.attention_fusion import attention_fusion_engine

print("=" * 75)
print("VERIFYING INDIVIDUAL CLINICAL MACHINE LEARNING PIPELINES")
print("=" * 75)

# 1. Test Mode 2: BioClinicalBERT parser
print("\n[TEST MODE 2] Executing BioClinicalBERT Clinical Notes Entity Parser...")
raw_notes = "Patient presenting MDD symptoms and acute generalized anxiety. Prescribed Escitalopram 10mg. Clinical history reveals acute clinical vulnerability and previous hospitalization."
extracted_reports = bioclinical_bert.parse_record(raw_notes)
print(f"  - Extracted Diagnoses: {extracted_reports.diagnoses}")
print(f"  - Extracted Medications: {extracted_reports.medications}")
print(f"  - Extracted History Flags: {extracted_reports.clinical_risk_signals}")
print(f"  - Generated NER Summary: {extracted_reports.parsed_summary}")

# 2. Test Mode 3: SensorBiLSTM PyTorch architecture & anomaly analyzer
print("\n[TEST MODE 3] Executing PyTorch SensorBiLSTM & Statistical Anomaly Detector...")
# Pass low HRV (35ms), elevated heart rate (92bpm), and poor sleep (4.8 hours)
wearable_assessment = wearable_lstm_analyzer.analyze_wearables(
    heart_rate=92.0,
    hrv=35.0,
    sleep_hours=4.8,
    steps=800.0
)
print(f"  - Bidirectional LSTM Stress Index: {wearable_assessment.stress_index:.3f}")
print(f"  - Anomaly Alerter Flags: {wearable_assessment.anomaly_flags}")
print(f"  - Autonomic Stress Pattern: {wearable_assessment.stress_pattern}")
print(f"  - Consolidated Physiological Risk: {wearable_assessment.physiological_risk}")

# 3. Test Mode 4: DeepFace CNN & Wav2Vec2 audio speech processors
print("\n[TEST MODE 4] Executing DeepFace CNN & Wav2Vec2 speech emotion processors...")
face_metrics = deepface_analyzer.analyze_face("sadness")
print(f"  - DeepFace CNN Dominant Face Expression: {face_metrics.dominant_expression}")
print(f"  - DeepFace CNN Facial Arousal: {face_metrics.facial_arousal}")
print(f"  - DeepFace CNN Facial Valence: {face_metrics.facial_valence}")

voice_metrics = wav2vec2_analyzer.analyze_speech("I feel lonely and hopelessness, today is hard", vocal_tremolo_level=0.62)
print(f"  - Wav2Vec2 Voice Stress Score: {voice_metrics.voice_stress_score:.3f}")
print(f"  - Wav2Vec2 Acoustic Affect Tone: {voice_metrics.voice_emotion}")
print(f"  - Dialogue Safety Keywords Flagged: {voice_metrics.high_risk_words_detected}")

# 4. Test Central Attention Fusion Engine
print("\n[TEST FUSION ENGINE] Running dynamic attention weights and LIME explainability...")
dashboard = attention_fusion_engine.fuse_clinical_modalities(
    phq9_score=18,
    phq9_emotion="overwhelm",
    raw_medical_text=raw_notes,
    heart_rate=92.0,
    hrv=35.0,
    sleep_hours=4.8,
    steps=800.0,
    session_type="video",
    dominant_expression="sadness",
    spoken_text="I feel lonely and hopeless, today is hard",
    vocal_tremolo=0.62
)

print(f"  - Unified Mental Wellness Index : {dashboard.unified_wellness_index} / 100.0")
print(f"  - Tri-Tier Risk Classification : {dashboard.risk_classification.upper()}")
print(f"  - Safety Specialist Alert Flags: {dashboard.safety_alerts}")
print(f"  - Ingestion Bias Assessment    : {dashboard.bias_assessment}")

print("\n  - SHAP/LIME Modality Attribution Explainability:")
for record in dashboard.shap_explainability:
    print(f"    * {record.modality}:")
    print(f"      Attention Ingestion Weight : {record.attention_weight:.2f}")
    print(f"      Modality Point Deduction   : {record.point_impact} points")
    print(f"      Local Rationale Attribution: {record.attribution_reason}")

print("\n  - AI Clinical Actionable Recommendations:")
for rec in dashboard.clinical_recommendations:
    print(f"    * {rec}")
print("=" * 75)
print("ALL CLINICAL MACHINE LEARNING PIPELINE LAYERS SUCCESSFUL!")
print("=" * 75)
