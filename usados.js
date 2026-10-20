/**
 * MOTOBOX — Usados exclusivos
 * Lee del CRM (tabla usados_exclusivos, solo las publicadas que no están vendidas) y arma:
 *   * usados.html: listado con orden, tarjetas con fotos y ficha completa en una hoja que sube
 *     desde abajo (como en una app). La ficha tiene su propia dirección (#u-<id>) para compartirla.
 *   * index.html: una franja con los últimos usados (se oculta si no hay ninguno).
 * Las motos se cargan en el CRM → «Usados exclusivos».
 */
(function () {
  "use strict";

  const grid = document.querySelector("[data-us-grid]");
  const homeSection = document.getElementById("usados-home");
  if (!grid && !homeSection) return;

  const SB_URL = typeof SUPABASE_URL !== "undefined" ? SUPABASE_URL : "";
  const SB_KEY = typeof SUPABASE_ANON_KEY !== "undefined" ? SUPABASE_ANON_KEY : "";
  const WA_NUMBER = typeof WHATSAPP_NUMBER !== "undefined" ? WHATSAPP_NUMBER : "5493516312930";
  // Columnas públicas (las notas internas del CRM no están habilitadas para la web).
  const COLS = "id,marca,modelo,anio,km,precio,cilindrada,color,duenos,frase,descripcion,papeles_al_dia," +
    "service_al_dia,acepta_permuta,financiacion,imagen_url,imagenes,estado,destacada,created_at";

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // Solo fotos https o locales (mismo criterio que data.js para el catálogo)
  const safeUrl = (v) => {
    const u = v == null ? "" : String(v).trim();
    return /^https:\/\/[^\s"'<>()]+$/i.test(u) || /^img\/[\w./-]+$/.test(u) ? u : "";
  };
  const num = (v) => Number(v).toLocaleString("es-AR");
  const money = (v) => (v || v === 0) && v !== "" && v !== null ? "$" + num(v) : "";
  const waLink = (text) => "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(text);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const ICON_WA = '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.26-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.07c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.41-.08-.13-.27-.2-.57-.35M12.05 21.79a9.87 9.87 0 0 1-5.03-1.38l-.36-.21-3.74.98 1-3.65-.24-.37a9.86 9.86 0 0 1-1.51-5.26c0-5.45 4.44-9.88 9.89-9.88 2.64 0 5.12 1.03 6.99 2.9a9.83 9.83 0 0 1 2.89 6.99c0 5.45-4.44 9.88-9.89 9.88m8.41-18.3A11.82 11.82 0 0 0 12.05 0C5.5 0 .16 5.34.16 11.89c0 2.1.55 4.14 1.59 5.95L.06 24l6.3-1.65a11.88 11.88 0 0 0 5.68 1.45h.01c6.55 0 11.89-5.34 11.89-11.89 0-3.18-1.24-6.17-3.48-8.41"/></svg>';
  const ICON_CLOSE = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_MOTO = '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5l4-7h4l3 7"/><path d="M13.5 9.5l1.5-3h2.5"/><path d="M9 9.5H6.5"/></svg>';

  // --- Datos ---
  function normalize(r) {
    const imgs = (Array.isArray(r.imagenes) ? r.imagenes : []).map(safeUrl).filter(Boolean);
    const cover = safeUrl(r.imagen_url);
    const fotos = cover ? [cover].concat(imgs.filter((u) => u !== cover)) : imgs;
    return Object.assign({}, r, { fotos: fotos, nombre: (r.marca || "") + " " + (r.modelo || "") });
  }
  async function load(limit) {
    if (!SB_URL || !SB_KEY) return [];
    const q = "select=" + COLS + "&visible_web=is.true&estado=neq.vendido&order=destacada.desc,created_at.desc&limit=" + limit;
    try {
      const res = await fetch(SB_URL + "/rest/v1/usados_exclusivos?" + q, {
        headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY }
      });
      if (!res.ok) return [];   // la tabla todavía no existe o no hay conexión: se muestra el estado vacío
      const data = await res.json();
      return Array.isArray(data) ? data.map(normalize) : [];
    } catch (e) {
      return [];
    }
  }

  const consulta = (u) => "Hola MOTOBOX! Me interesa el usado " + u.nombre + (u.anio ? " " + u.anio : "") +
    ((u.km || u.km === 0) ? " (" + num(u.km) + " km)" : "") + " que vi en la web. ¿Sigue disponible?";

  function tags(u) {
    return [
      u.papeles_al_dia && "Papeles al día",
      u.service_al_dia && "Service al día",
      u.acepta_permuta && "Acepta permuta",
      u.financiacion && "Financiación"
    ].filter(Boolean);
  }

  function specs(u) {
    return [
      u.anio && [u.anio, "Año"],
      (u.km || u.km === 0) && [num(u.km), "km"],
      u.cilindrada && [esc(u.cilindrada), "cc"]
    ].filter(Boolean);
  }

  function badges(u) {
    return (u.estado === "reservado" ? '<span class="us-badge us-badge--res">Reservado</span>' : "") +
      (u.destacada ? '<span class="us-badge us-badge--star">Destacado</span>' : "");
  }

  function cardHtml(u, i) {
    const img = u.fotos[0];
    return '<article class="us-card" style="--i:' + i + '">' +
      '<button type="button" class="us-card-media" data-us-open="' + esc(u.id) + '" aria-label="Ver ' + esc(u.nombre) + '">' +
        (img ? '<img src="' + esc(img) + '" alt="' + esc(u.nombre) + '" loading="lazy" decoding="async">' : '<span class="us-ph">' + ICON_MOTO + "</span>") +
        '<span class="us-badges">' + badges(u) + "</span>" +
        (u.fotos.length > 1 ? '<span class="us-photos">' + u.fotos.length + " fotos</span>" : "") +
      "</button>" +
      '<div class="us-card-body">' +
        '<p class="us-brand">' + esc(u.marca) + "</p>" +
        '<h3 class="us-name"><button type="button" data-us-open="' + esc(u.id) + '">' + esc(u.modelo) + "</button></h3>" +
        '<ul class="us-specs">' + specs(u).map((s) => "<li><b>" + s[0] + "</b><span>" + s[1] + "</span></li>").join("") + "</ul>" +
        (u.frase ? '<p class="us-frase">' + esc(u.frase) + "</p>" : "") +
        (tags(u).length ? '<ul class="us-tags">' + tags(u).map((t) => "<li>" + t + "</li>").join("") + "</ul>" : "") +
        '<div class="us-card-foot">' +
          '<strong class="us-price">' + (money(u.precio) || "Consultar precio") + "</strong>" +
          '<a class="us-wa" target="_blank" rel="noopener" href="' + esc(waLink(consulta(u))) + '">' + ICON_WA + "<span>Consultar</span></a>" +
        "</div>" +
      "</div>" +
    "</article>";
  }

  // --- Portada: franja con los últimos usados ---
  async function initHome() {
    const track = homeSection.querySelector("[data-us-home]");
    const list = await load(8);
    if (!list.length) return;   // sin usados la franja no aparece
    track.innerHTML = list.map((u, i) =>
      '<a class="us-mini" style="--i:' + i + '" href="usados.html#u-' + encodeURIComponent(u.id) + '">' +
        '<span class="us-mini-media">' +
          (u.fotos[0] ? '<img src="' + esc(u.fotos[0]) + '" alt="' + esc(u.nombre) + '" loading="lazy" decoding="async">' : '<span class="us-ph">' + ICON_MOTO + "</span>") +
          '<span class="us-badges">' + badges(u) + "</span>" +
        "</span>" +
        '<span class="us-mini-body">' +
          '<span class="us-brand">' + esc(u.marca) + "</span>" +
          '<span class="us-mini-name">' + esc(u.modelo) + "</span>" +
          '<span class="us-mini-meta">' + [u.anio, (u.km || u.km === 0) ? num(u.km) + " km" : ""].filter(Boolean).join(" · ") + "</span>" +
          '<span class="us-price">' + (money(u.precio) || "Consultar precio") + "</span>" +
        "</span>" +
      "</a>"
    ).join("");
    homeSection.hidden = false;
    if (!reduce && "IntersectionObserver" in window) {
      homeSection.classList.add("us-pre");
      new IntersectionObserver((en, io) => {
        if (!en[0].isIntersecting) return;
        homeSection.classList.remove("us-pre");
        io.disconnect();
      }, { rootMargin: "0px 0px -15% 0px" }).observe(homeSection);
    }
  }

  // --- Página de usados ---
  let all = [];
  let sortBy = "destacados";
  const countEl = document.querySelector("[data-us-count]");
  const emptyEl = document.querySelector("[data-us-empty]");

  function sorted() {
    const list = all.slice();
    const by = (f, dir) => (a, b) => {
      const x = a[f], y = b[f];
      if (x == null && y == null) return 0;
      if (x == null) return 1;
      if (y == null) return -1;
      return (x - y) * dir;
    };
    if (sortBy === "precio") list.sort(by("precio", 1));
    else if (sortBy === "km") list.sort(by("km", 1));
    else if (sortBy === "anio") list.sort(by("anio", -1));
    return list;
  }

  function render() {
    const list = sorted();
    grid.innerHTML = list.map(cardHtml).join("");
    grid.classList.toggle("is-in", true);
    if (countEl) countEl.textContent = list.length ? list.length + (list.length === 1 ? " moto" : " motos") : "";
    if (emptyEl) emptyEl.hidden = list.length > 0;
    grid.hidden = list.length === 0;
  }

  // --- Ficha (hoja que sube desde abajo) ---
  let sheet = null, opened = false, pushed = false, lastFocus = null;
  function buildSheet() {
    sheet = document.createElement("div");
    sheet.className = "us-sheet";
    sheet.hidden = true;
    sheet.innerHTML = '<div class="us-sheet-backdrop" data-us-close></div>' +
      '<div class="us-sheet-panel" role="dialog" aria-modal="true" aria-labelledby="us-sheet-title" tabindex="-1">' +
        '<span class="us-sheet-grip" aria-hidden="true"></span>' +
        '<button type="button" class="us-sheet-close" data-us-close aria-label="Cerrar">' + ICON_CLOSE + "</button>" +
        '<div class="us-sheet-body" data-us-sheet-body></div>' +
      "</div>";
    document.body.appendChild(sheet);
    sheet.addEventListener("click", (e) => { if (e.target.closest("[data-us-close]")) close(); });
    document.addEventListener("keydown", (e) => { if (opened && e.key === "Escape") close(); });
  }

  function sheetHtml(u) {
    const fotos = u.fotos.length ? u.fotos : [""];
    const rows = [
      ["Año", u.anio], ["Kilómetros", (u.km || u.km === 0) ? num(u.km) + " km" : ""], ["Cilindrada", u.cilindrada ? esc(u.cilindrada) + " cc" : ""],
      ["Color", esc(u.color || "")], ["Dueños", u.duenos ? u.duenos + (u.duenos > 1 ? " dueños" : " dueño") : ""]
    ].filter((r) => r[1]);
    return '<div class="us-gallery">' +
        '<div class="us-gallery-track" data-us-track>' + fotos.map((f, i) =>
          '<div class="us-slide">' + (f ? '<img src="' + esc(f) + '" alt="' + esc(u.nombre) + " — foto " + (i + 1) + '"' + (i ? ' loading="lazy"' : "") + ' decoding="async">' : '<span class="us-ph">' + ICON_MOTO + "</span>") + "</div>"
        ).join("") + "</div>" +
        (fotos.length > 1 ? '<div class="us-gallery-dots" data-us-dots>' + fotos.map((_, i) => "<i" + (i ? "" : ' class="is-on"') + "></i>").join("") + "</div>" : "") +
        '<span class="us-badges">' + badges(u) + "</span>" +
      "</div>" +
      '<div class="us-sheet-info">' +
        '<p class="us-brand">' + esc(u.marca) + "</p>" +
        '<h2 class="us-sheet-title" id="us-sheet-title">' + esc(u.modelo) + "</h2>" +
        '<p class="us-sheet-price">' + (money(u.precio) || "Consultar precio") + "</p>" +
        (u.frase ? '<p class="us-frase">' + esc(u.frase) + "</p>" : "") +
        (rows.length ? '<dl class="us-data">' + rows.map((r) => "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>").join("") + "</dl>" : "") +
        (tags(u).length ? '<ul class="us-tags">' + tags(u).map((t) => "<li>" + t + "</li>").join("") + "</ul>" : "") +
        (u.descripcion ? '<p class="us-desc">' + esc(u.descripcion) + "</p>" : "") +
        '<a class="us-sheet-cta" target="_blank" rel="noopener" href="' + esc(waLink(consulta(u))) + '">' + ICON_WA + "<span>Consultar por WhatsApp</span></a>" +
        '<p class="us-sheet-note">Te responde un asesor de MOTOBOX. Podés coordinar para verla en el showroom de Santa Rosa 4227.</p>' +
      "</div>";
  }

  function open(id, fromHash) {
    const u = all.find((x) => String(x.id) === String(id));
    if (!u) return;
    if (!sheet) buildSheet();
    lastFocus = document.activeElement;
    sheet.querySelector("[data-us-sheet-body]").innerHTML = sheetHtml(u);
    const track = sheet.querySelector("[data-us-track]");
    const dots = sheet.querySelector("[data-us-dots]");
    if (dots) {
      let raf = 0;
      track.addEventListener("scroll", () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const i = Math.round(track.scrollLeft / (track.clientWidth || 1));
          Array.from(dots.children).forEach((d, n) => d.classList.toggle("is-on", n === i));
        });
      }, { passive: true });
    }
    sheet.hidden = false;
    sheet.querySelector(".us-sheet-panel").scrollTop = 0;
    document.body.style.overflow = "hidden";   // también pausa las animaciones de fondo (motion.js)
    requestAnimationFrame(() => sheet.classList.add("is-open"));
    opened = true;
    // Botón "atrás" del celular = cerrar la ficha, como en una app
    const hash = "#u-" + encodeURIComponent(u.id);
    if (!fromHash) { history.pushState({ usado: u.id }, "", hash); pushed = true; }
    try { sheet.querySelector(".us-sheet-panel").focus({ preventScroll: true }); } catch (e) { /* sin foco */ }
  }

  function close(fromPop) {
    if (!opened) return;
    opened = false;
    sheet.classList.remove("is-open");
    document.body.style.overflow = "";
    const done = () => { if (!opened) sheet.hidden = true; };
    if (reduce) done(); else setTimeout(done, 320);
    if (!fromPop) {
      if (pushed) history.back();
      else history.replaceState(null, "", location.pathname + location.search);
    }
    pushed = false;
    if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus({ preventScroll: true }); } catch (e) { /* sin foco */ } }
  }

  function idFromHash() {
    const m = /^#u-(.+)$/.exec(location.hash);
    return m ? decodeURIComponent(m[1]) : null;
  }

  async function initPage() {
    document.querySelectorAll("[data-us-sort]").forEach((b) => {
      b.addEventListener("click", () => {
        sortBy = b.dataset.usSort;
        document.querySelectorAll("[data-us-sort]").forEach((x) => {
          const on = x === b;
          x.classList.toggle("is-on", on);
          x.setAttribute("aria-pressed", on ? "true" : "false");
        });
        render();
      });
    });
    grid.addEventListener("click", (e) => {
      const t = e.target.closest("[data-us-open]");
      if (t) open(t.dataset.usOpen);
    });
    window.addEventListener("popstate", () => {
      const id = idFromHash();
      if (id) open(id, true); else close(true);
    });
    all = await load(60);
    render();
    const id = idFromHash();
    if (id) open(id, true);
  }

  const start = () => { if (grid) initPage(); if (homeSection) initHome(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
