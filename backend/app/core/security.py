import base64
import binascii
import hashlib
import hmac
import logging
import os
from datetime import datetime, timedelta, timezone

from cryptography.fernet import Fernet, InvalidToken
from jose import jwt

from app.core.config import settings

logger = logging.getLogger(__name__)

ALGORITHM = "HS256"
PBKDF2_ALGORITHM = "sha256"
PBKDF2_ITERATIONS = 390000
PBKDF2_PREFIX = "pbkdf2_sha256"


def _encode_bytes(value: bytes) -> str:
    return base64.b64encode(value).decode("ascii")


def _decode_bytes(value: str) -> bytes:
    return base64.b64decode(value.encode("ascii"))


def _verify_pbkdf2_password(plain_password: str, hashed_password: str) -> bool:
    try:
        prefix, iterations_str, salt_b64, digest_b64 = hashed_password.split("$", 3)
        if prefix != PBKDF2_PREFIX:
            return False

        iterations = int(iterations_str)
        salt = _decode_bytes(salt_b64)
        expected_digest = _decode_bytes(digest_b64)

        computed_digest = hashlib.pbkdf2_hmac(
            PBKDF2_ALGORITHM,
            plain_password.encode("utf-8"),
            salt,
            iterations,
        )
        return hmac.compare_digest(computed_digest, expected_digest)
    except (ValueError, binascii.Error):
        return False


def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith(f"{PBKDF2_PREFIX}$"):
        return _verify_pbkdf2_password(plain_password, hashed_password)

    try:
        from passlib.context import CryptContext

        legacy_context = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")
        return legacy_context.verify(plain_password, hashed_password)
    except Exception:
        return False


def get_password_hash(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac(
        PBKDF2_ALGORITHM,
        password.encode("utf-8"),
        salt,
        PBKDF2_ITERATIONS,
    )
    return f"{PBKDF2_PREFIX}${PBKDF2_ITERATIONS}${_encode_bytes(salt)}${_encode_bytes(digest)}"


def create_access_token(subject: str) -> str:
    expires_delta = timedelta(minutes=settings.access_token_expire_minutes)
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode = {"sub": subject, "exp": expire}
    return jwt.encode(to_encode, settings.secret_key, algorithm=ALGORITHM)


# ---- Data-at-rest encryption (Fernet). Uses DATA_ENCRYPTION_KEY (falls back to a key derived from SECRET_KEY if unset). ----
_FERNET_PREFIX = "gAAAAA"
_cipher_cache: dict = {}


def _derive_fernet_key(secret: str) -> bytes:
    """Return a valid Fernet key for `secret`.

    * A real Fernet key (32 url-safe-base64 bytes) is used exactly as given, so data that was
      already encrypted with it stays readable.
    * Any other text (e.g. a plain passphrase typed into .env) is turned into a Fernet key with
      SHA-256. The result is deterministic, so the SAME text on two laptops gives the SAME key.
    """
    secret = secret.strip().strip('"').strip("'")
    try:
        raw = base64.urlsafe_b64decode(secret.encode("ascii"))
        if len(raw) == 32:
            return secret.encode("ascii")
    except (ValueError, binascii.Error, UnicodeEncodeError):
        pass
    return base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())


def get_data_cipher() -> Fernet:
    key = (settings.data_encryption_key or "").strip()
    if not key:
        # No DATA_ENCRYPTION_KEY configured: fall back to a key derived from SECRET_KEY so the
        # app still works instead of crashing with an HTTP 500 "Request failed".
        key = f"healthly-data-key::{settings.secret_key}"
        if "_warned" not in _cipher_cache:
            _cipher_cache["_warned"] = True
            logger.warning(
                "DATA_ENCRYPTION_KEY is not set - deriving the data-encryption key from SECRET_KEY. "
                "Set the SAME DATA_ENCRYPTION_KEY in backend/.env on every laptop."
            )
    cipher = _cipher_cache.get(key)
    if cipher is None:
        cipher = Fernet(_derive_fernet_key(key))
        _cipher_cache[key] = cipher
    return cipher


def encrypt_data(text):
    if text is None:
        return None
    return get_data_cipher().encrypt(text.encode("utf-8")).decode("ascii")


def is_encrypted(value) -> bool:
    if not value or not value.startswith(_FERNET_PREFIX):
        return False
    try:
        get_data_cipher().decrypt(value.encode("ascii"))
        return True
    except (InvalidToken, ValueError, UnicodeEncodeError):
        return False


def decrypt_data(ciphertext, *, strict: bool = False):
    """Non-strict: legacy plaintext rows are returned as-is until the migration runs."""
    if ciphertext is None:
        return None
    try:
        return get_data_cipher().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError, UnicodeEncodeError):
        if strict:
            raise
        if ciphertext.startswith(_FERNET_PREFIX) and len(ciphertext) > 60:
            raise InvalidToken("Stored value looks encrypted but cannot be decrypted with DATA_ENCRYPTION_KEY")
        return ciphertext


def encrypt_bytes(data: bytes) -> bytes:
    return get_data_cipher().encrypt(data)


def decrypt_bytes(token: bytes) -> bytes:
    return get_data_cipher().decrypt(token)
