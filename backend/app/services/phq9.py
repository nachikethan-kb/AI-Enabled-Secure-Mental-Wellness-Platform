from dataclasses import dataclass


@dataclass
class PHQ9ScoreBreakdown:
    emotional: int
    cognitive: int
    physical: int
    functional: int


@dataclass
class PHQ9ScoreResult:
    score: int
    risk_level: str
    breakdown: PHQ9ScoreBreakdown


class PHQ9ScorerModel:
    """Lightweight scoring model for PHQ-9 with domain-level explainability."""

    _RISK_BANDS: list[tuple[int, str]] = [
        (4, "Minimal"),
        (9, "Mild"),
        (14, "Moderate"),
        (19, "Moderately Severe"),
        (27, "Severe"),
    ]

    def predict(self, answers: list[int]) -> PHQ9ScoreResult:
        score = sum(answers)
        risk_level = self._risk_from_score(score)

        breakdown = PHQ9ScoreBreakdown(
            emotional=answers[0] + answers[1] + answers[8],
            cognitive=answers[5] + answers[6],
            physical=answers[2] + answers[3] + answers[4],
            functional=answers[7],
        )

        return PHQ9ScoreResult(score=score, risk_level=risk_level, breakdown=breakdown)

    def _risk_from_score(self, score: int) -> str:
        for threshold, label in self._RISK_BANDS:
            if score <= threshold:
                return label
        return "Severe"


_phq9_model = PHQ9ScorerModel()


def classify_phq9_risk(answers: list[int]) -> tuple[int, str]:
    result = _phq9_model.predict(answers)
    return result.score, result.risk_level


def score_phq9(answers: list[int]) -> PHQ9ScoreResult:
    return _phq9_model.predict(answers)
