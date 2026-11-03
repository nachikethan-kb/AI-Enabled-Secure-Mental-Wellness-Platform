"""Column types that encrypt on write and decrypt on read (stored as TEXT)."""
from sqlalchemy import Text
from sqlalchemy.types import TypeDecorator

from app.core.security import decrypt_data, encrypt_data


class EncryptedText(TypeDecorator):
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        return None if value is None else encrypt_data(str(value))

    def process_result_value(self, value, dialect):
        return None if value is None else decrypt_data(value)


class EncryptedString(EncryptedText):
    """Encrypted String(length); length bounds the plaintext."""
    cache_ok = True

    def __init__(self, length=None, *args, **kwargs):
        self.plaintext_length = length
        super().__init__(*args, **kwargs)

    def process_bind_param(self, value, dialect):
        if value is not None and self.plaintext_length is not None:
            value = str(value)[: self.plaintext_length]
        return super().process_bind_param(value, dialect)
