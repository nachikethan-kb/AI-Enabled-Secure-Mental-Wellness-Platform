"""
Agentic AI Orchestrator for coordinating PHQ-9 scoring, DistilBERT emotion analysis,
XGBoost risk classification, and CBT response generation.
"""

from typing import List, Dict, Any, Optional
from langchain_core.runnables import RunnableLambda
from app.services.phq9 import score_phq9
from app.services.emotion_classifier import analyze_emotion
from app.services.risk_classifier import classify_assessment_risk
from app.services.chatbot import generate_cbt_response


def parse_phq9(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """1. PHQ-9 scoring node."""
    answers = inputs.get("answers", [])
    if not answers or len(answers) != 9:
        raise ValueError("PHQ-9 assessment requires exactly 9 integer answers.")
    
    score_res = score_phq9(answers)
    return {
        **inputs,
        "phq9_score": score_res.score,
        "phq9_severity": score_res.risk_level,
        "phq9_breakdown": {
            "emotional": score_res.breakdown.emotional,
            "cognitive": score_res.breakdown.cognitive,
            "physical": score_res.breakdown.physical,
            "functional": score_res.breakdown.functional,
        }
    }


def analyze_emotion_text(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """2. DistilBERT emotion analysis node."""
    text = inputs.get("text", "")
    answers = inputs.get("answers", [])
    
    # Construct narrative from PHQ-9 answers if no text is provided
    if not text:
        symptoms = []
        labels = [
            "little interest or pleasure", 
            "feeling down, depressed, or hopeless", 
            "trouble sleeping",
            "feeling tired or little energy", 
            "poor appetite or overeating", 
            "feeling bad about self",
            "trouble concentrating", 
            "moving/speaking slowly or restless", 
            "thoughts of self-harm"
        ]
        for idx, val in enumerate(answers):
            if val > 0:
                symptoms.append(f"{labels[idx]} (severity: {val})")
        text = "User reports: " + (", ".join(symptoms) if symptoms else "no significant symptoms")
    
    emotion, confidence = analyze_emotion(text)
    return {
        **inputs,
        "narrative": text,
        "dominant_emotion": emotion,
        "emotion_confidence": confidence
    }


def classify_risk(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """3. XGBoost risk classification node."""
    answers = inputs.get("answers", [])
    total_score = inputs.get("phq9_score", sum(answers))
    risk_pred = classify_assessment_risk(answers, total_score)
    
    return {
        **inputs,
        "risk_probability": risk_pred.probability,
        "risk_tier": risk_pred.tier,
        "high_risk": risk_pred.high_risk,
        "model_source": risk_pred.model_source
    }


def generate_response(inputs: Dict[str, Any]) -> Dict[str, Any]:
    """4. Response generation node (CBT-aligned response)."""
    narrative = inputs.get("narrative", "")
    high_risk = inputs.get("high_risk", False)
    
    cbt_res = generate_cbt_response(narrative)
    response = cbt_res.get("response", "")
    
    # Override/escalate response if high risk is classified by XGBoost or PHQ-9
    if high_risk:
        response = (
            "I hear that you're in a very painful place right now. You're not alone. "
            "Please contact a trusted person or local emergency/crisis service immediately, "
            "and consider urgent consultation with a mental health professional."
        )
    
    return {
        **inputs,
        "response": response,
        "escalation_required": high_risk
    }


# Construct LangChain LCEL Orchestration Chain
orchestration_chain = (
    RunnableLambda(parse_phq9)
    | RunnableLambda(analyze_emotion_text)
    | RunnableLambda(classify_risk)
    | RunnableLambda(generate_response)
)


class AgenticAIOrchestrator:
    """Agentic AI Orchestrator coordinating model execution sequence using LangChain LCEL."""
    
    def __init__(self):
        self.chain = orchestration_chain
        
    def execute(self, answers: List[int], text: Optional[str] = None) -> Dict[str, Any]:
        """
        Executes the orchestrated workflow.
        Returns a dictionary containing assessment outputs from all models in the sequence.
        """
        inputs = {
            "answers": answers,
            "text": text or ""
        }
        return self.chain.invoke(inputs)


_orchestrator = AgenticAIOrchestrator()


def orchestrate_assessment(answers: List[int], text: Optional[str] = None) -> Dict[str, Any]:
    """Convenience helper function to run the Agentic AI Orchestrator."""
    return _orchestrator.execute(answers, text)
