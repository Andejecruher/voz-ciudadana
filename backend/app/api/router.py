"""
Router raíz que agrupa todas las rutas de la aplicación.
"""
from fastapi import APIRouter

from app.api.routes import health, whatsapp_webhook
from app.api.routes import auth, admin

api_router = APIRouter()

# Rutas de salud
api_router.include_router(health.router)

# Webhook de WhatsApp
api_router.include_router(whatsapp_webhook.router)

# Autenticación JWT
api_router.include_router(auth.router)

# Administración de usuarios y roles (solo admin)
api_router.include_router(admin.router)
