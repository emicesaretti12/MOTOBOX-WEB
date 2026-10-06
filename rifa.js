/**
 * MOTOBOX — Sorteo promocional
 * Popup que aparece al entrar a la web. Pasos:
 *   1. intro  → premios y las dos formas de participar (comprando el manual o gratis).
 *   2. datos  → formulario de inscripción (una participación por DNI, mayores de 18).
 *   3. pago   → solo si compra el manual: datos del pedido, alias, CBU, Mercado Pago y comprobante.
 *   4. listo  → número de participación y verificación del teléfono por WhatsApp.
 * Comprar o no, la chance es la misma. Las inscripciones se guardan en Supabase
 * (función sorteo_inscribir) y se gestionan desde el bloque "Sorteo" del CRM.
 * Se configura con SORTEO_CONFIG (data.js). Las bases completas están en sorteo.html.
 */
(function () {
  "use strict";

  if (typeof SORTEO_CONFIG === "undefined" || !SORTEO_CONFIG || !SORTEO_CONFIG.activo) return;

  const C = SORTEO_CONFIG;
  const PRIZES = Array.isArray(C.premios) ? C.premios.filter((p) => p && p.nombre) : [];
  if (!PRIZES.length) return;

  const MANUAL = C.manual || {};
  const PAGO = C.pago || {};
  const STEPS = ["intro", "datos", "pago", "listo"];
  const WA_NUMBER = typeof WHATSAPP_NUMBER !== "undefined" ? WHATSAPP_NUMBER : "5493516312930";
  const SB_URL = typeof SUPABASE_URL !== "undefined" ? SUPABASE_URL : "";
  const SB_KEY = typeof SUPABASE_ANON_KEY !== "undefined" ? SUPABASE_ANON_KEY : "";
  const KEY = "motobox_sorteo_" + C.id;
  const desktopMq = window.matchMedia("(min-width: 900px)");
  const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
  const MAX_FILE = 8 * 1024 * 1024;

  // modo: "compra" o "gratis". inscripcion: lo que devolvió el servidor (se guarda en el teléfono).
  const state = { open: false, step: "intro", modo: "compra", sending: false, inscripcion: null };

  // --- Helpers ---
  function readKey(kind, key) {
    try { return window[kind] ? window[kind].getItem(key) : null; } catch (e) { return null; }
  }
  function writeKey(kind, key, value) {
    try { if (window[kind]) window[kind].setItem(key, value); } catch (e) { /* almacenamiento bloqueado */ }
  }
  const fmt = (x) => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const money = (x) => "$" + fmt(x);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(5, "0");
  const fecha = C.fechaSorteo ? String(C.fechaSorteo) : "a confirmar";
  const prizeNames = PRIZES.map((p) => p.nombre);
  const prizeList = prizeNames.length > 1 ? prizeNames.slice(0, -1).join(", ") + " y " + prizeNames[prizeNames.length - 1] : prizeNames[0];
  const precio = Number(MANUAL.precio) || 0;
  const manualNombre = MANUAL.nombre || "Manual de Cuidado y Mantenimiento";
  const waLink = (text) => "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(text);

  function saveInscripcion() { writeKey("localStorage", KEY + "_inscripcion", JSON.stringify(state.inscripcion)); }
  function loadInscripcion() {
    try { const raw = readKey("localStorage", KEY + "_inscripcion"); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }

  // Teléfono argentino: se quitan +54, 9, el 0 del área y el 15 del número → 10 dígitos.
  function normalizePhone(raw) {
    let d = String(raw || "").replace(/\D/g, "");
    if (d.startsWith("54")) d = d.slice(2);
    if (d.length === 11 && d.startsWith("9")) d = d.slice(1);
    if (d.startsWith("0")) d = d.slice(1);
    if (d.length === 12) {
      // área de 2 a 4 dígitos seguida de "15"
      for (let a = 2; a <= 4; a++) {
        if (d.substr(a, 2) === "15") { d = d.slice(0, a) + d.slice(a + 2); break; }
      }
    }
    return d;
  }
  function ageFrom(isoDate) {
    const d = new Date(isoDate + "T12:00:00");
    if (isNaN(d)) return -1;
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
  }

  // --- Servidor (Supabase) ---
  const ERRORES = {
    DNI_YA_INSCRIPTO: "Este DNI ya está inscripto en el sorteo. Si necesitás ayuda, escribinos por WhatsApp.",
    DNI_INVALIDO: "Revisá el DNI: tiene que tener 7 u 8 números.",
    NOMBRE_INVALIDO: "Escribí tu nombre y apellido completos.",
    MENOR_DE_EDAD: "Para participar tenés que ser mayor de 18 años.",
    FECHA_INVALIDA: "Revisá la fecha de nacimiento.",
    TELEFONO_INVALIDO: "Revisá el teléfono: código de área y número, sin 0 ni 15.",
    EMAIL_INVALIDO: "Revisá el correo electrónico.",
    DIRECCION_INVALIDA: "Revisá la dirección, la localidad, la provincia y el código postal.",
    DATOS_DEMASIADO_LARGOS: "Algún dato es demasiado largo. Revisalo y probá de nuevo."
  };
  async function rpc(name, body) {
    const res = await fetch(SB_URL + "/rest/v1/rpc/" + name, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const code = data && data.message ? String(data.message) : "";
      // La función todavía no existe en la base (falta la migración): se ofrece WhatsApp.
      if (res.status === 404 || (data && data.code === "PGRST202")) {
        const err = new Error("La inscripción online se está activando. Mientras tanto, anotate por WhatsApp y te asignamos tu número.");
        err.code = "SIN_SERVICIO";
        throw err;
      }
      const err = new Error(ERRORES[code] || "No pudimos guardar tu inscripción. Revisá tu conexión y probá de nuevo.");
      err.code = code;
      throw err;
    }
    return data;
  }
  async function uploadComprobante(file, token) {
    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    const path = token + "/comprobante-" + Date.now() + "." + ext;
    const res = await fetch(SB_URL + "/storage/v1/object/sorteo-comprobantes/" + path, {
      method: "POST",
      headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": file.type || "application/octet-stream", "x-upsert": "false" },
      body: file
    });
    if (!res.ok) throw new Error("No pudimos subir el comprobante. Probá con una foto o un PDF de menos de 8 MB.");
    const ok = await rpc("sorteo_registrar_comprobante", { p_token: token, p_path: path });
    if (ok !== true) throw new Error("No pudimos registrar el comprobante. Escribinos por WhatsApp y lo cargamos nosotros.");
  }

  // --- Markup ---
  const title = esc(C.titulo || "Ganate una moto 0km");
  const legal = '<strong>Sin obligación de compra.</strong> Comprando o gratis, la misma chance. <a href="' + esc(C.basesUrl || "sorteo.html") + '">Bases y condiciones</a>';

  const ICON_BACK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  const ICON_CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_MOTO = '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5l4-7h4l3 7"/><path d="M13.5 9.5l1.5-3h2.5"/><path d="M9 9.5H6.5"/></svg>';
  const ICON_BOOK = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/></svg>';
  const ICON_TICKET = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 8a2 2 0 0 0 0 4v0a2 2 0 0 0 0 4v2h18v-2a2 2 0 0 0 0-4 2 2 0 0 0 0-4V6H3z"/><path d="M13 6v12" stroke-dasharray="2 2"/></svg>';
  const ICON_COPY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';

  const prizeCards = PRIZES.slice(0, 2).map((p, i) =>
    '<div class="rf-prize-card rf-prize-card--' + (i + 1) + '">' +
      (p.imagen
        ? '<img src="' + esc(p.imagen) + '" alt="' + esc(p.nombre) + ' 0km">'
        : '<div class="rf-prize-ph">' + ICON_MOTO + "</div>") +
      '<span class="rf-prize-name">' + esc(p.nombre) + "</span>" +
      (i === PRIZES.length - 1 || i === 1 ? '<div class="rf-glare"></div><div class="rf-sheen"></div>' : "") +
    "</div>"
  ).join("");

  const field = (name, label, attrs, hint) =>
    '<label class="rf-field" data-field="' + name + '"><span class="rf-label-t">' + label + "</span>" +
      "<input " + attrs + ' name="' + name + '">' +
      (hint ? '<small class="rf-hint">' + hint + "</small>" : "") +
      '<small class="rf-err" aria-live="polite"></small></label>';

  const PROVINCIAS = ["Córdoba", "Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Catamarca", "Chaco", "Chubut", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"];

  const root = document.createElement("div");
  root.className = "rf";
  root.hidden = true;
  root.innerHTML = `
    <div class="rf-scrim" data-rf-close></div>
    <div class="rf-dialog" role="dialog" aria-modal="true" aria-labelledby="rf-title" tabindex="-1">
      <div class="rf-grabber" aria-hidden="true"></div>
      <div class="rf-top">
        <button type="button" class="rf-icon-btn" data-rf-back aria-label="Volver">${ICON_BACK}</button>
        <div class="rf-progress" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        <button type="button" class="rf-icon-btn" data-rf-close aria-label="Cerrar">${ICON_CLOSE}</button>
      </div>

      <aside class="rf-prize">
        <div class="rf-stage rf-st">
          <div class="rf-stage-shadow"></div>
          <div class="rf-float" data-rf-tilt-hit>
            <div class="rf-card3d" data-rf-tilt>${prizeCards}</div>
          </div>
        </div>
        <div class="rf-prize-text rf-st rf-d1">
          <p class="rf-kicker">Sorteo N.º ${esc(C.id)} · ${PRIZES.length === 1 ? "1 premio" : PRIZES.length + " premios"}</p>
          <h2 class="rf-title" id="rf-title">${title}</h2>
          <p class="rf-sub">Sorteamos ${esc(prizeList)} 0km. Participás comprando el ${esc(manualNombre)} o gratis: en los dos casos, la misma chance.</p>
        </div>
        <div class="rf-stats rf-st rf-d2">
          <div class="rf-stat"><strong>${PRIZES.length}</strong><span>${PRIZES.length === 1 ? "moto 0km" : "motos 0km"}</span></div>
          <div class="rf-stat"><strong>1 por DNI</strong><span>misma chance para todos</span></div>
          <div class="rf-stat"><strong>${C.fechaSorteo ? esc(C.fechaSorteo) : "A confirmar"}</strong><span>fecha del sorteo</span></div>
        </div>
        <p class="rf-legal rf-legal--desk">${legal}</p>
      </aside>

      <div class="rf-steps">
        <section class="rf-step" data-step="intro">
          <div class="rf-head rf-intro-head">
            <h3 class="rf-h">Elegí cómo participar</h3>
            <p class="rf-p">Las dos opciones tienen exactamente la misma chance.</p>
          </div>
          <div class="rf-options rf-st rf-d3" role="radiogroup" aria-label="Forma de participar">
            <button type="button" class="rf-option is-selected" role="radio" aria-checked="true" data-rf-modo="compra">
              <span class="rf-option-icon">${ICON_BOOK}</span>
              <span class="rf-option-body">
                <span class="rf-option-title">Comprar el manual y participar</span>
                <span class="rf-option-chip">Incluye manual en PDF</span>
                <span class="rf-option-desc">${esc(manualNombre)} en PDF por WhatsApp + tu número para el sorteo.</span>
              </span>
              <span class="rf-option-price">${precio ? money(precio) : ""}</span>
            </button>
            <button type="button" class="rf-option" role="radio" aria-checked="false" data-rf-modo="gratis">
              <span class="rf-option-icon">${ICON_TICKET}</span>
              <span class="rf-option-body">
                <span class="rf-option-title">Participar gratis</span>
                <span class="rf-option-desc">Te inscribís sin comprar nada y recibís tu número.</span>
              </span>
              <span class="rf-option-price">$0</span>
            </button>
          </div>
          <div class="rf-cta-block rf-st rf-d4">
            <button type="button" class="rf-btn rf-btn-red rf-btn-shine" data-rf-go="datos"><span data-rf-intro-cta>Continuar</span></button>
            <p class="rf-legal">${legal}</p>
          </div>
        </section>

        <section class="rf-step" data-step="datos">
          <div class="rf-head">
            <h3 class="rf-h">Tus datos</h3>
            <p class="rf-p" data-rf-datos-sub>Con estos datos te inscribimos y te contactamos si ganás.</p>
          </div>
          <form class="rf-form" data-rf-form novalidate>
            ${field("dni", "DNI", 'inputmode="numeric" autocomplete="off" maxlength="10" required placeholder="Solo números"')}
            ${field("nombre_completo", "Nombre y apellido", 'autocomplete="name" maxlength="120" required')}
            ${field("fecha_nacimiento", "Fecha de nacimiento", 'type="date" required max="' + new Date(Date.now() - 18 * 365.25 * 864e5).toISOString().slice(0, 10) + '"', "Tenés que ser mayor de 18 años.")}
            ${field("telefono", "Celular con WhatsApp", 'type="tel" inputmode="tel" autocomplete="tel-national" required placeholder="351 6312930"', "Código de área y número, sin 0 ni 15. Es el medio por el que te vamos a contactar.")}
            ${field("telefono2", "Repetí el celular", 'type="tel" inputmode="tel" autocomplete="off" required placeholder="351 6312930"')}
            ${field("email", "Gmail", 'type="email" inputmode="email" autocomplete="email" maxlength="120" required placeholder="nombre@gmail.com"')}
            <div class="rf-row">
              ${field("localidad", "Localidad", 'autocomplete="address-level2" maxlength="80" required')}
              ${field("codigo_postal", "Código postal", 'autocomplete="postal-code" maxlength="8" required')}
            </div>
            ${field("direccion", "Dirección", 'autocomplete="street-address" maxlength="160" required placeholder="Calle, número, piso"')}
            <label class="rf-field" data-field="provincia"><span class="rf-label-t">Provincia</span>
              <select name="provincia" required autocomplete="address-level1">
                ${PROVINCIAS.map((p) => '<option value="' + p + '">' + p + "</option>").join("")}
              </select><small class="rf-err" aria-live="polite"></small></label>
            <label class="rf-check" data-field="acepto"><input type="checkbox" name="acepto" required>
              <span>Soy mayor de 18 años y acepto las <a href="${esc(C.basesUrl || "sorteo.html")}" target="_blank" rel="noopener">bases y condiciones</a>.</span></label>
            <small class="rf-err rf-err-acepto" aria-live="polite"></small>
            <p class="rf-form-error" data-rf-form-error role="alert" hidden></p>
            <button type="submit" class="rf-btn rf-btn-red" data-rf-submit><span data-rf-submit-label>Confirmar</span></button>
          </form>
        </section>

        <section class="rf-step" data-step="pago">
          <div class="rf-head">
            <h3 class="rf-h">Pagá tu manual</h3>
            <p class="rf-p">Tu número ya está reservado. Pagá y subí el comprobante para que lo verifiquemos.</p>
          </div>
          <div class="rf-order" data-rf-order></div>
          <div class="rf-paybox">
            <div class="rf-pay-amount"><span>Total a pagar</span><strong>${precio ? money(precio) : "A confirmar"}</strong></div>
            <div data-rf-bank></div>
            <a class="rf-btn rf-btn-mp" data-rf-mp href="#" target="_blank" rel="noopener" hidden>Pagar con Mercado Pago</a>
          </div>
          <div class="rf-upload">
            <p class="rf-upload-title">Adjuntá el comprobante</p>
            <label class="rf-drop" data-rf-drop>
              <input type="file" accept="image/*,application/pdf" data-rf-file>
              <span class="rf-drop-text" data-rf-file-name>Tocá para elegir una foto o un PDF (hasta 8 MB)</span>
            </label>
            <p class="rf-form-error" data-rf-upload-error role="alert" hidden></p>
            <button type="button" class="rf-btn rf-btn-red" data-rf-send-file disabled><span>Enviar comprobante</span></button>
            <button type="button" class="rf-btn rf-btn-ghost" data-rf-go="listo">Lo subo más tarde</button>
          </div>
        </section>

        <section class="rf-step" data-step="listo">
          <div class="rf-done">
            <div class="rf-ticket-lite">
              <span class="rf-tl-kicker">Sorteo N.º ${esc(C.id)}</span>
              <span class="rf-tl-label">Tu número</span>
              <strong class="rf-tl-num" data-rf-num>—</strong>
              <span class="rf-tl-name" data-rf-name></span>
            </div>
            <p class="rf-done-status" data-rf-status></p>
          </div>
          <div class="rf-verify">
            <p class="rf-upload-title">Verificá tu WhatsApp</p>
            <p class="rf-p">Mandanos el código desde el celular que cargaste: así confirmamos que es tuyo y por ahí te avisamos todo.</p>
            <p class="rf-code">Código <strong data-rf-code>—</strong></p>
            <a class="rf-btn rf-btn-wa" data-rf-verify href="#" target="_blank" rel="noopener">Enviar código por WhatsApp</a>
          </div>
          <button type="button" class="rf-btn rf-btn-outline" data-rf-go="pago" data-rf-back-pay hidden>Volver al pago</button>
          <p class="rf-legal">${legal}</p>
        </section>
      </div>
    </div>`;

  const pill = document.createElement("div");
  pill.className = "rf-pill";
  pill.hidden = true;
  const pillImg = (PRIZES.find((p) => p.imagen) || {}).imagen;
  pill.innerHTML = `
    <button type="button" class="rf-pill-main" data-rf-open aria-haspopup="dialog">
      <span class="rf-pill-thumb">${pillImg ? '<img src="' + esc(pillImg) + '" alt="">' : ""}</span>
      <span class="rf-pill-text">
        <span class="rf-pill-kicker"><i class="rf-live"></i>Sorteo N.º ${esc(C.id)}</span>
        <span class="rf-pill-title">${PRIZES.length === 1 ? "1 moto 0km" : PRIZES.length + " motos 0km"} · participá</span>
      </span>
      <span class="rf-pill-cta">Participar</span>
    </button>
    <button type="button" class="rf-pill-x" data-rf-hide-pill aria-label="Ocultar el sorteo">${ICON_CLOSE}</button>`;

  const $ = (sel) => root.querySelector(sel);
  const dialog = $(".rf-dialog");
  const stepsBox = $(".rf-steps");
  const stepEls = Array.from(root.querySelectorAll(".rf-step"));
  const progressEls = Array.from(root.querySelectorAll(".rf-progress span"));
  const backBtn = $("[data-rf-back]");
  const form = $("[data-rf-form]");
  const fileInput = $("[data-rf-file]");
  const sendFileBtn = $("[data-rf-send-file]");

  const timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  // --- Navegación entre pasos ---
  // Una vez inscripto no se vuelve al formulario: el número ya está asignado.
  function allowedBack(step) {
    if (step === "datos") return "intro";
    if (step === "listo" && state.inscripcion && state.inscripcion.compra && !state.inscripcion.comprobante) return "pago";
    return null;
  }

  function go(step, dir) {
    if (STEPS.indexOf(step) < 0) return;
    const ins = state.inscripcion;
    if (ins && (step === "intro" || step === "datos")) step = ins.compra && !ins.comprobante ? "pago" : "listo";
    if (!ins && (step === "pago" || step === "listo")) step = "intro";
    if (step === "pago" && ins && !ins.compra) step = "listo";
    state.step = step;
    root.dataset.step = step;
    const idx = STEPS.indexOf(step);
    stepEls.forEach((el) => {
      const on = el.dataset.step === step;
      el.classList.remove("is-fwd", "is-back");
      el.classList.toggle("is-active", on);
      if (on && dir && !reduceMq.matches) {
        void el.offsetWidth;
        el.classList.add(dir === "back" ? "is-back" : "is-fwd");
      }
    });
    progressEls.forEach((el, i) => el.classList.toggle("is-done", i <= idx));
    backBtn.classList.toggle("is-hidden", !allowedBack(step));
    resetTilt();
    if (step === "datos") renderDatos();
    if (step === "pago") renderPago();
    if (step === "listo") renderListo();
    dialog.scrollTop = 0;
    stepsBox.scrollTop = 0;
  }

  function back() {
    const to = allowedBack(state.step);
    if (to) go(to, "back");
  }

  function setModo(modo) {
    state.modo = modo;
    root.querySelectorAll("[data-rf-modo]").forEach((b) => {
      const on = b.dataset.rfModo === modo;
      b.classList.toggle("is-selected", on);
      b.setAttribute("aria-checked", on ? "true" : "false");
    });
    $("[data-rf-intro-cta]").textContent = modo === "compra" ? "Continuar con la compra" + (precio ? " · " + money(precio) : "") : "Participar gratis";
  }

  function renderDatos() {
    const compra = state.modo === "compra";
    $("[data-rf-submit-label]").textContent = compra ? "Confirmar pedido" : "Confirmar inscripción";
    $("[data-rf-datos-sub]").textContent = compra
      ? "Creamos tu inscripción y después te mostramos cómo pagar el manual."
      : "Con estos datos te inscribimos y te contactamos si ganás.";
  }

  function copyRow(label, value) {
    return '<div class="rf-copy-row"><span><small>' + label + "</small><strong>" + esc(value) + "</strong></span>" +
      '<button type="button" class="rf-copy" data-rf-copy="' + esc(value) + '" aria-label="Copiar ' + label + '">' + ICON_COPY + "<em>Copiar</em></button></div>";
  }

  function renderPago() {
    const ins = state.inscripcion;
    if (!ins) return;
    $("[data-rf-order]").innerHTML =
      '<div class="rf-order-head"><span>Pedido</span><strong>N.º de participación ' + pad(ins.numero) + "</strong></div>" +
      '<dl class="rf-order-list">' +
        "<div><dt>Producto</dt><dd>" + esc(manualNombre) + " (PDF)</dd></div>" +
        "<div><dt>Nombre</dt><dd>" + esc(ins.nombre) + "</dd></div>" +
        "<div><dt>DNI</dt><dd>" + esc(ins.dni) + "</dd></div>" +
        "<div><dt>WhatsApp</dt><dd>" + esc(ins.telefono) + "</dd></div>" +
        "<div><dt>Correo</dt><dd>" + esc(ins.email) + "</dd></div>" +
        "<div><dt>Domicilio</dt><dd>" + esc(ins.domicilio) + "</dd></div>" +
      "</dl>";
    const hasBank = PAGO.alias || PAGO.cbu;
    $("[data-rf-bank]").innerHTML = hasBank
      ? (PAGO.alias ? copyRow("Alias", PAGO.alias) : "") + (PAGO.cbu ? copyRow("CBU / CVU", PAGO.cbu) : "") +
        (PAGO.titular ? '<p class="rf-bank-holder">Titular: ' + esc(PAGO.titular) + "</p>" : "")
      : '<p class="rf-bank-holder">Te enviamos el alias y el CBU por WhatsApp.</p>' +
        '<a class="rf-btn rf-btn-outline" target="_blank" rel="noopener" href="' + esc(waLink("Hola Motobox! Me inscribí al Sorteo N.º " + C.id + " (número " + pad(ins.numero) + ", DNI " + ins.dni + ") y quiero pagar el manual. ¿Me pasan los datos para transferir?")) + '">Pedir datos de pago</a>';
    const mp = $("[data-rf-mp]");
    mp.hidden = !PAGO.mercadoPagoUrl;
    if (PAGO.mercadoPagoUrl) {
      mp.href = PAGO.mercadoPagoUrl;
      // Un link de cobro lleva directo a pagar; la página general abre la app para transferir al alias.
      const linkDeCobro = !/^https?:\/\/(www\.)?mercadopago\.com\.ar\/?$/.test(PAGO.mercadoPagoUrl);
      mp.textContent = linkDeCobro ? "Pagar con Mercado Pago" : "Abrir Mercado Pago y transferir";
    }
  }

  function renderListo() {
    const ins = state.inscripcion;
    if (!ins) return;
    const numEl = $("[data-rf-num]");
    if (celebrate && !reduceMq.matches) rollNumber(numEl, pad(ins.numero));
    else numEl.textContent = pad(ins.numero);
    $("[data-rf-name]").textContent = ins.nombre;
    $("[data-rf-code]").textContent = ins.codigo;
    let status;
    if (!ins.compra) status = "¡Listo, ya estás participando! Guardá tu número. Te avisamos por WhatsApp la fecha del sorteo.";
    else if (ins.comprobante) status = "Recibimos tu comprobante. Cuando verifiquemos el pago te mandamos por WhatsApp tu número y el manual en PDF.";
    else status = "Tu número está reservado. Falta el pago del manual: cuando subas el comprobante lo verificamos y te mandamos todo por WhatsApp.";
    $("[data-rf-status]").textContent = status;
    $("[data-rf-back-pay]").hidden = !(ins.compra && !ins.comprobante);
    $("[data-rf-verify]").href = waLink("Hola Motobox! Verifico mi WhatsApp para el Sorteo N.º " + C.id + ". Código: " + ins.codigo + ". DNI: " + ins.dni + ".");
    if (celebrate && !reduceMq.matches) later(burstConfetti, 380);
    celebrate = false;
  }

  // Festejo al inscribirse: el número gira como un contador y salta papel picado.
  let celebrate = false;
  function rollNumber(el, final) {
    el.innerHTML = final.split("").map((d, i) =>
      '<span class="rf-roll" style="--i:' + i + '"><span class="rf-roll-strip">' +
        "0123456789".split("").map((n) => "<b>" + n + "</b>").join("") + "<b>" + d + "</b>" +
      "</span></span>"
    ).join("");
    el.setAttribute("aria-label", final);
  }
  function burstConfetti() {
    const box = $(".rf-done");
    if (!box) return;
    const layer = document.createElement("div");
    layer.className = "rf-confetti-burst";
    layer.setAttribute("aria-hidden", "true");
    const colors = ["#e02e24", "#ff7a45", "#ffd166", "#1d1d1f", "#ffffff", "#25d366"];
    let html = "";
    for (let i = 0; i < 28; i++) {
      const a = (Math.random() * 140 + 200) * Math.PI / 180;  // hacia arriba, abanico
      const d = 120 + Math.random() * 160;
      html += '<i style="--x:' + (Math.cos(a) * d).toFixed(0) + "px;--y:" + (Math.sin(a) * d).toFixed(0) + "px;--r:" + Math.round(Math.random() * 720 - 360) +
        "deg;--d:" + Math.round(Math.random() * 120) + "ms;background:" + colors[i % colors.length] + '"></i>';
    }
    layer.innerHTML = html;
    box.appendChild(layer);
    later(() => layer.remove(), 1800);
  }

  // --- Validación del formulario ---
  function setError(name, msg) {
    const box = name === "acepto" ? $(".rf-err-acepto") : $('[data-field="' + name + '"] .rf-err');
    const wrap = $('[data-field="' + name + '"]');
    if (box) box.textContent = msg || "";
    if (wrap) wrap.classList.toggle("is-invalid", !!msg);
  }

  function validate() {
    const v = Object.fromEntries(new FormData(form).entries());
    const errs = {};
    const dni = String(v.dni || "").replace(/\D/g, "");
    if (!/^\d{7,8}$/.test(dni)) errs.dni = "Tiene que tener 7 u 8 números.";
    const nombre = String(v.nombre_completo || "").trim().replace(/\s+/g, " ");
    if (nombre.length < 5 || !/\s/.test(nombre)) errs.nombre_completo = "Escribí nombre y apellido.";
    if (!v.fecha_nacimiento) errs.fecha_nacimiento = "Elegí tu fecha de nacimiento.";
    else if (ageFrom(v.fecha_nacimiento) < 18 || ageFrom(v.fecha_nacimiento) > 110) errs.fecha_nacimiento = "Tenés que ser mayor de 18 años.";
    const tel = normalizePhone(v.telefono);
    if (tel.length !== 10) errs.telefono = "Revisalo: código de área y número, 10 dígitos en total.";
    else if (normalizePhone(v.telefono2) !== tel) errs.telefono2 = "Los dos números no coinciden.";
    const email = String(v.email || "").trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.email = "Revisá el correo.";
    if (String(v.localidad || "").trim().length < 2) errs.localidad = "Completá la localidad.";
    if (!/^[A-Za-z0-9]{4,8}$/.test(String(v.codigo_postal || "").trim())) errs.codigo_postal = "Ej: 5000 o X5000ABC.";
    if (String(v.direccion || "").trim().length < 3) errs.direccion = "Completá la dirección.";
    if (!v.provincia) errs.provincia = "Elegí la provincia.";
    if (!form.elements.acepto.checked) errs.acepto = "Tenés que aceptar las bases para participar.";
    ["dni", "nombre_completo", "fecha_nacimiento", "telefono", "telefono2", "email", "localidad", "codigo_postal", "direccion", "provincia", "acepto"]
      .forEach((k) => setError(k, errs[k]));
    return { ok: !Object.keys(errs).length, errs, data: {
      sorteo_id: C.id, dni, nombre_completo: nombre, fecha_nacimiento: v.fecha_nacimiento, telefono: tel, email,
      localidad: String(v.localidad).trim(), codigo_postal: String(v.codigo_postal).trim().toUpperCase(),
      direccion: String(v.direccion).trim(), provincia: v.provincia
    } };
  }

  async function submitForm(e) {
    e.preventDefault();
    if (state.sending) return;
    const formError = $("[data-rf-form-error]");
    formError.hidden = true;
    const r = validate();
    if (!r.ok) {
      const first = form.querySelector(".is-invalid input, .is-invalid select, [data-field='acepto'] input:not(:checked)");
      if (first) first.focus();
      return;
    }
    const compra = state.modo === "compra";
    const btn = $("[data-rf-submit]");
    state.sending = true;
    btn.disabled = true;
    $("[data-rf-submit-label]").textContent = "Guardando…";
    try {
      const res = await rpc("sorteo_inscribir", { p: Object.assign({}, r.data, { compra_manual: compra, monto: compra ? precio : null }) });
      state.inscripcion = {
        numero: res.numero, codigo: res.codigo, token: res.upload_token || null, compra: compra, comprobante: false,
        nombre: r.data.nombre_completo, dni: r.data.dni, telefono: r.data.telefono, email: r.data.email,
        domicilio: r.data.direccion + ", " + r.data.localidad + ", " + r.data.provincia + " (" + r.data.codigo_postal + ")"
      };
      saveInscripcion();
      if (!compra) celebrate = true;
      go(compra ? "pago" : "listo", "fwd");
    } catch (err) {
      formError.textContent = err.message;
      if (err.code === "SIN_SERVICIO") {
        const link = document.createElement("a");
        link.className = "rf-btn rf-btn-wa rf-fallback-wa";
        link.target = "_blank";
        link.rel = "noopener";
        link.textContent = "Inscribirme por WhatsApp";
        link.href = waLink("Hola Motobox! Quiero inscribirme al Sorteo N.º " + C.id + (compra ? " comprando el manual" : " (participación gratis)") +
          ". Mis datos: " + r.data.nombre_completo + ", DNI " + r.data.dni + ", nacimiento " + r.data.fecha_nacimiento +
          ", " + r.data.email + ", " + r.data.direccion + ", " + r.data.localidad + ", " + r.data.provincia + " (" + r.data.codigo_postal + ").");
        formError.appendChild(document.createElement("br"));
        formError.appendChild(link);
      }
      formError.hidden = false;
      if (err.code === "DNI_YA_INSCRIPTO") setError("dni", "Ya está inscripto.");
    } finally {
      state.sending = false;
      btn.disabled = false;
      renderDatos();
    }
  }

  async function sendFile() {
    const ins = state.inscripcion;
    const file = fileInput.files && fileInput.files[0];
    const errBox = $("[data-rf-upload-error]");
    errBox.hidden = true;
    if (!ins || !ins.token || !file) return;
    if (file.size > MAX_FILE) { errBox.textContent = "El archivo pesa más de 8 MB. Probá con una captura de pantalla."; errBox.hidden = false; return; }
    sendFileBtn.disabled = true;
    sendFileBtn.firstElementChild.textContent = "Enviando…";
    try {
      await uploadComprobante(file, ins.token);
      ins.comprobante = true;
      saveInscripcion();
      celebrate = true;
      go("listo", "fwd");
    } catch (err) {
      errBox.textContent = err.message;
      errBox.hidden = false;
    } finally {
      sendFileBtn.firstElementChild.textContent = "Enviar comprobante";
      sendFileBtn.disabled = !(fileInput.files && fileInput.files[0]);
    }
  }

  let lastFocus = null;
  function open() {
    if (state.open) return;
    state.open = true;
    lastFocus = document.activeElement;
    pill.hidden = true;
    root.classList.remove("is-closing");
    root.hidden = false;
    document.documentElement.classList.add("rf-lock");
    go(state.step === "datos" ? "datos" : "intro");
    requestAnimationFrame(() => {
      try { dialog.focus({ preventScroll: true }); } catch (e) { dialog.focus(); }
    });
  }

  function close() {
    if (!state.open) return;
    state.open = false;
    resetTilt();
    document.documentElement.classList.remove("rf-lock");
    const finish = () => {
      if (state.open) return;
      root.hidden = true;
      root.classList.remove("is-closing");
    };
    if (reduceMq.matches) finish();
    else { root.classList.add("is-closing"); later(finish, 240); }
    if (readKey("sessionStorage", KEY + "_pill") !== "1") pill.hidden = false;
    if (lastFocus && typeof lastFocus.focus === "function" && document.contains(lastFocus)) {
      try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* sin foco previo */ }
    }
  }

  // --- Inclinación 3D con resorte (tarjetas de premios, solo con mouse) ---
  // Resorte estilo Apple: respuesta 0,5 s y rebote 0,2 → rigidez 157,9 y amortiguación 20,1.
  const spring = { el: null, x: 0, y: 0, vx: 0, vy: 0, tx: 0, ty: 0, gx: 50, gy: 50, tgx: 50, tgy: 50, raf: 0 };

  function applyTilt() {
    const el = spring.el;
    if (!el) return;
    el.style.setProperty("--rx", spring.x.toFixed(2) + "deg");
    el.style.setProperty("--ry", spring.y.toFixed(2) + "deg");
    el.style.setProperty("--gx", spring.gx.toFixed(1) + "%");
    el.style.setProperty("--gy", spring.gy.toFixed(1) + "%");
    el.style.setProperty("--glare", Math.min(1, (Math.abs(spring.x) + Math.abs(spring.y)) / 8).toFixed(2));
  }
  function resetTilt() {
    cancelAnimationFrame(spring.raf);
    spring.raf = 0;
    if (spring.el) {
      spring.x = spring.y = spring.vx = spring.vy = spring.tx = spring.ty = 0;
      spring.gx = spring.gy = spring.tgx = spring.tgy = 50;
      applyTilt();
    }
    spring.el = null;
  }
  function runSpring() {
    if (spring.raf) return;
    let last = null;
    const frame = (now) => {
      const dt = last === null ? 1 / 60 : Math.min(0.032, (now - last) / 1000);
      last = now;
      spring.vx += (157.9 * (spring.tx - spring.x) - 20.1 * spring.vx) * dt;
      spring.vy += (157.9 * (spring.ty - spring.y) - 20.1 * spring.vy) * dt;
      spring.x += spring.vx * dt;
      spring.y += spring.vy * dt;
      spring.gx += (spring.tgx - spring.gx) * 0.18;
      spring.gy += (spring.tgy - spring.gy) * 0.18;
      const done = Math.abs(spring.tx - spring.x) < 0.02 && Math.abs(spring.ty - spring.y) < 0.02 &&
        Math.abs(spring.vx) < 0.02 && Math.abs(spring.vy) < 0.02;
      if (done) { spring.x = spring.tx; spring.y = spring.ty; spring.vx = spring.vy = 0; }
      applyTilt();
      spring.raf = done ? 0 : requestAnimationFrame(frame);
    };
    spring.raf = requestAnimationFrame(frame);
  }
  function bindTilt(hit, target) {
    if (!hit || !target) return;
    hit.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch" || reduceMq.matches) return;
      const r = hit.getBoundingClientRect();
      if (!r.width || !r.height) return;
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      if (spring.el !== target) { resetTilt(); spring.el = target; }
      spring.tx = -y * 14;
      spring.ty = x * 18;
      spring.tgx = (x + 0.5) * 100;
      spring.tgy = (y + 0.5) * 100;
      runSpring();
    });
    hit.addEventListener("pointerleave", () => {
      if (spring.el !== target) return;
      spring.tx = spring.ty = 0;
      spring.tgx = spring.tgy = 50;
      runSpring();
    });
  }

  // --- Eventos ---
  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-rf-close], [data-rf-back], [data-rf-go], [data-rf-modo], [data-rf-copy], [data-rf-send-file]");
    if (!t || !root.contains(t)) return;
    if (t.hasAttribute("data-rf-close")) close();
    else if (t.hasAttribute("data-rf-back")) back();
    else if (t.hasAttribute("data-rf-modo")) setModo(t.dataset.rfModo);
    else if (t.hasAttribute("data-rf-go")) { if (!t.disabled) go(t.getAttribute("data-rf-go"), "fwd"); }
    else if (t.hasAttribute("data-rf-send-file")) sendFile();
    else if (t.hasAttribute("data-rf-copy")) {
      const value = t.getAttribute("data-rf-copy");
      const done = () => { t.classList.add("is-copied"); t.lastElementChild.textContent = "Copiado"; later(() => { t.classList.remove("is-copied"); t.lastElementChild.textContent = "Copiar"; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(value).then(done, done);
      else done();
    }
  });
  form.addEventListener("submit", submitForm);
  form.addEventListener("input", (e) => { if (e.target.name) setError(e.target.name, ""); });
  fileInput.addEventListener("change", () => {
    const f = fileInput.files && fileInput.files[0];
    $("[data-rf-file-name]").textContent = f ? f.name : "Tocá para elegir una foto o un PDF (hasta 8 MB)";
    $("[data-rf-drop]").classList.toggle("has-file", !!f);
    sendFileBtn.disabled = !f;
    $("[data-rf-upload-error]").hidden = true;
  });

  // Los links "Sorteo" del menú abren el popup en vez de navegar.
  document.addEventListener("click", (e) => {
    const link = e.target.closest && e.target.closest("[data-rifa-open]");
    if (!link) return;
    e.preventDefault();
    open();
  });

  pill.addEventListener("click", (e) => {
    if (e.target.closest("[data-rf-hide-pill]")) {
      writeKey("sessionStorage", KEY + "_pill", "1");
      pill.hidden = true;
    } else if (e.target.closest("[data-rf-open]")) {
      open();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (!state.open) return;
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = Array.from(dialog.querySelectorAll("a[href], button:not([disabled]), input, select")).filter((el) => el.offsetParent !== null);
    if (!focusables.length) return;
    const first = focusables[0], last = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  // --- Inicio ---
  function init() {
    document.body.appendChild(root);
    document.body.appendChild(pill);
    state.inscripcion = loadInscripcion();
    setModo(state.inscripcion && !state.inscripcion.compra ? "gratis" : "compra");
    bindTilt($("[data-rf-tilt-hit]"), $("[data-rf-tilt]"));

    if (window.location.hash === "#sorteo") {
      writeKey("sessionStorage", KEY + "_visto", "1");
      later(open, 300);
    } else if (document.body.dataset.page === "sorteo") {
      // En la página de bases no se abre solo: se abre con el botón "Participar".
    } else if (readKey("sessionStorage", KEY + "_visto") !== "1" && !state.inscripcion) {
      writeKey("sessionStorage", KEY + "_visto", "1");
      // Si está corriendo la intro de la portada, el popup espera a que termine.
      if (document.documentElement.classList.contains("mx-intro-on")) {
        document.addEventListener("motobox:intro-done", () => later(open, 700), { once: true });
      } else {
        later(open, 900);
      }
    } else if (readKey("sessionStorage", KEY + "_pill") !== "1") {
      pill.hidden = false;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
