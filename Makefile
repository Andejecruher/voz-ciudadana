# ─────────────────────────────────────────────────────────────────────────────
# VozCiudadana — Makefile
# Comandos rápidos para el equipo. Todos asumen que Docker está corriendo.
# ─────────────────────────────────────────────────────────────────────────────

.PHONY: help \
        test-docker test-docker-fast \
        dev-up dev-down \
        docker-reset-dev-volumes

# ── Default ───────────────────────────────────────────────────────────────────
help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-30s\033[0m %s\n", $$1, $$2}'

# ── Tests en Docker ───────────────────────────────────────────────────────────
test-docker: ## Build + run de tests en Docker (profile test)
	docker compose --profile test build api-test
	docker compose --profile test run --rm api-test

test-docker-fast: ## Run de tests SIN rebuild (para iteración rápida)
	docker compose --profile test run --rm api-test

# ---- Construir build de development (profile dev) ----
build-dev: ## Construye imágenes del profile dev (sin levantar contenedores)
	docker compose --profile dev build

# ---- Levantar stack de desarrollo (profile dev) por primera vez ----
dev-up-first:
	docker compose --profile dev up --build -d

# ── Desarrollo ────────────────────────────────────────────────────────────────
dev-up: ## Levanta stack de desarrollo (profile dev)
	docker compose --profile dev up -d

dev-down: ## Baja el stack de desarrollo
	docker compose --profile dev down

# ── Limpieza de volúmenes ─────────────────────────────────────────────────────
docker-reset-dev-volumes: ## Elimina volúmenes anónimos stale del profile dev
	@echo "⚠️  Bajando el stack dev..."
	docker compose --profile dev down -v --remove-orphans
	@echo "✅  Volúmenes stale eliminados. Próximo 'make dev-up' recrea todo desde cero."
