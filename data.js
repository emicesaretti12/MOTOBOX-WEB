/**
 * MOTOBOX — Catálogo & Sistema de Datos
 * Concesionaria Multimarca | Córdoba, Argentina
 * 
 * Estructura de datos enriquecida para catálogo, simulador financiero
 * y asistente de ventas con conexión directa a WhatsApp.
 */

const WHATSAPP_NUMBER = "5493511234567"; // Reemplazar con el número real de atención

const CONFIG = {
  nombreAgencia: "Motobox",
  direccion: "Santa Rosa 4227, Córdoba Capital",
  horarios: "Lunes a Lunes de 09:00 a 21:00 hs",
  tasaInteresEstimada: 0.042, // Tasa mensual estimada para el simulador
  cuotasDisponibles: [12, 18, 24, 36]
};

const motos = [
  {
    id: 1,
    marca: "Keller",
    modelo: "Crono Classic 110",
    categoria: "economica",
    categoriaLabel: "Económica / Urbana",
    precio: 1450000,
    cuotaMinimaEstimada: 68500,
    imagen: "img/motos/keller-110.jpg",
    imagenes: ["img/motos/keller-110.jpg"],
    disponible: true,
    cilindrada: "110 cc",
    consumo: "2.1 L / 100km",
    potencia: "7.0 HP",
    frenos: "Disco delantero / Tambor",
    tanque: "4.0 Litros",
    arranque: "Eléctrico y a pedal",
    destacada: false,
    badge: "Más Vendida",
    tagline: "La reina del ahorro urbano y bajo costo de mantenimiento.",
    usosRecomendados: ["trabajo", "ciudad", "primera-moto"],
    perfilComprador: "Ideal para delivery, traslados diarios económicos o primera moto."
  },
  {
    id: 2,
    marca: "Motomel",
    modelo: "B110 Blitz",
    categoria: "economica",
    categoriaLabel: "Económica / Urbana",
    precio: 1380000,
    cuotaMinimaEstimada: 64900,
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
    badge: "Precio Imbatible",
    tagline: "Agilidad, simplicidad mecánica y máximo rendimiento diario.",
    usosRecomendados: ["trabajo", "ciudad", "primera-moto"],
    perfilComprador: "Excelente relación precio/calidad para movilidad diaria en Córdoba."
  },
  {
    id: 3,
    marca: "Zanella",
    modelo: "ZR 150 OHC",
    categoria: "economica",
    categoriaLabel: "Calle / Trabajo",
    precio: 1890000,
    cuotaMinimaEstimada: 89000,
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
    tagline: "Mayor porte, tanque grande y confort para jornadas intensas.",
    usosRecomendados: ["trabajo", "ciudad", "viajes-cortos"],
    perfilComprador: "Para quienes necesitan potencia extra en avenidas y circunvalación."
  },
  {
    id: 4,
    marca: "Bajaj",
    modelo: "Rouser NS 200",
    categoria: "diario",
    categoriaLabel: "Naked Sport / Uso Diario",
    precio: 4200000,
    cuotaMinimaEstimada: 198000,
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
    badge: "Hero Deportiva",
    tagline: "Potencia pura, refrigeración líquida y facha imbatible en ciudad.",
    usosRecomendados: ["ciudad", "estilo", "viajes-cortos"],
    perfilComprador: "Buscás aceleración, diseño agresivo y tecnología superior."
  },
  {
    id: 5,
    marca: "Honda",
    modelo: "XR 250 Tornado",
    categoria: "viajar",
    categoriaLabel: "On-Off / Aventura & Viajes",
    precio: null, // "Consultar precio"
    cuotaMinimaEstimada: null,
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
    tagline: "Indestructible. Las sierras de Córdoba y cualquier camino son tuyos.",
    usosRecomendados: ["viajar", "aventura", "ciudad"],
    perfilComprador: "Para quienes no tienen límites de terreno y buscan máxima reventa."
  }
];

const categoriasInfo = [
  {
    slug: "economica",
    nombre: "Económicas & Trabajo",
    descripcion: "Bajo consumo, cuotas mínimas y repuestos súper accesibles.",
    imagen: "img/cat-economicas.jpg",
    cuotaDesde: "$64.900",
    badge: "Consumo 2L/100km"
  },
  {
    slug: "diario",
    nombre: "Uso Diario & Sport",
    descripcion: "Potencia, estética agresiva y agilidad para circunvalación.",
    imagen: "img/cat-diario.jpg",
    cuotaDesde: "$198.000",
    badge: "Hasta 24.5 HP"
  },
  {
    slug: "viajar",
    nombre: "Aventura & Viajes",
    descripcion: "Suspensión de largo recorrido, confiabilidad y confort de ruta.",
    imagen: "img/cat-viajar.jpg",
    cuotaDesde: "Consultar",
    badge: "Todo Terreno"
  }
];
