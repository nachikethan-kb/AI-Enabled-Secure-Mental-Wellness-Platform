from typing import Dict, Any, Optional

def calculate_mental_health_risk(
    steps: int,
    screen_time_minutes: int,
    sleep_hours: float,
    sleep_quality_percent: int,
    heart_rate_bpm: Optional[int],
    hrv_ms: Optional[float],
    social_app_minutes: int,
    notification_count: int,
    phq9_score: Optional[int] = None
) -> Dict[str, Any]:
    """
    Calculates mental health risk level, confidence, and contributing factors based on mobile telemetry.
    
    - steps: Low steps indicates sedentary behavior (linked to depression/low energy)
    - screen_time_minutes: High screen time indicates doom-scrolling, avoidance, or fatigue
    - sleep: Irregular duration or poor quality indicates insomnia or disruption
    - social_app_minutes: Excessive social media correlates with higher anxiety/depression risk
    - heart_rate/hrv: Low HRV indicates physiological stress
    - notification_count: High counts correlate with cognitive load and anxiety
    """
    factors = {}
    total_weight = 0
    risk_points = 0
    
    # 1. Activity (Steps) - Normal range: 6000-10000+
    weight_steps = 15
    total_weight += weight_steps
    if steps < 2000:
        risk_points += weight_steps
        factors["extremely_low_activity"] = "Steps are under 2,000, indicating severe sedentary behavior."
    elif steps < 5000:
        risk_points += weight_steps * 0.6
        factors["low_activity"] = "Steps are under 5,000, showing low physical activity."
    
    # 2. Screen Time - Normal range: < 240 mins (4 hours)
    weight_screen = 20
    total_weight += weight_screen
    if screen_time_minutes > 480: # 8+ hours
        risk_points += weight_screen
        factors["excessive_screen_time"] = f"Screen time is extremely high ({screen_time_minutes} mins), risking fatigue."
    elif screen_time_minutes > 300: # 5+ hours
        risk_points += weight_screen * 0.6
        factors["moderate_screen_time"] = f"Screen time is elevated ({screen_time_minutes} mins)."

    # 3. Sleep duration & quality
    weight_sleep = 20
    total_weight += weight_sleep
    sleep_score = 0.0
    if sleep_hours < 5.0 or sleep_hours > 10.0:
        sleep_score += 0.5
        factors["irregular_sleep_duration"] = f"Sleep duration of {sleep_hours}h is outside healthy range."
    if sleep_quality_percent < 55:
        sleep_score += 0.5
        factors["poor_sleep_quality"] = f"Sleep quality is low ({sleep_quality_percent}%)."
    risk_points += weight_sleep * sleep_score

    # 4. Social media app usage
    weight_social = 15
    total_weight += weight_social
    if social_app_minutes > 180:
        risk_points += weight_social
        factors["excessive_social_media"] = f"Social media usage is high ({social_app_minutes} mins)."
    elif social_app_minutes > 120:
        risk_points += weight_social * 0.5
        factors["elevated_social_media"] = f"Social media usage is elevated ({social_app_minutes} mins)."

    # 5. Heart rate & HRV
    weight_heart = 15
    if heart_rate_bpm is not None or hrv_ms is not None:
        total_weight += weight_heart
        heart_score = 0.0
        if heart_rate_bpm is not None and heart_rate_bpm > 85:
            heart_score += 0.5
            factors["elevated_resting_heart_rate"] = f"Resting heart rate is high ({heart_rate_bpm} bpm)."
        if hrv_ms is not None and hrv_ms < 30.0:
            heart_score += 0.5
            factors["low_heart_rate_variability"] = f"HRV is low ({hrv_ms} ms), indicating physiological stress."
        risk_points += weight_heart * heart_score

    # 6. Notifications
    weight_notify = 15
    total_weight += weight_notify
    if notification_count > 150:
        risk_points += weight_notify
        factors["excessive_notifications"] = "High notification count indicates potential digital overstimulation."
    elif notification_count > 80:
        risk_points += weight_notify * 0.5
        factors["elevated_notifications"] = "Elevated notification count."

    # Calculate normalized phone risk score
    phone_risk = risk_points / total_weight if total_weight > 0 else 0.0
    
    # Cross-validation with PHQ-9 score if available
    final_risk_score = phone_risk
    phq9_risk = 0.0
    confidence = 0.80
    
    if phq9_score is not None:
        phq9_risk = min(phq9_score / 27.0, 1.0)
        # 60% PHQ-9, 40% phone sensor data
        final_risk_score = (0.6 * phq9_risk) + (0.4 * phone_risk)
        confidence = 0.95
        factors["phq9_assessment_integrated"] = f"Self-reported PHQ-9 score of {phq9_score} has been integrated."
        if phq9_score >= 15:
            factors["high_phq9_severity"] = f"PHQ-9 score is high ({phq9_score}), indicating clinical concern."
    
    # Determine risk level
    if final_risk_score < 0.35:
        risk_level = "Low"
    elif final_risk_score < 0.65:
        risk_level = "Medium"
    else:
        risk_level = "High"

    return {
        "risk_score": round(final_risk_score, 2),
        "risk_level": risk_level,
        "confidence": confidence,
        "contributing_factors": factors,
        "phone_component": round(phone_risk, 2),
        "phq9_component": round(phq9_risk, 2)
    }
