/**
 * MOTOBOX — Sorteo: "Mis números"
 * Cada participante ve su número y el estado del pago del manual.
 *   * Desde el mismo teléfono con el que se inscribió entra solo (token guardado por rifa.js).
 *   * Desde otro equipo entra con DNI + la clave que creó en el formulario.
 * Cuando el vendedor marca "Pagado" en el CRM, acá aparece el pago confirmado y el manual para descargar.
 * Funciones del servidor: sorteo_mi_participacion y sorteo_consultar (migración 005 del CRM).
 */
(function () {
  "use strict";

  const main = document.getElementById("mis-numeros");
  if (!main) return;

  const C = typeof SORTEO_CONFIG !== "undefined" && SORTEO_CONFIG ? SORTEO_CONFIG : { id: "01" };
  const MANUAL = C.manual || {};
  const WA_NUMBER = typeof WHATSAPP_NUMBER !== "undefined" ? WHATSAPP_NUMBER : "5493516312930";
  const SB_URL = typeof SUPABASE_URL !== "undefined" ? SUPABASE_URL : "";
  const SB_KEY = typeof SUPABASE_ANON_KEY !== "undefined" ? SUPABASE_ANON_KEY : "";
  const KEY = "motobox_sorteo_" + C.id + "_inscripcion";
  const MANUAL_URL = SB_URL + "/storage/v1/object/public/sorteo-manual/manual.pdf";
  const manualNombre = MANUAL.nombre || "Manual de Cuidado y Mantenimiento";
  const precio = Number(MANUAL.precio) || 0;
  const fecha = C.fechaSorteo ? String(C.fechaSorteo) : "a confirmar";

  const $ = (sel) => main.querySelector(sel);
  const login = $("[data-mn-login]");
  const form = $("[data-mn-form]");
  const errorBox = $("[data-mn-error]");
  const submitBtn = $("[data-mn-submit]");
  const result = $("[data-mn-result]");
  const loading = $("[data-mn-loading]");

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = (n) => String(n).padStart(5, "0");
  const fmt = (x) => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const waLink = (text) => "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(text);

  function readSaved() {
    try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  }
  function writeSaved(value) {
    try {
      if (value) localStorage.setItem(KEY, JSON.stringify(value));
      else localStorage.removeItem(KEY);
    } catch (e) { /* almacenamiento bloqueado */ }
  }

  // --- Servidor ---
  const ERRORES = {
    DATOS_INCORRECTOS: "El DNI o la clave no coinciden. Revisalos y probá de nuevo.",
    NO_ENCONTRADO: "No encontramos tu inscripción en este teléfono. Entrá con tu DNI y tu clave.",
    DEMASIADOS_INTENTOS: "Hubo demasiados intentos. Por seguridad, esperá 15 minutos y probá de nuevo."
  };
  async function rpc(name, body) {
    let res;
    try {
      res = await fetch(SB_URL + "/rest/v1/rpc/" + name, {
        method: "POST",
        headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
    } catch (e) {
      const err = new Error("No pudimos conectarnos. Revisá tu conexión y probá de nuevo.");
      err.code = "RED";
      throw err;
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      const code = data && data.message ? String(data.message) : "";
      if (res.status === 404 || (data && data.code === "PGRST202")) {
        const err = new Error("«Mis números» se está activando. Mientras tanto, consultá tu número por WhatsApp.");
        err.code = "SIN_SERVICIO";
        throw err;
      }
      const err = new Error(ERRORES[code] || "No pudimos consultar tu número. Probá de nuevo en un momento.");
      err.code = code;
      throw err;
    }
    // Los intentos fallidos vuelven como respuesta normal con "error" (así el servidor los puede contar).
    if (data && data.error) {
      const err = new Error(ERRORES[data.error] || "No pudimos consultar tu número. Probá de nuevo en un momento.");
      err.code = String(data.error);
      throw err;
    }
    return data;
  }

  // --- Vista ---
  function show(view) {
    loading.hidden = view !== "loading";
    login.hidden = view !== "login";
    result.hidden = view !== "result";
  }

  function showError(msg) {
    errorBox.textContent = msg || "";
    errorBox.hidden = !msg;
  }

  const ICON_OK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  const ICON_WAIT = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 2"/></svg>';
  const ICON_NO = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>';
  const ICON_INFO = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" aria-hidden="true"><path d="M12 11v6M12 7.5v.5"/></svg>';
  const ICON_WA = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35M12.05 21.79a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.89 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.41"/></svg>';
  const ICON_PDF = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/></svg>';

  function row(kind, icon, title, desc, i) {
    return '<div class="mn-row" style="--i:' + i + '"><span class="mn-dot mn-' + kind + '">' + icon + "</span>" +
      "<div><strong>" + esc(title) + "</strong><span>" + esc(desc) + "</span></div></div>";
  }

  function fechaCorta(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
  }

  function waMensaje(f, tipo) {
    const numero = (f.numeros || []).map(pad).join(", ");
    const base = "Hola MOTOBOX! Soy " + f.nombre + (f.dni ? " (DNI " + f.dni + ")" : "") + ". Participo del Sorteo N.º " + C.id +
      " con el número " + numero + ".";
    const codigo = f.codigo ? " Código: " + f.codigo + "." : "";
    if (tipo === "pagar") {
      return base + " Quiero pagar el " + manualNombre + (precio ? " ($" + fmt(precio) + ")" : "") +
        ". ¿Me pasan el alias para transferir? Después les envío el comprobante." + codigo;
    }
    if (tipo === "comprar") {
      return base + " Quiero comprar el " + manualNombre + (precio ? " ($" + fmt(precio) + ")" : "") + ". ¿Me pasan el alias?" + codigo;
    }
    if (tipo === "rechazado") return base + " Me figura que el pago del manual no se confirmó. ¿Me ayudan?" + codigo;
    return base + " Confirmo mi WhatsApp para el sorteo." + codigo;
  }

  function render(f) {
    const numeros = Array.isArray(f.numeros) && f.numeros.length ? f.numeros : [];
    const pagado = !!f.pagado;
    const rechazado = f.estado_pago === "rechazado";
    const nombre = String(f.nombre || "").split(" ")[0];
    const chancesExtra = f.chances_extra || 0;
    const montoChances = f.monto_chances || 0;
    const totalChances = 1 + chancesExtra;
    let i = 0;

    const tickets = numeros.map((n, k) =>
      '<article class="mn-ticket' + (pagado ? " is-paid" : "") + '" style="--d:' + (k * 90) + 'ms">' +
        "<small>" + (numeros.length > 1 ? "Número " + (k + 1) + " de " + numeros.length : "Tu número de participación") + "</small>" +
        '<strong class="mn-num">' + pad(n) + "</strong>" +
        (pagado ? '<span class="mn-stamp">Pagado</span>' : "") +
        (chancesExtra > 0 ? '<span class="mn-chances-badge">' + totalChances + ' chances</span>' : '') +
        '<div class="mn-tline"><span>Sorteo N.º ' + esc(C.id) + "</span><span>Fecha: " + esc(fecha) + "</span></div>" +
      "</article>"
    ).join("");

    let rows = row("ok", ICON_OK, "Participación confirmada", f.inscripto ? "Inscripto el " + fechaCorta(f.inscripto) + "." : "Ya estás en el sorteo.", i++);
    if (f.compra_manual) {
      if (pagado) rows += row("ok", ICON_OK, "Manual pagado", "El vendedor confirmó tu pago. Ya podés descargar el manual.", i++);
      else if (rechazado) rows += row("no", ICON_NO, "Pago no confirmado", "No pudimos verificar el comprobante. Escribinos por WhatsApp. Tu número sigue participando.", i++);
      else rows += row("wait", ICON_WAIT, "Pago del manual pendiente", "Cuando el vendedor verifique tu transferencia, acá vas a ver «Pagado».", i++);
    } else {
      rows += row("info", ICON_INFO, "Participación registrada", "Tu número está activo para el sorteo.", i++);
    }
    if (chancesExtra > 0) {
      rows += row("ok", ICON_OK, chancesExtra + " chances extras", "Paquete de " + chancesExtra + " chances · $" + fmt(montoChances) + ". Total: " + totalChances + " chances en el sorteo.", i++);
    }
    rows += f.telefono_verificado
      ? row("ok", ICON_OK, "WhatsApp confirmado", "Por ahí te avisamos la fecha del sorteo y si ganás.", i++)
      : row("wait", ICON_WAIT, "WhatsApp sin confirmar", "Mandanos el mensaje con tu código para que podamos avisarte si ganás.", i++);

    let actions = "";
    if (pagado) {
      actions += '<a class="rf-btn rf-btn-red" href="' + esc(MANUAL_URL) + '" target="_blank" rel="noopener" download>' + ICON_PDF + "<span>Descargar el manual (PDF)</span></a>";
    } else if (f.compra_manual) {
      actions += '<a class="rf-btn rf-btn-wa" href="' + esc(waLink(waMensaje(f, rechazado ? "rechazado" : "pagar"))) + '" target="_blank" rel="noopener">' + ICON_WA +
        "<span>" + (rechazado ? "Resolverlo por WhatsApp" : "Coordinar el pago por WhatsApp") + "</span></a>";
    } else {
      if (!f.telefono_verificado) {
        actions += '<a class="rf-btn rf-btn-wa" href="' + esc(waLink(waMensaje(f, "confirmar"))) + '" target="_blank" rel="noopener">' + ICON_WA + "<span>Confirmar por WhatsApp</span></a>";
      }
      actions += '<a class="rf-btn rf-btn-outline" href="' + esc(waLink(waMensaje(f, "comprar"))) + '" target="_blank" rel="noopener">Quiero el manual' + (precio ? " · $" + fmt(precio) : "") + "</a>";
    }

    result.innerHTML =
      '<p class="mn-hello">Hola, <strong>' + esc(nombre) + "</strong>. Estos son tus números del Sorteo N.º " + esc(C.id) + ".</p>" +
      (chancesExtra > 0 ? '<p class="mn-chances-summary">Tenés <strong>' + totalChances + ' chances</strong> en total (1 base + ' + chancesExtra + ' extras).</p>' : '') +
      '<div class="mn-tickets">' + tickets + "</div>" +
      '<div class="mn-status">' + rows + "</div>" +
      '<div class="mn-actions">' + actions +
        '<div class="mn-sub"><button type="button" class="mn-link" data-mn-refresh>Actualizar</button>' +
        '<button type="button" class="mn-link" data-mn-logout>Salir de este dispositivo</button></div>' +
        '<p class="mn-note">Sumá chances extras para aumentar tus probabilidades. <a href="' + esc(C.basesUrl || "sorteo.html") + '">Bases y condiciones</a></p>' +
      "</div>";
    show("result");
  }

  // Se guarda el token para entrar directo la próxima vez; el popup del sorteo también lo usa.
  function remember(f) {
    const prev = readSaved() || {};
    writeSaved({
      numero: (f.numeros || [])[0] != null ? f.numeros[0] : prev.numero,
      codigo: f.codigo || prev.codigo || null,
      token: f.token || prev.token || null,
      compra: !!f.compra_manual,
      nombre: f.nombre || prev.nombre,
      dni: f.dni || prev.dni || null
    });
  }

  let current = null;
  async function loadByToken(token, quiet) {
    if (!quiet) show("loading");
    try {
      const f = await rpc("sorteo_mi_participacion", { p_token: token });
      current = f;
      remember(f);
      render(f);
    } catch (err) {
      if (quiet && current) return; // sin conexión al volver a la pestaña: queda lo último que se vio
      if (err.code === "NO_ENCONTRADO") writeSaved(null);
      show("login");
      if (err.code !== "NO_ENCONTRADO" || !quiet) showError(err.message);
    }
  }

  async function submit(e) {
    e.preventDefault();
    const dni = String(form.elements.dni.value || "").replace(/\D/g, "");
    const clave = String(form.elements.clave.value || "");
    if (!/^\d{7,8}$/.test(dni)) { showError("Revisá el DNI: tiene que tener 7 u 8 números."); form.elements.dni.focus(); return; }
    if (clave.length < 6) { showError("Escribí la clave que creaste al inscribirte (mínimo 6 caracteres)."); form.elements.clave.focus(); return; }
    showError("");
    submitBtn.disabled = true;
    submitBtn.textContent = "Buscando…";
    try {
      const f = await rpc("sorteo_consultar", { p_dni: dni, p_clave: clave });
      current = f;
      remember(Object.assign({ dni: dni }, f));
      form.reset();
      render(f);
      main.scrollIntoView({ block: "start", behavior: "smooth" });
    } catch (err) {
      showError(err.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Ver mis números";
    }
  }

  form.addEventListener("submit", submit);
  form.addEventListener("input", () => showError(""));

  result.addEventListener("click", (e) => {
    if (e.target.closest("[data-mn-refresh]")) {
      const saved = readSaved();
      if (saved && saved.token) loadByToken(saved.token);
    } else if (e.target.closest("[data-mn-logout]")) {
      writeSaved(null);
      current = null;
      document.dispatchEvent(new CustomEvent("motobox:sorteo-salir"));
      result.innerHTML = "";
      showError("");
      show("login");
    }
  });

  $("[data-mn-forgot]").href = waLink("Hola MOTOBOX! Me inscribí al Sorteo N.º " + C.id + " y no recuerdo mi clave para ver mis números. Mi DNI es: ");

  // Al volver de WhatsApp (o de otra pestaña) se consulta de nuevo: el pago puede haberse confirmado.
  let lastCheck = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || !current) return;
    if (Date.now() - lastCheck < 15000) return;
    lastCheck = Date.now();
    const saved = readSaved();
    if (saved && saved.token) loadByToken(saved.token, true);
  });

  // Inscripción hecha desde el popup en esta misma página.
  document.addEventListener("motobox:sorteo-inscripto", (e) => {
    const ins = e.detail || {};
    if (ins.token) loadByToken(ins.token);
  });

  const saved = readSaved();
  if (saved && saved.token) {
    lastCheck = Date.now();
    loadByToken(saved.token);
  } else {
    show("login");
  }
})();
