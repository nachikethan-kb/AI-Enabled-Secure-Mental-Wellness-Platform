"""
Bias Detection Layer for mental health analysis.
Identifies and mitigates demographic biases in AI predictions.
"""

from dataclasses import dataclass
from typing import Optional
import numpy as np


@dataclass
class BiasReport:
    """Report of detected biases."""
    has_potential_bias: bool
    bias_factors: list[str]
    affected_groups: list[str]
    bias_score: float  # 0.0-1.0, higher = more biased
    mitigation_strategies: list[str]
    confidence_adjustment: float  # Confidence multiplier (e.g., 0.85)
    recommendations: list[str]


class BiasDetector:
    """
    Detects and mitigates demographic and representation biases
    in mental health predictions.
    """
    
    def __init__(self):
        # Known bias patterns in mental health diagnosis
        self.demographic_sensitivities = {
            "age": {
                "elderly": ["underdiagnosis of depression", "atypical symptom presentation"],
                "adolescent": ["misdiagnosis as personality disorders", "overdiagnosis of ADHD"],
            },
            "gender": {
                "female": ["higher false positive rates for anxiety", "depression overdiagnosis"],
                "male": ["lower detection rates for depression", "underreporting of emotional symptoms"],
                "non-binary": ["limited training data", "ambiguous diagnostic criteria"],
            },
            "cultural": {
                "western": ["individualistic symptom bias", "somatic symptom underestimation"],
                "eastern": ["collectivist value underappreciation"],
                "other": ["cultural idioms of distress not captured"],
            },
            "socioeconomic": {
                "low_ses": ["stress from material hardship conflated with mental illness"],
                "high_ses": ["minimization of contextual stressors"],
            },
        }
        
        self.bias_thresholds = {
            "high_risk": 0.75,
            "moderate_risk": 0.5,
            "low_risk": 0.25,
        }
    
    def assess_bias(self, 
                   prediction_data: dict,
                   demographics: Optional[dict] = None,
                   text_content: Optional[str] = None) -> BiasReport:
        """
        Assess potential biases in the prediction.
        
        Args:
            prediction_data: Model predictions and scores
            demographics: User demographic info (age_group, gender, etc.)
            text_content: User input text for language bias analysis
        
        Returns:
            BiasReport with bias detection and mitigation strategies
        """
        bias_factors = []
        affected_groups = []
        bias_score = 0.0
        
        # Analyze demographic biases
        if demographics:
            demo_bias = self._check_demographic_biases(demographics, prediction_data)
            if demo_bias["bias_factors"]:
                bias_factors.extend(demo_bias["bias_factors"])
                affected_groups.extend(demo_bias["affected_groups"])
                bias_score += demo_bias["bias_score"]
        
        # Analyze language and presentation biases
        if text_content:
            lang_bias = self._check_language_biases(text_content, prediction_data)
            if lang_bias["bias_factors"]:
                bias_factors.extend(lang_bias["bias_factors"])
                bias_score += lang_bias["bias_score"]
        
        # Normalize bias score
        bias_score = min(bias_score / max(len(bias_factors), 1), 1.0)
        
        # Determine if bias is significant
        has_bias = bias_score >= self.bias_thresholds["low_risk"]
        
        # Generate mitigation strategies
        mitigation = self._generate_mitigations(bias_factors, demographics)
        
        # Calculate confidence adjustment
        confidence_adj = self._calculate_confidence_adjustment(bias_score)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(bias_factors, affected_groups)
        
        return BiasReport(
            has_potential_bias=has_bias,
            bias_factors=list(set(bias_factors)),  # Remove duplicates
            affected_groups=list(set(affected_groups)),
            bias_score=round(bias_score, 4),
            mitigation_strategies=mitigation,
            confidence_adjustment=round(confidence_adj, 4),
            recommendations=recommendations,
        )
    
    def _check_demographic_biases(self, demographics: dict,
                                 prediction_data: dict) -> dict:
        """Check for demographic-related biases."""
        bias_factors = []
        affected_groups = []
        bias_score = 0.0
        
        # Age-based bias check
        if "age_group" in demographics:
            age = demographics["age_group"]
            if age in self.demographic_sensitivities["age"]:
                bias_factors.extend(self.demographic_sensitivities["age"][age])
                affected_groups.append(f"Age group: {age}")
                bias_score += 0.2
        
        # Gender-based bias check
        if "gender" in demographics:
            gender = demographics["gender"].lower()
            for key in self.demographic_sensitivities["gender"]:
                if key in gender or gender in key:
                    bias_factors.extend(self.demographic_sensitivities["gender"][key])
                    affected_groups.append(f"Gender: {gender}")
                    bias_score += 0.25
                    break
        
        # Cultural bias check
        if "cultural_background" in demographics:
            culture = demographics["cultural_background"]
            if culture in self.demographic_sensitivities["cultural"]:
                bias_factors.extend(self.demographic_sensitivities["cultural"][culture])
                affected_groups.append(f"Cultural background: {culture}")
                bias_score += 0.2
        
        # SES-based bias check
        if "socioeconomic_status" in demographics:
            ses = demographics["socioeconomic_status"].lower()
            if "low" in ses:
                bias_factors.extend(self.demographic_sensitivities["socioeconomic"]["low_ses"])
                affected_groups.append("Low SES")
                bias_score += 0.15
            elif "high" in ses:
                bias_factors.extend(self.demographic_sensitivities["socioeconomic"]["high_ses"])
                affected_groups.append("High SES")
                bias_score += 0.1
        
        return {
            "bias_factors": bias_factors,
            "affected_groups": affected_groups,
            "bias_score": bias_score,
        }
    
    def _check_language_biases(self, text_content: str,
                              prediction_data: dict) -> dict:
        """Check for language-related biases."""
        bias_factors = []
        bias_score = 0.0
        
        text_lower = text_content.lower()
        
        # Check for emotional expression patterns
        emotional_words = ["sad", "depressed", "anxious", "angry", "frustrated"]
        emotion_count = sum(1 for word in emotional_words if word in text_lower)
        
        # Gender-biased language interpretation
        if emotion_count > 5:
            # High emotional expressiveness might be penalized differently by gender
            bias_factors.append("Potential gender bias in emotional expression interpretation")
            bias_score += 0.1
        
        # Cultural idioms
        if any(phrase in text_lower for phrase in ["heart pain", "blood boiling", "bones aching"]):
            bias_factors.append("Somatic expression patterns - culture-specific language detected")
            bias_score += 0.15
        
        # Check for English fluency bias
        text_word_count = len(text_content.split())
        if text_word_count < 20:
            bias_factors.append("Limited text - potential bias against non-native speakers")
            bias_score += 0.1
        
        return {
            "bias_factors": bias_factors,
            "bias_score": bias_score,
        }
    
    def _generate_mitigations(self, bias_factors: list[str],
                             demographics: Optional[dict]) -> list[str]:
        """Generate mitigation strategies for detected biases."""
        mitigations = []
        
        if not bias_factors:
            return ["No significant biases detected"]
        
        for factor in bias_factors:
            if "gender" in factor.lower():
                mitigations.append("Use gender-neutral assessment criteria")
                mitigations.append("Review decision against gender-balanced training data")
            
            if "age" in factor.lower():
                mitigations.append("Apply age-appropriate diagnostic criteria")
                mitigations.append("Consider age-related symptom presentation variations")
            
            if "cultural" in factor.lower() or "language" in factor.lower():
                mitigations.append("Consult cultural mental health frameworks")
                mitigations.append("Involve cultural competency expert review")
            
            if "somatic" in factor.lower():
                mitigations.append("Consider somatic vs psychological symptoms")
                mitigations.append("Include traditional healing context in assessment")
        
        return list(set(mitigations))  # Remove duplicates
    
    def _calculate_confidence_adjustment(self, bias_score: float) -> float:
        """Calculate confidence adjustment factor based on bias level."""
        if bias_score >= self.bias_thresholds["high_risk"]:
            return 0.75  # Reduce confidence by 25%
        elif bias_score >= self.bias_thresholds["moderate_risk"]:
            return 0.85  # Reduce confidence by 15%
        else:
            return 0.95  # Reduce confidence by 5%
    
    def _generate_recommendations(self, bias_factors: list[str],
                                 affected_groups: list[str]) -> list[str]:
        """Generate recommendations for bias mitigation."""
        recommendations = []
        
        if affected_groups:
            recommendations.append(
                f"Extra attention needed for {', '.join(affected_groups)}"
            )
        
        if bias_factors:
            recommendations.append(
                "Recommend human review to validate automated assessment"
            )
            recommendations.append(
                "Consider consulting domain expert familiar with affected demographics"
            )
        
        if any("gender" in f.lower() for f in bias_factors):
            recommendations.append("Use gender-inclusive language and assessment criteria")
        
        if any("cultural" in f.lower() for f in bias_factors):
            recommendations.append("Involve mental health professional from same cultural background")
        
        return recommendations
