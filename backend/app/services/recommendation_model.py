from app.services.risk_classifier import RiskPrediction


class RecommendationModel:
    """Recommendation model conditioned on risk tier and emotional profile."""

    def predict(self, risk: RiskPrediction, emotion: str | None = None, mental_state: str | None = None) -> str:
        if mental_state == "crisis":
            return (
                "Urgent support recommended immediately. Please contact emergency or crisis services, "
                "and involve a trusted person right now."
            )
        if risk.tier == "high":
            return (
                "Immediate referral for professional consultation and crisis support. "
                "Please contact local emergency or trusted support now."
            )
        if risk.tier == "medium":
            if emotion in {"sadness", "fear", "anger"}:
                return (
                    "Schedule a counselor check-in within 24-72 hours and practice a guided CBT exercise daily."
                )
            return "Increase self-care routines, monitor symptoms, and re-assess in 3-5 days."
        return "Continue self-care and regular weekly check-ins to maintain wellbeing."


_recommendation_model = RecommendationModel()


def recommend_action(
    risk: RiskPrediction,
    emotion: str | None = None,
    mental_state: str | None = None,
) -> str:
    return _recommendation_model.predict(risk, emotion, mental_state)
