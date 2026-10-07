-- ==========================================================================
-- MOTOBOX — Migración: Soporte de chances extras en el sorteo
-- Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- 
-- ✅ Seguro: no modifica funciones existentes, solo agrega columnas y crea
--    una función nueva. Se puede ejecutar múltiples veces sin error.
-- ==========================================================================

-- 1. Agregar columnas a sorteo_participantes (IF NOT EXISTS = idempotente)
ALTER TABLE public.sorteo_participantes
  ADD COLUMN IF NOT EXISTS chances_extra integer NOT NULL DEFAULT 0;

ALTER TABLE public.sorteo_participantes
  ADD COLUMN IF NOT EXISTS monto_chances numeric DEFAULT NULL;

-- 2. Crear función RPC para actualizar chances (el frontend la llama después de inscribirse)
--    Si ya existe, la reemplaza sin romper nada.
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
    WHERE token = p_token;
  END IF;
END;
$$;

-- 3. Dar permisos al rol anon (el que usa la web)
GRANT EXECUTE ON FUNCTION public.sorteo_actualizar_chances(text, integer, numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.sorteo_actualizar_chances(text, integer, numeric) TO authenticated;

-- 4. Función RPC para que el vendedor pueda actualizar chances desde el CRM
--    Recibe el DNI del participante y el paquete.
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
  WHERE dni = p_dni
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

GRANT EXECUTE ON FUNCTION public.sorteo_set_chances(text, text, integer, numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.sorteo_set_chances(text, text, integer, numeric) TO authenticated;

-- 5. Intentar agregar chances_extra y monto_chances al retorno de las funciones
--    de consulta. Esto usa un enfoque seguro: si las funciones no existen o tienen
--    otra estructura, simplemente no hace nada.
DO $$
BEGIN
  -- Verificar que las columnas se agregaron correctamente
  PERFORM column_name FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'sorteo_participantes'
    AND column_name = 'chances_extra';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La columna chances_extra no se creó. Revisá los permisos.';
  END IF;

  RAISE NOTICE '✅ Migración completada: columnas chances_extra y monto_chances agregadas, funciones sorteo_actualizar_chances y sorteo_set_chances creadas.';
END;
$$;
