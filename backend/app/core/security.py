"""
Utilidades de seguridad: validación de firma HMAC-SHA256 del webhook de Meta.
"""
import hashlib
import hmac

from app.core.config import settings


def verify_meta_signature(payload: bytes, signature_header: str) -> bool:
    """
    Valida el encabezado X-Hub-Signature-256 enviado por Meta.

    Meta firma el cuerpo del request con HMAC-SHA256 usando el App Secret.
    El encabezado tiene el formato: 'sha256=<hex_digest>'
    """
    if not signature_header or not signature_header.startswith("sha256="):
        return False

    expected_digest = signature_header.removeprefix("sha256=")

    computed = hmac.new(
        key=settings.whatsapp_app_secret.encode(),
        msg=payload,
        digestmod=hashlib.sha256,
    ).hexdigest()

    # Comparación de tiempo constante para prevenir ataques de tiempo
    return hmac.compare_digest(computed, expected_digest)
