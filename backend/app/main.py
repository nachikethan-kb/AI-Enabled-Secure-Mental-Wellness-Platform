import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import models
from app.api.v1.router import api_router
from app.core.config import settings
from app.db.session import Base, engine
from app.services.emotion_classifier import get_emotion_pipeline
from app.services.mental_state_classifier import _load_artifact

logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)

from app.db.schema_upgrade import ensure_schema  # noqa: E402
ensure_schema()

app = FastAPI(title=settings.project_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    # Also accept the frontend being opened from another laptop on the same LAN.
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Always answer with JSON so the UI shows the real reason instead of a bare "Request failed"."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": f"Server error: {type(exc).__name__}: {exc}"})


@app.get("/health", tags=["health"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


async def daily_cleanup_and_aggregation_loop():
    """Background scheduler task to aggregate daily metrics and purge stale sensor data."""
    logger.info("✓ Background WiFi aggregation & retention scheduler started")
    while True:
        try:
            # Check for aggregates and cleanup every 6 hours
            await asyncio.sleep(21600)
            from app.db.session import SessionLocal
            from app.api.v1.endpoints.wifi_sensor import run_daily_aggregations
            from app.models.wifi_sensor import SensorReading
            from datetime import datetime, timedelta
            
            db = SessionLocal()
            try:
                # 1. Run daily aggregations
                await run_daily_aggregations(db)
                
                # 2. Enforce 90-day retention policy
                cutoff = datetime.utcnow() - timedelta(days=90)
                deleted = db.query(SensorReading).filter(SensorReading.timestamp < cutoff).delete()
                db.commit()
                if deleted:
                    logger.info(f"Purged {deleted} telemetry records older than 90 days (retention policy).")
            except Exception as e:
                logger.error(f"Error in background daily scheduler execution: {e}")
                db.rollback()
            finally:
                db.close()
        except asyncio.CancelledError:
            logger.info("Background daily scheduler cancelled.")
            break
        except Exception as e:
            logger.error(f"Background daily scheduler error: {e}")


@app.on_event("startup")
async def load_ml_models() -> None:
    """Pre-load trained ML models at startup for faster inference."""
    try:
        get_emotion_pipeline()
        logger.info("✓ Emotion classification model loaded successfully")
    except Exception as e:
        logger.warning(f"⚠ Emotion model loading failed, will use fallback: {e}")

    try:
        _load_artifact()
        logger.info("✓ Mental state prediction model loaded successfully")
    except Exception as e:
        logger.warning(f"⚠ Mental state model loading failed, will use fallback: {e}")
        
    # Start the async background aggregation loop
    asyncio.create_task(daily_cleanup_and_aggregation_loop())
    
    # Start the websocket heartbeat monitoring loop
    from app.api.v1.endpoints.wifi_sensor import websocket_heartbeat_monitor
    asyncio.create_task(websocket_heartbeat_monitor())



from app.api.v1.endpoints.wifi_sensor import router as wifi_router
from app.api.v1.endpoints.video_call import ws_router as video_call_ws_router
import asyncio

app.include_router(api_router, prefix=settings.api_v1_prefix)
app.include_router(wifi_router)
app.include_router(video_call_ws_router)


