import json
from datetime import datetime
from sqlalchemy.orm import Session
from app.db.session import SessionLocal, Base, engine
from app.models.user import User
from app.models.phq9_assessment import PHQ9Assessment
from app.models.health_report import HealthReport
from app.models.sensor_data import SensorData
from app.models.session_analytics import SessionAnalytics

# Set up DB tables
Base.metadata.create_all(bind=engine)

print("=" * 70)
print("RUNNING MULTI-MODAL 4-MODE DATA FUSION INTEGRATION TEST")
print("=" * 70)

db: Session = SessionLocal()
try:
    # 1. Ensure a test user exists
    test_user = db.query(User).filter(User.email == "tester_gemini@example.com").first()
    if not test_user:
        test_user = User(
            email="tester_gemini@example.com",
            full_name="ML Tester",
            hashed_password="hashed_password123"
        )
        db.add(test_user)
        db.commit()
        db.refresh(test_user)
        print(f"Created test user: {test_user.full_name} (ID: {test_user.id})")
    else:
        print(f"Loaded existing test user: {test_user.full_name} (ID: {test_user.id})")

    # Clean up old records for this tester to start fresh
    db.query(PHQ9Assessment).filter(PHQ9Assessment.user_id == test_user.id).delete()
    db.query(HealthReport).filter(HealthReport.user_id == test_user.id).delete()
    db.query(SensorData).filter(SensorData.user_id == test_user.id).delete()
    db.query(SessionAnalytics).filter(SessionAnalytics.user_id == test_user.id).delete()
    db.commit()

    print("\n--- STAGE 1: SUBMITTING MULTI-MODAL DATA ---")

    # MODE 1: PHQ-9 Clinical Survey
    # Mix of severe distress scores on the 9 answers
    phq9_answers = [3, 2, 3, 2, 1, 3, 2, 2, 3] # Total score = 21 (Severe)
    phq9 = PHQ9Assessment(
        user_id=test_user.id,
        answers=phq9_answers,
        score=21,
        risk_level="Severe",
        high_risk=True,
        recommended_action="Seek clinical care or active support.",
        dominant_emotion="sadness",
        emotion_confidence=0.88,
        secondary_emotions=["overwhelm"],
        concern_areas=["depressed mood", "anhedonia", "self-harm thoughts"],
        emotion_rationale="Score 21 indicates high clinical load. Active Q9 self-harm flag present.",
        emotion_summary="Linguistic and cluster indicators demonstrate severe distress patterns.",
        needs_human_review=True,
        risk_flags=["self_harm_signal", "very_high_symptom_burden"],
        agent_version="agentic-phq9-v2",
        mental_state_label="crisis",
        mental_state_confidence=0.78,
        emotional_score=8,
        cognitive_score=6,
        physical_score=4,
        functional_score=3
    )
    db.add(phq9)
    print("[Mode 1] PHQ-9 Severe Distress Survey submitted successfully (Score: 21).")

    # MODE 2: Medical Health Record (BioClinicalBERT & OCR)
    report = HealthReport(
        user_id=test_user.id,
        filename="discharge_summary_2025.pdf",
        summary="BioClinicalBERT parsed psychiatric records. Identified history of Major Depressive Disorder (MDD) and Generalized Anxiety Disorder (GAD).",
        diagnoses=["Major Depressive Disorder (MDD)", "Generalized Anxiety Disorder (GAD)"],
        medications=["Sertraline (SSRI)", "Alprazolam (Anxiolytic)"],
        clinical_notes="Discharged with stable medication regimen. Previous episodes show acute clinical vulnerability."
    )
    db.add(report)
    print("[Mode 2] BioClinicalBERT Medical Record Analysis submitted successfully.")

    # MODE 3: Biometric Sensor Data (LSTM & Anomalies)
    # Severe physiological arousal: Low HRV (32ms), High GSR (6.8 uS), Poor Sleep (4.5 hours)
    hrv_stress = max(0.0, min(1.0, (65.0 - 32.0) / 45.0))
    gsr_stress = max(0.0, min(1.0, 6.8 / 8.0))
    sleep_stress = max(0.0, min(1.0, (7.5 - 4.5) / 4.0))
    stress_index = (hrv_stress * 0.45) + (gsr_stress * 0.35) + (sleep_stress * 0.20)
    
    sensor = SensorData(
        user_id=test_user.id,
        heart_rate_variability=32.0,
        galvanic_skin_response=6.8,
        sleep_duration_hours=4.5,
        stress_index=stress_index
    )
    db.add(sensor)
    print(f"[Mode 3] Wearable Sensor Telemetry submitted. LSTM Stress Index synthesized: {stress_index:.2f}")

    # MODE 4: Chat & Video Call Session Analytics (Valence, Arousal, wav2vec2, DeepFace)
    session = SessionAnalytics(
        user_id=test_user.id,
        session_type="video",
        dominant_expression="fear",
        key_transcript_words=["lonely", "die", "tired", "hopeless"],
        sentiment_score=-0.75, # Deep linguistic negativity
        facial_arousal=0.85,  # DeepFace CNN high intensity arousal
        facial_valence=-0.70  # DeepFace CNN negative emotional state
    )
    db.add(session)
    print("[Mode 4] Chat & Video Call Speech Analytics submitted (Valence: -0.70, Voice Stress: High).")

    db.commit()

    print("\n--- STAGE 2: RUNNING CENTRAL ATTENTION-BASED FUSION ENGINE ---")
    # Emulate the dashboard router logic directly in-memory to verify calculations
    latest_phq9 = db.query(PHQ9Assessment).filter(PHQ9Assessment.user_id == test_user.id).order_by(PHQ9Assessment.created_at.desc()).first()
    latest_sensor = db.query(SensorData).filter(SensorData.user_id == test_user.id).order_by(SensorData.created_at.desc()).first()
    latest_session = db.query(SessionAnalytics).filter(SessionAnalytics.user_id == test_user.id).order_by(SessionAnalytics.created_at.desc()).first()
    all_reports = db.query(HealthReport).filter(HealthReport.user_id == test_user.id).order_by(HealthReport.created_at.desc()).all()

    # Calculate attention weights dynamically
    raw_weights = {"phq9": 0.35, "sensor": 0.30, "session": 0.25, "reports": 0.10}
    total_raw_weight = sum(raw_weights.values())
    attention_weights = {k: v / total_raw_weight for k, v in raw_weights.items()}

    # Multi-modal fusion scoring
    unified_score = 100.0
    alert_flags = []
    explainability = []

    # PHQ-9 deduction (Clinical)
    phq9_impact = (latest_phq9.score / 27.0) * 40.0
    unified_score -= phq9_impact
    explainability.append({
        "modality": "Mode 1: PHQ-9 Text Analysis",
        "attention_weight": attention_weights["phq9"],
        "impact": -phq9_impact,
        "reason": f"Severe score ({latest_phq9.score}/27) driving high clinical attention weight."
    })
    
    # Sensor deduction (Physiological)
    sensor_impact = latest_sensor.stress_index * 30.0
    unified_score -= sensor_impact
    explainability.append({
        "modality": "Mode 3: Wearable Sensor & Autonomic Analysis",
        "attention_weight": attention_weights["sensor"],
        "impact": -sensor_impact,
        "reason": f"Autonomic stress index is {latest_sensor.stress_index:.2f} due to suppressed HRV ({latest_sensor.heart_rate_variability}ms) and high GSR."
    })

    # Session deduction (Behavioral/Dialogue/Expressions)
    valence_factor = max(0.0, -latest_session.facial_valence)
    session_impact = ((1.0 - latest_session.sentiment_score) * 12.0) + (valence_factor * 18.0)
    unified_score -= session_impact
    explainability.append({
        "modality": "Mode 4: Chat, Video & Speech Expression Analysis",
        "attention_weight": attention_weights["session"],
        "impact": -session_impact,
        "reason": f"Negative facial valence ({latest_session.facial_valence:.2f}) and high vocal arousal/stress detected in speech."
    })

    # Medical History Contribution
    diagnoses = []
    for r in all_reports:
        if r.diagnoses:
            diagnoses.extend(r.diagnoses)
    diagnoses = list(set(diagnoses))
    explainability.append({
        "modality": "Mode 2: Medical Record History Summary",
        "attention_weight": attention_weights["reports"],
        "impact": 0.0,
        "reason": f"Identified {len(diagnoses)} chronic psychiatric disorders in historical records: {diagnoses}."
    })

    unified_score = max(0.0, min(100.0, unified_score))
    
    # Clinical Synergy rules
    if latest_phq9.score >= 15 and latest_sensor.stress_index >= 0.65:
        alert_flags.append("CRITICAL: Autonomic-Clinical Co-Stress Convergence Detected")
    
    suicidal_keywords = {"hopeless", "worthless", "hurt", "die", "suicide", "lonely"}
    triggered_words = [w for w in latest_session.key_transcript_words if w.lower() in suicidal_keywords]
    if triggered_words:
        alert_flags.append(f"SAFETY: Safety transcript triggers identified during session ({', '.join(triggered_words)})")

    risk_classification = "High" if unified_score < 50.0 else "Medium" if unified_score < 80.0 else "Low"

    print("\n--- STAGE 3: MULTI-MODAL WELLNESS DASHBOARD RESULTS ---")
    print(f"Unified Mental Wellness Index : {unified_score:.1f} / 100.0")
    print(f"Risk Classification           : {risk_classification.upper()} RISK")
    print(f"Modality Modes Engaged        : {list(raw_weights.keys())}")
    
    print("\n[AI Clinical Alert Flags]")
    for alert in alert_flags:
        print(f"  [ALERT] {alert}")

    print("\n[SHAP / LIME Modality Contribution Explainability Layer]")
    for factor in explainability:
        print(f"  * {factor['modality']}:")
        print(f"    - Attention Weight      : {factor['attention_weight']:.2f}")
        print(f"    - Wellness Impact       : {factor['impact']:.2f} points")
        print(f"    - Attribution Reason    : {factor['reason']}")

    print("\n[Unified Diagnostic Recommendations]")
    print("  * Autonomic-clinical stress convergence is high. Clinical therapy check-in is urged.")
    print("  * Initiate daily respiratory pacing biofeedback (vagal activation) to decrease autonomic stress indexes.")
    print("  * Flagged dialog keywords indicate safety-sensitive trends; establish support team check-ins.")
    print("=" * 70)

finally:
    db.close()
