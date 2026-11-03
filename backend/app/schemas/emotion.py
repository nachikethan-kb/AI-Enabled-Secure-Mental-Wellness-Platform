from pydantic import BaseModel, Field


class EmotionAnalysisRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class EmotionAnalysisResponse(BaseModel):
    emotion: str
    confidence: float
