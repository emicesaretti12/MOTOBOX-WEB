/**
 * MOTOBOX — Catálogo & Sistema de Datos 0KM
 * Concesionaria Multimarca Oficial | Córdoba, Argentina
 * Venta exclusiva de motos 0km nuevas de fábrica.
 */

const WHATSAPP_NUMBER = "5493511234567"; // Número comercial de ventas Motobox Córdoba

const CONFIG = {
  nombreAgencia: "Motobox Córdoba",
  slogan: "Concesionaria Multimarca de Motos 0km",
  direccion: "Santa Rosa 4227, Córdoba Capital",
  horarios: "Lunes a Sábados de 09:00 a 20:30 hs",
  telefono: "(0351) 123-4567",
  email: "ventas@motoboxcordoba.com.ar",
  whatsappUrl: `https://wa.me/${WHATSAPP_NUMBER}`
};

const motos = [
  {
    id: 1,
    marca: "Keller",
    modelo: "Crono Classic 110",
    categoria: "economica",
    categoriaLabel: "Económica & Urbana",
    estado: "0km Nueva",
    imagen: "img/motos/keller-110.jpg",
    imagenes: ["img/motos/keller-110.jpg"],
    disponible: true,
    cilindrada: "110 cc",
    consumo: "2.1 L / 100km",
    potencia: "7.0 HP",
    frenos: "Disco delantero / Tambor",
    tanque: "4.0 Litros",
    arranque: "Eléctrico y a pedal",
    destacada: true,
    badge: "Más Vendida",
    tagline: "La reina del ahorro urbano, agilidad y mínimo costo operativo.",
    usosRecomendados: ["trabajo", "ciudad", "primera-moto"],
    perfilComprador: "Ideal para delivery, movilidad diaria y traslados económicos en la ciudad."
  },
  {
    id: 2,
    marca: "Motomel",
    modelo: "B110 Blitz",
    categoria: "economica",
    categoriaLabel: "Económica & Urbana",
    estado: "0km Nueva",
    imagen: "img/motos/motomel-b110.jpg",
    imagenes: ["img/motos/motomel-b110.jpg"],
    disponible: true,
    cilindrada: "110 cc",
    consumo: "2.0 L / 100km",
    potencia: "7.2 HP",
    frenos: "Tambor / Tambor",
    tanque: "3.8 Litros",
    arranque: "Eléctrico y patada",
    destacada: false,
    badge: "Eficiencia Total",
    tagline: "Agilidad comprobada, bajo consumo y repuestos siempre disponibles.",
    usosRecomendados: ["trabajo", "ciudad", "primera-moto"],
    perfilComprador: "Excelente opción de bajo mantenimiento para moverte sin demoras."
  },
  {
    id: 3,
    marca: "Zanella",
    modelo: "ZR 150 OHC",
    categoria: "economica",
    categoriaLabel: "Calle & Trabajo",
    estado: "0km Nueva",
    imagen: "img/motos/zanella-zr150.jpg",
    imagenes: ["img/motos/zanella-zr150.jpg"],
    disponible: true,
    cilindrada: "150 cc",
    consumo: "2.6 L / 100km",
    potencia: "11.5 HP",
    frenos: "Disco delantero",
    tanque: "12 Litros",
    arranque: "Eléctrico",
    destacada: false,
    badge: "Gran Autonomía",
    tagline: "Mayor porte, tanque de 12L y respuesta para jornadas intensas.",
    usosRecomendados: ["trabajo", "ciudad", "avenidas"],
    perfilComprador: "Para quienes necesitan potencia extra en circunvalación y trayectos largos."
  },
  {
    id: 4,
    marca: "Bajaj",
    modelo: "Rouser NS 200",
    categoria: "diario",
    categoriaLabel: "Naked Sport & Ciudad",
    estado: "0km Nueva",
    imagen: "img/motos/bajaj-ns200.jpg",
    imagenes: ["img/motos/bajaj-ns200.jpg", "img/cat-diario.jpg"],
    disponible: true,
    cilindrada: "199.5 cc",
    consumo: "3.2 L / 100km",
    potencia: "24.5 HP (Triple bujía)",
    frenos: "Disco lobulado del/tras",
    tanque: "12 Litros",
    arranque: "Eléctrico",
    destacada: true,
    badge: "Líder Deportiva",
    tagline: "Potencia pura de 24.5 HP, refrigeración líquida y diseño agresivo.",
    usosRecomendados: ["ciudad", "estilo", "viajes-cortos"],
    perfilComprador: "Buscás aceleración deportiva, tecnología superior y presencia en la calle."
  },
  {
    id: 5,
    marca: "Honda",
    modelo: "XR 250 Tornado",
    categoria: "viajar",
    categoriaLabel: "On-Off / Aventura & Sierras",
    estado: "0km Nueva",
    imagen: "img/motos/honda-tornado.jpg",
    imagenes: ["img/motos/honda-tornado.jpg", "img/cat-viajar.jpg", "img/hero.jpg"],
    disponible: true,
    cilindrada: "249 cc",
    consumo: "3.4 L / 100km",
    potencia: "23.3 HP DOHC",
    frenos: "Disco delantero / Tambor",
    tanque: "11.5 Litros",
    arranque: "Eléctrico",
    destacada: true,
    badge: "Mito de la Ruta",
    tagline: "Indestructible. Las sierras de Córdoba y cualquier terreno son tuyos.",
    usosRecomendados: ["viajar", "aventura", "ciudad"],
    perfilComprador: "Para quienes buscan confiabilidad legendaria y máximo valor de reventa."
  }
];

const categoriasInfo = [
  {
    slug: "economica",
    nombre: "Económicas & Trabajo",
    descripcion: "Bajo consumo de combustible, agilidad y repuestos económicos.",
    imagen: "img/cat-economicas.jpg",
    badge: "Consumo 2L/100km"
  },
  {
    slug: "diario",
    nombre: "Uso Diario & Sport",
    descripcion: "Potencia superior, refrigeración líquida y diseño deportivo para la ciudad.",
    imagen: "img/cat-diario.jpg",
    badge: "Hasta 24.5 HP"
  },
  {
    slug: "viajar",
    nombre: "Aventura & Sierras",
    descripcion: "Suspensión de largo recorrido, robustez off-road y confort de marcha.",
    imagen: "img/cat-viajar.jpg",
    badge: "Todo Terreno"
];

/**
 * Configuración de Publicidad / Poster Promocional Editable desde el CRM
 * El personal del CRM puede cambiar la imagen, títulos y links aquí o vía API.
 */
const PROMO_CRM = {
  activo: true,
  badge: "Oportunidad Exclusiva 0KM",
  titulo: "Subite a tu moto 0km hoy con Casco y Patente 100% Bonificados",
  subtitulo: "Válido en nuestro Showroom de Santa Rosa 4227 para todas las marcas oficiales en stock físico.",
  imagen: "img/hero.jpg", // Ruta del poster publicitario generado o subido desde el CRM
  textoBoton: "Aprovechar Promo por WhatsApp",
  mensajeWhatsApp: "Hola Motobox! Quiero aprovechar la promoción de Casco y Patente Bonificados que vi en la web."
};
