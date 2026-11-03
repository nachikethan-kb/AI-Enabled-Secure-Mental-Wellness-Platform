from fastapi import APIRouter

from app.api.v1.endpoints import admin, assessment, auth, chat, emotion, forum, webhook, multimodal, bluetooth, video_call

api_router = APIRouter()
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(assessment.router, prefix="/assessment", tags=["assessment"])
api_router.include_router(emotion.router, prefix="/emotion", tags=["emotion"])
api_router.include_router(chat.router, prefix="/chat", tags=["chat"])
api_router.include_router(forum.router, prefix="/forum", tags=["forum"])
api_router.include_router(multimodal.router, prefix="/multimodal", tags=["multimodal"])
api_router.include_router(bluetooth.router, prefix="/bluetooth", tags=["bluetooth"])
api_router.include_router(webhook.router, tags=["webhook"])
api_router.include_router(admin.router, prefix="/admin", tags=["admin"])
api_router.include_router(video_call.router, prefix="/video-call", tags=["video-call"])


