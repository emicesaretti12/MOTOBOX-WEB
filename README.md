# Motobox Web

Landing page / catálogo web para **Motobox**, agencia multimarca de motos en Córdoba, Argentina.

## Estructura

```
index.html      — Página principal
styles.css      — Estilos (CSS vanilla, mobile-first)
app.js          — Lógica: catálogo, filtros, animaciones, WhatsApp links
data.js         — Datos mock del catálogo (estructura para futura DB) y SORTEO_CONFIG
rifa.js         — Popup del sorteo: premios, inscripción, pago del manual y comprobante
rifa.css        — Estilos y animaciones 3D del popup del sorteo
motion.js       — Animaciones: ruta nocturna 3D, título con volumen, showroom 360°, velocímetro, 3D con giroscopio y scroll en celular, sorteo 3D y resortes
motion.css      — Estilos de esas animaciones (se apagan con "reducir movimiento")
vendor/         — Lenis (scroll suave, licencia MIT)
sorteo.html     — Bases y condiciones del sorteo
img/            — Imágenes del sitio
  hero.jpg
  cat-economicas.jpg
  cat-diario.jpg
  cat-viajar.jpg
  motos/        — Fotos de producto
```

## Setup

1. Cloná el repo
2. Ejecutá `setup-images.bat` para copiar las imágenes generadas al directorio `img/`
3. Abrí `index.html` en tu navegador o usá un servidor local:
   ```bash
   npx serve .
   ```

## Modelo de datos

Cada moto tiene esta estructura (en `data.js`):

```js
{
  id: number,
  marca: string,
  modelo: string,
  categoria: "economica" | "diario" | "viajar",
  precio: number | null,  // null = "Consultar precio"
  imagen: string,
  disponible: boolean,
  cilindrada: string,
  destacada: boolean
}
```

## Sorteo

Sorteo promocional: se participa con la compra del Manual de Cuidado
y Mantenimiento, y se pueden sumar paquetes de chances extras.

- **Web** (`rifa.js`): el popup permite elegir paquetes de chances extras, pide los datos (DNI, nombre, fecha de
  nacimiento, celular, Gmail, domicilio y una clave), guarda la inscripción en el CRM, asigna el
  número y abre WhatsApp con un mensaje personalizado (nombre, DNI, número y código).
- **Pago del manual**: lo coordina un vendedor por WhatsApp: pasa el alias, recibe el comprobante y,
  cuando verifica la transferencia, toca "Marcar como pagado" en el CRM.
- **Mis números** (`mis-numeros.html` + `mis-numeros.js`): cada persona ve su número y si el pago
  figura como pagado (con el manual en PDF para descargar). Entra sola desde el teléfono con el que se
  inscribió, o con DNI + clave desde cualquier otro.
- **Datos**: tabla `sorteo_participantes` en Supabase. Las migraciones están en el repo del CRM
  (`supabase/migrations/004_sorteo.sql` y `005_sorteo_cuentas.sql`) y se corren una vez en el SQL Editor.
- **CRM**: bloque "Sorteo" (solo admin) para ver inscriptos, marcar pagos, crear una clave nueva para
  quien la olvidó y enviar por WhatsApp el número, el alias o el manual en PDF.
- **Configuración** en `SORTEO_CONFIG` (`data.js`): premios, precio del manual y fecha. Las bases
  completas están en `sorteo.html`.

## Seguridad

- **Cabeceras** (`vercel.json`): Content-Security-Policy estricta (solo scripts propios), HSTS,
  anti-iframe (`frame-ancestors 'none'`), `nosniff`, Referrer y Permissions-Policy.
  Si se agrega un servicio externo (scripts, fuentes, APIs), hay que sumarlo a la CSP.
- **Sin scripts en línea**: todo JS va en archivos (`intro.js` en el `<head>` de la portada).
- **supabase-js local** (`vendor/supabase.min.js`, versión fija 2.117.2) en lugar del CDN.
- **Datos del CRM**: `data.js` limpia los textos (`< > "`) y solo acepta imágenes `https://`.
- **Sorteo**: límites de intentos, campo trampa para bots y precio fijado en el servidor
  (migración `006_seguridad.sql` del repo del CRM).

## WhatsApp

Los CTAs generan links de WhatsApp con mensaje prearmado:
```
https://wa.me/5493511234567?text=Hola, quiero info sobre la [marca] [modelo]
```

Cambiá `WHATSAPP_NUMBER` en `data.js` por tu número real.

## Stack

- HTML5 semántico
- CSS vanilla (design tokens, mobile-first)
- JavaScript vanilla (ES6+, IntersectionObserver)
- Google Fonts: Inter + Space Grotesk
- Sin dependencias ni frameworks
