import httpx
from app.core.config import settings


async def trigger_n8n_workflow(webhook_path: str, data: dict) -> dict:
    """
    Trigger an n8n workflow by sending a POST request to the webhook URL.
    webhook_path: e.g., "webhook/risk-alert" or "webhook/new-user"
    """
    webhook_url = f"{settings.n8n_webhook_url}/{webhook_path}"

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(webhook_url, json=data, timeout=30.0)
            response.raise_for_status()
            return {"success": True, "message": "Workflow triggered", "response": response.json()}
    except httpx.RequestError as exc:
        return {"success": False, "message": f"Failed to trigger workflow: {str(exc)}"}


async def send_webhook_to_n8n_risk_alert(user_id: int, email: str, full_name: str, phq9_score: int, risk_level: str) -> dict:
    """
    Trigger the Risk Alert workflow in n8n.
    """
    payload = {
        "user_id": user_id,
        "email": email,
        "full_name": full_name,
        "phq9_score": phq9_score,
        "risk_level": risk_level,
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
    }

    return await trigger_n8n_workflow("webhook/risk-alert", payload)


async def send_webhook_to_n8n_new_user(user_id: int, email: str, full_name: str) -> dict:
    """
    Trigger the New User Onboarding workflow in n8n.
    """
    payload = {
        "user_id": user_id,
        "email": email,
        "full_name": full_name,
        "timestamp": __import__("datetime").datetime.utcnow().isoformat(),
    }

    return await trigger_n8n_workflow("webhook/new-user", payload)
