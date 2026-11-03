import random

from app.services.emotion_classifier import analyze_emotion

# Safety-critical keyword sets (unchanged behaviour, always checked first)
DISTRESS_KEYWORDS = {
    "suicide",
    "self-harm",
    "kill myself",
    "hopeless",
    "end my life",
    "worthless",
}

SEVERE_KEYWORDS = {
    "suicidal",
    "can't go on",
    "no reason to live",
    "want to die",
}

# PHQ-9 risk bands, mirrored from app.services.phq9
_SEVERE_BANDS = {"Severe", "Moderately Severe"}
_MODERATE_BANDS = {"Moderate"}
_MILD_BANDS = {"Mild"}
_MINIMAL_BANDS = {"Minimal"}

# Recommended step/activity target used for gentle nudges
_DAILY_STEP_GOAL = 6000
_DAILY_ACTIVE_MINUTES_GOAL = 30


def _wellness_percentage(score: int | None, max_score: int = 27) -> int | None:
    """Convert a PHQ-9 score (0=best, 27=worst) into a 0-100 wellbeing percentage (100=best)."""
    if score is None:
        return None
    score = max(0, min(max_score, score))
    return round((1 - score / max_score) * 100)


def _activity_line(sensor: dict | None) -> tuple[str | None, bool]:
    """Builds a short line about today's physical activity from the latest sensor reading.
    Returns (line, is_low_activity)."""
    if not sensor or not sensor.get("connected"):
        return (
            "I don't see a connected activity sensor yet - pairing your device on the Sensors "
            "page lets me track your movement and tailor these check-ins to you.",
            False,
        )

    steps = sensor.get("steps") or 0
    active_minutes = sensor.get("active_minutes") or 0
    low_activity = steps < _DAILY_STEP_GOAL * 0.5 and active_minutes < _DAILY_ACTIVE_MINUTES_GOAL * 0.5

    if steps or active_minutes:
        base = f"Your sensor shows {steps:,} steps and {active_minutes} active minutes so far today."
        if low_activity:
            base += " Even a short 10-15 minute walk can help lift mood - want to aim for that next?"
        else:
            base += " That's solid movement - keep that rhythm going."
        return base, low_activity

    return (
        "Your sensor is connected but hasn't logged much movement yet today - "
        "a short walk could be a great way to start.",
        True,
    )


def _doctor_line(risk_level: str | None) -> tuple[str | None, bool, bool]:
    """Returns (line, suggest_doctor, urgent_doctor) based on PHQ-9 risk band."""
    if not risk_level:
        return None, False, False

    if risk_level in _SEVERE_BANDS:
        return (
            "Based on your last assessment, you're in the severe depression range. Please contact "
            "a doctor immediately - I can arrange a video meeting with a specialist for you right now, "
            "just say the word.",
            True,
            True,
        )
    if risk_level in _MODERATE_BANDS:
        return (
            "Your last assessment placed you in the moderate depression range. It could really help to "
            "connect with a doctor for proper support - I can set up that video call whenever you're ready.",
            True,
            False,
        )
    if risk_level in _MILD_BANDS:
        return (
            "You're showing mild depression signs based on your last assessment. You're doing okay, and "
            "if you'd like extra support, I can also connect you with a doctor for a quick chat.",
            True,
            False,
        )
    return None, False, False


def _base_cbt_line(emotion: str, escalation_required: bool) -> str:
    if escalation_required:
        return (
            "I hear that you're in a very painful place right now. You're not alone. "
            "Please contact a trusted person or local emergency/crisis service immediately, "
            "and consider urgent consultation with a mental health professional."
        )
    if emotion in {"sadness", "fear", "anger"}:
        return (
            "Thank you for sharing this. A CBT step you can try: identify the strongest thought "
            "behind this feeling, then ask yourself what evidence supports and challenges it. "
            "Would you like to work through that thought together?"
        )
    return random.choice(
        [
            "You're doing a good job checking in. Let's build resilience with a quick CBT habit: "
            "name one challenge today and one small action you can take in the next hour.",
            "Thanks for checking in. Noticing your patterns like this is itself a great CBT habit - "
            "what's one small win from today, however small it feels?",
        ]
    )


def generate_cbt_response(
    message: str,
    phq9_context: dict | None = None,
    sensor_context: dict | None = None,
) -> dict:
    """Generates a companion chatbot response that fuses:
      - real-time message emotion/keyword risk analysis (safety-critical, always runs first)
      - the user's most recent PHQ-9 assessment (severity-aware guidance + doctor escalation)
      - the user's most recent wearable/phone sensor reading (activity nudges)

    phq9_context: {"score": int, "risk_level": str, "high_risk": bool} | None
    sensor_context: {"connected": bool, "steps": int, "active_minutes": int, "sleep_hours": float} | None
    """
    lowered = message.lower()
    emotion, confidence = analyze_emotion(message)

    keyword_hit = any(keyword in lowered for keyword in DISTRESS_KEYWORDS)
    severe_hit = any(keyword in lowered for keyword in SEVERE_KEYWORDS)
    emotion_risk = 0.25 if emotion in {"sadness", "fear", "anger"} and confidence >= 0.70 else 0.05
    keyword_risk = 0.60 if keyword_hit else 0.0
    severe_risk = 0.30 if severe_hit else 0.0
    base_risk = 0.05
    risk_probability = min(0.99, round(base_risk + emotion_risk + keyword_risk + severe_risk, 4))
    escalation_required = risk_probability >= 0.65

    # 1) Safety-critical crisis response always wins and is never diluted with activity chit-chat.
    if escalation_required:
        return {
            "response": _base_cbt_line(emotion, escalation_required),
            "emotion": emotion,
            "confidence": confidence,
            "escalation_required": escalation_required,
            "risk_probability": risk_probability,
            "risk_level": (phq9_context or {}).get("risk_level"),
            "wellness_percentage": _wellness_percentage((phq9_context or {}).get("score")),
            "suggest_doctor": True,
            "urgent_doctor": True,
            "sensor_connected": bool((sensor_context or {}).get("connected")),
            "steps_today": (sensor_context or {}).get("steps"),
            "active_minutes_today": (sensor_context or {}).get("active_minutes"),
            "activity_suggestion": None,
        }

    # 2) Otherwise, build a normal CBT reply and layer PHQ-9 severity + activity guidance on top.
    parts = [_base_cbt_line(emotion, escalation_required)]

    risk_level = (phq9_context or {}).get("risk_level")
    doctor_line, suggest_doctor, urgent_doctor = _doctor_line(risk_level)
    activity_line, low_activity = _activity_line(sensor_context)

    if risk_level in _SEVERE_BANDS or risk_level in _MODERATE_BANDS:
        # Prioritise the doctor guidance for moderate+ severity; activity note stays supportive, not preachy.
        if doctor_line:
            parts.append(doctor_line)
        if activity_line:
            parts.append(activity_line)
    else:
        # Minimal/mild/unknown severity: lead with activity encouragement, doctor offer stays soft.
        if activity_line:
            parts.append(activity_line)
        if doctor_line:
            parts.append(doctor_line)

    if not risk_level:
        parts.append(
            "By the way, I don't have a recent PHQ-9 check-in from you - taking a couple of minutes for "
            "that helps me personalize this support to how you're really doing."
        )

    response_text = " ".join(p for p in parts if p)

    return {
        "response": response_text,
        "emotion": emotion,
        "confidence": confidence,
        "escalation_required": escalation_required,
        "risk_probability": risk_probability,
        "risk_level": risk_level,
        "wellness_percentage": _wellness_percentage((phq9_context or {}).get("score")),
        "suggest_doctor": suggest_doctor,
        "urgent_doctor": urgent_doctor,
        "sensor_connected": bool((sensor_context or {}).get("connected")),
        "steps_today": (sensor_context or {}).get("steps"),
        "active_minutes_today": (sensor_context or {}).get("active_minutes"),
        "activity_suggestion": activity_line if low_activity else None,
    }


def get_companion_status(phq9_context: dict | None, sensor_context: dict | None) -> dict:
    """Lightweight status snapshot (no message) used to populate the wellness widget on page load."""
    risk_level = (phq9_context or {}).get("risk_level")
    _, suggest_doctor, urgent_doctor = _doctor_line(risk_level)
    activity_line, low_activity = _activity_line(sensor_context)

    return {
        "risk_level": risk_level,
        "wellness_percentage": _wellness_percentage((phq9_context or {}).get("score")),
        "suggest_doctor": suggest_doctor,
        "urgent_doctor": urgent_doctor,
        "sensor_connected": bool((sensor_context or {}).get("connected")),
        "steps_today": (sensor_context or {}).get("steps"),
        "active_minutes_today": (sensor_context or {}).get("active_minutes"),
        "activity_suggestion": activity_line if low_activity else None,
    }
