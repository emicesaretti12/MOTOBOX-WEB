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
  const ICON_PREV = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
  const ICON_NEXT = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
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
      if (!res.ok) return [];   // sin conexión o error del servidor: se muestra el estado vacío
      const data = await res.json();
      return Array.isArray(data) ? data.map(normalize) : [];
    } catch (e) {
      return [];
    }
  }

  const consulta = (u) => "Hola MOTOBOX! Me interesa el usado " + u.nombre + (u.anio ? " " + u.anio : "") +
    ((u.km || u.km === 0) ? " (" + num(u.km) + " km)" : "") + " que vi en la web. ¿Sigue disponible?";

  const ICON_CHECK = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

  function checks(u) {
    const list = [
      u.papeles_al_dia && "Papeles al día",
      u.service_al_dia && "Service al día",
      u.acepta_permuta && "Toma tu moto en parte de pago",
      u.financiacion && "Se puede financiar"
    ].filter(Boolean);
    return list.length ? '<ul class="us-checks">' + list.map((t) => "<li>" + ICON_CHECK + t + "</li>").join("") + "</ul>" : "";
  }

  // Cuentakilómetros de tambor: 6 dígitos, el último en rojo. Los ceros de la izquierda van apagados.
  function odometer(km) {
    if (!(km || km === 0)) return "";
    const digits = String(Math.min(999999, Math.max(0, Math.round(km)))).padStart(6, "0").split("");
    const lead = digits.findIndex((d) => d !== "0");
    const firstReal = lead === -1 ? 5 : lead;
    const strip = "0123456789".split("").map((n) => "<b>" + n + "</b>").join("");
    return '<span class="odo is-waiting" role="img" aria-label="' + num(km) + ' kilómetros">' +
      '<span class="odo-drum" aria-hidden="true">' + digits.map((d, i) =>
        '<span class="odo-cell' + (i < firstReal ? " is-lead" : "") + '" style="--v:' + d + ";--d:" + i + '"><span class="odo-strip">' + strip + "</span></span>"
      ).join("") + "</span>" +
      '<span class="odo-unit" aria-hidden="true">km</span>' +
    "</span>";
  }

  // Los tambores giran hasta su valor una sola vez, cuando aparecen en pantalla.
  const odoIo = "IntersectionObserver" in window && !reduce
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          odoIo.unobserve(e.target);
          e.target.classList.add("is-rolling");
          requestAnimationFrame(() => requestAnimationFrame(() => e.target.classList.remove("is-waiting")));
        });
      }, { rootMargin: "0px 0px -4% 0px" })
    : null;
  function rollOdometers(scope) {
    scope.querySelectorAll(".odo.is-waiting").forEach((o) => {
      if (odoIo) odoIo.observe(o); else o.classList.remove("is-waiting");
    });
  }

  function facts(u, withKm) {
    const rows = [
      ["Año", u.anio],
      withKm && (u.km || u.km === 0) ? ["Kilómetros", num(u.km)] : null,
      ["Cilindrada", u.cilindrada ? esc(u.cilindrada) + " cc" : ""],
      ["Dueños", u.duenos ? (u.duenos === 1 ? "Único dueño" : u.duenos + " dueños") : ""],
      ["Color", esc(u.color || "")]
    ].filter((r) => r && r[1]);
    return rows.map((r) => "<div><dt>" + r[0] + "</dt><dd>" + r[1] + "</dd></div>").join("");
  }

  function priceHtml(u) {
    const p = money(u.precio);
    return '<div><strong class="us-price' + (p ? "" : " us-price--ask") + '">' + (p || "Precio a consultar") + "</strong>" +
      (u.estado === "reservado" ? '<span class="us-reserved">Reservada. Preguntá si se libera.</span>' : "") + "</div>";
  }

  function cardHtml(u) {
    const img = u.fotos[0];
    const f = facts(u, false);
    return '<article class="us-row">' +
      '<div class="us-row-gallery"><button type="button" class="us-row-media" data-us-open="' + esc(u.id) + '" aria-label="Ver fotos y ficha de ' + esc(u.nombre) + '">' +
        (img ? '<img class="us-blur" src="' + esc(img) + '" alt="" aria-hidden="true" loading="lazy" decoding="async"><img class="us-main" src="' + esc(img) + '" alt="' + esc(u.nombre) + '" loading="lazy" decoding="async">' : '<span class="us-ph">' + ICON_MOTO + "</span>") +
        (u.fotos.length > 1 ? '<span class="us-count-photos">' + u.fotos.length + " fotos</span>" : "") +
      "</button>" +
      (u.fotos.length > 1 ? '<div class="us-row-thumbs">' + u.fotos.slice(0, 5).map((src, i) =>
        '<button type="button" class="us-thumb' + (i ? "" : " is-on") + '" data-us-swap="' + esc(src) + '" aria-label="Mostrar foto ' + (i + 1) + '"><img src="' + esc(src) + '" alt="" loading="lazy" decoding="async"></button>'
      ).join("") + (u.fotos.length > 5 ? '<button type="button" class="us-thumb us-thumb-more" data-us-open="' + esc(u.id) + '">+' + (u.fotos.length - 5) + "</button>" : "") + "</div>" : "") +
      "</div>" +
      '<div class="us-row-info">' +
        '<p class="us-row-brand">' + esc(u.marca) + (u.destacada ? '<span class="us-flag">Destacada</span>' : "") + "</p>" +
        '<h2 class="us-row-name"><button type="button" data-us-open="' + esc(u.id) + '">' + esc(u.modelo) + "</button></h2>" +
        odometer(u.km) +
        (f ? '<dl class="us-facts">' + f + "</dl>" : "") +
        (u.frase ? '<p class="us-frase">' + esc(u.frase) + "</p>" : "") +
        checks(u) +
        '<div class="us-row-buy">' + priceHtml(u) +
          '<div class="us-row-actions">' +
            '<a class="us-btn us-btn--wa" target="_blank" rel="noopener" href="' + esc(waLink(consulta(u))) + '">' + ICON_WA + "<span>Consultar</span></a>" +
            '<button type="button" class="us-btn us-btn--line" data-us-open="' + esc(u.id) + '">Ver ficha</button>' +
          "</div>" +
        "</div>" +
      "</div>" +
    "</article>";
  }

  // --- Portada: franja con los últimos usados ---
  async function initHome() {
    const track = homeSection.querySelector("[data-us-home]");
    const list = await load(8);
    if (!list.length) return;   // sin usados la franja no aparece
    track.innerHTML = list.map((u) =>
      '<a class="us-mini" href="usados.html#u-' + encodeURIComponent(u.id) + '">' +
        '<span class="us-mini-media">' +
          (u.fotos[0] ? '<img src="' + esc(u.fotos[0]) + '" alt="' + esc(u.nombre) + '" loading="lazy" decoding="async">' : '<span class="us-ph">' + ICON_MOTO + "</span>") +
        "</span>" +
        '<span class="us-mini-brand">' + esc(u.marca) + (u.anio ? " " + u.anio : "") + "</span>" +
        '<span class="us-mini-name">' + esc(u.modelo) + "</span>" +
        odometer(u.km) +
        '<strong class="us-price' + (money(u.precio) ? "" : " us-price--ask") + '">' + (money(u.precio) || "Precio a consultar") + "</strong>" +
      "</a>"
    ).join("");
    homeSection.hidden = false;
    rollOdometers(track);
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
    rollOdometers(grid);
    if (countEl) countEl.textContent = list.length ? list.length + (list.length === 1 ? " moto" : " motos") : "";
    if (emptyEl) emptyEl.hidden = list.length > 0;
    grid.hidden = list.length === 0;
  }

  // --- Ficha (hoja que sube desde abajo) ---
  let sheet = null, opened = false, pushed = false, lastFocus = null;
  let goTo = () => {};
  const currentIndex = () => {
    const tr = sheet && sheet.querySelector("[data-us-track]");
    return tr ? Math.round(tr.scrollLeft / (tr.clientWidth || 1)) : 0;
  };
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
    sheet.addEventListener("click", (e) => {
      if (e.target.closest("[data-us-close]")) return close();
      const t = e.target.closest("[data-us-thumb]");
      if (t) return goTo(Number(t.dataset.usThumb));
      if (e.target.closest("[data-us-prev]")) return goTo(currentIndex() - 1);
      if (e.target.closest("[data-us-next]")) return goTo(currentIndex() + 1);
    });
    document.addEventListener("keydown", (e) => {
      if (!opened) return;
      if (e.key === "Escape") close();
      else if (e.key === "ArrowLeft") { e.preventDefault(); goTo(currentIndex() - 1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); goTo(currentIndex() + 1); }
    });
  }

  function sheetHtml(u) {
    const fotos = u.fotos.length ? u.fotos : [""];
    const f = facts(u, false);
    return '<div class="us-sheet-media"><div class="us-gallery">' +
        '<div class="us-gallery-track" data-us-track>' + fotos.map((src, i) =>
          '<div class="us-slide">' + (src ? '<img class="us-blur" src="' + esc(src) + '" alt="" aria-hidden="true" decoding="async"><img src="' + esc(src) + '" alt="' + esc(u.nombre) + ", foto " + (i + 1) + " de " + fotos.length + '" decoding="async">' : '<span class="us-ph">' + ICON_MOTO + "</span>") + "</div>"
        ).join("") + "</div>" +
        (fotos.length > 1
          ? '<span class="us-gallery-count" data-us-dots>1 / ' + fotos.length + "</span>" +
            '<button type="button" class="us-gal-nav us-gal-prev" data-us-prev aria-label="Foto anterior">' + ICON_PREV + "</button>" +
            '<button type="button" class="us-gal-nav us-gal-next" data-us-next aria-label="Foto siguiente">' + ICON_NEXT + "</button>"
          : "") +
      "</div>" +
      (fotos.length > 1 ? '<div class="us-thumbs" role="group" aria-label="Fotos">' + fotos.map((src, i) =>
        '<button type="button" class="us-thumb' + (i ? "" : " is-on") + '" data-us-thumb="' + i + '" aria-label="Ver foto ' + (i + 1) + '"' + (i ? "" : ' aria-current="true"') + '><img src="' + esc(src) + '" alt="" loading="lazy" decoding="async"></button>'
      ).join("") + "</div>" : "") +
      "</div>" +
      '<div class="us-sheet-info">' +
        '<p class="us-row-brand">' + esc(u.marca) + (u.destacada ? '<span class="us-flag">Destacada</span>' : "") + "</p>" +
        '<h2 class="us-sheet-title" id="us-sheet-title">' + esc(u.modelo) + "</h2>" +
        odometer(u.km) +
        (f ? '<dl class="us-sheet-facts">' + f + "</dl>" : "") +
        (u.frase ? '<p class="us-frase">' + esc(u.frase) + "</p>" : "") +
        checks(u) +
        (u.descripcion ? '<p class="us-desc">' + esc(u.descripcion) + "</p>" : "") +
        '<div class="us-sheet-buy">' + priceHtml(u) +
          '<a class="us-btn us-btn--wa" target="_blank" rel="noopener" href="' + esc(waLink(consulta(u))) + '">' + ICON_WA + "<span>Consultar por WhatsApp</span></a>" +
          '<p class="us-sheet-note">Te contesta un vendedor de MOTOBOX. Si querés verla, la tenemos en el showroom de Santa Rosa 4227.</p>' +
        "</div>" +
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
    const thumbs = Array.from(sheet.querySelectorAll("[data-us-thumb]"));
    const total = track.children.length;
    let cur = 0;
    const sync = (i) => {
      cur = i;
      if (dots) dots.textContent = (i + 1) + " / " + total;
      thumbs.forEach((t, n) => {
        t.classList.toggle("is-on", n === i);
        if (n === i) {
          t.setAttribute("aria-current", "true");
          // Solo se corre la tira de miniaturas (scrollIntoView movía también la ventana de la ficha)
          const box = t.parentElement;
          const left = t.offsetLeft - box.offsetLeft, right = left + t.offsetWidth;
          if (left < box.scrollLeft) box.scrollLeft = left - 8;
          else if (right > box.scrollLeft + box.clientWidth) box.scrollLeft = right - box.clientWidth + 8;
        }
        else t.removeAttribute("aria-current");
      });
      const prev = sheet.querySelector("[data-us-prev]"), next = sheet.querySelector("[data-us-next]");
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === total - 1;
    };
    goTo = (i) => {
      i = Math.max(0, Math.min(total - 1, i));
      track.scrollTo({ left: i * track.clientWidth, behavior: reduce ? "auto" : "smooth" });
      sync(i);
    };
    if (total > 1) {
      let raf = 0;
      track.addEventListener("scroll", () => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = 0;
          const i = Math.round(track.scrollLeft / (track.clientWidth || 1));
          if (i !== cur) sync(i);
        });
      }, { passive: true });
      sync(0);
    }
    sheet.hidden = false;
    sheet.querySelector(".us-sheet-panel").scrollTop = 0;
    const info = sheet.querySelector(".us-sheet-info");
    if (info) info.scrollTop = 0;
    rollOdometers(sheet);
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
      const sw = e.target.closest("[data-us-swap]");
      if (sw) {
        const gal = sw.closest(".us-row-gallery");
        gal.querySelectorAll(".us-row-media img").forEach((img) => { img.src = sw.dataset.usSwap; });
        gal.querySelectorAll(".us-thumb").forEach((t) => t.classList.toggle("is-on", t === sw));
        return;
      }
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
