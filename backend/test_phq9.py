import json
from app.services.phq9_emotion_agent import analyze_phq9_emotions
from app.services.phq9 import score_phq9

print("=" * 60)
print("RUNNING HEALTHLY PHQ-9 ML & AGENT AI PIPELINE TEST")
print("=" * 60)

# Case 1: Healthy Profile (Stable/Low Risk)
print("\n[TEST CASE 1] Profile: All 0s (Healthy / Minimal Distress)")
answers_stable = [0, 0, 0, 0, 0, 0, 0, 0, 0]

score_res = score_phq9(answers_stable)
print(f"Scorer Result -> Score: {score_res.score}, Risk Tier: {score_res.risk_level}")
print(f"Breakdown -> Emotional: {score_res.breakdown.emotional}, Physical: {score_res.breakdown.physical}, Cognitive: {score_res.breakdown.cognitive}, Functional: {score_res.breakdown.functional}")

agent_res = analyze_phq9_emotions(answers_stable)
print(f"Agentic Emotion Fused Decision -> {agent_res.dominant_emotion} (Confidence: {agent_res.confidence:.4f})")
print(f"Agent Version: {agent_res.agent_version}")
print(f"Mental State Classification: {agent_res.mental_state_label} (Confidence: {agent_res.mental_state_confidence:.4f})")
print(f"Risk Flags: {agent_res.risk_flags}")
print(f"Needs Human Review: {agent_res.needs_human_review}")
print(f"Emotion Rationale:\n  {agent_res.emotion_rationale if hasattr(agent_res, 'emotion_rationale') else agent_res.rationale}")

# Case 2: Crisis/High-Risk Profile (Severe distress and active self-harm thoughts)
print("\n" + "=" * 60)
print("[TEST CASE 2] Profile: All 3s (Severe Distress / Self-Harm Risk)")
answers_severe = [3, 3, 3, 3, 3, 3, 3, 3, 3]

score_res_severe = score_phq9(answers_severe)
print(f"Scorer Result -> Score: {score_res_severe.score}, Risk Tier: {score_res_severe.risk_level}")
print(f"Breakdown -> Emotional: {score_res_severe.breakdown.emotional}, Physical: {score_res_severe.breakdown.physical}, Cognitive: {score_res_severe.breakdown.cognitive}, Functional: {score_res_severe.breakdown.functional}")

agent_res_severe = analyze_phq9_emotions(answers_severe)
print(f"Agentic Emotion Fused Decision -> {agent_res_severe.dominant_emotion} (Confidence: {agent_res_severe.confidence:.4f})")
print(f"Agent Version: {agent_res_severe.agent_version}")
print(f"Mental State Classification: {agent_res_severe.mental_state_label} (Confidence: {agent_res_severe.mental_state_confidence:.4f})")
print(f"Risk Flags: {agent_res_severe.risk_flags}")
print(f"Needs Human Review: {agent_res_severe.needs_human_review}")
print(f"Emotion Rationale:\n  {agent_res_severe.emotion_rationale if hasattr(agent_res, 'emotion_rationale') else agent_res_severe.rationale}")
print("=" * 60)
