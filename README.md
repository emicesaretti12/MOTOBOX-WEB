# Motobox Web

Landing page / catálogo web para **Motobox**, agencia multimarca de motos en Córdoba, Argentina.

## Estructura

```
index.html      — Página principal
styles.css      — Estilos (CSS vanilla, mobile-first)
app.js          — Lógica: catálogo, filtros, animaciones, WhatsApp links
data.js         — Datos mock del catálogo (estructura para futura DB) y SORTEO_CONFIG
rifa.js         — Popup del sorteo: premios, ruleta de chances y participación por WhatsApp
rifa.css        — Estilos y animaciones 3D del popup del sorteo
motion.js       — Intro de marca, cinta de marcas, sorteo 3D en la portada, revelados al scroll y botones magnéticos
motion.css      — Estilos de esas animaciones (se apagan con "reducir movimiento")
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

Sorteo promocional gratuito, sin obligación de compra: se participa gratis por WhatsApp o con
la compra del manual, siempre con las mismas chances. El popup aparece la primera vez que alguien
entra en la sesión; después queda un acceso flotante y el link "Sorteo" del menú.
Se configura en `SORTEO_CONFIG` (`data.js`): premios y sus fotos, manual y precio, fecha del sorteo
y chances de la ruleta. Las bases completas están en `sorteo.html` (completar los campos marcados).

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
