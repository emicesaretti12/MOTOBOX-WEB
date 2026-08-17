# Motobox Web

Landing page / catálogo web para **Motobox**, agencia multimarca de motos en Córdoba, Argentina.

## Estructura

```
index.html      — Página principal
styles.css      — Estilos (CSS vanilla, mobile-first)
app.js          — Lógica: catálogo, filtros, animaciones, WhatsApp links
data.js         — Datos mock del catálogo (estructura para futura DB)
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
