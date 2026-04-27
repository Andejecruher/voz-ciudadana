-- Seed idempotente de roles base para panel administrativo.
-- No modifica estructura: solo inserta datos en roles.

INSERT INTO "roles" ("id", "name", "description", "created_at")
VALUES
  ('00000000-0000-0000-0000-000000000101', 'SUPERADMIN', 'Acceso total al panel y configuración', CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000102', 'COORDINADOR', 'Lectura operativa y coordinación de equipo', CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000103', 'OPERADOR_CHAT', 'Operación de conversaciones y handover', CURRENT_TIMESTAMP),
  ('00000000-0000-0000-0000-000000000104', 'ANALISTA', 'Consulta y análisis de datos del panel', CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;
