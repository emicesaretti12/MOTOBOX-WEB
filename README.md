# Motobox Web

Landing page / catálogo web para **Motobox**, agencia multimarca de motos en Córdoba, Argentina.

## Estructura

```
index.html      — Página principal
styles.css      — Estilos (CSS vanilla, mobile-first)
app.js          — Lógica: catálogo, filtros, animaciones, WhatsApp links
data.js         — Datos mock del catálogo (estructura para futura DB) y RIFA_CONFIG
rifa.js         — Popup de la rifa: ruleta, elección de números y reserva por WhatsApp
rifa.css        — Estilos y animaciones 3D del popup de la rifa
supabase/       — SQL de la tabla rifa_numeros (números reservados/vendidos)
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

## Rifa

El popup aparece la primera vez que alguien entra en la sesión; después queda un acceso flotante.
Todo se configura en `RIFA_CONFIG` (`data.js`): premio, precio por número, cantidad de números,
fecha y modalidad del sorteo, organismo y resolución de la autorización, link a las bases y los
premios de la ruleta con su probabilidad. Con `activo: false` el popup no se muestra.

Para marcar números reservados o vendidos, ejecutá `supabase/rifa_numeros.sql` una vez en Supabase
y cargá los números en la tabla `rifa_numeros`: la web los muestra como vendidos y se actualiza en vivo.
Sin esa tabla, todos los números aparecen libres y no se muestran cifras de venta.

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
