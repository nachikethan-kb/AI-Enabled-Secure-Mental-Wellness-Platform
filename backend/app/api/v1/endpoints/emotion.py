from fastapi import APIRouter

from app.schemas.emotion import EmotionAnalysisRequest, EmotionAnalysisResponse
from app.services.emotion_classifier import analyze_emotion

router = APIRouter()


@router.post("/analyze", response_model=EmotionAnalysisResponse)
def analyze_text(payload: EmotionAnalysisRequest) -> EmotionAnalysisResponse:
    emotion, confidence = analyze_emotion(payload.text)
    return EmotionAnalysisResponse(emotion=emotion, confidence=confidence)
