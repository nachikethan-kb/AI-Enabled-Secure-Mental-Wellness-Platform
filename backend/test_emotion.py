from app.services.emotion_classifier import analyze_emotion

texts = [
    "I feel completely fine and happy today.",
    "mild sleep disturbance: insomnia or hypersomnia",
    "severe self-harm thoughts: thoughts about death or self-harm. frequent depressed mood: persistent sadness or hopelessness.",
    "I am extremely angry and frustrated at my situation!",
    "mild low energy: fatigue and low drive. frequent low self-worth: guilt, shame, or worthlessness."
]

for t in texts:
    label, score = analyze_emotion(t)
    print(f"Text: {t}\nEmotion: {label}, Score: {score}\n")
