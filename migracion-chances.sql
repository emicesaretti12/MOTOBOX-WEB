-- ==========================================================================
-- MOTOBOX — Migración: Soporte total de chances y números en CRM y Web
-- Ejecutar en Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- 
-- ✅ Seguro e Idempotente: se puede ejecutar múltiples veces sin error.
-- ==========================================================================

-- 1. Agregar columnas para que el CRM y la Web vean exactamente cuántos números compró cada uno
ALTER TABLE public.sorteo_participantes
  ADD COLUMN IF NOT EXISTS chances integer NOT NULL DEFAULT 1;

ALTER TABLE public.sorteo_participantes
  ADD COLUMN IF NOT EXISTS cantidad_numeros integer NOT NULL DEFAULT 1;

ALTER TABLE public.sorteo_participantes
  ADD COLUMN IF NOT EXISTS cantidad_chances integer NOT NULL DEFAULT 1;

ALTER TABLE public.sorteo_participantes
  ADD COLUMN IF NOT EXISTS numero_hasta integer DEFAULT NULL;

ALTER TABLE public.sorteo_participantes
  ADD COLUMN IF NOT EXISTS numeros_texto text DEFAULT NULL;

ALTER TABLE public.sorteo_participantes
  ADD COLUMN IF NOT EXISTS chances_extra integer NOT NULL DEFAULT 0;

ALTER TABLE public.sorteo_participantes
  ADD COLUMN IF NOT EXISTS monto_chances numeric DEFAULT NULL;

ALTER TABLE public.sorteo_participantes
  ADD COLUMN IF NOT EXISTS notas text DEFAULT NULL;

-- 2. Actualizar participantes existentes para que el CRM muestre sus números de inmediato
UPDATE public.sorteo_participantes
SET chances = GREATEST(1, COALESCE(chances, chances_extra + 1, 1)),
    cantidad_numeros = GREATEST(1, COALESCE(chances, chances_extra + 1, 1)),
    cantidad_chances = GREATEST(1, COALESCE(chances, chances_extra + 1, 1)),
    numero_hasta = COALESCE(numero_hasta, numero + GREATEST(1, COALESCE(chances, chances_extra + 1, 1)) - 1),
    numeros_texto = CASE 
      WHEN GREATEST(1, COALESCE(chances, chances_extra + 1, 1)) > 1
      THEN 'Del #' || lpad(numero::text, 5, '0') || ' al #' || lpad((numero + GREATEST(1, COALESCE(chances, chances_extra + 1, 1)) - 1)::text, 5, '0') || ' (' || GREATEST(1, COALESCE(chances, chances_extra + 1, 1)) || ' números)'
      ELSE '#' || lpad(numero::text, 5, '0') || ' (1 número)'
    END,
    notas = COALESCE(notas, 
      CASE 
        WHEN GREATEST(1, COALESCE(chances, chances_extra + 1, 1)) > 1
        THEN 'Compró ' || GREATEST(1, COALESCE(chances, chances_extra + 1, 1)) || ' números (del #' || lpad(numero::text, 5, '0') || ' al #' || lpad((numero + GREATEST(1, COALESCE(chances, chances_extra + 1, 1)) - 1)::text, 5, '0') || ')'
        ELSE 'Compró 1 número (#' || lpad(numero::text, 5, '0') || ')'
      END
    );

-- 3. Ficha de participación (lo que ve la persona en "Mis números")
CREATE OR REPLACE FUNCTION public.sorteo_ficha(r public.sorteo_participantes)
RETURNS JSONB
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'sorteo_id', r.sorteo_id,
    'numero', r.numero,
    'numero_hasta', COALESCE(r.numero_hasta, r.numero),
    'numeros', ARRAY(SELECT generate_series(r.numero, COALESCE(r.numero_hasta, r.numero))),
    'numeros_texto', r.numeros_texto,
    'nombre', r.nombre_completo,
    'dni', r.dni,
    'codigo', r.codigo_verificacion,
    'compra_manual', r.compra_manual,
    'estado_pago', r.estado_pago,
    'pagado', r.estado_pago = 'verificado',
    'telefono_verificado', r.telefono_verificado,
    'inscripto', r.created_at,
    'token', r.upload_token,
    'chances', COALESCE(r.chances, 1 + COALESCE(r.chances_extra, 0)),
    'cantidad_numeros', COALESCE(r.cantidad_numeros, r.chances, 1),
    'chances_extra', COALESCE(r.chances_extra, 0),
    'monto_chances', r.monto_chances,
    'notas', r.notas
  );
$$;

-- 4. Inscripción con asignación correlativa y guardado de chances para el CRM
CREATE OR REPLACE FUNCTION public.sorteo_inscribir(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_sorteo TEXT := COALESCE(NULLIF(trim(p->>'sorteo_id'), ''), '01');
  v_dni TEXT := regexp_replace(COALESCE(p->>'dni', ''), '\D', '', 'g');
  v_nombre TEXT := trim(COALESCE(p->>'nombre_completo', ''));
  v_nac DATE;
  v_tel TEXT := regexp_replace(COALESCE(p->>'telefono', ''), '\D', '', 'g');
  v_email TEXT := lower(trim(COALESCE(p->>'email', '')));
  v_loc TEXT := trim(COALESCE(p->>'localidad', ''));
  v_dir TEXT := trim(COALESCE(p->>'direccion', ''));
  v_prov TEXT := trim(COALESCE(p->>'provincia', ''));
  v_cp TEXT := trim(COALESCE(p->>'codigo_postal', ''));
  v_clave TEXT := COALESCE(NULLIF(trim(p->>'clave'), ''), v_dni);
  v_compra BOOLEAN := COALESCE((p->>'compra_manual')::BOOLEAN, true);
  v_monto INTEGER := NULLIF(p->>'monto', '')::INTEGER;
  v_chances INTEGER := GREATEST(1, COALESCE((p->>'chances')::INTEGER, (p->>'cantidad_numeros')::INTEGER, (p->>'cantidad_chances')::INTEGER, (p->>'chances_extra')::INTEGER, 1));
  v_num INTEGER;
  v_num_hasta INTEGER;
  v_numeros_texto TEXT;
  v_notas TEXT;
  v_codigo TEXT := lpad((floor(random() * 10000))::INT::TEXT, 4, '0');
  v_row public.sorteo_participantes;
BEGIN
  BEGIN
    v_nac := (p->>'fecha_nacimiento')::DATE;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'FECHA_INVALIDA';
  END;

  IF v_dni !~ '^\d{7,8}$' THEN RAISE EXCEPTION 'DNI_INVALIDO'; END IF;
  IF length(v_nombre) < 5 OR v_nombre !~ '\s' THEN RAISE EXCEPTION 'NOMBRE_INVALIDO'; END IF;
  IF v_nac IS NULL OR v_nac > (current_date - INTERVAL '18 years')::DATE OR v_nac < DATE '1900-01-01' THEN
    RAISE EXCEPTION 'MENOR_DE_EDAD';
  END IF;
  IF length(v_tel) < 10 OR length(v_tel) > 13 THEN RAISE EXCEPTION 'TELEFONO_INVALIDO'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'EMAIL_INVALIDO'; END IF;
  IF length(v_loc) < 2 OR length(v_dir) < 3 OR length(v_prov) < 2 OR v_cp !~ '^[A-Za-z0-9]{4,8}$' THEN
    RAISE EXCEPTION 'DIRECCION_INVALIDA';
  END IF;
  IF length(v_nombre) > 120 OR length(v_dir) > 160 OR length(v_loc) > 80 OR length(v_prov) > 60 OR length(v_email) > 120 THEN
    RAISE EXCEPTION 'DATOS_DEMASIADO_LARGOS';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('sorteo_' || v_sorteo));

  IF EXISTS (SELECT 1 FROM public.sorteo_participantes WHERE sorteo_id = v_sorteo AND dni = v_dni) THEN
    RAISE EXCEPTION 'DNI_YA_INSCRIPTO';
  END IF;

  -- Asignar el siguiente bloque de números correlativos según cantidad de chances
  SELECT COALESCE(MAX(GREATEST(numero, COALESCE(numero_hasta, numero))), 0) + 1 INTO v_num
    FROM public.sorteo_participantes WHERE sorteo_id = v_sorteo;

  v_num_hasta := v_num + v_chances - 1;

  v_numeros_texto := CASE 
    WHEN v_chances > 1 THEN 'Del #' || lpad(v_num::text, 5, '0') || ' al #' || lpad(v_num_hasta::text, 5, '0') || ' (' || v_chances || ' números)'
    ELSE '#' || lpad(v_num::text, 5, '0') || ' (1 número)'
  END;

  v_notas := COALESCE(
    NULLIF(trim(p->>'notas'), ''),
    'Compró ' || v_chances || ' números · ' || v_numeros_texto
  );

  INSERT INTO public.sorteo_participantes (
    sorteo_id, numero, numero_hasta, chances, cantidad_numeros, cantidad_chances, chances_extra,
    numeros_texto, notas, dni, nombre_completo, fecha_nacimiento, telefono, codigo_verificacion,
    email, localidad, direccion, provincia, codigo_postal, compra_manual, monto, monto_chances,
    estado_pago, clave_hash
  ) VALUES (
    v_sorteo, v_num, v_num_hasta, v_chances, v_chances, v_chances, (v_chances - 1),
    v_numeros_texto, v_notas, v_dni, v_nombre, v_nac, v_tel, v_codigo,
    v_email, v_loc, v_dir, v_prov, upper(v_cp), v_compra, v_monto, v_monto,
    'pendiente',
    extensions.crypt(v_clave, extensions.gen_salt('bf', 8))
  ) RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'numero', v_row.numero,
    'numero_hasta', v_row.numero_hasta,
    'chances', v_chances,
    'cantidad_numeros', v_chances,
    'numeros_texto', v_numeros_texto,
    'numeros', ARRAY(SELECT generate_series(v_row.numero, v_row.numero_hasta)),
    'codigo', v_row.codigo_verificacion,
    'token', v_row.upload_token
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sorteo_inscribir(JSONB) TO anon, authenticated;

-- 5. Consulta directa por DNI (SIN necesidad de clave)
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

-- Compatibilidad de 2 parámetros si se llama con clave
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

-- 6. Actualizar chances tras inscripción desde la web (actualiza todas las columnas para el CRM)
CREATE OR REPLACE FUNCTION public.sorteo_actualizar_chances(
  p_token text,
  p_chances integer DEFAULT 1,
  p_monto numeric DEFAULT NULL,
  p_notas text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_num integer;
  v_total integer;
  v_num_hasta integer;
  v_txt text;
BEGIN
  IF p_chances IS NOT NULL AND p_chances > 0 THEN
    SELECT numero INTO v_num FROM public.sorteo_participantes WHERE upload_token::text = p_token;
    IF FOUND THEN
      v_total := p_chances;
      v_num_hasta := v_num + v_total - 1;
      v_txt := CASE 
        WHEN v_total > 1 THEN 'Del #' || lpad(v_num::text, 5, '0') || ' al #' || lpad(v_num_hasta::text, 5, '0') || ' (' || v_total || ' números)'
        ELSE '#' || lpad(v_num::text, 5, '0') || ' (1 número)'
      END;

      UPDATE public.sorteo_participantes
      SET chances = v_total,
          cantidad_numeros = v_total,
          cantidad_chances = v_total,
          chances_extra = GREATEST(0, v_total - 1),
          numero_hasta = v_num_hasta,
          numeros_texto = v_txt,
          monto_chances = p_monto,
          notas = COALESCE(p_notas, 'Compró ' || v_total || ' números · ' || v_txt)
      WHERE upload_token::text = p_token;
    END IF;
  END IF;
END;
$$;

-- Sobrecarga de 3 parámetros para compatibilidad
CREATE OR REPLACE FUNCTION public.sorteo_actualizar_chances(
  p_token text,
  p_chances integer,
  p_monto numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sorteo_actualizar_chances(p_token, p_chances, p_monto, NULL);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sorteo_actualizar_chances(text, integer, numeric, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sorteo_actualizar_chances(text, integer, numeric) TO anon, authenticated;

-- 7. Función para que el vendedor asigne o modifique chances desde el CRM
CREATE OR REPLACE FUNCTION public.sorteo_set_chances(
  p_dni text,
  p_sorteo_id text DEFAULT '01',
  p_chances integer DEFAULT 1,
  p_monto numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nombre text;
  v_num integer;
  v_total integer;
  v_num_hasta integer;
  v_txt text;
BEGIN
  SELECT numero INTO v_num
    FROM public.sorteo_participantes
   WHERE dni = regexp_replace(p_dni, '\D', '', 'g')
     AND sorteo_id = p_sorteo_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'NO_ENCONTRADO');
  END IF;

  v_total := GREATEST(1, p_chances);
  v_num_hasta := v_num + v_total - 1;
  v_txt := CASE 
    WHEN v_total > 1 THEN 'Del #' || lpad(v_num::text, 5, '0') || ' al #' || lpad(v_num_hasta::text, 5, '0') || ' (' || v_total || ' números)'
    ELSE '#' || lpad(v_num::text, 5, '0') || ' (1 número)'
  END;

  UPDATE public.sorteo_participantes
  SET chances = v_total,
      cantidad_numeros = v_total,
      cantidad_chances = v_total,
      chances_extra = GREATEST(0, v_total - 1),
      numero_hasta = v_num_hasta,
      numeros_texto = v_txt,
      monto_chances = p_monto,
      notas = 'Actualizado en CRM: ' || v_total || ' números · ' || v_txt
  WHERE dni = regexp_replace(p_dni, '\D', '', 'g')
    AND sorteo_id = p_sorteo_id
  RETURNING nombre_completo, chances
  INTO v_nombre, v_total;

  RETURN jsonb_build_object(
    'ok', true,
    'nombre', v_nombre,
    'chances', v_total,
    'cantidad_numeros', v_total,
    'numero_desde', v_num,
    'numero_hasta', v_num_hasta,
    'numeros_texto', v_txt,
    'monto_chances', p_monto
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sorteo_set_chances(text, text, integer, numeric) TO anon, authenticated;
