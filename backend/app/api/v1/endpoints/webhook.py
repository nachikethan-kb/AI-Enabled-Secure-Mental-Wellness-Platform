from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.deps import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.webhook import NewUserWebhookRequest, WebhookResponse
from app.services.webhook_service import send_webhook_to_n8n_new_user, send_webhook_to_n8n_risk_alert

router = APIRouter()


def verify_webhook_secret(x_webhook_secret: str = Header(...)) -> None:
    """Verify the webhook secret from header."""
    if x_webhook_secret != settings.webhook_secret:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook secret")


@router.post("/webhook/risk-alert", response_model=WebhookResponse)
async def receive_risk_alert_webhook(
    webhook_secret_verified: None = Depends(verify_webhook_secret),
) -> WebhookResponse:
    """
    Internal webhook endpoint that receives risk alert notifications.
    n8n will POST to this endpoint after processing the workflow.
    """
    return WebhookResponse(
        success=True,
        message="Risk alert webhook received and processing started",
        workflow_id="risk-alert-workflow",
    )


@router.post("/webhook/new-user", response_model=WebhookResponse)
async def receive_new_user_webhook(
    payload: NewUserWebhookRequest,
    webhook_secret_verified: None = Depends(verify_webhook_secret),
) -> WebhookResponse:
    """
    Internal webhook endpoint for new user onboarding confirmation.
    Called by n8n after completing the onboarding workflow.
    """
    return WebhookResponse(
        success=True,
        message="New user onboarding started",
        workflow_id="new-user-onboarding-workflow",
    )


@router.get("/api/user/last-score/{user_id}")
async def get_user_last_phq9_score(
    user_id: int, db: Session = Depends(get_db), webhook_secret_verified: None = Depends(verify_webhook_secret)
) -> dict:
    """
    n8n internal API endpoint to fetch the user's last PHQ-9 score.
    Used by recurring check-in workflows.
    """
    from app.models.phq9_assessment import PHQ9Assessment

    last_assessment = (
        db.query(PHQ9Assessment)
        .filter(PHQ9Assessment.user_id == user_id)
        .order_by(PHQ9Assessment.created_at.desc())
        .first()
    )

    if not last_assessment:
        return {
            "user_id": user_id,
            "score": None,
            "risk_level": None,
            "created_at": None,
            "message": "No previous assessment found",
        }

    return {
        "user_id": user_id,
        "score": last_assessment.score,
        "risk_level": last_assessment.risk_level,
        "created_at": last_assessment.created_at.isoformat(),
    }


@router.post("/trigger-n8n/risk-alert/{user_id}")
async def trigger_risk_alert_workflow(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WebhookResponse:
    """
    Endpoint called by assessment endpoint to trigger risk alert workflow in n8n.
    Only the same user can trigger this.
    """
    if current_user.id != user_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Can only trigger for your own user ID")

    from app.models.phq9_assessment import PHQ9Assessment

    last_assessment = (
        db.query(PHQ9Assessment)
        .filter(PHQ9Assessment.user_id == user_id)
        .order_by(PHQ9Assessment.created_at.desc())
        .first()
    )

    if not last_assessment:
        raise HTTPException(status_code=404, detail="No assessment found")

    result = await send_webhook_to_n8n_risk_alert(
        user_id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        phq9_score=last_assessment.score,
        risk_level=last_assessment.risk_level,
    )

    return WebhookResponse(
        success=result.get("success", False),
        message=result.get("message", ""),
        workflow_id="risk-alert-workflow",
    )


@router.post("/trigger-n8n/new-user")
async def trigger_new_user_workflow(current_user: User = Depends(get_current_user)) -> WebhookResponse:
    """
    Trigger new user onboarding workflow in n8n (called after registration).
    """
    result = await send_webhook_to_n8n_new_user(
        user_id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
    )

    return WebhookResponse(
        success=result.get("success", False),
        message=result.get("message", ""),
        workflow_id="new-user-onboarding-workflow",
    )
