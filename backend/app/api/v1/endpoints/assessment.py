from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.phq9_assessment import PHQ9Assessment
from app.models.user import User
from app.schemas.assessment import PHQ9HistoryItem, PHQ9HistoryResponse, PHQ9Request, PHQ9Response
from app.services.phq9_emotion_agent import analyze_phq9_emotions
from app.services.phq9 import score_phq9
from app.services.recommendation_model import recommend_action
from app.services.risk_classifier import classify_assessment_risk
from app.services.webhook_service import send_webhook_to_n8n_risk_alert

router = APIRouter()


@router.post("/phq9", response_model=PHQ9Response)
async def submit_phq9(
    payload: PHQ9Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PHQ9Response:
    score_result = score_phq9(payload.answers)
    score = score_result.score
    risk_level = score_result.risk_level
    emotion_result = analyze_phq9_emotions(payload.answers)
    risk = classify_assessment_risk(payload.answers, score)

    response = PHQ9Response(
        score=score,
        risk_level=risk_level,
        high_risk=risk.high_risk,
            recommended_action=recommend_action(
                risk,
                emotion_result.dominant_emotion,
                emotion_result.mental_state_label,
            ),
        risk_probability=risk.probability,
        dominant_emotion=emotion_result.dominant_emotion,
        emotion_confidence=emotion_result.confidence,
        secondary_emotions=emotion_result.secondary_emotions,
        concern_areas=emotion_result.concern_areas,
        emotion_rationale=emotion_result.rationale,
        emotion_summary=emotion_result.summary,
        needs_human_review=emotion_result.needs_human_review,
        risk_flags=emotion_result.risk_flags,
        agent_version=emotion_result.agent_version,
        mental_state_label=emotion_result.mental_state_label,
        mental_state_confidence=emotion_result.mental_state_confidence,
        emotional_score=score_result.breakdown.emotional,
        cognitive_score=score_result.breakdown.cognitive,
        physical_score=score_result.breakdown.physical,
        functional_score=score_result.breakdown.functional,
    )

    assessment = PHQ9Assessment(
        user_id=current_user.id,
        answers=payload.answers,
        score=response.score,
        risk_level=response.risk_level,
        high_risk=response.high_risk,
        recommended_action=response.recommended_action,
        dominant_emotion=response.dominant_emotion,
        emotion_confidence=response.emotion_confidence,
        secondary_emotions=response.secondary_emotions,
        concern_areas=response.concern_areas,
        emotion_rationale=response.emotion_rationale,
        emotion_summary=response.emotion_summary,
        needs_human_review=response.needs_human_review,
        risk_flags=response.risk_flags,
        agent_version=response.agent_version,
        mental_state_label=response.mental_state_label,
        mental_state_confidence=response.mental_state_confidence,
        emotional_score=response.emotional_score,
        cognitive_score=response.cognitive_score,
        physical_score=response.physical_score,
        functional_score=response.functional_score,
    )
    db.add(assessment)
    db.commit()

    # Trigger risk alert workflow if high-risk
    if response.high_risk:
        await send_webhook_to_n8n_risk_alert(
            user_id=current_user.id,
            email=current_user.email,
            full_name=current_user.full_name,
            phq9_score=response.score,
            risk_level=response.risk_level,
        )

    return response


@router.get("/phq9/history", response_model=PHQ9HistoryResponse)
def phq9_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PHQ9HistoryResponse:
    records = (
        db.query(PHQ9Assessment)
        .filter(PHQ9Assessment.user_id == current_user.id)
        .order_by(PHQ9Assessment.created_at.desc())
        .all()
    )

    return PHQ9HistoryResponse(
        items=[
            PHQ9HistoryItem(
                id=record.id,
                score=record.score,
                risk_level=record.risk_level,
                high_risk=record.high_risk,
                recommended_action=record.recommended_action,
                created_at=record.created_at.isoformat(),
                dominant_emotion=record.dominant_emotion,
                emotion_confidence=record.emotion_confidence,
                secondary_emotions=record.secondary_emotions,
                concern_areas=record.concern_areas,
                emotion_rationale=record.emotion_rationale,
                emotion_summary=record.emotion_summary,
                needs_human_review=record.needs_human_review,
                risk_flags=record.risk_flags,
                agent_version=record.agent_version,
                mental_state_label=record.mental_state_label,
                mental_state_confidence=record.mental_state_confidence,
                emotional_score=record.emotional_score,
                cognitive_score=record.cognitive_score,
                physical_score=record.physical_score,
                functional_score=record.functional_score,
            )
            for record in records
        ]
    )


@router.post("/agentic")
def run_agentic_orchestrator(
    payload: PHQ9Request,
    text: str = "",
    current_user: User = Depends(get_current_user)
) -> dict:
    """
    Runs the LangChain Agentic AI Orchestrator:
    coordinating: PHQ-9 scoring -> DistilBERT emotion analysis -> XGBoost risk classification -> response generation.
    """
    from app.services.agentic_orchestrator import orchestrate_assessment
    try:
        return orchestrate_assessment(payload.answers, text)
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=400, detail=str(e))

