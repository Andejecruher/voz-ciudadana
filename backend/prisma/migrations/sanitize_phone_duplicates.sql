-- ============================================================================
-- Migración de saneamiento: unificar duplicados de teléfono +52 vs 52
-- 
-- Contexto del bug:
--   Se generaban dos registros en citizens con el mismo número lógico:
--   uno con phone='+521234567890' y otro con phone='521234567890'.
--   El de '+52' quedaba incompleto (lead_status = 'new').
--
-- Estrategia:
--   1. Para cada par (+52X / 52X):
--      - Conservar el registro MÁS COMPLETO (más datos, lead_status avanzado).
--      - Si ambos están incompletos, conservar el más antiguo.
--   2. Reasignar todas las FK (conversations, citizen_tags, attachments)
--      del registro descartado al conservado.
--   3. Eliminar el registro duplicado.
--   4. Normalizar TODOS los phones restantes que aún tengan '+' → sin '+'.
-- ============================================================================

BEGIN;

-- ─── PASO 1: Reasignar FKs de duplicados al registro más completo ────────────

DO $$
DECLARE
  rec RECORD;
  keep_id UUID;
  drop_id UUID;
BEGIN
  -- Buscar pares: phone con '+' que tiene equivalente sin '+'
  FOR rec IN
    SELECT
      a.id        AS id_with_plus,
      a.phone     AS phone_with_plus,
      a.lead_status AS status_with_plus,
      a.created_at  AS created_with_plus,
      b.id        AS id_without_plus,
      b.phone     AS phone_without_plus,
      b.lead_status AS status_without_plus,
      b.created_at  AS created_without_plus
    FROM citizens a
    JOIN citizens b
      ON REPLACE(a.phone, '+', '') = b.phone
    WHERE a.phone LIKE '+%'
  LOOP
    -- Elegir cuál conservar: el de lead_status más avanzado
    -- Orden de preferencia: converted > engaged > contacted > new
    -- Si empate en status, conservar el más antiguo (creado primero)
    IF rec.status_without_plus IN ('converted', 'engaged')
       OR (rec.status_without_plus = 'contacted' AND rec.status_with_plus = 'new')
       OR (rec.status_with_plus = rec.status_without_plus AND rec.created_without_plus <= rec.created_with_plus)
    THEN
      keep_id := rec.id_without_plus;
      drop_id := rec.id_with_plus;
    ELSE
      keep_id := rec.id_with_plus;
      drop_id := rec.id_without_plus;
    END IF;

    RAISE NOTICE 'Pair found: keep=%, drop=%, keep_phone=%, drop_phone=%',
      keep_id, drop_id,
      (SELECT phone FROM citizens WHERE id = keep_id),
      (SELECT phone FROM citizens WHERE id = drop_id);

    -- Reasignar conversaciones
    UPDATE conversations SET citizen_id = keep_id WHERE citizen_id = drop_id;

    -- Reasignar citizen_tags (ignorar conflictos de uniqueness)
    UPDATE citizen_tags SET citizen_id = keep_id
    WHERE citizen_id = drop_id
      AND NOT EXISTS (
        SELECT 1 FROM citizen_tags
        WHERE citizen_id = keep_id AND tag_id = citizen_tags.tag_id
      );
    DELETE FROM citizen_tags WHERE citizen_id = drop_id;

    -- Reasignar attachments
    UPDATE attachments SET citizen_id = keep_id WHERE citizen_id = drop_id;

    -- Copiar datos al registro conservado si faltan (merge seguro)
    UPDATE citizens SET
      name         = COALESCE(name, (SELECT name FROM citizens WHERE id = drop_id)),
      last_name    = COALESCE(last_name, (SELECT last_name FROM citizens WHERE id = drop_id)),
      email        = COALESCE(email, (SELECT email FROM citizens WHERE id = drop_id)),
      neighborhood = COALESCE(neighborhood, (SELECT neighborhood FROM citizens WHERE id = drop_id)),
      neighborhood_id = COALESCE(neighborhood_id, (SELECT neighborhood_id FROM citizens WHERE id = drop_id)),
      interests    = CASE WHEN array_length(interests, 1) IS NULL OR array_length(interests, 1) = 0
                         THEN (SELECT interests FROM citizens WHERE id = drop_id)
                         ELSE interests
                    END,
      consent_given = GREATEST(consent_given, (SELECT consent_given FROM citizens WHERE id = drop_id)),
      consent_at   = CASE WHEN consent_given AND consent_at IS NULL
                         THEN (SELECT consent_at FROM citizens WHERE id = drop_id)
                         ELSE consent_at
                    END
    WHERE id = keep_id;

    -- Eliminar el duplicado
    DELETE FROM citizens WHERE id = drop_id;

    RAISE NOTICE 'Merged: drop_id=% into keep_id=%', drop_id, keep_id;
  END LOOP;
END $$;

-- ─── PASO 2: Normalizar todos los phones restantes con '+' ───────────────────
-- (Para casos sin duplicado pero con formato incorrecto)

UPDATE citizens
SET phone = REPLACE(phone, '+', '')
WHERE phone LIKE '+%';

-- ─── PASO 3: Verificación post-migración ────────────────────────────────────

DO $$
DECLARE
  remaining_plus_count INTEGER;
  duplicate_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_plus_count FROM citizens WHERE phone LIKE '+%';
  SELECT COUNT(*) INTO duplicate_count
  FROM (
    SELECT REPLACE(phone, '+', '') AS normalized_phone, COUNT(*) AS cnt
    FROM citizens
    GROUP BY normalized_phone
    HAVING COUNT(*) > 1
  ) duplicates;

  IF remaining_plus_count > 0 THEN
    RAISE WARNING 'Aún hay % citizen(s) con phone con "+". Revisar manualmente.', remaining_plus_count;
  ELSE
    RAISE NOTICE 'OK: No quedan phones con "+" en citizens.';
  END IF;

  IF duplicate_count > 0 THEN
    RAISE WARNING 'Aún hay % número(s) con duplicados. Requiere revisión manual.', duplicate_count;
  ELSE
    RAISE NOTICE 'OK: No quedan duplicados de phone en citizens.';
  END IF;
END $$;

COMMIT;
