"""Chat sentiment and linguistic analysis service (Mode 4A).

Uses the locally trained DistilBERT emotion model for per-message
sentiment classification, tracks emotional drift over conversation
turns, detects hopelessness markers, and identifies conversational
risk signals.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.services.emotion_classifier import analyze_emotion


@dataclass
class MessageAnalysis:
    text: str
    emotion: str
    confidence: float
    sentiment_polarity: float  # -1.0 to 1.0


@dataclass
class ChatAnalysisResult:
    messages_analyzed: int
    per_message: list[MessageAnalysis]
    dominant_emotion: str
    average_sentiment: float
    emotional_drift: float  # magnitude of sentiment change across conversation
    hopelessness_score: float  # 0.0 to 1.0
    risk_keywords_found: list[str]
    conversational_risk: str  # "Low", "Medium", "High"
    model_source: str


# Sentiment polarity mapping for DistilBERT emotion labels
_POLARITY = {
    "joy": 0.85, "surprise": 0.30, "neutral": 0.05, "stable": 0.10,
    "sadness": -0.70, "anger": -0.60, "fear": -0.65, "disgust": -0.55,
    "anxiety": -0.60, "overwhelm": -0.50, "shame": -0.65,
}

# Linguistic markers of hopelessness
_HOPELESSNESS_MARKERS = {
    "hopeless", "pointless", "worthless", "no point", "give up",
    "can't go on", "never get better", "what's the use", "nothing matters",
    "no one cares", "better off", "tired of living", "end it",
}

# Safety-critical keywords
_RISK_KEYWORDS = {
    "suicide", "kill", "die", "self-harm", "hurt myself", "overdose",
    "cutting", "hanging", "jumping", "pills", "gun",
    "lonely", "hopeless", "worthless", "burden", "trapped", "numb",
}


class ChatSentimentTracker:
    """Analyzes chat message sequences using DistilBERT and tracks emotional drift."""

    def analyze_conversation(self, messages: list[str]) -> ChatAnalysisResult:
        """Process a list of chat messages through DistilBERT emotion + drift analysis."""
        if not messages:
            return ChatAnalysisResult(
                messages_analyzed=0, per_message=[], dominant_emotion="neutral",
                average_sentiment=0.0, emotional_drift=0.0, hopelessness_score=0.0,
                risk_keywords_found=[], conversational_risk="Low", model_source="distilbert",
            )

        analyses: list[MessageAnalysis] = []
        emotion_counts: dict[str, float] = {}
        sentiments: list[float] = []
        all_risk_words: list[str] = []
        hopelessness_hits = 0

        for msg in messages:
            # Run trained DistilBERT emotion model
            emotion, confidence = analyze_emotion(msg)
            polarity = _POLARITY.get(emotion, 0.0)

            analyses.append(MessageAnalysis(
                text=msg, emotion=emotion,
                confidence=confidence, sentiment_polarity=polarity,
            ))
            sentiments.append(polarity)
            emotion_counts[emotion] = emotion_counts.get(emotion, 0.0) + confidence

            # Check for hopelessness markers
            msg_lower = msg.lower()
            for marker in _HOPELESSNESS_MARKERS:
                if marker in msg_lower:
                    hopelessness_hits += 1
                    break

            # Check for risk keywords
            for word in _RISK_KEYWORDS:
                if word in msg_lower and word not in all_risk_words:
                    all_risk_words.append(word)

        # Dominant emotion across conversation
        dominant = max(emotion_counts, key=emotion_counts.get) if emotion_counts else "neutral"
        avg_sentiment = sum(sentiments) / len(sentiments)

        # Emotional drift: how much sentiment changed from start to end
        if len(sentiments) >= 2:
            first_half = sum(sentiments[:len(sentiments)//2]) / max(1, len(sentiments)//2)
            second_half = sum(sentiments[len(sentiments)//2:]) / max(1, len(sentiments) - len(sentiments)//2)
            drift = second_half - first_half  # negative means worsening
        else:
            drift = 0.0

        # Hopelessness score
        hopelessness = min(1.0, hopelessness_hits / max(1, len(messages)) * 2.0)

        # Risk classification
        if hopelessness >= 0.5 or len(all_risk_words) >= 3 or avg_sentiment <= -0.5:
            risk = "High"
        elif hopelessness >= 0.2 or len(all_risk_words) >= 1 or avg_sentiment <= -0.3:
            risk = "Medium"
        else:
            risk = "Low"

        return ChatAnalysisResult(
            messages_analyzed=len(messages),
            per_message=analyses,
            dominant_emotion=dominant,
            average_sentiment=round(avg_sentiment, 4),
            emotional_drift=round(drift, 4),
            hopelessness_score=round(hopelessness, 4),
            risk_keywords_found=all_risk_words,
            conversational_risk=risk,
            model_source="trained_distilbert",
        )


# Singleton
chat_sentiment_tracker = ChatSentimentTracker()
