from dataclasses import dataclass

from app.services.emotion_classifier import analyze_emotion
from app.services.mental_state_classifier import analyze_mental_state


@dataclass
class AgentVote:
    agent_name: str
    emotion: str
    confidence: float
    evidence: list[str]


@dataclass
class AgenticEmotionResult:
    dominant_emotion: str
    confidence: float
    secondary_emotions: list[str]
    concern_areas: list[str]
    rationale: str
    summary: str
    needs_human_review: bool
    risk_flags: list[str]
    agent_version: str
    mental_state_label: str
    mental_state_confidence: float


class PHQ9EmotionAgent:
    """Planner + specialists + critic orchestration for PHQ-9 emotion analysis."""

    VERSION = "agentic-phq9-v2"

    _ITEM_CONTEXT: list[tuple[str, str]] = [
        ("anhedonia", "low motivation or low pleasure"),
        ("depressed mood", "persistent sadness or hopelessness"),
        ("sleep disturbance", "insomnia or hypersomnia"),
        ("low energy", "fatigue and low drive"),
        ("appetite change", "reduced or increased appetite"),
        ("low self-worth", "guilt, shame, or worthlessness"),
        ("concentration issues", "difficulty focusing"),
        ("psychomotor changes", "slowed down or restless behavior"),
        ("self-harm thoughts", "thoughts about death or self-harm"),
    ]

    _EMOTION_ALIASES: dict[str, str] = {
        "fear": "anxiety",
        "anger": "overwhelm",
        "disgust": "shame",
        "sadness": "sadness",
        "neutral": "stable",
        "joy": "stable",
        "surprise": "overwhelm",
    }

    def analyze(self, answers: list[int]) -> AgenticEmotionResult:
        concern_areas = self._extract_concern_areas(answers)
        plan = self._planner(answers)
        votes = self._run_specialists(answers, concern_areas, plan)
        decision, confidence, secondaries = self._fuse_votes(votes)
        mental_state = analyze_mental_state(answers)
        flags = self._risk_flags(answers, confidence, votes)
        needs_human_review = self._critic_requires_human_review(flags)

        if needs_human_review and decision == "stable":
            # Conservative override: avoid under-calling distress when high-risk markers exist.
            decision = "sadness"
            confidence = max(confidence, 0.55)

        if mental_state.label == "crisis":
            needs_human_review = True
            flags.append("mental_state_crisis")

        rationale = self._build_rationale(decision, concern_areas, answers, votes, flags)
        summary = self._build_summary(decision, confidence, concern_areas, needs_human_review, mental_state.label)

        return AgenticEmotionResult(
            dominant_emotion=decision,
            confidence=round(confidence, 4),
            secondary_emotions=secondaries,
            concern_areas=concern_areas,
            rationale=rationale,
            summary=summary,
            needs_human_review=needs_human_review,
            risk_flags=flags,
            agent_version=self.VERSION,
            mental_state_label=mental_state.label,
            mental_state_confidence=round(mental_state.confidence, 4),
        )

    def _planner(self, answers: list[int]) -> list[str]:
        plan = ["symptom-pattern-agent", "functional-impact-agent", "nlp-evidence-agent", "xgboost-risk-agent"]
        if answers[8] >= 1 or sum(answers) >= 15:
            plan.append("safety-agent")
        return plan

    def _run_specialists(self, answers: list[int], concern_areas: list[str], plan: list[str]) -> list[AgentVote]:
        votes: list[AgentVote] = []

        if "symptom-pattern-agent" in plan:
            votes.append(self._symptom_pattern_agent(answers))
        if "functional-impact-agent" in plan:
            votes.append(self._functional_impact_agent(answers))
        if "nlp-evidence-agent" in plan:
            votes.append(self._nlp_evidence_agent(answers, concern_areas))
        if "xgboost-risk-agent" in plan:
            votes.append(self._xgboost_risk_agent(answers))
        if "safety-agent" in plan:
            votes.append(self._safety_agent(answers))

        return votes

    def _xgboost_risk_agent(self, answers: list[int]) -> AgentVote:
        from app.services.risk_classifier import classify_assessment_risk
        
        total = sum(answers)
        risk_pred = classify_assessment_risk(answers, total)
        
        # XGBoost output drives agentic vote:
        if risk_pred.high_risk or risk_pred.probability >= 0.75:
            emotion = "sadness" if answers[8] >= 1 else "overwhelm"
            confidence = float(risk_pred.probability)
        elif risk_pred.tier == "medium" or risk_pred.probability >= 0.45:
            emotion = "overwhelm"
            confidence = float(risk_pred.probability)
        else:
            emotion = "stable"
            confidence = float(1.0 - risk_pred.probability)
            
        evidence = [
            f"XGBoost risk model source={risk_pred.model_source}",
            f"risk probability={risk_pred.probability:.4f}",
            f"classified tier={risk_pred.tier}"
        ]
        return AgentVote("xgboost-risk-agent", emotion, confidence, evidence)

    def _symptom_pattern_agent(self, answers: list[int]) -> AgentVote:
        sadness_signal = answers[1] + answers[0] + answers[8]
        anxiety_signal = answers[2] + answers[3] + answers[6]
        shame_signal = answers[5] + answers[8]
        overwhelm_signal = answers[3] + answers[4] + answers[7]

        score_map = {
            "sadness": sadness_signal / 9,
            "anxiety": anxiety_signal / 9,
            "shame": shame_signal / 6,
            "overwhelm": overwhelm_signal / 9,
            "stable": max(0.0, 1 - (sum(answers) / 27)),
        }
        emotion = max(score_map, key=score_map.get)
        confidence = min(max(score_map[emotion], 0.0), 1.0)
        evidence = [
            f"Q2+Q1+Q9 sadness signal={sadness_signal}",
            f"Q3+Q4+Q7 anxiety signal={anxiety_signal}",
        ]
        return AgentVote("symptom-pattern-agent", emotion, confidence, evidence)

    def _functional_impact_agent(self, answers: list[int]) -> AgentVote:
        functional = answers[7]
        cognition = answers[6]
        energy = answers[3]
        burden = functional + cognition + energy

        if burden >= 6:
            emotion = "overwhelm"
            confidence = 0.78
        elif answers[5] + answers[1] >= 4:
            emotion = "shame"
            confidence = 0.70
        elif sum(answers) <= 4:
            emotion = "stable"
            confidence = 0.75
        else:
            emotion = "sadness"
            confidence = 0.58

        evidence = [
            f"functional burden score={burden}",
            f"Q8={functional}, Q7={cognition}, Q4={energy}",
        ]
        return AgentVote("functional-impact-agent", emotion, confidence, evidence)

    def _nlp_evidence_agent(self, answers: list[int], concern_areas: list[str]) -> AgentVote:
        narrative = self._build_narrative(answers, concern_areas)
        raw_emotion, raw_confidence = analyze_emotion(narrative)
        mapped = self._EMOTION_ALIASES.get(raw_emotion, "sadness")
        confidence = max(min(raw_confidence, 1.0), 0.0)
        evidence = [f"transformer emotion={raw_emotion}", "narrative synthesized from PHQ-9 item severities"]
        return AgentVote("nlp-evidence-agent", mapped, confidence, evidence)

    def _safety_agent(self, answers: list[int]) -> AgentVote:
        self_harm = answers[8]
        total = sum(answers)

        if self_harm >= 2:
            return AgentVote(
                "safety-agent",
                "sadness",
                0.95,
                ["Q9 indicates frequent or severe self-harm thoughts", f"total score={total}"],
            )
        if self_harm == 1 or total >= 20:
            return AgentVote(
                "safety-agent",
                "overwhelm",
                0.82,
                ["Q9 mild positive or very high total burden", f"total score={total}"],
            )
        return AgentVote("safety-agent", "stable", 0.55, ["No immediate safety marker from Q9"])

    def _fuse_votes(self, votes: list[AgentVote]) -> tuple[str, float, list[str]]:
        weight_map = {
            "symptom-pattern-agent": 1.0,
            "functional-impact-agent": 0.9,
            "nlp-evidence-agent": 1.15,
            "xgboost-risk-agent": 1.2,
            "safety-agent": 1.3,
        }
        score_accumulator: dict[str, float] = {}
        for vote in votes:
            weighted = vote.confidence * weight_map.get(vote.agent_name, 1.0)
            score_accumulator[vote.emotion] = score_accumulator.get(vote.emotion, 0.0) + weighted

        ranked = sorted(score_accumulator.items(), key=lambda item: item[1], reverse=True)
        if not ranked:
            return "stable", 0.5, []

        top_emotion, top_score = ranked[0]
        # Calculate actual confidence as the weighted average probability 
        # (top_score is already the sum of weighted confidences).
        total_weight_for_top = sum(weight_map.get(v.agent_name, 1.0) for v in votes if v.emotion == top_emotion)
        
        # Avoid division by zero, though unlikely
        if total_weight_for_top > 0:
            confidence = top_score / total_weight_for_top
        else:
            confidence = 0.50
            
        confidence = min(max(confidence, 0.0), 0.99)
        
        secondary = [emotion for emotion, score in ranked[1:3] if score >= 0.6]

        return top_emotion, confidence, secondary

    def _risk_flags(self, answers: list[int], confidence: float, votes: list[AgentVote]) -> list[str]:
        flags: list[str] = []
        total = sum(answers)
        if answers[8] >= 1:
            flags.append("self_harm_signal")
        if total >= 20:
            flags.append("very_high_symptom_burden")
        if confidence < 0.60:
            flags.append("low_consensus")

        distinct_emotions = {vote.emotion for vote in votes}
        if len(distinct_emotions) >= 3:
            flags.append("high_agent_disagreement")
        return flags

    def _critic_requires_human_review(self, flags: list[str]) -> bool:
        return "self_harm_signal" in flags or "very_high_symptom_burden" in flags or "low_consensus" in flags

    def _extract_concern_areas(self, answers: list[int]) -> list[str]:
        return [
            name
            for idx, (name, _context) in enumerate(self._ITEM_CONTEXT)
            if answers[idx] >= 2
        ]

    def _build_narrative(self, answers: list[int], concern_areas: list[str]) -> str:
        phrases: list[str] = []
        for idx, answer in enumerate(answers):
            if answer <= 0:
                continue
            symptom, context = self._ITEM_CONTEXT[idx]
            if answer == 1:
                phrases.append(f"mild {symptom}: {context}")
            elif answer == 2:
                phrases.append(f"frequent {symptom}: {context}")
            else:
                phrases.append(f"severe {symptom}: {context}")

        if not phrases:
            phrases.append("overall stable mood and low symptom burden")
        if concern_areas:
            phrases.append("priority concerns include " + ", ".join(concern_areas))
        return ". ".join(phrases)

    def _build_rationale(
        self,
        dominant_emotion: str,
        concern_areas: list[str],
        answers: list[int],
        votes: list[AgentVote],
        flags: list[str],
    ) -> str:
        total_score = sum(answers)
        lead_concerns = ", ".join(concern_areas[:3]) if concern_areas else "low symptom intensity"
        agent_view = "; ".join([f"{vote.agent_name}:{vote.emotion}@{vote.confidence:.2f}" for vote in votes])
        flag_view = ", ".join(flags) if flags else "none"
        return (
            f"Dominant emotion={dominant_emotion}; PHQ-9 total={total_score}; concerns={lead_concerns}; "
            f"agent_votes=[{agent_view}]; risk_flags={flag_view}."
        )

    def _build_summary(
        self,
        dominant_emotion: str,
        confidence: float,
        concern_areas: list[str],
        needs_human_review: bool,
        mental_state_label: str,
    ) -> str:
        if concern_areas:
            concern_text = concern_areas[0]
            review_text = " Human review recommended." if needs_human_review else ""
            return (
                f"Orchestrated agents predict {dominant_emotion} with confidence {confidence:.2f}; "
                f"strongest concern is {concern_text}; mental state={mental_state_label}.{review_text}"
            )
        return f"Orchestrated agents indicate a mostly stable emotional pattern ({confidence:.2f}); mental state={mental_state_label}."


_phq9_emotion_agent = PHQ9EmotionAgent()


def analyze_phq9_emotions(answers: list[int]) -> AgenticEmotionResult:
    return _phq9_emotion_agent.analyze(answers)