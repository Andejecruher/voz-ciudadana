"""
Schemas Pydantic v2 para el payload del webhook de WhatsApp (Meta Cloud API).
Solo se mapean los campos que la app consume; el resto se ignora con model_config extra='allow'.
"""
from typing import Any

from pydantic import BaseModel, ConfigDict


class WebhookProfile(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str


class WebhookContact(BaseModel):
    model_config = ConfigDict(extra="allow")
    profile: WebhookProfile
    wa_id: str


class WebhookTextBody(BaseModel):
    model_config = ConfigDict(extra="allow")
    body: str


class WebhookMessage(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    from_: str | None = None  # 'from' es palabra reservada — se mapea con alias
    timestamp: str
    type: str
    text: WebhookTextBody | None = None

    # Pydantic v2: usa alias para el campo 'from' del JSON
    model_config = ConfigDict(extra="allow", populate_by_name=True)

    @classmethod
    def model_validate(cls, obj: Any, *args, **kwargs):
        # Renombra 'from' → 'from_' antes de validar
        if isinstance(obj, dict) and "from" in obj:
            obj = {**obj, "from_": obj.pop("from")}
        return super().model_validate(obj, *args, **kwargs)


class WebhookValue(BaseModel):
    model_config = ConfigDict(extra="allow")
    messaging_product: str
    contacts: list[WebhookContact] | None = None
    messages: list[WebhookMessage] | None = None


class WebhookChange(BaseModel):
    model_config = ConfigDict(extra="allow")
    value: WebhookValue
    field: str


class WebhookEntry(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    changes: list[WebhookChange]


class WebhookPayload(BaseModel):
    """Cuerpo completo del POST enviado por Meta al webhook."""
    model_config = ConfigDict(extra="allow")
    object: str
    entry: list[WebhookEntry]
