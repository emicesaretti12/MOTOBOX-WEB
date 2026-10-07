-- ==========================================================================
-- MOTOBOX — Migración: Chances extras + Consulta directa por DNI (sin clave)
-- Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- 
-- ✅ Seguro e Idempotente: se puede ejecutar múltiples veces sin error.
-- ==========================================================================

-- 1. Agregar columnas para chances extras en sorteo_participantes
ALTER TABLE public.sorteo_participantes
  ADD COLUMN IF NOT EXISTS chances_extra integer NOT NULL DEFAULT 0;

ALTER TABLE public.sorteo_participantes
  ADD COLUMN IF NOT EXISTS monto_chances numeric DEFAULT NULL;

-- 2. Ficha de participación (lo que ve la persona en "Mis números")
--    Incluye las chances extras y total de chances sin exponer datos sensibles.
CREATE OR REPLACE FUNCTION public.sorteo_ficha(r public.sorteo_participantes)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'sorteo_id', r.sorteo_id,
    'numeros', jsonb_build_array(r.numero),
    'nombre', r.nombre_completo,
    'dni', r.dni,
    'codigo', r.codigo_verificacion,
    'compra_manual', r.compra_manual,
    'estado_pago', r.estado_pago,
    'pagado', r.estado_pago = 'verificado',
    'telefono_verificado', r.telefono_verificado,
    'inscripto', r.created_at,
    'token', r.upload_token,
    'chances_extra', COALESCE(r.chances_extra, 0),
    'monto_chances', r.monto_chances
  );
$$;

-- 3. Consulta directa por DNI (SIN necesidad de clave)
CREATE OR REPLACE FUNCTION public.sorteo_consultar(p_dni TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r public.sorteo_participantes;
BEGIN
  SELECT * INTO r
    FROM public.sorteo_participantes
   WHERE dni = regexp_replace(COALESCE(p_dni, ''), '\D', '', 'g')
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_ENCONTRADO';
  END IF;

  RETURN public.sorteo_ficha(r);
END;
$$;

-- Mantener compatibilidad con la función anterior de 2 parámetros si se llama con clave
CREATE OR REPLACE FUNCTION public.sorteo_consultar(p_dni TEXT, p_clave TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  r public.sorteo_participantes;
BEGIN
  SELECT * INTO r
    FROM public.sorteo_participantes
   WHERE dni = regexp_replace(COALESCE(p_dni, ''), '\D', '', 'g')
   ORDER BY created_at DESC
   LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NO_ENCONTRADO';
  END IF;

  RETURN public.sorteo_ficha(r);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sorteo_consultar(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sorteo_consultar(TEXT, TEXT) TO anon, authenticated;

-- 4. Actualizar chances tras inscripción desde la web (fire-and-forget)
CREATE OR REPLACE FUNCTION public.sorteo_actualizar_chances(
  p_token text,
  p_chances integer DEFAULT 0,
  p_monto numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_chances IS NOT NULL AND p_chances > 0 THEN
    UPDATE public.sorteo_participantes
    SET chances_extra = p_chances,
        monto_chances = p_monto
    WHERE upload_token::text = p_token;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sorteo_actualizar_chances(text, integer, numeric) TO anon, authenticated;

-- 5. Función para que el vendedor asigne/actualice chances desde el CRM
CREATE OR REPLACE FUNCTION public.sorteo_set_chances(
  p_dni text,
  p_sorteo_id text DEFAULT '01',
  p_chances integer DEFAULT 0,
  p_monto numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre text;
  v_total integer;
BEGIN
  UPDATE public.sorteo_participantes
  SET chances_extra = COALESCE(p_chances, 0),
      monto_chances = p_monto
  WHERE dni = regexp_replace(p_dni, '\D', '', 'g')
    AND sorteo_id = p_sorteo_id
  RETURNING nombre_completo, (1 + COALESCE(p_chances, 0))
  INTO v_nombre, v_total;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NO_ENCONTRADO');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'nombre', v_nombre,
    'chances_extra', COALESCE(p_chances, 0),
    'monto_chances', p_monto,
    'chances_total', v_total
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sorteo_set_chances(text, text, integer, numeric) TO anon, authenticated;
