"""
Explainability Layer for mental health models.
Provides SHAP and LIME-inspired feature importance explanations.
"""

from dataclasses import dataclass
from typing import Any, Optional
import numpy as np


@dataclass
class FeatureImportance:
    """Feature importance with explanation."""
    feature_name: str
    importance_score: float  # -1.0 to 1.0, negative means risk-increasing
    contribution_direction: str  # "risk_increase", "risk_decrease", "neutral"
    explanation: str
    confidence: float  # How confident in this attribution


@dataclass
class ModelExplanation:
    """Complete model explanation with SHAP/LIME-style breakdowns."""
    prediction: float
    base_value: float  # Average prediction
    local_explanations: list[FeatureImportance]
    top_contributing_factors: list[tuple[str, float]]  # Top 3-5
    prediction_narrative: str  # Human-readable explanation
    model_confidence: float
    limitations: list[str]


class ExplainabilityEngine:
    """
    Provides interpretable explanations for model predictions
    using SHAP and LIME-inspired approaches.
    """
    
    def __init__(self):
        self.base_values = {
            "phq9_risk": 0.35,  # Average risk for PHQ-9
            "emotion_risk": 0.25,
            "sensor_risk": 0.30,
            "chat_risk": 0.28,
            "video_risk": 0.32,
        }
    
    def explain_phq9_prediction(self, 
                               answers: list[int],
                               phq9_score: int,
                               risk_score: float,
                               emotion_label: str) -> ModelExplanation:
        """
        Explain PHQ-9 risk prediction with feature importance.
        """
        explanations = []
        
        # Analyze contribution of each question
        severity_categories = {
            0: ("Not at all", -0.3),
            1: ("Several days", -0.1),
            2: ("More than half", 0.2),
            3: ("Nearly every day", 0.5),
        }
        
        phq9_questions = [
            "Little interest or pleasure in doing things",
            "Feeling down, depressed, or hopeless",
            "Trouble falling asleep, staying asleep, or sleeping too much",
            "Feeling tired or having little energy",
            "Poor appetite or overeating",
            "Feeling bad about yourself",
            "Trouble concentrating on things",
            "Moving slowly or too fast",
            "Thoughts that you would be better off dead",
        ]
        
        contributions = []
        
        for i, answer in enumerate(answers):
            if i < len(phq9_questions):
                severity_label, contribution = severity_categories.get(answer, ("Unknown", 0.0))
                
                # Question 9 (suicidal ideation) has highest weight
                if i == 8:
                    contribution *= 2.5
                
                # Questions 1-2 (core depression) have higher weight
                elif i in [0, 1]:
                    contribution *= 1.5
                
                contributions.append((phq9_questions[i], contribution))
                
                explanations.append(FeatureImportance(
                    feature_name=f"Q{i+1}: {phq9_questions[i][:30]}...",
                    importance_score=contribution,
                    contribution_direction="risk_increase" if contribution > 0 else "risk_decrease",
                    explanation=f"Response: {severity_label} - {severity_categories[answer][0]}",
                    confidence=0.85,
                ))
        
        # Sort by absolute importance
        contributions.sort(key=lambda x: abs(x[1]), reverse=True)
        top_factors = contributions[:5]
        
        # Generate narrative explanation
        narrative = self._generate_phq9_narrative(
            phq9_score, risk_score, emotion_label, top_factors
        )
        
        return ModelExplanation(
            prediction=risk_score,
            base_value=self.base_values["phq9_risk"],
            local_explanations=explanations,
            top_contributing_factors=top_factors,
            prediction_narrative=narrative,
            model_confidence=0.92,
            limitations=[
                "PHQ-9 is self-reported; may be affected by social desirability",
                "Does not account for cultural variations in symptom expression",
                "Single assessment; longitudinal data would improve accuracy",
            ],
        )
    
    def explain_emotion_prediction(self,
                                  detected_emotion: str,
                                  confidence: float,
                                  text_features: dict[str, float]) -> ModelExplanation:
        """
        Explain emotion detection prediction.
        """
        explanations = []
        
        # Analyze contributing text features
        feature_weights = {
            "negative_sentiment_words": 0.35,
            "anxiety_markers": 0.25,
            "hopelessness_expressions": 0.40,
            "suicidal_ideation_markers": 0.50,
            "emotional_intensity": 0.20,
            "temporal_markers": 0.15,
        }
        
        contributions = []
        
        for feature_name, base_weight in feature_weights.items():
            if feature_name in text_features:
                feature_value = text_features[feature_name]
                contribution = base_weight * feature_value
                contributions.append((feature_name, contribution))
                
                explanations.append(FeatureImportance(
                    feature_name=feature_name.replace("_", " ").title(),
                    importance_score=contribution,
                    contribution_direction="risk_increase" if contribution > 0 else "risk_decrease",
                    explanation=f"Feature presence: {feature_value:.2f} (weight: {base_weight:.2f})",
                    confidence=0.80,
                ))
        
        contributions.sort(key=lambda x: abs(x[1]), reverse=True)
        top_factors = contributions[:4]
        
        narrative = f"Model detected '{detected_emotion.title()}' emotion with {confidence:.0%} confidence. " \
                   f"Key contributing factors: {', '.join([f[0].replace('_', ' ') for f in top_factors[:2]])}."
        
        return ModelExplanation(
            prediction=confidence,
            base_value=self.base_values["emotion_risk"],
            local_explanations=explanations,
            top_contributing_factors=top_factors,
            prediction_narrative=narrative,
            model_confidence=0.88,
            limitations=[
                "Emotion detection from text is inherently ambiguous",
                "Sarcasm and irony are not reliably detected",
                "Context from conversation history not always considered",
            ],
        )
    
    def explain_sensor_prediction(self,
                                 sensor_data: dict[str, float],
                                 anomaly_score: float) -> ModelExplanation:
        """
        Explain sensor-based risk prediction.
        """
        explanations = []
        
        sensor_ranges = {
            "heart_rate_variability": (50.0, 150.0, "Higher is better"),
            "sleep_duration": (6.0, 9.0, "7-9 hours recommended"),
            "activity_level": (5000, 10000, "Steps per day"),
            "stress_index": (0.0, 1.0, "Lower is better"),
        }
        
        contributions = []
        
        for sensor_name, sensor_value in sensor_data.items():
            if sensor_name in sensor_ranges:
                min_val, max_val, description = sensor_ranges[sensor_name]
                
                # Calculate deviation from normal
                if sensor_name == "stress_index":
                    # For stress, high values are bad
                    if sensor_value > 0.7:
                        contribution = (sensor_value - 0.7) * 0.8
                    else:
                        contribution = -0.1
                else:
                    # For other metrics, out-of-range is bad
                    if sensor_value < min_val or sensor_value > max_val:
                        contribution = abs(sensor_value - (min_val + max_val) / 2) / max_val * 0.5
                    else:
                        contribution = -0.1
                
                contributions.append((sensor_name, contribution))
                
                explanations.append(FeatureImportance(
                    feature_name=sensor_name.replace("_", " ").title(),
                    importance_score=contribution,
                    contribution_direction="risk_increase" if contribution > 0 else "risk_decrease",
                    explanation=f"Value: {sensor_value:.2f} | Expected: {min_val}-{max_val} | {description}",
                    confidence=0.85,
                ))
        
        contributions.sort(key=lambda x: abs(x[1]), reverse=True)
        top_factors = contributions[:3]
        
        # Generate narrative
        problem_areas = [f[0].replace("_", " ") for f in top_factors if f[1] > 0]
        narrative = f"Sensor analysis detected anomaly score of {anomaly_score:.2%}. " \
                   f"Concern areas: {', '.join(problem_areas) if problem_areas else 'All metrics within normal range'}."
        
        return ModelExplanation(
            prediction=anomaly_score,
            base_value=self.base_values["sensor_risk"],
            local_explanations=explanations,
            top_contributing_factors=top_factors,
            prediction_narrative=narrative,
            model_confidence=0.90,
            limitations=[
                "Wearable devices have variable accuracy across individuals",
                "Environmental factors (temperature, activity type) affect readings",
                "Individual baselines vary; personalization needed for better accuracy",
            ],
        )
    
    def _generate_phq9_narrative(self, score: int, risk: float,
                               emotion: str, top_factors: list) -> str:
        """Generate human-readable narrative for PHQ-9 prediction."""
        severity = "Severe"
        if score < 5:
            severity = "Minimal"
        elif score < 10:
            severity = "Mild"
        elif score < 15:
            severity = "Moderate"
        elif score < 20:
            severity = "Moderately Severe"
        
        narrative = f"PHQ-9 assessment indicates {severity.lower()} depression symptoms (Score: {score}/27). " \
                   f"Risk classification: {('HIGH' if risk >= 0.75 else 'MEDIUM' if risk >= 0.5 else 'LOW')}. " \
                   f"Dominant emotional state: {emotion}. "
        
        if top_factors:
            narrative += f"Most significant concern areas: {', '.join([f[0][:25] for f in top_factors[:2]])}."
        
        return narrative
    
    def generate_audit_report(self, explanation: ModelExplanation) -> str:
        """Generate explainability audit report for compliance."""
        report = f"""
EXPLAINABILITY AUDIT REPORT
{'='*50}

Prediction Value: {explanation.prediction:.4f}
Base/Average Value: {explanation.base_value:.4f}
Model Confidence: {explanation.model_confidence:.2%}

KEY CONTRIBUTING FACTORS:
{chr(10).join([f"  • {name}: {score:+.4f}" for name, score in explanation.top_contributing_factors[:5]])}

DETAILED EXPLANATIONS:
{chr(10).join([f"  • {e.feature_name}: {e.explanation}" for e in explanation.local_explanations[:10]])}

MODEL LIMITATIONS:
{chr(10).join([f"  • {l}" for l in explanation.limitations])}

PREDICTION NARRATIVE:
{explanation.prediction_narrative}

This explanation is intended for human review and should not be used
as the sole basis for clinical decision-making.
{'='*50}
        """
        return report
