"""
Servicio de bot de WhatsApp con máquina de estados finitos (FSM) en Redis.

Estados de registro:
  0 → inicio: el bot saluda y pregunta el nombre
  1 → esperando nombre: captura el nombre y pregunta el barrio
  2 → esperando barrio: valida contra lista estática, registra al ciudadano

El estado se almacena en Redis con la clave: fsm:{phone}
El nombre capturado se guarda temporalmente en:  fsm:{phone}:name
"""
from __future__ import annotations

import logging

import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.db.models.citizen import Citizen

logger = logging.getLogger(__name__)

# ── Lista estática de barrios válidos ─────────────────────────────────────────
VALID_NEIGHBORHOODS: frozenset[str] = frozenset(
    {
        "centro",
        "palermo",
        "belgrano",
        "caballito",
        "flores",
        "villa del parque",
        "almagro",
        "boedo",
        "san telmo",
        "la boca",
        "recoleta",
        "montserrat",
        "balvanera",
        "barracas",
        "villa crespo",
    }
)

# Claves de estado FSM en Redis
_STATE_KEY = "fsm:{phone}"
_NAME_KEY = "fsm:{phone}:name"
# TTL de 24 horas para limpiar estados huérfanos
_TTL_SECONDS = 86_400


class WhatsAppBotService:
    """
    Orquesta la lógica conversacional del bot de registro ciudadano.
    Recibe un mensaje de texto y devuelve la respuesta que debe enviarse.
    """

    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        # Conexión Redis reutilizable por request
        self._redis: aioredis.Redis = aioredis.from_url(
            settings.redis_url, decode_responses=True
        )

    # ─── Punto de entrada principal ───────────────────────────────────────────

    async def handle_message(self, phone: str, text: str) -> str:
        """
        Procesa un mensaje entrante y retorna el texto de respuesta.
        Crea o actualiza el estado FSM del ciudadano en Redis.
        """
        text = text.strip()

        # Verificar si el ciudadano ya está registrado
        existing = await self._get_citizen_by_phone(phone)
        if existing is not None:
            return (
                f"¡Hola {existing.name}! Ya estás registrado/a en VozCiudadana. "
                "Pronto podrás reportar problemas de tu barrio por este medio. 🏙️"
            )

        # Leer estado actual desde Redis (default: "0")
        state = await self._get_state(phone)

        if state == "0":
            return await self._handle_state_start(phone)
        elif state == "1":
            return await self._handle_state_capture_name(phone, text)
        elif state == "2":
            return await self._handle_state_capture_neighborhood(phone, text)
        else:
            # Estado desconocido — resetear
            await self._set_state(phone, "0")
            return await self._handle_state_start(phone)

    # ─── Handlers por estado ──────────────────────────────────────────────────

    async def _handle_state_start(self, phone: str) -> str:
        """Estado 0: saludo inicial y solicitud de nombre."""
        await self._set_state(phone, "1")
        return (
            "¡Bienvenido/a a *VozCiudadana*! 🏛️\n\n"
            "Soy el asistente virtual de tu municipio.\n"
            "Para registrarte, necesito algunos datos.\n\n"
            "¿Cuál es tu nombre completo?"
        )

    async def _handle_state_capture_name(self, phone: str, text: str) -> str:
        """Estado 1: recibe el nombre y solicita el barrio."""
        if not text:
            return "Por favor, escribí tu nombre completo para continuar."

        # Guardar nombre temporalmente en Redis
        await self._redis.setex(_NAME_KEY.format(phone=phone), _TTL_SECONDS, text)
        await self._set_state(phone, "2")

        barrios = ", ".join(sorted(VALID_NEIGHBORHOODS))
        return (
            f"Gracias, *{text}*! 👋\n\n"
            f"¿En qué barrio vivís?\n\n"
            f"Barrios disponibles:\n_{barrios}_"
        )

    async def _handle_state_capture_neighborhood(self, phone: str, text: str) -> str:
        """Estado 2: valida el barrio y registra al ciudadano."""
        neighborhood_input = text.lower().strip()

        if neighborhood_input not in VALID_NEIGHBORHOODS:
            barrios = ", ".join(sorted(VALID_NEIGHBORHOODS))
            return (
                f"❌ No reconocemos el barrio *{text}*.\n\n"
                f"Por favor elegí uno de la siguiente lista:\n_{barrios}_"
            )

        # Recuperar nombre guardado en Redis
        name = await self._redis.get(_NAME_KEY.format(phone=phone))
        if not name:
            # Si expiró el nombre, reiniciar el flujo
            await self._set_state(phone, "0")
            return (
                "Parece que tu sesión expiró. "
                "¡No te preocupes! Empecemos de nuevo.\n\n¿Cuál es tu nombre completo?"
            )

        # Persistir ciudadano en la base de datos
        citizen = Citizen(
            phone=phone,
            name=name,
            neighborhood=neighborhood_input,
        )
        self._db.add(citizen)
        await self._db.commit()

        # Limpiar estado FSM de Redis
        await self._redis.delete(
            _STATE_KEY.format(phone=phone),
            _NAME_KEY.format(phone=phone),
        )

        logger.info("Ciudadano registrado: phone=%s neighborhood=%s", phone, neighborhood_input)

        return (
            f"✅ ¡Registro completado, *{name}*!\n\n"
            f"Barrio: *{neighborhood_input.title()}*\n\n"
            "Ahora podés reportar problemas de tu barrio y seguir el estado de tus reclamos. "
            "¡Gracias por participar! 🌟"
        )

    # ─── Helpers Redis ────────────────────────────────────────────────────────

    async def _get_state(self, phone: str) -> str:
        state = await self._redis.get(_STATE_KEY.format(phone=phone))
        return state if state is not None else "0"

    async def _set_state(self, phone: str, state: str) -> None:
        await self._redis.setex(_STATE_KEY.format(phone=phone), _TTL_SECONDS, state)

    # ─── Helpers DB ───────────────────────────────────────────────────────────

    async def _get_citizen_by_phone(self, phone: str) -> Citizen | None:
        result = await self._db.execute(select(Citizen).where(Citizen.phone == phone))
        return result.scalar_one_or_none()

    # ─── Cleanup ─────────────────────────────────────────────────────────────

    async def close(self) -> None:
        """Cierra la conexión Redis."""
        await self._redis.aclose()
