"""
WiFi-based wearable/phone sensor bridge.

This replaces the old Bluetooth-LE mock service. Instead of scanning for
BLE wearables, the companion Android app (SensorApp) reads Activity +
Body Measurement records from Health Connect and pushes them to this
backend over the local WiFi network using a short-lived pairing code.

Kept intentionally simple and in-memory (single active pairing at a
time) to match how the original mock service behaved - no new DB
migrations required.
"""

import logging
import random
import secrets
import socket
import string
import time
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

# Kept for backward-compat with any code that still imports MOCK_DEVICES.
MOCK_DEVICES = []

PAIRING_CODE_TTL_SECONDS = 15 * 60  # pairing code expires if never used
STALE_AFTER_SECONDS = 45  # if no data pushed in this long, mark offline


def _get_lan_ip() -> str:
    """Best-effort discovery of this machine's LAN IP address (the address
    the phone, on the same WiFi network, should target)."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        try:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
        finally:
            s.close()
    except Exception:
        return "127.0.0.1"


def _generate_pairing_code() -> str:
    return "".join(random.choices(string.digits, k=6))


class WifiSensorService:
    """Holds the single active phone<->dashboard pairing session."""

    def __init__(self) -> None:
        self._pairing_code: Optional[str] = None
        self._pairing_created_at: float = 0.0
        self._connected: bool = False
        self._device: Optional[Dict[str, Any]] = None
        self._last_seen: float = 0.0
        self._latest_packet: Optional[Dict[str, Any]] = None
        self._subscribers = []
        self._user_id: Optional[int] = None  # patient who owns the active pairing

    # ---- Pairing lifecycle -------------------------------------------------

    def start_pairing(self, server_port: int = 8000, user_id: Optional[int] = None) -> Dict[str, Any]:
        """Generates a fresh pairing code and returns connection info to show
        on the web dashboard so the user can enter it on their phone."""
        self._pairing_code = _generate_pairing_code()
        self._user_id = user_id
        self._pairing_created_at = time.time()
        return {
            "pairing_code": self._pairing_code,
            "server_ip": _get_lan_ip(),
            "server_port": server_port,
            "expires_in": PAIRING_CODE_TTL_SECONDS,
        }

    def verify_pairing_code(self, code: str) -> bool:
        if not self._pairing_code:
            return False
        if time.time() - self._pairing_created_at > PAIRING_CODE_TTL_SECONDS:
            return False
        return secrets.compare_digest(code, self._pairing_code)

    def disconnect(self) -> Dict[str, Any]:
        self._connected = False
        self._device = None
        self._pairing_code = None
        self._latest_packet = None
        self._user_id = None
        return {"status": "disconnected"}

    # ---- Ingesting data from the phone --------------------------------------

    def ingest(self, device_id: str, activity_index: float, telemetry: Dict[str, Any],
               ai_analysis: Dict[str, Any], fusion: Dict[str, Any]) -> Dict[str, Any]:
        self._connected = True
        self._last_seen = time.time()
        self._device = {
            "name": "Android Health Connect",
            "address": device_id,
            "device_type": "phone",
            "brand": "Android",
            "rssi": -40,
            "is_mock": False,
        }
        packet = {
            "telemetry": telemetry,
            "ai_analysis": ai_analysis,
            "fusion_contribution": fusion,
            "device_status": {
                "battery_level": None,
                "connected": True,
            },
        }
        self._latest_packet = packet
        return packet

    # ---- Status / streaming --------------------------------------------------

    @property
    def paired_user_id(self) -> Optional[int]:
        return self._user_id

    def is_connected_for(self, user_id: int) -> bool:
        """True if this user's phone is paired AND recently pushing data."""
        if self._user_id != user_id or not self._connected:
            return False
        return (time.time() - self._last_seen) <= STALE_AFTER_SECONDS

    def live_info_for(self, user_id: int) -> Dict[str, Any]:
        """Live pairing info for one patient (used by the assigned doctor's Sensor Analysis view)."""
        if self._user_id != user_id or not self._connected:
            return {"connected": False, "device": None, "last_seen_seconds_ago": None, "telemetry": None}
        age = time.time() - self._last_seen
        connected = age <= STALE_AFTER_SECONDS
        return {
            "connected": connected,
            "device": self._device,
            "last_seen_seconds_ago": round(age, 1),
            "telemetry": (self._latest_packet or {}).get("telemetry") if connected else None,
        }

    def get_status(self) -> Dict[str, Any]:
        # Auto-expire if the phone stopped pushing data.
        if self._connected and (time.time() - self._last_seen) > STALE_AFTER_SECONDS:
            self._connected = False

        return {
            "connected": self._connected,
            "device": self._device,
            "is_mocked": False,
            "battery_level": None,
            "real_ble_supported": False,
            "pairing_code": self._pairing_code if not self._connected else None,
            "server_ip": _get_lan_ip(),
        }

    def get_latest_packet(self) -> Optional[Dict[str, Any]]:
        return self._latest_packet


wifi_sensor_service = WifiSensorService()

# Backward-compatible alias for any leftover imports of the old name.
bluetooth_service = wifi_sensor_service
