"""
Agentic AI Orchestrator for mental health multimodal analysis.
Coordinates all analysis modes, fusion, safety, bias detection, and explainability.
"""

from dataclasses import dataclass, field
from typing import Optional, Any
from enum import Enum
from datetime import datetime

from app.services.fusion_engine import (
    AttentionFusionEngine, ModalityOutput, FusionResult
)
from app.services.safety_agent import SafetyAgent, SafetyAssessment
from app.services.bias_detector import BiasDetector, BiasReport
from app.services.explainability_engine import ExplainabilityEngine, ModelExplanation


class AnalysisMode(Enum):
    """Available analysis modes."""
    PHQ9_TEXT = "phq9_text"
    MEDICAL_RECORDS = "medical_records"
    SENSOR_WEARABLE = "sensor_wearable"
    CHAT_ANALYSIS = "chat_analysis"
    VIDEO_SPEECH = "video_speech"


@dataclass
class AnalysisResult:
    """Individual modality analysis result."""
    mode: AnalysisMode
    primary_finding: str
    risk_score: float
    confidence: float
    metadata: dict[str, Any] = field(default_factory=dict)
    explanation: Optional[ModelExplanation] = None


@dataclass
class ComprehensiveAssessment:
    """Complete multimodal assessment with all layers."""
    assessment_id: str
    timestamp: datetime
    
    # Individual modality results
    mode1_phq9: Optional[AnalysisResult] = None
    mode2_medical: Optional[AnalysisResult] = None
    mode3_sensor: Optional[AnalysisResult] = None
    mode4a_chat: Optional[AnalysisResult] = None
    mode4b_video: Optional[AnalysisResult] = None
    
    # Fusion result
    fusion_result: Optional[FusionResult] = None
    
    # Safety assessment
    safety_assessment: Optional[SafetyAssessment] = None
    
    # Bias report
    bias_report: Optional[BiasReport] = None
    
    # Final integrated metrics
    final_risk_score: float = 0.0
    risk_classification: str = "low"
    intervention_recommended: bool = False
    
    # Explainability
    explanations: dict[str, ModelExplanation] = field(default_factory=dict)
    
    # Audit trail
    models_used: list[str] = field(default_factory=list)
    processing_time_ms: float = 0.0


class OrchestratorAgent:
    """
    Main orchestrator for comprehensive mental health analysis.
    Coordinates all modalities, fusion, safety, bias, and explainability.
    """
    
    def __init__(self):
        self.fusion_engine = AttentionFusionEngine(device="cpu")
        self.safety_agent = SafetyAgent()
        self.bias_detector = BiasDetector()
        self.explainability_engine = ExplainabilityEngine()
        
        self.assessment_history = []
    
    async def orchestrate_comprehensive_assessment(
        self,
        user_id: str,
        demographics: Optional[dict] = None,
        phq9_data: Optional[dict] = None,
        medical_records: Optional[list[str]] = None,
        sensor_data: Optional[dict] = None,
        chat_messages: Optional[list[str]] = None,
        video_session_data: Optional[dict] = None,
    ) -> ComprehensiveAssessment:
        """
        Execute comprehensive multimodal mental health assessment.
        Integrates up to 5 analysis modes with fusion, safety, bias detection, and explainability.
        """
        import uuid
        from datetime import datetime
        import time
        
        start_time = time.time()
        assessment_id = str(uuid.uuid4())
        assessment = ComprehensiveAssessment(
            assessment_id=assessment_id,
            timestamp=datetime.now(),
        )
        
        # MODE 1: PHQ-9 Text Analysis
        if phq9_data:
            mode1_result = await self._analyze_phq9(phq9_data)
            assessment.mode1_phq9 = mode1_result
            assessment.models_used.append("PHQ-9 Analyzer")
            
            # Add to fusion engine
            if mode1_result:
                self.fusion_engine.add_modality_output(ModalityOutput(
                    modality_name="PHQ-9 Text",
                    primary_signal=mode1_result.primary_finding,
                    confidence=mode1_result.confidence,
                    risk_score=mode1_result.risk_score,
                    secondary_signals=[],
                    metadata=mode1_result.metadata,
                ))
        
        # MODE 2: Medical Record Analysis
        if medical_records:
            mode2_result = await self._analyze_medical_records(medical_records)
            assessment.mode2_medical = mode2_result
            assessment.models_used.append("Medical Record Analyzer")
            
            if mode2_result:
                self.fusion_engine.add_modality_output(ModalityOutput(
                    modality_name="Medical Records",
                    primary_signal=mode2_result.primary_finding,
                    confidence=mode2_result.confidence,
                    risk_score=mode2_result.risk_score,
                    secondary_signals=[],
                    metadata=mode2_result.metadata,
                ))
        
        # MODE 3: Sensor & Wearable Analysis
        if sensor_data:
            mode3_result = await self._analyze_sensor_data(sensor_data)
            assessment.mode3_sensor = mode3_result
            assessment.models_used.append("Sensor/Wearable LSTM Analyzer")
            
            if mode3_result:
                self.fusion_engine.add_modality_output(ModalityOutput(
                    modality_name="Sensor/Wearable",
                    primary_signal=mode3_result.primary_finding,
                    confidence=mode3_result.confidence,
                    risk_score=mode3_result.risk_score,
                    secondary_signals=[],
                    metadata=mode3_result.metadata,
                ))
        
        # MODE 4A: Chat Analysis
        if chat_messages:
            mode4a_result = await self._analyze_chat(chat_messages)
            assessment.mode4a_chat = mode4a_result
            assessment.models_used.append("Chat DistilBERT Analyzer")
            
            if mode4a_result:
                self.fusion_engine.add_modality_output(ModalityOutput(
                    modality_name="Chat Messages",
                    primary_signal=mode4a_result.primary_finding,
                    confidence=mode4a_result.confidence,
                    risk_score=mode4a_result.risk_score,
                    secondary_signals=[],
                    metadata=mode4a_result.metadata,
                ))
        
        # MODE 4B: Video & Speech Analysis
        if video_session_data:
            mode4b_result = await self._analyze_video_speech(video_session_data)
            assessment.mode4b_video = mode4b_result
            assessment.models_used.append("Video/Speech Emotion & Stress Analyzer")
            
            if mode4b_result:
                self.fusion_engine.add_modality_output(ModalityOutput(
                    modality_name="Video/Speech",
                    primary_signal=mode4b_result.primary_finding,
                    confidence=mode4b_result.confidence,
                    risk_score=mode4b_result.risk_score,
                    secondary_signals=[],
                    metadata=mode4b_result.metadata,
                ))
        
        # FUSION SYSTEM: Combine all modalities
        if self.fusion_engine.modality_buffer:
            fusion_result = self.fusion_engine.fuse()
            assessment.fusion_result = fusion_result
            assessment.final_risk_score = fusion_result.integrated_risk_score
            assessment.risk_classification = fusion_result.risk_classification
            assessment.models_used.append("Attention-Based Fusion Engine")
        
        # SAFETY AGENT: Assess intervention needs
        text_for_safety = " ".join(chat_messages) if chat_messages else phq9_data.get("narrative", "")
        phq9_score = phq9_data.get("score", 0) if phq9_data else None
        
        safety_assessment = self.safety_agent.assess_text(
            text=text_for_safety,
            phq9_score=phq9_score,
            emotion=assessment.mode1_phq9.metadata.get("dominant_emotion") if assessment.mode1_phq9 else None,
        )
        assessment.safety_assessment = safety_assessment
        assessment.models_used.append("Safety Agent")
        assessment.intervention_recommended = safety_assessment.requires_immediate_contact
        
        # BIAS DETECTION: Check for demographic biases
        bias_report = self.bias_detector.assess_bias(
            prediction_data={
                "phq9_risk": assessment.mode1_phq9.risk_score if assessment.mode1_phq9 else 0.0,
                "overall_risk": assessment.final_risk_score,
            },
            demographics=demographics,
            text_content=text_for_safety,
        )
        assessment.bias_report = bias_report
        assessment.models_used.append("Bias Detection Layer")
        
        # EXPLAINABILITY: Generate explanations for key predictions
        if assessment.mode1_phq9:
            phq9_explanation = self.explainability_engine.explain_phq9_prediction(
                answers=phq9_data.get("answers", []),
                phq9_score=phq9_data.get("score", 0),
                risk_score=assessment.mode1_phq9.risk_score,
                emotion_label=assessment.mode1_phq9.metadata.get("dominant_emotion", "unknown"),
            )
            assessment.explanations["phq9"] = phq9_explanation
        
        if assessment.mode3_sensor:
            sensor_explanation = self.explainability_engine.explain_sensor_prediction(
                sensor_data=sensor_data,
                anomaly_score=assessment.mode3_sensor.risk_score,
            )
            assessment.explanations["sensor"] = sensor_explanation
        
        assessment.models_used.append("Explainability Engine (SHAP/LIME)")
        
        # Update final metrics considering bias adjustments
        if bias_report.has_potential_bias:
            assessment.final_risk_score *= bias_report.confidence_adjustment
            assessment.models_used.append("Bias-Adjusted Risk Calculation")
        
        # Calculate processing time
        assessment.processing_time_ms = (time.time() - start_time) * 1000
        
        # Store in history
        self.assessment_history.append(assessment)
        
        return assessment
    
    async def _analyze_phq9(self, data: dict) -> AnalysisResult:
        """Analyze PHQ-9 questionnaire responses."""
        from app.services.phq9 import score_phq9
        from app.services.phq9_emotion_agent import analyze_phq9_emotions
        from app.services.risk_classifier import classify_assessment_risk
        
        try:
            score_result = score_phq9(data.get("answers", []))
            emotion_result = analyze_phq9_emotions(data.get("answers", []))
            risk = classify_assessment_risk(data.get("answers", []), score_result.score)
            
            return AnalysisResult(
                mode=AnalysisMode.PHQ9_TEXT,
                primary_finding=f"{emotion_result.mental_state_label} mental state with depression severity: {score_result.risk_level}",
                risk_score=risk.probability,
                confidence=emotion_result.mental_state_confidence,
                metadata={
                    "phq9_score": score_result.score,
                    "dominant_emotion": emotion_result.dominant_emotion,
                    "mental_state": emotion_result.mental_state_label,
                    "risk_flags": emotion_result.risk_flags,
                },
            )
        except Exception as e:
            return AnalysisResult(
                mode=AnalysisMode.PHQ9_TEXT,
                primary_finding=f"Error in PHQ-9 analysis: {str(e)}",
                risk_score=0.5,
                confidence=0.0,
                metadata={"error": str(e)},
            )
    
    async def _analyze_medical_records(self, records: list[str]) -> AnalysisResult:
        """Analyze medical records and health history."""
        # Placeholder for BioClinicalBERT analysis
        risk_score = 0.3
        
        # Basic pattern matching for risk indicators
        all_text = " ".join(records).lower()
        risk_keywords = ["depression", "anxiety", "suicidal", "psychiatric", "mental health"]
        
        for keyword in risk_keywords:
            if keyword in all_text:
                risk_score += 0.15
        
        return AnalysisResult(
            mode=AnalysisMode.MEDICAL_RECORDS,
            primary_finding=f"Medical history analysis: Risk indicators detected" if risk_score > 0.4 else "Medical history: Stable",
            risk_score=min(risk_score, 1.0),
            confidence=0.75,
            metadata={
                "record_count": len(records),
                "risk_keywords_found": len([k for k in risk_keywords if k in all_text]),
            },
        )
    
    async def _analyze_sensor_data(self, data: dict) -> AnalysisResult:
        """Analyze wearable sensor and biometric data."""
        # Placeholder for Bidirectional LSTM analysis
        risk_score = 0.0
        
        # Analyze each sensor metric
        if "heart_rate_variability" in data:
            hrv = data["heart_rate_variability"]
            if hrv < 30:  # Low HRV indicates stress
                risk_score += 0.3
            elif hrv < 50:
                risk_score += 0.15
        
        if "sleep_duration_hours" in data:
            sleep = data["sleep_duration_hours"]
            if sleep < 5 or sleep > 9:
                risk_score += 0.25
        
        if "stress_index" in data:
            stress = data["stress_index"]
            risk_score += stress * 0.3
        
        if "activity_level_steps" in data:
            steps = data["activity_level_steps"]
            if steps < 3000:  # Low activity
                risk_score += 0.1
        
        return AnalysisResult(
            mode=AnalysisMode.SENSOR_WEARABLE,
            primary_finding="Sensor anomalies detected" if risk_score > 0.4 else "Biometrics within normal ranges",
            risk_score=min(risk_score / 0.95, 1.0),  # Normalize
            confidence=0.82,
            metadata=data,
        )
    
    async def _analyze_chat(self, messages: list[str]) -> AnalysisResult:
        """Analyze user chat messages for emotional drift and risk signals."""
        from app.services.emotion_classifier import analyze_emotion
        
        risk_score = 0.0
        emotions = []
        
        for msg in messages:
            emotion, conf = analyze_emotion(msg)
            emotions.append((emotion, conf))
            
            # Risk scoring based on emotions
            high_risk_emotions = ["sadness", "fear", "anger"]
            if emotion in high_risk_emotions:
                risk_score += conf * 0.3
        
        return AnalysisResult(
            mode=AnalysisMode.CHAT_ANALYSIS,
            primary_finding=f"Chat sentiment: {emotions[0][0] if emotions else 'neutral'}" if emotions else "Insufficient data",
            risk_score=min(risk_score, 1.0),
            confidence=0.80,
            metadata={
                "message_count": len(messages),
                "emotions_detected": emotions[:5],
            },
        )
    
    async def _analyze_video_speech(self, data: dict) -> AnalysisResult:
        """Analyze video/facial expressions and speech emotion."""
        # Placeholder for DeepFace and Wav2Vec2 analysis
        risk_score = 0.0
        
        if "facial_emotions" in data:
            facial_risk_emotions = ["sadness", "fear", "disgust"]
            for emotion in data["facial_emotions"]:
                if emotion in facial_risk_emotions:
                    risk_score += 0.25
        
        if "voice_stress_score" in data:
            stress_score = data["voice_stress_score"]
            risk_score += stress_score * 0.3
        
        if "detected_keywords" in data:
            risk_keywords = data.get("risk_keywords", [])
            risk_score += len(risk_keywords) * 0.1
        
        return AnalysisResult(
            mode=AnalysisMode.VIDEO_SPEECH,
            primary_finding="Video/Speech analysis: Stress indicators detected" if risk_score > 0.3 else "Video/Speech: Normal",
            risk_score=min(risk_score, 1.0),
            confidence=0.78,
            metadata=data,
        )
    
    def get_assessment_summary(self, assessment: ComprehensiveAssessment) -> dict:
        """Generate summary report of comprehensive assessment."""
        return {
            "assessment_id": assessment.assessment_id,
            "timestamp": assessment.timestamp.isoformat(),
            "final_risk_score": assessment.final_risk_score,
            "risk_classification": assessment.risk_classification.upper(),
            "intervention_recommended": assessment.intervention_recommended,
            "dominant_modalities": assessment.fusion_result.dominant_modalities if assessment.fusion_result else [],
            "safety_level": assessment.safety_assessment.intervention_level.value if assessment.safety_assessment else None,
            "bias_detected": assessment.bias_report.has_potential_bias if assessment.bias_report else False,
            "models_used": assessment.models_used,
            "processing_time_ms": assessment.processing_time_ms,
        }
