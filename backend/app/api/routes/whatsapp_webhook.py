"""
Router del webhook de WhatsApp (Meta Cloud API).

GET  /webhook  → verificación del webhook por parte de Meta
POST /webhook  → recepción de mensajes entrantes
"""
import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_meta_signature
from app.schemas.webhook import WebhookPayload
from app.services.whatsapp_bot_service import WhatsAppBotService

logger = logging.getLogger(__name__)
router = APIRouter()


# ─── GET: verificación de webhook ────────────────────────────────────────────

@router.get("/webhook", tags=["WhatsApp Webhook"])
async def verify_webhook(request: Request):
    """
    Meta llama a este endpoint al registrar el webhook.
    Verifica el token y responde con el challenge para confirmar la URL.
    """
    params = request.query_params

    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token == settings.whatsapp_verify_token:
        logger.info("Webhook de WhatsApp verificado correctamente")
        # Responder con el challenge en texto plano (Meta lo requiere así)
        from fastapi.responses import PlainTextResponse
        return PlainTextResponse(content=challenge)

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Token de verificación inválido",
    )


# ─── POST: mensajes entrantes ─────────────────────────────────────────────────

@router.post("/webhook", status_code=status.HTTP_200_OK, tags=["WhatsApp Webhook"])
async def receive_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Recibe eventos de mensajes de Meta.
    1. Valida la firma HMAC-SHA256 del cuerpo.
    2. Parsea el payload con Pydantic.
    3. Procesa los mensajes en background para responder a Meta en < 5 s.
    """
    # Leer cuerpo raw para validar firma ANTES de parsear
    raw_body = await request.body()

    signature = request.headers.get("X-Hub-Signature-256", "")
    if not verify_meta_signature(raw_body, signature):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Firma HMAC-SHA256 inválida",
        )

    # Parsear payload
    try:
        payload = WebhookPayload.model_validate_json(raw_body)
    except Exception as exc:
        logger.warning("Payload de webhook inválido: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Payload inválido",
        )

    # Procesar mensajes en segundo plano para liberar a Meta rápidamente
    background_tasks.add_task(_process_webhook_payload, payload, db)

    # Meta espera siempre 200 OK
    return {"status": "received"}


# ─── Procesamiento en background ─────────────────────────────────────────────

async def _process_webhook_payload(payload: WebhookPayload, db: AsyncSession) -> None:
    """
    Itera sobre los mensajes del payload y delega en WhatsAppBotService.
    Los errores se loguean sin propagar para no afectar otros mensajes.
    """
    bot = WhatsAppBotService(db=db)

    try:
        for entry in payload.entry:
            for change in entry.changes:
                if change.field != "messages":
                    continue

                messages = change.value.messages or []
                for msg in messages:
                    if msg.type != "text" or msg.text is None:
                        # Ignorar mensajes no-texto por ahora
                        continue

                    phone = msg.from_
                    text = msg.text.body
                    logger.info("Mensaje entrante de %s: %r", phone, text)

                    try:
                        response_text = await bot.handle_message(phone=phone, text=text)
                        logger.info("Respuesta para %s: %r", phone, response_text)
                        # TODO: enviar response_text vía WhatsApp API (httpx)
                    except Exception as exc:
                        logger.exception(
                            "Error procesando mensaje de %s: %s", phone, exc
                        )
    finally:
        await bot.close()
