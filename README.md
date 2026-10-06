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

Sorteo promocional sin obligación de compra: se participa gratis o comprando el Manual de Cuidado
y Mantenimiento, siempre con la misma chance (una participación por DNI).

- **Web** (`rifa.js`): el popup ofrece las dos opciones, pide los datos (DNI, nombre, fecha de
  nacimiento, celular, Gmail, domicilio), asigna el número de participación y, si compró el manual,
  muestra el pedido con alias, CBU, Mercado Pago y la carga del comprobante. El celular se confirma
  enviando por WhatsApp el código que muestra la web.
- **Datos**: tabla `sorteo_participantes` en Supabase. La migración está en el repo del CRM
  (`supabase/migrations/004_sorteo.sql`) y se corre una vez en el SQL Editor.
- **CRM**: bloque "Sorteo" (solo admin) para ver inscriptos, comprobantes, verificar pagos y
  enviar por WhatsApp el número y el manual en PDF.
- **Configuración** en `SORTEO_CONFIG` (`data.js`): premios, precio del manual, fecha, alias, CBU,
  titular y link de Mercado Pago. Las bases completas están en `sorteo.html`.

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
