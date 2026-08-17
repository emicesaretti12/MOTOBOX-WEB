/**
 * MOTOBOX — Catálogo de Motos
 * Datos mock estructurados para futura conexión a base de datos.
 * 
 * Modelo de datos:
 *   marca       : string   — Marca de la moto
 *   modelo      : string   — Modelo específico
 *   categoria   : string   — "economica" | "diario" | "viajar"
 *   precio      : number|null — Precio en ARS (null = "Consultar precio")
 *   imagen      : string   — Ruta a la imagen del producto
 *   disponible  : boolean  — Si está disponible actualmente
 *   cilindrada  : string   — Cilindrada del motor
 *   destacada   : boolean  — Si se muestra como destacada
 */

const WHATSAPP_NUMBER = "5493511234567";

const motos = [
  {
    id: 1,
    marca: "Keller",
    modelo: "Crono Classic 110",
    categoria: "economica",
    precio: 1450000,
    imagen: "img/motos/keller-110.jpg",
    disponible: true,
    cilindrada: "110cc",
    destacada: false
  },
  {
    id: 2,
    marca: "Motomel",
    modelo: "B110",
    categoria: "economica",
    precio: 1380000,
    imagen: "img/motos/motomel-b110.jpg",
    disponible: true,
    cilindrada: "110cc",
    destacada: false
  },
  {
    id: 3,
    marca: "Zanella",
    modelo: "ZR 150",
    categoria: "economica",
    precio: 1890000,
    imagen: "img/motos/zanella-zr150.jpg",
    disponible: true,
    cilindrada: "150cc",
    destacada: false
  },
  {
    id: 4,
    marca: "Bajaj",
    modelo: "Rouser NS 200",
    categoria: "diario",
    precio: 4200000,
    imagen: "img/motos/bajaj-ns200.jpg",
    disponible: true,
    cilindrada: "200cc",
    destacada: true
  },
  {
    id: 5,
    marca: "Honda",
    modelo: "XR 250 Tornado",
    categoria: "viajar",
    precio: null,
    imagen: "img/motos/honda-tornado.jpg",
    disponible: true,
    cilindrada: "250cc",
    destacada: true
  }
];
