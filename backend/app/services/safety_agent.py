"""
Safety Agent for mental health interventions.
Provides safety assessments, risk alerts, and intervention recommendations.
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional
import numpy as np


class InterventionLevel(Enum):
    """Intervention priority levels."""
    ROUTINE = "routine"  # Regular monitoring
    ELEVATED = "elevated"  # Recommend professional consultation
    CRISIS = "crisis"  # Immediate intervention needed


@dataclass
class SafetyAssessment:
    """Safety assessment result."""
    intervention_level: InterventionLevel
    risk_flags: list[str]
    recommended_actions: list[str]
    crisis_indicators: list[str]
    requires_immediate_contact: bool
    contact_recommendation: str  # Email, phone, emergency services
    safety_score: float  # 0.0-1.0, higher = safer
    assessment_rationale: str


class SafetyAgent:
    """
    Evaluates risk signals and provides safety recommendations.
    Detects crisis indicators and escalates appropriately.
    """
    
    # Crisis keywords and patterns
    CRISIS_KEYWORDS = {
        "suicide": 10.0,
        "kill myself": 10.0,
        "end it": 9.5,
        "no point living": 9.5,
        "harm myself": 9.0,
        "hurt myself": 9.0,
        "overdose": 8.5,
        "self-harm": 8.0,
        "jump": 7.5,
        "hang": 7.5,
        "cut": 6.0,
        "worthless": 5.0,
        "hopeless": 5.0,
        "can't go on": 5.0,
        "give up": 4.5,
        "tired of living": 4.5,
        "everyone would be better": 4.0,
    }
    
    # Risk escalation thresholds
    CRISIS_THRESHOLD = 0.8
    ELEVATED_THRESHOLD = 0.5
    
    def __init__(self):
        self.assessment_history = []
    
    def assess_text(self, text: str, phq9_score: Optional[int] = None, 
                   emotion: Optional[str] = None) -> SafetyAssessment:
        """
        Perform safety assessment based on text and other indicators.
        
        Args:
            text: User input text to analyze
            phq9_score: PHQ-9 depression severity score (0-27)
            emotion: Detected emotion (e.g., "sadness", "anger")
        
        Returns:
            SafetyAssessment with intervention recommendations
        """
        risk_flags = []
        crisis_indicators = []
        text_lower = text.lower()
        
        # Scan for crisis keywords
        max_crisis_score = 0.0
        for keyword, severity in self.CRISIS_KEYWORDS.items():
            if keyword in text_lower:
                crisis_indicators.append(keyword)
                max_crisis_score = max(max_crisis_score, severity / 10.0)
        
        # Calculate composite risk score
        text_risk = max_crisis_score
        
        # Factor in PHQ-9 score
        if phq9_score is not None:
            phq9_risk = phq9_score / 27.0
            text_risk = (text_risk + phq9_risk) / 2.0
            
            if phq9_score >= 20:
                risk_flags.append("High PHQ-9 depression score")
            elif phq9_score >= 15:
                risk_flags.append("Moderate PHQ-9 score")
        
        # Factor in emotion
        if emotion:
            high_risk_emotions = ["sadness", "despair", "anxiety", "panic", "grief"]
            if emotion in high_risk_emotions:
                text_risk += 0.15
                risk_flags.append(f"High-risk emotion detected: {emotion}")
        
        # Normalize risk score
        risk_score = min(text_risk, 1.0)
        safety_score = 1.0 - risk_score
        
        # Determine intervention level
        if risk_score >= self.CRISIS_THRESHOLD:
            intervention_level = InterventionLevel.CRISIS
        elif risk_score >= self.ELEVATED_THRESHOLD:
            intervention_level = InterventionLevel.ELEVATED
        else:
            intervention_level = InterventionLevel.ROUTINE
        
        # Generate recommendations
        recommended_actions = self._generate_recommendations(
            intervention_level, risk_flags, crisis_indicators
        )
        
        # Determine contact recommendation
        requires_immediate = intervention_level == InterventionLevel.CRISIS
        contact_rec = self._get_contact_recommendation(intervention_level)
        
        # Generate rationale
        rationale = self._generate_rationale(
            risk_score, risk_flags, crisis_indicators, intervention_level
        )
        
        assessment = SafetyAssessment(
            intervention_level=intervention_level,
            risk_flags=risk_flags,
            recommended_actions=recommended_actions,
            crisis_indicators=crisis_indicators,
            requires_immediate_contact=requires_immediate,
            contact_recommendation=contact_rec,
            safety_score=round(safety_score, 4),
            assessment_rationale=rationale,
        )
        
        self.assessment_history.append(assessment)
        
        return assessment
    
    def _generate_recommendations(self, level: InterventionLevel,
                                 risk_flags: list[str],
                                 crisis_indicators: list[str]) -> list[str]:
        """Generate intervention recommendations based on risk level."""
        recommendations = []
        
        if level == InterventionLevel.CRISIS:
            recommendations = [
                "IMMEDIATE: Contact emergency services (911 in US, 112 in EU)",
                "Ensure user is in a safe location",
                "Have crisis counselor available for immediate chat",
                "Alert designated emergency contact",
                "Document all crisis indicators for medical professionals",
            ]
        elif level == InterventionLevel.ELEVATED:
            recommendations = [
                "Schedule urgent appointment with mental health professional",
                "Provide crisis hotline resources",
                "Daily check-in recommended",
                "Encourage grounding techniques and self-care",
                "Monitor for escalation in next assessment",
            ]
        else:  # ROUTINE
            recommendations = [
                "Continue regular assessments (weekly or monthly)",
                "Access mental wellness resources",
                "Encourage healthy coping strategies",
                "Suggest peer support or community groups",
            ]
        
        return recommendations
    
    def _get_contact_recommendation(self, level: InterventionLevel) -> str:
        """Get appropriate contact method based on risk level."""
        if level == InterventionLevel.CRISIS:
            return "Emergency services and immediate professional intervention"
        elif level == InterventionLevel.ELEVATED:
            return "Professional therapist/counselor (within 24-48 hours)"
        else:
            return "Regular check-ins with healthcare provider"
    
    def _generate_rationale(self, risk_score: float, risk_flags: list[str],
                           crisis_indicators: list[str],
                           level: InterventionLevel) -> str:
        """Generate human-readable rationale for assessment."""
        parts = []
        
        if crisis_indicators:
            parts.append(f"Crisis indicators detected: {', '.join(crisis_indicators)}")
        
        if risk_flags:
            parts.append(f"Risk factors: {', '.join(risk_flags)}")
        
        parts.append(f"Overall risk score: {risk_score:.2%}")
        parts.append(f"Recommended intervention level: {level.value.upper()}")
        
        return " | ".join(parts)
    
    def assess_behavioral_patterns(self, message_history: list[str],
                                  time_window_days: int = 7) -> dict:
        """
        Analyze patterns in user messages over time.
        """
        if not message_history:
            return {"trend": "insufficient_data", "risk_trajectory": 0.0}
        
        # Analyze sentiment/risk progression
        risks = []
        for msg in message_history:
            text_risk = 0.0
            for keyword in self.CRISIS_KEYWORDS:
                if keyword in msg.lower():
                    text_risk = max(text_risk, self.CRISIS_KEYWORDS[keyword] / 10.0)
            risks.append(text_risk)
        
        # Calculate trend
        if len(risks) >= 2:
            trend_slope = (risks[-1] - risks[0]) / (len(risks) - 1)
            if trend_slope > 0.1:
                trend = "worsening"
            elif trend_slope < -0.1:
                trend = "improving"
            else:
                trend = "stable"
        else:
            trend = "insufficient_data"
        
        return {
            "trend": trend,
            "risk_trajectory": float(np.mean(risks)) if risks else 0.0,
            "latest_risk": float(risks[-1]) if risks else 0.0,
        }
