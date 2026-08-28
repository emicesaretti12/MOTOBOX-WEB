/**
 * MOTOBOX — Datos Dinámicos & Sincronización Realtime desde CRM (Supabase)
 * Lee el catálogo de motos y el poster promocional en tiempo real sin refrescar la página.
 */

const SUPABASE_URL = "https://szgencxcwhhjwonubika.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_C4tFvXzQJi_o8TWPpdVg3A_f0X0aGss";
const WHATSAPP_NUMBER = "5493511234567";

const CONFIG = {
  nombreAgencia: "Motobox Córdoba",
  slogan: "Concesionaria Multimarca de Motos 0km",
  direccion: "Santa Rosa 4227, Córdoba Capital",
  horarios: "Lunes a Sábados de 09:00 a 20:30 hs",
  telefono: "(0351) 123-4567",
  email: "ventas@motoboxcordoba.com.ar",
  whatsappUrl: `https://wa.me/${WHATSAPP_NUMBER}`
};

const CAT_LABELS = {
  economica: "Económica & Urbana",
  diario: "Uso Diario & Sport",
  viajar: "Aventura & Sierras"
};

// --- Initialize Supabase Client for REST & Realtime ---
let supabaseClient = null;
if (typeof window !== "undefined" && window.supabase && typeof window.supabase.createClient === "function") {
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    });
  } catch (e) {
    console.warn("[MotoBox] Error initializing Supabase client:", e);
  }
}

// --- Supabase REST helper ---
async function supabaseFetch(table, query = '') {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn(`[MotoBox] Error fetching ${table}:`, e.message);
    return null;
  }
}

// --- Fetch motos from CRM ---
async function fetchMotosFromCRM() {
  // Direct select with order, filtering performed in JS for 100% resilience across all schema versions
  let data = await supabaseFetch('inventario_motos', 'select=*&order=created_at.desc');
  if (!data || data.length === 0) return null;

  // Filter visible & available motos, sort featured first
  const visibleList = data
    .filter(m => (m.visible_web !== false) && (m.estado !== 'vendida'))
    .sort((a, b) => (b.destacada ? 1 : 0) - (a.destacada ? 1 : 0));

  return visibleList.map((m, idx) => ({
    id: m.id || idx + 1,
    marca: m.marca || '',
    modelo: m.modelo || '',
    categoria: m.categoria || 'economica',
    categoriaLabel: CAT_LABELS[m.categoria] || m.categoria || 'General',
    imagen: m.imagen_url || (Array.isArray(m.imagenes) && m.imagenes.length ? m.imagenes[0] : `img/motos/placeholder.jpg`),
    imagenes: (Array.isArray(m.imagenes) && m.imagenes.length) ? m.imagenes : (m.imagen_url ? [m.imagen_url] : []),
    disponible: m.estado === 'disponible',
    cilindrada: m.cilindrada ? `${m.cilindrada} cc` : '',
    consumo: m.consumo || '',
    potencia: m.potencia || '',
    frenos: m.frenos || '',
    tanque: m.tanque || '',
    arranque: m.arranque || '',
    destacada: Boolean(m.destacada),
    badge: m.destacada ? 'Destacada' : (m.estado === 'reservada' ? 'Reservada' : ''),
    tagline: m.tagline || `${m.marca} ${m.modelo} — disponible en nuestro showroom.`,
    precio: m.precio || null,
    color: m.color || '',
    anio: m.anio || null,
    usosRecomendados: [],
    perfilComprador: ''
  }));
}

// --- Fetch promo poster from CRM ---
async function fetchPromoFromCRM() {
  const data = await supabaseFetch('configuracion_web', 'id=eq.1');
  if (!data || data.length === 0) return null;
  const c = data[0];
  return {
    activo: c.poster_activo !== false,
    badge: c.poster_badge || '',
    titulo: c.poster_titulo || '',
    subtitulo: c.poster_subtitulo || '',
    imagen: c.poster_imagen_url || 'img/hero.jpg',
    textoBoton: c.poster_boton_texto || 'Consultar por WhatsApp',
    mensajeWhatsApp: c.poster_whatsapp_msg || 'Hola Motobox!'
  };
}

// --- Fallback static data ---
const STATIC_MOTOS = [
  {
    id: 1, marca: "Keller", modelo: "Crono Classic 110", categoria: "economica",
    categoriaLabel: "Económica & Urbana", estado: "0km Nueva", imagen: "img/motos/keller-110.jpg",
    imagenes: ["img/motos/keller-110.jpg"], disponible: true, cilindrada: "110 cc",
    consumo: "2.1 L / 100km", potencia: "7.0 HP", frenos: "Disco delantero / Tambor",
    tanque: "4.0 Litros", arranque: "Eléctrico y a pedal", destacada: true,
    badge: "Más Vendida", tagline: "La reina del ahorro urbano, agilidad y mínimo costo operativo.",
    usosRecomendados: ["trabajo", "ciudad"], perfilComprador: "Ideal para delivery y movilidad diaria."
  },
  {
    id: 4, marca: "Bajaj", modelo: "Rouser NS 200", categoria: "diario",
    categoriaLabel: "Naked Sport & Ciudad", estado: "0km Nueva", imagen: "img/motos/bajaj-ns200.jpg",
    imagenes: ["img/motos/bajaj-ns200.jpg"], disponible: true, cilindrada: "199.5 cc",
    consumo: "3.2 L / 100km", potencia: "24.5 HP", frenos: "Disco lobulado del/tras",
    tanque: "12 Litros", arranque: "Eléctrico", destacada: true,
    badge: "Líder Deportiva", tagline: "Potencia pura de 24.5 HP y diseño agresivo.",
    usosRecomendados: ["ciudad", "estilo"], perfilComprador: "Aceleración deportiva y presencia."
  },
  {
    id: 5, marca: "Honda", modelo: "XR 250 Tornado", categoria: "viajar",
    categoriaLabel: "On-Off / Aventura & Sierras", estado: "0km Nueva", imagen: "img/motos/honda-tornado.jpg",
    imagenes: ["img/motos/honda-tornado.jpg"], disponible: true, cilindrada: "249 cc",
    consumo: "3.4 L / 100km", potencia: "23.3 HP DOHC", frenos: "Disco delantero / Tambor",
    tanque: "11.5 Litros", arranque: "Eléctrico", destacada: true,
    badge: "Mito de la Ruta", tagline: "Indestructible. Las sierras de Córdoba son tuyas.",
    usosRecomendados: ["viajar", "aventura"], perfilComprador: "Confiabilidad legendaria."
  }
];

const STATIC_PROMO = {
  activo: true,
  badge: "Oportunidad Exclusiva 0KM",
  titulo: "Subite a tu moto 0km hoy con Casco y Patente 100% Bonificados",
  subtitulo: "Válido en nuestro Showroom de Santa Rosa 4227 para todas las marcas oficiales en stock físico.",
  imagen: "img/hero.jpg",
  textoBoton: "Aprovechar Promo por WhatsApp",
  mensajeWhatsApp: "Hola Motobox! Quiero aprovechar la promoción de Casco y Patente Bonificados que vi en la web."
};

// --- Categorías ---
const categoriasInfo = [
  { slug: "economica", nombre: "Económicas & Trabajo", descripcion: "Bajo consumo, agilidad y repuestos económicos.", imagen: "img/cat-economicas.jpg", badge: "Consumo 2L/100km" },
  { slug: "diario", nombre: "Uso Diario & Sport", descripcion: "Potencia superior, refrigeración líquida y diseño deportivo.", imagen: "img/cat-diario.jpg", badge: "Hasta 24.5 HP" },
  { slug: "viajar", nombre: "Aventura & Sierras", descripcion: "Suspensión de largo recorrido y robustez off-road.", imagen: "img/cat-viajar.jpg", badge: "Todo Terreno" }
];

// --- Global variables (populated async) ---
let motos = STATIC_MOTOS;
let PROMO_CRM = STATIC_PROMO;

/**
 * Initialize data from CRM and activate Realtime sync.
 * Called by app.js before rendering.
 */
async function initDataFromCRM() {
  const [crmMotos, crmPromo] = await Promise.all([
    fetchMotosFromCRM(),
    fetchPromoFromCRM()
  ]);

  if (crmMotos && crmMotos.length > 0) {
    motos = crmMotos;
    console.log(`[MotoBox] ✅ ${crmMotos.length} motos cargadas desde CRM`);
  } else {
    console.log('[MotoBox] ⚠️ Usando catálogo estático (fallback)');
  }

  if (crmPromo) {
    PROMO_CRM = crmPromo;
    console.log('[MotoBox] ✅ Poster cargado desde CRM');
  } else {
    console.log('[MotoBox] ⚠️ Usando poster estático (fallback)');
  }

  setupRealtimeSubscriptions();
}

/**
 * Supabase Realtime Subscriptions
 * Listens for INSERT, UPDATE, DELETE on inventario_motos and configuracion_web
 * and dispatches events to instantly update UI without full page refresh.
 */
let realtimeChannel = null;

function setupRealtimeSubscriptions() {
  if (!supabaseClient || realtimeChannel) return;

  try {
    realtimeChannel = supabaseClient
      .channel('motobox-realtime-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inventario_motos' }, async (payload) => {
        console.log('[MotoBox Realtime] ⚡ Actualización detectada en inventario:', payload.eventType);
        const updatedMotos = await fetchMotosFromCRM();
        if (updatedMotos) {
          motos = updatedMotos;
          document.dispatchEvent(new CustomEvent('motobox:motos-updated', { detail: motos }));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'configuracion_web' }, async (payload) => {
        console.log('[MotoBox Realtime] ⚡ Actualización detectada en poster web:', payload.eventType);
        const updatedPromo = await fetchPromoFromCRM();
        if (updatedPromo) {
          PROMO_CRM = updatedPromo;
          document.dispatchEvent(new CustomEvent('motobox:promo-updated', { detail: PROMO_CRM }));
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[MotoBox Realtime] 🟢 Conectado en tiempo real con el CRM');
        }
      });
  } catch (err) {
    console.warn('[MotoBox Realtime] Error configurando suscripciones:', err);
  }
}

// Handle Back-Forward Cache (bfcache) navigation
if (typeof window !== "undefined") {
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      initDataFromCRM();
    }
  });
}
