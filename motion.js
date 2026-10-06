/**
 * MOTOBOX — Capa de animaciones (motion.js)
 * Corre en todas las páginas: intro de marca (portada), hero con profundidad, entrada
 * orquestada de cada página, cinta de marcas, escenario 3D del sorteo, revelados ligados
 * al scroll, tarjetas en 3D y botones magnéticos.
 *
 * Criterios (Emil Kowalski):
 * - Solo transform / opacity / clip-path. Curvas propias, nunca ease-in.
 * - Lo que sigue al puntero usa un resorte: tiene inercia y se puede interrumpir.
 * - Hover solo con mouse real; en touch no hay falsos positivos.
 * - Con "reducir movimiento" no hay desplazamientos: quedan solo fundidos suaves.
 */
(function () {
  "use strict";

  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const page = document.body.dataset.page || "";
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const EASE_OUT = "cubic-bezier(0.23, 1, 0.32, 1)";
  const EASE_IN_OUT = "cubic-bezier(0.77, 0, 0.175, 1)";

  const BRANDS = ["Honda", "Yamaha", "Suzuki", "Kawasaki", "Bajaj", "KTM", "Royal Enfield", "Benelli", "Voge", "TVS",
    "Hero", "Motomel", "Keller", "Zanella", "Corven", "Gilera", "Guerrero", "Mondial", "Beta", "Brava"];

  const ICON_MOTO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5l4-7h4l3 7"/><path d="M13.5 9.5l1.5-3h2.5"/><path d="M9 9.5H6.5"/></svg>';

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const $ = (sel) => document.querySelector(sel);

  if (reduce) root.classList.add("mx-reduce");

  /**
   * Resorte (masa 1): mueve varios valores hacia su objetivo con inercia.
   * apply(valores) se llama en cada cuadro; se detiene solo cuando se asienta.
   */
  function spring(initial, apply, stiffness, damping) {
    const k = stiffness || 170, c = damping || 22;
    const x = Object.assign({}, initial), v = {}, t = Object.assign({}, initial);
    Object.keys(x).forEach((key) => { v[key] = 0; });
    let raf = 0, last = 0;
    const step = (now) => {
      const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
      last = now;
      let moving = false;
      for (const key in t) {
        const a = -k * (x[key] - t[key]) - c * v[key];
        v[key] += a * dt;
        x[key] += v[key] * dt;
        if (Math.abs(v[key]) > 0.0005 || Math.abs(x[key] - t[key]) > 0.0005) moving = true;
        else { x[key] = t[key]; v[key] = 0; }
      }
      apply(x);
      raf = moving ? requestAnimationFrame(step) : 0;
    };
    return {
      set(target) {
        Object.assign(t, target);
        if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); }
      },
      values: x
    };
  }

  /**
   * Giroscopio (solo celulares): inclinar el teléfono mueve las escenas 3D.
   * Android lo da directo; iOS pide permiso, y se lo pedimos recién cuando la persona
   * toca una zona 3D (portada, showroom, sorteo o velocímetro).
   * La posición de reposo se recalibra despacio: no importa cómo se sostenga el teléfono.
   */
  const gyro = { x: 0, y: 0, on: false, subs: [] };
  const onGyro = (fn) => { gyro.subs.push(fn); };
  function initGyro() {
    if (reduce || finePointer || typeof window.DeviceOrientationEvent === "undefined") return;
    let baseB = null, baseG = null, pending = false;
    const handle = (e) => {
      if (e.beta == null || e.gamma == null) return;
      let b = e.beta, g = e.gamma;
      const ang = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
      if (ang === 90) { const t = b; b = -g; g = t; }
      else if (ang === -90 || ang === 270) { const t = b; b = g; g = -t; }
      if (baseB === null) { baseB = b; baseG = g; }
      baseB += (b - baseB) * 0.006;
      baseG += (g - baseG) * 0.006;
      gyro.x = clamp((g - baseG) / 16, -1, 1);
      gyro.y = clamp((b - baseB) / 16, -1, 1);
      if (!pending) {
        pending = true;
        requestAnimationFrame(() => { pending = false; gyro.subs.forEach((f) => f(gyro.x, gyro.y)); });
      }
    };
    const start = () => {
      if (gyro.on) return;
      gyro.on = true;
      root.classList.add("mx-gyro");
      window.addEventListener("deviceorientation", handle);
    };
    if (typeof window.DeviceOrientationEvent.requestPermission === "function") {
      const ask = (e) => {
        if (!e.target.closest || !e.target.closest(".simple-hero, .mx-sr-stage, .mx-stage, .mx-gauge-wrap")) return;
        if (e.target.closest("a, button")) return;
        document.removeEventListener("click", ask, true);
        window.DeviceOrientationEvent.requestPermission().then((r) => { if (r === "granted") start(); }).catch(() => {});
      };
      document.addEventListener("click", ask, true);
    } else {
      start();
    }
  }

  // Vibración muy corta (Android) para confirmar un cambio hecho con el dedo.
  let lastTouchAt = 0;
  document.addEventListener("pointerdown", (e) => { if (e.pointerType === "touch") lastTouchAt = performance.now(); }, { passive: true });
  const tick = () => {
    if (navigator.vibrate && performance.now() - lastTouchAt < 2500) { try { navigator.vibrate(8); } catch (err) { /* sin vibración */ } }
  };

  /**
   * Con el popup del sorteo o la ficha de una moto abiertos, todo lo que se mueve
   * detrás se pausa (además, el fondo del popup está desenfocado: si lo de atrás
   * siguiera animando, el desenfoque se recalcularía en cada cuadro).
   */
  const lock = { on: false, subs: [] };
  const onLock = (fn) => { lock.subs.push(fn); };
  function initLockWatch() {
    const sync = () => {
      const on = root.classList.contains("rf-lock") || document.body.style.overflow === "hidden";
      if (on === lock.on) return;
      lock.on = on;
      root.classList.toggle("mx-paused", on);
      lock.subs.forEach((f) => f(on));
    };
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["class"] });
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["style"] });
  }

  // Las animaciones infinitas de CSS de un bloque se pausan cuando no está en pantalla.
  function pauseOffscreen(el) {
    if (!el || !("IntersectionObserver" in window)) return;
    new IntersectionObserver((en) => { el.classList.toggle("mx-off", !en[0].isIntersecting); }, { rootMargin: "10% 0px" }).observe(el);
  }

  // ── 1. Intro de marca (solo portada, una vez por sesión) ──────────────────
  let heroSpring = null;
  let rideGoal = null;

  function runIntro() {
    if (!root.classList.contains("mx-intro-on")) return;
    if (reduce) {
      root.classList.remove("mx-intro-on");
      document.dispatchEvent(new CustomEvent("motobox:intro-done"));
      return;
    }
    const chars = "MOTOBOX".split("").map((ch, i) =>
      '<span class="mx-intro-char' + (i < 4 ? " mx-intro-char--red" : "") + '" style="--i:' + i + '">' + ch + "</span>"
    ).join("");
    const el = document.createElement("div");
    el.className = "mx-intro";
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<div class="mx-intro-inner">' +
        '<div class="mx-intro-word">' + chars + "</div>" +
        '<div class="mx-intro-line"></div>' +
        '<div class="mx-intro-sub">Motos 0km en Córdoba</div>' +
      "</div>";
    document.body.appendChild(el);
    root.classList.add("mx-intro-built");

    let left = false;
    const leave = () => {
      if (left) return;
      left = true;
      clearTimeout(timer);
      el.classList.add("is-leaving");
      root.classList.remove("mx-intro-on");
      // La foto del hero baja de 1.3x a su escala normal con un resorte blando.
      if (heroSpring) heroSpring.set({ s: 1.06 });
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent("motobox:intro-done"));
        const hero = $(".simple-hero");
        if (hero) hero.classList.add("mx-hero-live");
      }, 450);
      setTimeout(() => el.remove(), 1200);
    };
    const timer = setTimeout(leave, 1750);
    el.addEventListener("click", leave);
    window.addEventListener("keydown", leave, { once: true });
  }

  // ── 2. Hero de la portada con profundidad ────────────────────────────────
  function initHero() {
    const hero = $('[data-page="home"] .simple-hero');
    if (!hero || reduce) return;

    // Capa propia para la foto: respira (Ken Burns), sigue al mouse y baja con el scroll.
    const bg = document.createElement("div");
    bg.className = "mx-hero-bg";
    bg.setAttribute("aria-hidden", "true");
    hero.prepend(bg);
    hero.classList.add("has-mx-bg");

    let scrollP = 0;
    const paint = (s) => {
      bg.style.transform = "translate3d(" + (s.px * -18).toFixed(2) + "px," + (s.py * -14 + scrollP * 70).toFixed(2) + "px,0) scale(" + s.s.toFixed(4) + ")";
    };
    const introOn = root.classList.contains("mx-intro-on");
    heroSpring = spring({ px: 0, py: 0, s: introOn ? 1.3 : 1.06 }, paint, 60, 16);
    paint(heroSpring.values);
    if (!introOn) hero.classList.add("mx-hero-live");

    let heroH = hero.offsetHeight || 1, heroTick = false;
    window.addEventListener("resize", () => { heroH = hero.offsetHeight || 1; });
    window.addEventListener("scroll", () => {
      if (heroTick) return;
      heroTick = true;
      requestAnimationFrame(() => {
        heroTick = false;
        const p = clamp(window.scrollY / heroH, 0, 1);
        if (p === scrollP || (p === 1 && scrollP === 1)) return;
        scrollP = p;
        paint(heroSpring.values);
      });
    }, { passive: true });
    pauseOffscreen(hero);

    const cue = document.createElement("span");
    cue.className = "mx-scroll-cue";
    cue.setAttribute("aria-hidden", "true");
    hero.appendChild(cue);

    // Título con volumen: capas de sombra en rojo oscuro arman un bloque extruido.
    // En compu la extrusión sigue al mouse; en celular queda fija (redibujar sombras en
    // cada cuadro traba los teléfonos) y el título solo gira, que es casi gratis.
    const title = hero.querySelector(".simple-hero-title");
    const LAYERS = 7;
    const extrude = (x, y) => {
      const dx = -x * 0.8, dy = 0.55 - y * 0.6;
      const sh = [];
      for (let i = 1; i <= LAYERS; i++) {
        const k = i / LAYERS;
        sh.push((dx * i).toFixed(1) + "px " + (dy * i).toFixed(1) + "px 0 rgb(" + Math.round(176 - 128 * k) + "," + Math.round(30 - 20 * k) + "," + Math.round(24 - 16 * k) + ")");
      }
      title.style.textShadow = sh.join(",");
    };
    let lastShadow = "";
    const titleSpring = title ? spring({ x: 0, y: 0 }, (t) => {
      title.style.transform = "perspective(900px) rotateX(" + (t.y * -10).toFixed(2) + "deg) rotateY(" + (t.x * 14).toFixed(2) + "deg)";
      if (finePointer) {
        // La sombra solo se rehace cuando el cambio se nota (pasos de 0,05).
        const key = (Math.round(t.x * 20) / 20) + "," + (Math.round(t.y * 20) / 20);
        if (key !== lastShadow) { lastShadow = key; extrude(Math.round(t.x * 20) / 20, Math.round(t.y * 20) / 20); }
      }
    }, 70, 12) : null;
    if (title) extrude(0, 0);

    // Una sola "inclinación" mueve todo el hero: foto, título y cámara de la ruta.
    const lean = (x, y) => {
      heroSpring.set({ px: x * 0.5, py: y * 0.5 });
      if (titleSpring) titleSpring.set({ x: x, y: y });
      if (rideGoal) { rideGoal.x = x * 1.2; rideGoal.pitch = y * -12; rideGoal.roll = x * -0.025; }
    };

    if (!finePointer) {
      // Celular: giroscopio si hay; si no, un balanceo lento para que la escena respire.
      let heroVisible = true;
      new IntersectionObserver((en) => { heroVisible = en[0].isIntersecting; }).observe(hero);
      let gx = 0, gy = 0;
      onGyro((x, y) => {
        if (!heroVisible || (Math.abs(x - gx) < 0.02 && Math.abs(y - gy) < 0.02)) return;
        gx = x; gy = y;
        lean(x, y);
      });
      setInterval(() => {
        if (gyro.on || !heroVisible || document.hidden || lock.on) return;
        const t = performance.now() / 1000;
        lean(Math.sin(t * 0.55) * 0.5, Math.sin(t * 0.8) * 0.3);
      }, 140);
      return;
    }

    const glow = document.createElement("div");
    glow.className = "mx-hero-glow";
    glow.setAttribute("aria-hidden", "true");
    hero.insertBefore(glow, hero.querySelector(".simple-hero-content"));
    const glowSpring = spring({ x: 0.5, y: 0.4 }, (g) => {
      glow.style.transform = "translate3d(" + ((g.x - 0.5) * 100).toFixed(2) + "%," + ((g.y - 0.4) * 100).toFixed(2) + "%,0)";
    }, 120, 18);

    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      lean((x - 0.5) * 2, (y - 0.5) * 2);
      glowSpring.set({ x: x, y: y });
    });
    hero.addEventListener("pointerleave", () => lean(0, 0));
  }

  // ── 3. Entrada orquestada de cada página interna ─────────────────────────
  // Un solo momento al cargar: el título entra palabra por palabra y lo demás lo sigue.
  function initPageEntrance() {
    const configs = {
      catalogo: { title: ".catalog-page-title", seq: [".catalog-breadcrumbs", ".catalog-page-subtitle", ".catalog-toolbar"] },
      nosotros: { title: ".about-title", seq: [".catalog-breadcrumbs", ".hero-eyebrow", ".about-lead"], media: ".about-hero-media" },
      sorteo: { title: ".bases h1", seq: [".bases-kicker", ".bases-lead", ".bases-highlight", ".bases-cta"] }
    };
    const cfg = configs[page];
    if (!cfg) return;

    const title = $(cfg.title);
    let words = 0;
    if (title && !reduce) {
      Array.from(title.childNodes).forEach((node) => {
        if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) return;
        const frag = document.createDocumentFragment();
        node.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); return; }
          const span = document.createElement("span");
          span.className = "mx-word";
          span.style.setProperty("--mx-d", (120 + words * 55) + "ms");
          span.textContent = part;
          frag.appendChild(span);
          words++;
        });
        node.replaceWith(frag);
      });
    } else if (title) {
      title.classList.add("mx-enter");
    }

    const base = 120 + Math.min(words, 8) * 55;
    cfg.seq.forEach((sel, i) => {
      const el = $(sel);
      if (!el) return;
      el.classList.add("mx-enter");
      el.style.setProperty("--mx-d", (sel === ".catalog-breadcrumbs" || sel === ".bases-kicker" || sel === ".hero-eyebrow" ? 40 : base + i * 70) + "ms");
    });

    // Foto de Nosotros: se descubre de abajo hacia arriba con un recorte (WAAPI).
    const media = cfg.media && $(cfg.media);
    if (media && !reduce && media.animate) {
      media.animate(
        [{ clipPath: "inset(100% 0 0 0 round 24px)" }, { clipPath: "inset(0% 0 0 0 round 24px)" }],
        { duration: 1100, delay: 200, easing: EASE_IN_OUT, fill: "backwards" }
      );
      const img = media.querySelector("img");
      if (img) img.animate([{ transform: "scale(1.25)" }, { transform: "scale(1)" }], { duration: 1600, delay: 200, easing: EASE_OUT, fill: "backwards" });
    }
  }

  // ── 4. Cinta de marcas (velocidad e inclinación según el scroll) ─────────
  function buildMarquee(anchor, where) {
    if (!anchor) return;
    const half = Math.ceil(BRANDS.length / 2);
    const rowHtml = (list, outline) => {
      const items = list.map((b) => '<span class="mx-marquee-item">' + esc(b) + "<i></i></span>").join("");
      return '<div class="mx-marquee-row' + (outline ? " mx-marquee-row--outline" : "") + '">' +
        '<div class="mx-marquee-track">' + items + "</div>" +
        '<div class="mx-marquee-track" aria-hidden="true">' + items + "</div>" +
      "</div>";
    };
    const section = document.createElement("section");
    section.className = "mx-marquee";
    section.setAttribute("aria-label", "Marcas que trabajamos: " + BRANDS.join(", "));
    section.innerHTML = rowHtml(BRANDS.slice(0, half), false) + rowHtml(BRANDS.slice(half), true);
    if (where === "before") anchor.before(section); else anchor.after(section);
    if (reduce) return;

    const rows = Array.from(section.querySelectorAll(".mx-marquee-row")).map((row, i) => ({
      el: row, x: 0, dir: i % 2 ? 1 : -1, width: row.firstElementChild.offsetWidth
    }));
    const measure = () => rows.forEach((r) => { r.width = r.el.firstElementChild.offsetWidth; });
    window.addEventListener("resize", measure);
    rows.forEach((r) => { if (r.dir > 0) r.x = -r.width / 2; });

    // Movimiento constante = lineal; el scroll suma velocidad y una leve inclinación.
    let visible = false, lastY = window.scrollY, boost = 0, last = performance.now(), raf = 0;
    const tick = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      const y = window.scrollY;
      boost += (clamp((y - lastY) * 0.9, -40, 40) - boost) * 0.12;
      lastY = y;
      rows.forEach((r) => {
        if (!r.width) return;
        r.x += r.dir * (0.045 * dt + Math.abs(boost) * 0.35);
        if (r.x <= -r.width) r.x += r.width;
        if (r.x > 0) r.x -= r.width;
        const skew = clamp(boost * 0.25, -8, 8) * -r.dir;
        r.el.style.transform = "translate3d(" + r.x.toFixed(2) + "px,0,0) skewX(" + skew.toFixed(2) + "deg)";
      });
      raf = (visible && !lock.on && !document.hidden) ? requestAnimationFrame(tick) : 0;
    };
    const run = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      if (visible && !lock.on && !document.hidden) { last = performance.now(); lastY = window.scrollY; raf = requestAnimationFrame(tick); }
    };
    new IntersectionObserver((entries) => { visible = entries[0].isIntersecting; run(); }).observe(section);
    onLock(run);
    document.addEventListener("visibilitychange", run);
  }

  // ── 5. Escenario 3D del sorteo ───────────────────────────────────────────
  function sorteoMarkup(C, compact) {
    const prizes = (C.premios || []).slice(0, 2);
    const fecha = C.fechaSorteo ? esc(C.fechaSorteo) : "a confirmar";
    const prizeHtml = prizes.map((p, i) =>
      '<div class="mx-prize mx-prize--' + (i + 1) + '"><div class="mx-prize-body">' +
        (p.imagen ? '<img src="' + esc(p.imagen) + '" alt="' + esc(p.nombre) + ' 0km" loading="lazy">'
                  : '<div class="mx-prize-ph">' + ICON_MOTO + "</div>") +
        '<div class="mx-prize-name"><small>' + (i === 0 ? "Primer premio" : "Segundo premio") + "</small>" + esc(p.nombre) + "</div>" +
      "</div></div>"
    ).join("");
    let sparks = "";
    // Menos destellos en celular: cada uno es una animación más en cada cuadro.
    const sparkCount = window.innerWidth < 900 ? 6 : 12;
    for (let i = 0; i < sparkCount; i++) {
      sparks += '<i class="mx-spark" style="left:' + (8 + Math.random() * 84).toFixed(1) + "%;top:" + (6 + Math.random() * 84).toFixed(1) +
        "%;--dur:" + (2.4 + Math.random() * 2.6).toFixed(2) + "s;--del:-" + (Math.random() * 4).toFixed(2) + 's"></i>';
    }
    const stage = '<div class="mx-stage" aria-hidden="true"><div class="mx-stage-rig">' + prizeHtml + '<div class="mx-stage-floor"></div>' + sparks + "</div></div>";
    if (compact) return stage;
    return '<div class="container"><div class="mx-sorteo-grid">' +
      "<div>" +
        '<p class="mx-sorteo-kicker">Sorteo N.º ' + esc(C.id || "01") + " · Participación gratuita</p>" +
        '<h2 class="mx-sorteo-title"><span class="mx-line"><span>Ganate una</span></span><span class="mx-line"><span>moto 0km</span></span></h2>' +
        '<p class="mx-sorteo-text">Sorteamos ' + prizes.map((p) => esc(p.nombre)).join(" y ") +
          ". Participás comprando el manual o gratis: en los dos casos, la misma chance.</p>" +
        '<ul class="mx-sorteo-facts"><li>Sin obligación de compra</li><li>Una participación por DNI</li><li>Fecha del sorteo: ' + fecha + "</li></ul>" +
        '<div class="mx-sorteo-actions">' +
          '<a href="sorteo.html" class="btn-hero-red mx-magnetic" data-rifa-open>Participar</a>' +
          '<a href="' + esc(C.basesUrl || "sorteo.html") + '" class="mx-sorteo-link">Ver bases y condiciones</a>' +
        "</div>" +
      "</div>" + stage +
    "</div></div>";
  }

  function buildSorteo(anchor, where, compact) {
    const C = typeof SORTEO_CONFIG !== "undefined" ? SORTEO_CONFIG : null;
    if (!C || !C.activo || !anchor) return null;
    const section = document.createElement(compact ? "div" : "section");
    section.className = "mx-sorteo" + (compact ? " mx-sorteo--compact" : "") + (reduce ? "" : " mx-pre");
    section.innerHTML = sorteoMarkup(C, compact);
    if (where === "before") anchor.before(section); else anchor.after(section);
    if (reduce) return section;

    new IntersectionObserver((entries, io) => {
      if (!entries[0].isIntersecting) return;
      section.classList.remove("mx-pre");
      io.disconnect();
    }, { threshold: 0.2 }).observe(section);

    // El par de motos gira en 3D: con el scroll (entra mirando a un lado y sale mirando
    // al otro), con el mouse en compu y con el giroscopio en celular. Todo con resorte.
    const stage = section.querySelector(".mx-stage");
    const rig = section.querySelector(".mx-stage-rig");
    const tilt = spring({ x: 0, y: 0, s: 0 }, (t) => {
      rig.style.transform = "rotateX(" + (t.y * -10 + t.s * -5).toFixed(3) + "deg) rotateY(" + (t.x * 14 + t.s * 26).toFixed(3) + "deg)";
    }, 90, 14);
    let inView = false, ticking = false;
    new IntersectionObserver((en) => { inView = en[0].isIntersecting; }).observe(section);
    pauseOffscreen(section);
    const onScroll = () => {
      ticking = false;
      if (!inView) return;
      const r = section.getBoundingClientRect(), vh = window.innerHeight;
      tilt.set({ s: clamp((r.top + r.height / 2 - vh / 2) / (vh / 2 + r.height / 2), -1, 1) });
    };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    if (finePointer) {
      section.addEventListener("pointermove", (e) => {
        const r = stage.getBoundingClientRect();
        tilt.set({
          x: clamp((e.clientX - (r.left + r.width / 2)) / r.width, -1, 1),
          y: clamp((e.clientY - (r.top + r.height / 2)) / r.height, -1, 1)
        });
      });
      section.addEventListener("pointerleave", () => tilt.set({ x: 0, y: 0 }));
    } else {
      let gx = 0, gy = 0;
      onGyro((x, y) => {
        if (!inView || (Math.abs(x - gx) < 0.02 && Math.abs(y - gy) < 0.02)) return;
        gx = x; gy = y;
        tilt.set({ x: x * 1.2, y: y * 1.2 });
      });
    }
    return section;
  }

  // ── 6. Barra de progreso + bloques que se abren al entrar ────────────────
  // Antes el recorte se recalculaba en cada cuadro del scroll (repintaba bloques
  // enteros). Ahora cada bloque se abre una sola vez al entrar, con transform y
  // opacidad, que la placa de video resuelve sin trabar.
  function initScrub() {
    if (reduce) return;
    const bar = document.createElement("div");
    bar.className = "mx-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);
    let max = 1, ticking = false, lastP = -1;
    const measure = () => { max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight); };
    const update = () => {
      ticking = false;
      const p = clamp(window.scrollY / max, 0, 1);
      if (Math.abs(p - lastP) < 0.0005) return;
      lastP = p;
      bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
    };
    measure();
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener("resize", () => { measure(); update(); });
    window.addEventListener("load", measure);
    document.addEventListener("motobox:ready", () => requestAnimationFrame(measure));
    new ResizeObserver(measure).observe(document.body);
    update();

    // En celular la entrada de estos bloques la hace initTouch3D.
    if (!finePointer || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const el = e.target;
        io.unobserve(el);
        el.classList.add("is-in");
        // Al terminar se quitan las clases: el hover 3D de la tarjeta vuelve a mandar.
        const done = (ev) => {
          if (ev.target !== el || ev.propertyName !== "transform") return;
          el.removeEventListener("transitionend", done);
          el.classList.remove("mx-rise", "is-in");
        };
        el.addEventListener("transitionend", done);
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    document.querySelectorAll(".promo-poster-card, .cta-strip-inner").forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
      el.classList.add("mx-rise");
      io.observe(el);
    });
  }

  // ── 7. Títulos que suben desde una máscara e imágenes que se descubren ───
  function initReveals() {
    if (reduce || !("IntersectionObserver" in window)) return;
    const vh = window.innerHeight;

    // Se observa al contenedor: el recorte del propio título no debe frenar su aparición.
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.querySelectorAll(":scope > .mx-mask.mx-pre").forEach((t) => t.classList.remove("mx-pre"));
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    document.querySelectorAll(".promo-poster-title, .cta-strip-inner h3").forEach((el) => {
      if (el.getBoundingClientRect().top < vh * 0.9) return;
      el.classList.add("mx-mask", "mx-pre");
      io.observe(el.parentElement);
    });

    // Fotos y mapa del showroom: recorte de abajo hacia arriba (WAAPI, una sola vez).
    const imgIo = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        imgIo.unobserve(e.target);
        e.target.style.clipPath = "";
        e.target.animate([{ clipPath: "inset(100% 0 0 0)" }, { clipPath: "inset(0% 0 0 0)" }], { duration: 1000, easing: EASE_IN_OUT });
      });
    }, { rootMargin: "0px 0px -15% 0px" });
    document.querySelectorAll(".map-embed-wrapper iframe").forEach((el) => {
      if (el.getBoundingClientRect().top < vh) return;
      el.style.clipPath = "inset(100% 0 0 0)";
      imgIo.observe(el);
    });
  }

  // ── 8. Tarjetas: entran en 3D recién cuando aparecen ─────────────────────
  function initCards() {
    // En celular la entrada de las tarjetas la maneja el scroll (initTouch3D).
    if (reduce || !finePointer || !("IntersectionObserver" in window)) return;
    let batch = 0, batchTimer = 0;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const card = e.target;
        io.unobserve(card);
        card.style.animationDelay = Math.min(batch, 5) * 60 + "ms";
        batch++;
        card.classList.remove("mx-card-wait");
      });
      clearTimeout(batchTimer);
      batchTimer = setTimeout(() => { batch = 0; }, 120);
    }, { threshold: 0.12, rootMargin: "0px 0px -30px 0px" });

    const hold = (card) => {
      if (card.dataset.mxSeen) return;
      card.dataset.mxSeen = "1";
      if (card.getBoundingClientRect().top < window.innerHeight) return;
      card.classList.add("mx-card-wait");
      io.observe(card);
    };
    document.querySelectorAll(".catalog-cards-grid").forEach((grid) => {
      grid.querySelectorAll(".moto-card-modern").forEach(hold);
      new MutationObserver(() => grid.querySelectorAll(".moto-card-modern").forEach(hold)).observe(grid, { childList: true });
    });

    // Pilares de Nosotros: inclinación 3D con resorte al pasar el mouse.
    if (!finePointer) return;
    document.querySelectorAll(".about-pillar-card").forEach((card) => {
      card.classList.add("mx-tilt");
      const s = spring({ x: 0, y: 0, l: 0 }, (t) => {
        card.style.transform = "perspective(900px) rotateX(" + (t.y * -6).toFixed(3) + "deg) rotateY(" + (t.x * 8).toFixed(3) + "deg) translateY(" + (t.l * -4).toFixed(2) + "px)";
      }, 170, 20);
      card.addEventListener("pointermove", (e) => {
        if (card.classList.contains("mx-reveal")) return; // todavía está entrando
        const r = card.getBoundingClientRect();
        s.set({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5, l: 1 });
      });
      card.addEventListener("pointerleave", () => s.set({ x: 0, y: 0, l: 0 }));
    });
  }

  // ── 9. Botones magnéticos (solo con mouse, con resorte) ──────────────────
  function initMagnetic() {
    if (reduce || !finePointer) return;
    const sel = ".btn-hero-red, .btn-hero-outline, .btn-promo-whatsapp, .btn-primary-hero, .btn-secondary-hero, .mx-magnetic, .rf-btn-red";
    const springs = new WeakMap();
    const get = (b) => {
      let s = springs.get(b);
      if (!s) {
        // Se usa la propiedad "translate": no pisa el transform del hover ni del :active.
        s = spring({ x: 0, y: 0 }, (t) => { b.style.translate = t.x.toFixed(2) + "px " + t.y.toFixed(2) + "px"; }, 220, 14);
        springs.set(b, s);
      }
      return s;
    };
    document.addEventListener("pointermove", (e) => {
      const b = e.target.closest && e.target.closest(sel);
      if (!b) return;
      const r = b.getBoundingClientRect();
      get(b).set({
        x: clamp((e.clientX - (r.left + r.width / 2)) / (r.width / 2), -1, 1) * 6,
        y: clamp((e.clientY - (r.top + r.height / 2)) / (r.height / 2), -1, 1) * 5
      });
    });
    document.addEventListener("pointerout", (e) => {
      const b = e.target.closest && e.target.closest(sel);
      if (!b || b.contains(e.relatedTarget)) return;
      get(b).set({ x: 0, y: 0 });
    });
  }

  // ── 10. Ruta nocturna en 3D (portada) ────────────────────────────────────
  // Proyección en perspectiva real sobre un canvas: autos que vienen (luces blancas),
  // autos que se alejan (luces rojas), líneas de la ruta y el resplandor de la ciudad.
  // La cámara se inclina con el mouse; mantener apretado acelera hasta "warp".
  function initNightRide() {
    const hero = $('[data-page="home"] .simple-hero');
    if (!hero || reduce) return;
    const canvas = document.createElement("canvas");
    canvas.className = "mx-ride";
    hero.classList.add("has-ride");
    canvas.setAttribute("aria-hidden", "true");
    hero.insertBefore(canvas, hero.querySelector(".simple-hero-content"));
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const small = window.innerWidth < 700;
    const FAR = 260, CAM_H = 1.25, LIGHT_H = 0.62;
    // Calidad: 2 = halos y luz aditiva, 1 = sin halos, 0 = además la mitad de autos.
    // Arranca según el equipo y baja sola si los cuadros empiezan a tardar.
    let quality = small ? 1 : 2;
    let W = 0, H = 0, glow = null;
    const resize = () => {
      const w = hero.clientWidth, h = hero.clientHeight;
      // En celular la barra del navegador cambia el alto al scrollear: solo se rehace el
      // canvas si cambia el ancho o el alto cambia mucho (el CSS lo estira mientras tanto).
      if (w === W && Math.abs(h - H) < 140) return;
      W = w; H = h;
      const dpr = Math.min(small ? 1 : 1.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // El resplandor de la ciudad se pinta una vez en un canvas aparte y se reutiliza.
      glow = document.createElement("canvas");
      glow.width = Math.max(1, Math.round(W * 1.1));
      glow.height = Math.max(1, Math.round(W * 0.6));
      const g = glow.getContext("2d");
      const rg = g.createRadialGradient(glow.width / 2, glow.height / 2, 0, glow.width / 2, glow.height / 2, glow.width / 2);
      rg.addColorStop(0, "rgba(224,46,36,0.22)");
      rg.addColorStop(0.35, "rgba(224,46,36,0.07)");
      rg.addColorStop(1, "rgba(224,46,36,0)");
      g.fillStyle = rg;
      g.fillRect(0, 0, glow.width, glow.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const rand = (a, b) => a + Math.random() * (b - a);
    const TONES_ON = ["rgb(255,238,214)", "rgb(255,238,214)", "rgb(255,238,214)", "rgb(190,215,255)"];
    const TONES_OUT = ["rgb(232,46,36)", "rgb(232,46,36)", "rgb(232,46,36)", "rgb(255,112,64)"];
    const cars = [];
    const spawn = (car, initial) => {
      const oncoming = Math.random() < 0.5;
      car.oncoming = oncoming;
      car.x = oncoming ? -rand(1.6, 6.4) : rand(1.6, 6.4);
      car.z = initial ? rand(2, FAR) : (oncoming ? FAR + rand(0, 40) : rand(1.5, 4));
      car.len = rand(5, 16);
      car.v = oncoming ? rand(55, 85) : rand(10, 26);
      car.gap = rand(0.28, 0.42);
      car.tone = (oncoming ? TONES_ON : TONES_OUT)[Math.floor(Math.random() * 4)];
      return car;
    };
    for (let i = 0; i < (small ? 40 : 96); i++) cars.push(spawn({}, true));

    // Cámara con resorte: la inclinación del hero (mouse o giroscopio) mueve sus objetivos.
    const cam = { x: 0, pitch: 0, roll: 0, speed: 1 };
    const goal = { x: 0, pitch: 0, roll: 0, speed: 1 };
    const vel = { x: 0, pitch: 0, roll: 0, speed: 0 };
    rideGoal = goal;
    let dash = 0, running = false, raf = 0, last = 0, boost = 1, lastScroll = window.scrollY;
    let slowFrames = 0, sampled = 0;

    // Mantener apretado (o el dedo) sobre el hero = acelerar.
    hero.addEventListener("pointerdown", (e) => { if (!e.target.closest("a, button")) boost = 4; });
    window.addEventListener("pointerup", () => { boost = 1; });
    window.addEventListener("pointercancel", () => { boost = 1; });
    hero.querySelectorAll(".btn-hero-red").forEach((b) => {
      b.addEventListener("pointerenter", () => { boost = 2.2; });
      b.addEventListener("pointerleave", () => { boost = 1; });
    });

    const frame = (now) => {
      const ms = now - last;
      const dt = Math.min(0.05, ms / 1000 || 0.016);
      last = now;
      // Calidad automática: si en 90 cuadros más de un tercio tardó más de 24 ms, baja un escalón.
      if (++sampled > 20) {
        if (ms > 24) slowFrames++;
        if (sampled > 110) {
          if (slowFrames > 30 && quality > 0) {
            quality--;
            if (quality === 0) cars.length = Math.floor(cars.length / 2);
          }
          sampled = 20; slowFrames = 0;
        }
      }
      const sy = window.scrollY;
      goal.speed = boost + clamp(Math.abs(sy - lastScroll) * 0.08, 0, 2.5);
      lastScroll = sy;
      for (const k in cam) {
        const stiff = k === "speed" ? 18 : 40, damp = k === "speed" ? 8 : 12;
        vel[k] += (stiff * (goal[k] - cam[k]) - damp * vel[k]) * dt;
        cam[k] += vel[k] * dt;
      }

      const f = H * 1.05 * (1 - clamp(cam.speed - 1, 0, 3) * 0.07);
      const cx = W / 2;
      // El horizonte queda debajo de los botones: las luces nunca pasan detrás del texto.
      const hy = H * (small ? 0.86 : 0.8) + cam.pitch;
      const px = (x, z) => cx + (x - cam.x) * f / z;
      const py = (y, z) => hy + (CAM_H - y) * f / z;

      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(cx, hy);
      ctx.rotate(cam.roll);
      ctx.translate(-cx, -hy);
      if (glow) ctx.drawImage(glow, cx - glow.width / 2, hy - glow.height / 2);

      ctx.globalCompositeOperation = quality === 2 ? "lighter" : "source-over";
      ctx.lineCap = "round";

      // Bordes de la ruta y línea central discontinua que corre hacia la cámara
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 1.2;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.moveTo(px(-7.6, 1.2), py(0, 1.2)); ctx.lineTo(px(-7.6, FAR), py(0, FAR));
      ctx.moveTo(px(7.6, 1.2), py(0, 1.2)); ctx.lineTo(px(7.6, FAR), py(0, FAR));
      ctx.stroke();
      const travel = 34 * cam.speed;
      dash = (dash + travel * dt) % 9;
      for (let z = 9 - dash; z < FAR * 0.7; z += 9) {
        if (z < 3) continue;
        ctx.globalAlpha = 0.32 * (1 - z / (FAR * 0.7));
        ctx.lineWidth = clamp(0.16 * f / z, 0.6, 3);
        ctx.beginPath();
        ctx.moveTo(px(0, z), py(0, z));
        ctx.lineTo(px(0, z + 4), py(0, z + 4));
        ctx.stroke();
      }

      // Luces de los autos: un solo trazo para las dos luces de cada auto
      // (más un halo ancho cuando la calidad lo permite).
      const near = small ? 7 : 4;
      for (let i = 0; i < cars.length; i++) {
        const c = cars[i];
        c.z += (c.oncoming ? -(c.v + travel) : c.v * 2.2) * dt;
        if (c.oncoming && c.z < 1) spawn(c, false);
        else if (!c.oncoming && c.z > FAR) spawn(c, false);
        const z1 = Math.max(1, c.z), z2 = z1 + c.len * (0.6 + cam.speed * 0.4);
        // Cerca de la cámara las luces se apagan antes de volverse manchones.
        const fade = clamp((z1 - 1.5) / near, 0, 1) * clamp((FAR - z1) / (FAR * 0.35), 0, 1);
        if (fade <= 0.01) continue;
        const w = clamp(0.11 * f / z1, 0.5, small ? 3.2 : 6);
        const ya = py(LIGHT_H, z1), yb = py(LIGHT_H, z2);
        ctx.beginPath();
        ctx.moveTo(px(c.x - c.gap, z1), ya); ctx.lineTo(px(c.x - c.gap, z2), yb);
        ctx.moveTo(px(c.x + c.gap, z1), ya); ctx.lineTo(px(c.x + c.gap, z2), yb);
        ctx.strokeStyle = c.tone;
        if (quality === 2) {
          ctx.globalAlpha = 0.1 * fade;
          ctx.lineWidth = w * 4;
          ctx.stroke();
        }
        ctx.globalAlpha = 0.85 * fade;
        ctx.lineWidth = w;
        ctx.stroke();
      }
      ctx.restore();
      if (running) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || document.hidden || lock.on || !inView) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    let inView = true;
    new IntersectionObserver((entries) => {
      inView = entries[0].isIntersecting;
      if (inView) start(); else stop();
    }).observe(hero);
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else start(); });
    onLock((on) => { if (on) stop(); else start(); });

    const reveal = () => { canvas.classList.add("is-on"); start(); };
    if (root.classList.contains("mx-intro-on")) document.addEventListener("motobox:intro-done", reveal, { once: true });
    else requestAnimationFrame(reveal);
  }

  // ── 12. Marca gigante en el pie que se levanta en 3D ─────────────────────
  function initFooterWord() {
    const footer = $(".simple-footer, .site-footer");
    if (!footer) return;
    const word = document.createElement("div");
    word.className = "mx-footer-word";
    word.setAttribute("aria-hidden", "true");
    word.innerHTML = "<span>MOTOBOX</span>";
    footer.appendChild(word);
    if (reduce) return;
    const span = word.firstChild;
    let ticking = false, near = false, lastP = -1;
    new IntersectionObserver((en) => { near = en[0].isIntersecting; if (near) update(); }, { rootMargin: "20% 0px" }).observe(word);
    const update = () => {
      ticking = false;
      if (!near) return;
      const r = word.getBoundingClientRect();
      const vh = window.innerHeight;
      // p = 0 cuando asoma por abajo, 1 cuando está entero en pantalla.
      const p = clamp((vh - r.top) / r.height, 0, 1);
      if (p === lastP) return;
      lastP = p;
      span.style.transform = "perspective(800px) translateY(" + ((1 - p) * 40).toFixed(1) + "%) rotateX(" + ((1 - p) * 70).toFixed(2) + "deg)";
      span.style.opacity = (0.15 + p * 0.85).toFixed(3);
    };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // ── 13. Showroom 360° (portada) ──────────────────────────────────────────
  // Las motos en un anillo 3D sobre una plataforma giratoria. Se arrastra con inercia
  // (velocidad al soltar) y encaja en la moto más cercana con un resorte; avanza solo
  // cada pocos segundos mientras nadie lo toca.
  function buildShowroom(anchor) {
    if (!anchor) return;
    const section = document.createElement("section");
    section.className = "mx-showroom";
    section.setAttribute("aria-label", "Showroom 360°");
    section.innerHTML =
      '<div class="container mx-sr-head">' +
        '<h2 class="mx-sr-title" data-mx-chars>Showroom 360°</h2>' +
        '<p class="mx-sr-hint">Arrastrá para girar o usá las flechas.</p>' +
      "</div>" +
      '<div class="mx-sr-stage" tabindex="0" role="group" aria-roledescription="carrusel" aria-label="Motos del showroom">' +
        '<div class="mx-sr-spot" aria-hidden="true"></div>' +
        '<div class="mx-sr-tilt"><div class="mx-sr-ring"></div></div>' +
      "</div>" +
      '<div class="container mx-sr-info">' +
        '<div class="mx-sr-meta" aria-live="polite"></div>' +
        '<div class="mx-sr-side">' +
          '<div class="mx-sr-ctrl">' +
            '<button type="button" class="mx-sr-btn" data-sr="prev" aria-label="Moto anterior"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg></button>' +
            '<span class="mx-sr-count"></span>' +
            '<button type="button" class="mx-sr-btn" data-sr="next" aria-label="Moto siguiente"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg></button>' +
          "</div>" +
          '<div class="mx-sr-cta"></div>' +
        "</div>" +
      "</div>";
    anchor.after(section);

    const stage = section.querySelector(".mx-sr-stage");
    const tiltEl = section.querySelector(".mx-sr-tilt");
    const ring = section.querySelector(".mx-sr-ring");
    const meta = section.querySelector(".mx-sr-meta");
    const count = section.querySelector(".mx-sr-count");
    const cta = section.querySelector(".mx-sr-cta");

    let items = [], list = [], N = 0, step = 0, R = 0, W = 0, Hc = 0;
    let rot = 0, target = 0, vel = 0, mode = "rest", active = -1;
    let dragging = false, dragX = 0, dragRot = 0, moved = 0, samples = [];
    let raf = 0, last = 0, visible = false, idleAt = performance.now(), hover = false, tiltNow = -16, tiltGoal = -16;
    // Inclinación extra del escenario: mouse encima (compu) o giroscopio (celular).
    const lean = { x: 0, y: 0 }, leanGoal = { x: 0, y: 0 };

    const wa = (m) => "https://wa.me/5493516312930?text=" + encodeURIComponent("Hola Motobox! Quiero consultar por la " + m.marca + " " + m.modelo + " 0km que vi en el showroom de la web.");

    function layout() {
      const small = window.innerWidth < 700;
      W = small ? Math.round(Math.min(250, window.innerWidth * 0.62)) : 340;
      Hc = Math.round(W * 0.78);
      R = Math.max(W * 0.9, (W + (small ? 26 : 46)) / (2 * Math.tan(Math.PI / N)));
      stage.style.setProperty("--sr-w", W + "px");
      stage.style.setProperty("--sr-h", Hc + "px");
      stage.style.setProperty("--sr-r", R + "px");
      stage.style.perspective = (small ? 900 : 1500) + "px";
      items.forEach((el, i) => { el.style.transform = "rotateY(" + (i * step) + "deg) translateZ(" + R.toFixed(1) + "px)"; });
      const disc = ring.querySelector(".mx-sr-disc");
      if (disc) disc.style.setProperty("--sr-d", (R * 2 + W * 0.9).toFixed(0) + "px");
    }

    function setData(source) {
      const base = (source || []).filter((m) => m && m.imagen);
      if (!base.length) { section.hidden = true; return; }
      section.hidden = false;
      list = base.slice();
      // Con pocas motos se repiten para que el anillo quede lleno (las copias no se anuncian).
      const reps = Math.max(1, Math.ceil(8 / base.length));
      const ringList = [];
      for (let r = 0; r < reps; r++) base.forEach((m, i) => ringList.push({ m: m, i: i, copy: r > 0 }));
      N = ringList.length;
      step = 360 / N;
      ring.innerHTML = '<div class="mx-sr-disc" aria-hidden="true"></div>' + ringList.map((it) =>
        '<div class="mx-sr-item"' + (it.copy ? ' aria-hidden="true"' : "") + ' data-i="' + it.i + '">' +
          '<div class="mx-sr-card"><img src="' + esc(it.m.imagen) + '" alt="' + (it.copy ? "" : esc(it.m.marca + " " + it.m.modelo)) + '" loading="lazy" draggable="false">' +
          '<span class="mx-sr-tag">' + esc(it.m.marca) + "</span></div>" +
        "</div>"
      ).join("");
      items = Array.from(ring.querySelectorAll(".mx-sr-item"));
      layout();
      active = -1;
      rot = target = Math.round(rot / step) * step;
      paint(true);
      kick();
    }

    function showInfo(idx, instant) {
      const m = list[idx % list.length];
      if (!m) return;
      const specs = [m.cilindrada, m.potencia, m.consumo].filter(Boolean).slice(0, 3)
        .map((v) => "<li>" + esc(v) + "</li>").join("");
      const html =
        '<p class="mx-sr-brand">' + esc(m.marca) + (m.categoriaLabel ? " · " + esc(m.categoriaLabel) : "") + "</p>" +
        '<h3 class="mx-sr-model">' + esc(m.modelo) + "</h3>" +
        (specs ? '<ul class="mx-sr-specs">' + specs + "</ul>" : "");
      const swap = () => {
        meta.innerHTML = html;
        cta.innerHTML = '<a class="btn-hero-red mx-magnetic" href="' + wa(m) + '" target="_blank" rel="noopener">Consultar esta moto</a>' +
          '<a class="mx-sr-link" href="catalogo.html">Ver catálogo</a>';
        count.textContent = String((idx % list.length) + 1).padStart(2, "0") + " / " + String(list.length).padStart(2, "0");
      };
      if (instant || reduce || !meta.animate) { swap(); return; }
      // Fundido con un leve desenfoque: une las dos fichas en una sola transición.
      meta.animate([{ opacity: 1, filter: "blur(0px)", transform: "none" }, { opacity: 0, filter: "blur(6px)", transform: "translateY(-6px)" }],
        { duration: 140, easing: "ease-in-out", fill: "forwards" }).onfinish = () => {
        swap();
        meta.animate([{ opacity: 0, filter: "blur(6px)", transform: "translateY(8px)" }, { opacity: 1, filter: "blur(0px)", transform: "none" }],
          { duration: 260, easing: EASE_OUT, fill: "forwards" });
      };
    }

    function paint(force) {
      ring.style.transform = "translateZ(" + (-R).toFixed(1) + "px) rotateY(" + rot.toFixed(3) + "deg)";
      tiltEl.style.transform = "rotateX(" + (tiltNow + lean.y * -7).toFixed(2) + "deg) rotateY(" + (lean.x * 12).toFixed(2) + "deg) rotateZ(" + (lean.x * -1.5).toFixed(2) + "deg)";
      for (let i = 0; i < items.length; i++) {
        let a = ((i * step + rot) % 360 + 540) % 360 - 180;
        const c = Math.cos(a * Math.PI / 180);
        items[i].style.opacity = (0.12 + 0.88 * Math.pow((c + 1) / 2, 2.2)).toFixed(3);
        items[i].classList.toggle("is-front", Math.abs(a) < step / 2);
      }
      const idx = ((Math.round(-rot / step) % N) + N) % N;
      const real = items[idx] ? Number(items[idx].dataset.i) : 0;
      if (real !== active || force) {
        if (!force && active !== -1) tick();
        active = real;
        showInfo(real, force);
      }
    }

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      if (!dragging) {
        if (mode === "glide") {
          rot += vel * dt;
          vel *= Math.exp(-3.2 * dt);
          if (Math.abs(vel) < 40) { mode = "snap"; target = Math.round(rot / step) * step; vel *= 0.5; }
        }
        if (mode === "snap" || mode === "rest") {
          const a = 70 * (target - rot) - 13 * vel;
          vel += a * dt;
          rot += vel * dt;
          if (Math.abs(target - rot) < 0.01 && Math.abs(vel) < 0.05) { rot = target; vel = 0; mode = "rest"; }
        }
      }
      tiltNow += (tiltGoal - tiltNow) * Math.min(1, dt * 6);
      lean.x += (leanGoal.x - lean.x) * Math.min(1, dt * 5);
      lean.y += (leanGoal.y - lean.y) * Math.min(1, dt * 5);
      paint(false);
      // El bucle corre solo mientras algo se mueve; quieto no gasta nada.
      const busy = dragging || mode !== "rest" || Math.abs(tiltGoal - tiltNow) > 0.02 ||
        Math.abs(leanGoal.x - lean.x) > 0.003 || Math.abs(leanGoal.y - lean.y) > 0.003;
      raf = busy ? requestAnimationFrame(frame) : 0;
    }
    function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    // Avance automático: un reloj liviano en vez de un bucle por cuadro.
    setInterval(() => {
      const now = performance.now();
      if (mode !== "rest" || dragging || hover || !visible || reduce || lock.on || document.hidden || now - idleAt < 3600) return;
      target -= step; mode = "snap"; idleAt = now; kick();
    }, 400);
    const go = (dir) => { target = Math.round(target / step) * step - dir * step; mode = "snap"; idleAt = performance.now(); kick(); };

    stage.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      dragging = true; moved = 0; dragX = e.clientX; dragRot = rot; samples = [{ t: e.timeStamp, x: e.clientX }];
      stage.setPointerCapture(e.pointerId);
      stage.classList.add("is-dragging");
      kick();
    });
    stage.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - dragX;
      moved = Math.max(moved, Math.abs(dx));
      rot = dragRot + dx * (step / (W + 40)) * 1.1;
      samples.push({ t: e.timeStamp, x: e.clientX });
      if (samples.length > 6) samples.shift();
    });
    const release = (e) => {
      if (!dragging) return;
      dragging = false;
      stage.classList.remove("is-dragging");
      const a = samples[0], b = samples[samples.length - 1];
      const dtv = Math.max(1, b.t - a.t);
      // Un gesto rápido alcanza: la velocidad decide, no solo la distancia.
      vel = ((b.x - a.x) / dtv) * 1000 * (step / (W + 40)) * 1.1;
      mode = Math.abs(vel) > 60 ? "glide" : "snap";
      target = Math.round(rot / step) * step;
      idleAt = performance.now();
      if (moved < 6 && e && e.target && e.target.closest) {
        const item = e.target.closest(".mx-sr-item");
        if (item && !item.classList.contains("is-front")) {
          const i = items.indexOf(item);
          target = -i * step + Math.round((rot + i * step) / 360) * 360;
          mode = "snap";
        }
      }
      kick();
    };
    stage.addEventListener("pointerup", release);
    stage.addEventListener("pointercancel", release);
    stage.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
    });
    section.querySelector('[data-sr="prev"]').addEventListener("click", () => go(-1));
    section.querySelector('[data-sr="next"]').addEventListener("click", () => go(1));
    if (finePointer) {
      stage.addEventListener("pointermove", (e) => {
        if (dragging) { leanGoal.x = 0; leanGoal.y = 0; kick(); return; }
        const r = stage.getBoundingClientRect();
        leanGoal.x = clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1);
        leanGoal.y = clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1);
        kick();
      });
      stage.addEventListener("pointerleave", () => { leanGoal.x = 0; leanGoal.y = 0; kick(); });
    } else {
      onGyro((x, y) => {
        if (!visible) return;
        // Zona muerta: el temblor natural de la mano no despierta el bucle.
        if (Math.abs(x - leanGoal.x) < 0.02 && Math.abs(y - leanGoal.y) < 0.02) return;
        leanGoal.x = x; leanGoal.y = y; kick();
      });
    }
    stage.addEventListener("pointerenter", () => { hover = true; });
    stage.addEventListener("pointerleave", () => { hover = false; idleAt = performance.now(); });

    // Al entrar en pantalla la cámara baja de una vista en picada a la altura del showroom.
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) { tiltGoal = window.innerWidth < 700 ? -8 : -10; idleAt = performance.now(); kick(); }
    }, { threshold: 0.25 }).observe(stage);
    window.addEventListener("resize", () => { if (N) { layout(); paint(true); } });

    setData(typeof motos !== "undefined" ? motos : []);
    const refresh = () => setData(typeof motos !== "undefined" ? motos : []);
    document.addEventListener("motobox:ready", refresh);
    document.addEventListener("motobox:motos-updated", refresh);
  }

  // ── 14. Velocímetro ligado al scroll (portada) ───────────────────────────
  // La sección queda fija mientras se scrollea: la aguja sube con un resorte, el arco
  // rojo se completa y los tres motivos para comprar en MOTOBOX se van reemplazando.
  // El odómetro, claro, sigue en 000000 km.
  function buildStory(anchor) {
    if (!anchor) return;
    const steps = [
      ["Nuevas de fábrica", "Solo vendemos motos 0km: el odómetro arranca en cero y la garantía es oficial."],
      ["Stock real en el showroom", "Lo que ves en la web está en Santa Rosa 4227. Venís, la elegís y coordinás el retiro."],
      ["Te asesora una persona", "Escribís por WhatsApp y un asesor te pasa precio, colores y tiempos de entrega."]
    ];
    const CX = 200, CY = 205, RAD = 150, START = 150, SWEEP = 240, MAX = 200;
    const pt = (deg, r) => {
      const a = deg * Math.PI / 180;
      return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
    };
    const arc = (r) => {
      const a = pt(START, r), b = pt(START + SWEEP, r);
      return "M" + a[0].toFixed(2) + " " + a[1].toFixed(2) + " A" + r + " " + r + " 0 1 1 " + b[0].toFixed(2) + " " + b[1].toFixed(2);
    };
    let ticks = "", labels = "";
    for (let v = 0; v <= MAX; v += 10) {
      const deg = START + (v / MAX) * SWEEP;
      const major = v % 20 === 0;
      const a = pt(deg, RAD - 16), b = pt(deg, RAD - (major ? 34 : 25));
      ticks += '<line x1="' + a[0].toFixed(1) + '" y1="' + a[1].toFixed(1) + '" x2="' + b[0].toFixed(1) + '" y2="' + b[1].toFixed(1) + '" class="' + (v >= 180 ? "mx-g-red" : major ? "mx-g-major" : "mx-g-minor") + '"/>';
      if (major) {
        const l = pt(deg, RAD - 52);
        labels += '<text x="' + l[0].toFixed(1) + '" y="' + (l[1] + 5).toFixed(1) + '"' + (v >= 180 ? ' class="mx-g-red-t"' : "") + ">" + v + "</text>";
      }
    }
    // Líneas de velocidad de fondo: aparecen y se estiran a medida que sube la aguja.
    let streaks = '<div class="mx-story-streaks" aria-hidden="true">';
    for (let i = 0; i < 10; i++) {
      streaks += '<i style="top:' + (6 + Math.random() * 88).toFixed(1) + "%;width:" + (8 + Math.random() * 22).toFixed(1) +
        "vw;animation-duration:" + (0.7 + Math.random() * 0.9).toFixed(2) + "s;animation-delay:-" + (Math.random() * 1.5).toFixed(2) + 's"></i>';
    }
    streaks += "</div>";
    const section = document.createElement("section");
    section.className = "mx-story";
    section.innerHTML =
      '<div class="mx-story-sticky">' + streaks + '<div class="container mx-story-grid">' +
        '<div class="mx-story-copy">' +
          '<h2 class="mx-story-title" data-mx-chars>Por qué MOTOBOX</h2>' +
          '<div class="mx-story-steps">' + steps.map((s, i) =>
            '<div class="mx-step' + (i === 0 ? " is-on" : "") + '"><span class="mx-step-n">' + (i + 1) + "/3</span><h3>" + s[0] + "</h3><p>" + s[1] + "</p></div>"
          ).join("") + "</div>" +
          '<div class="mx-story-bar" aria-hidden="true"><i></i><i></i><i></i></div>' +
        "</div>" +
        '<div class="mx-gauge-wrap" aria-hidden="true"><div class="mx-gauge">' +
          '<svg viewBox="0 0 400 400">' +
            '<defs><linearGradient id="mxGArc" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#ff7a45"/><stop offset="1" stop-color="#e02e24"/></linearGradient></defs>' +
            '<path d="' + arc(RAD) + '" class="mx-g-track"/>' +
            '<path d="' + arc(RAD) + '" class="mx-g-glow" pathLength="1000"/>' +
            '<path d="' + arc(RAD) + '" class="mx-g-fill" pathLength="1000"/>' +
            ticks + '<g class="mx-g-labels">' + labels + "</g>" +
            '<g class="mx-g-needle"><path class="mx-g-needle-glow" d="M193 205 L200 ' + (CY - RAD + 26) + ' L207 205 Z"/><path d="M196 205 L200 ' + (CY - RAD + 30) + ' L204 205 Z"/><circle cx="200" cy="205" r="13"/><circle cx="200" cy="205" r="5" class="mx-g-hub"/></g>' +
          "</svg>" +
          '<div class="mx-g-read"><b class="mx-g-speed">0</b><span>km/h</span></div>' +
          '<div class="mx-g-odo"><span>000000</span> km</div>' +
        "</div></div>" +
      "</div></div>";
    anchor.after(section);
    if (reduce) { section.classList.add("is-static"); return; }

    const needle = section.querySelector(".mx-g-needle");
    const fill = section.querySelector(".mx-g-fill");
    const fillGlow = section.querySelector(".mx-g-glow");
    const speedEl = section.querySelector(".mx-g-speed");
    const gauge = section.querySelector(".mx-gauge");
    const stepEls = Array.from(section.querySelectorAll(".mx-step"));
    const bars = Array.from(section.querySelectorAll(".mx-story-bar i"));
    let cur = 0;
    const streakBox = section.querySelector(".mx-story-streaks");
    let lastShown = -1, streaksIdle = false;
    pauseOffscreen(section);
    const s = spring({ v: 0, p: 0, lx: 0, ly: 0 }, (t) => {
      const v = clamp(t.v, -4, MAX + 6);
      const k = clamp(v / MAX, 0, 1);
      needle.style.transform = "rotate(" + (-120 + k * SWEEP).toFixed(2) + "deg)";
      const off = (1000 - k * 1000).toFixed(1);
      fill.style.strokeDashoffset = off;
      fillGlow.style.strokeDashoffset = off;
      const shown = Math.max(0, Math.round(v));
      if (shown !== lastShown) { lastShown = shown; speedEl.textContent = shown; }
      gauge.style.transform = "rotateX(" + (10 + t.ly * -10).toFixed(2) + "deg) rotateY(" + (-16 + t.p * 32 + t.lx * 12).toFixed(2) + "deg)";
      const so = k * k * 0.9;
      streakBox.style.opacity = so.toFixed(3);
      const idle = so < 0.03;
      if (idle !== streaksIdle) { streaksIdle = idle; streakBox.classList.toggle("is-idle", idle); }
    }, 90, 11);
    const sticky = section.querySelector(".mx-story-sticky");
    if (finePointer) {
      sticky.addEventListener("pointermove", (e) => {
        s.set({ lx: e.clientX / window.innerWidth * 2 - 1, ly: (e.clientY - sticky.getBoundingClientRect().top) / sticky.offsetHeight * 2 - 1 });
      });
      sticky.addEventListener("pointerleave", () => s.set({ lx: 0, ly: 0 }));
    } else {
      let storyIn = false;
      new IntersectionObserver((en) => { storyIn = en[0].isIntersecting; }).observe(sticky);
      let gx = 0, gy = 0;
      onGyro((x, y) => {
        if (!storyIn || (Math.abs(x - gx) < 0.02 && Math.abs(y - gy) < 0.02)) return;
        gx = x; gy = y;
        s.set({ lx: x, ly: y });
      });
    }

    let ticking = false, lastP = -1;
    const update = () => {
      ticking = false;
      const r = section.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      const p = clamp(-r.top / (total || 1), 0, 1);
      if (p === lastP) return;   // fuera de la sección no hay nada que actualizar
      lastP = p;
      // Cada tramo acelera hasta un cambio y "pasa la marcha": la aguja cae un poco y vuelve a subir.
      const seg = Math.min(2, Math.floor(p * 3));
      const local = p * 3 - seg;
      const v = (seg * 60) + local * 60 - (local < 0.12 && seg > 0 ? (0.12 - local) * 160 : 0) + (p >= 0.995 ? 20 : 0);
      s.set({ v: v, p: p });
      if (seg !== cur) {
        stepEls[cur].classList.remove("is-on");
        stepEls[seg].classList.add("is-on");
        cur = seg;
      }
      bars.forEach((b, i) => { b.style.setProperty("--p", clamp(p * 3 - i, 0, 1).toFixed(3)); });
    };
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  // ── 15. Títulos letra por letra en 3D ────────────────────────────────────
  function splitChars(el) {
    if (el.dataset.mxSplit) return false;
    el.dataset.mxSplit = "1";
    el.setAttribute("aria-label", el.textContent.replace(/\s+/g, " ").trim());
    let i = 0;
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          n.textContent.split(/(\s+)/).forEach((word) => {
            if (!word) return;
            if (/^\s+$/.test(word)) { frag.appendChild(document.createTextNode(" ")); return; }
            const w = document.createElement("span");
            w.className = "mx-cw";
            w.setAttribute("aria-hidden", "true");
            Array.from(word).forEach((ch) => {
              const c = document.createElement("span");
              c.className = "mx-ch";
              c.style.setProperty("--i", i++);
              c.textContent = ch;
              w.appendChild(c);
            });
            frag.appendChild(w);
          });
          n.replaceWith(frag);
        } else if (n.nodeType === Node.ELEMENT_NODE && n.tagName !== "BR") {
          walk(n);
        }
      });
    };
    walk(el);
    return true;
  }

  function initCharTitles() {
    if (reduce || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.remove("mx-pre");
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -10% 0px" });
    document.querySelectorAll(".simple-catalog-title, .section-header h2, [data-mx-chars]").forEach((el) => {
      if (!splitChars(el)) return;
      el.classList.add("mx-chars");
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
      el.classList.add("mx-pre");
      io.observe(el);
    });
  }

  // ── 16. Scroll suave (solo con mouse o trackpad) ─────────────────────────
  function initSmoothScroll() {
    if (reduce || !finePointer || typeof Lenis === "undefined") return;
    const lenis = new Lenis({
      lerp: 0.11,
      wheelMultiplier: 1,
      anchors: { offset: -70 },
      prevent: (node) => !!(node.closest && node.closest(".rf, .assistant-modal-backdrop, .moto-gallery-track, [data-lenis-prevent]"))
    });
    const loop = (t) => { lenis.raf(t); requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
    // Con el popup o la ficha abiertos, el scroll de la página se detiene.
    const sync = () => {
      const locked = root.classList.contains("rf-lock") || document.body.style.overflow === "hidden";
      if (locked) lenis.stop(); else lenis.start();
    };
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ["class"] });
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ["style"] });
  }

  // ── 18. Nosotros: la foto del showroom se inclina en 3D ──────────────────
  function initAboutTilt() {
    const card = $(".about-hero-card");
    const media = $(".about-hero-media");
    if (!card || !media || reduce) return;
    media.classList.add("mx-about-3d");
    const s = spring({ x: 0, y: 0 }, (t) => {
      media.style.transform = "perspective(1000px) rotateX(" + (t.y * -8).toFixed(2) + "deg) rotateY(" + (t.x * 11).toFixed(2) + "deg)";
      const img = media.querySelector("img");
      if (img) img.style.translate = (t.x * -14).toFixed(1) + "px " + (t.y * -10).toFixed(1) + "px";
    }, 90, 14);
    if (finePointer) {
      card.addEventListener("pointermove", (e) => {
        const r = media.getBoundingClientRect();
        s.set({ x: clamp((e.clientX - r.left) / r.width * 2 - 1, -1, 1), y: clamp((e.clientY - r.top) / r.height * 2 - 1, -1, 1) });
      });
      card.addEventListener("pointerleave", () => s.set({ x: 0, y: 0 }));
    } else {
      onGyro((x, y) => s.set({ x: x, y: y }));
    }
  }

  // ── 17. Celular: tarjetas que se levantan en 3D con el scroll ────────────
  // Sin mouse no hay hover, así que el 3D lo maneja el scroll: cada tarjeta entra
  // acostada y se levanta al llegar al centro (las de cada columna se abren hacia
  // afuera, como un libro). Al tocarla se hunde hacia el dedo.
  function initTouch3D() {
    if (reduce || finePointer || !("IntersectionObserver" in window)) return;
    root.classList.add("mx-touch3d");
    const SEL = ".moto-card-modern, .promo-poster-card, .cta-strip-inner";
    const state = new WeakMap();
    const live = new Set();
    let raf = 0;

    const reset = (el) => {
      const st = state.get(el);
      if (st) st.out = "";
      el.style.transform = "";
      el.style.opacity = "";
      el.classList.remove("is-live3d");
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { live.add(e.target); e.target.classList.add("is-live3d"); }
        else { live.delete(e.target); reset(e.target); }
      });
      kick();
    }, { rootMargin: "15% 0px 15% 0px" });

    const add = (el) => {
      if (state.has(el)) return;
      state.set(el, { press: 0, goal: 0, px: 0, py: 0, out: "" });
      el.classList.add("mx-s3d");
      io.observe(el);
      el.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse") return;
        const st = state.get(el), r = el.getBoundingClientRect();
        st.goal = 1;
        st.px = clamp((e.clientX - r.left) / r.width - 0.5, -0.5, 0.5) * 2;
        st.py = clamp((e.clientY - r.top) / r.height - 0.5, -0.5, 0.5) * 2;
        kick();
      }, { passive: true });
      const up = () => { const st = state.get(el); st.goal = 0; kick(); };
      el.addEventListener("pointerup", up);
      el.addEventListener("pointercancel", up);
      el.addEventListener("pointerleave", up);
    };
    const scan = () => document.querySelectorAll(SEL).forEach(add);

    const smooth = (t) => t * t * (3 - 2 * t);
    const rects = [];
    const frame = () => {
      raf = 0;
      const vh = window.innerHeight, vw = window.innerWidth;
      let busy = false;
      // Primero se leen todas las posiciones y después se escribe: una sola pasada de estilo.
      rects.length = 0;
      live.forEach((el) => rects.push([el, el.getBoundingClientRect()]));
      for (let n = 0; n < rects.length; n++) {
        const el = rects[n][0], r = rects[n][1], st = state.get(el);
        st.press += (st.goal - st.press) * 0.28;
        if (Math.abs(st.goal - st.press) > 0.003) busy = true; else st.press = st.goal;
        const c = (r.top + r.height / 2 - vh / 2) / (vh / 2);
        const tin = smooth(clamp((c - 0.2) / 0.8, 0, 1));
        const tout = smooth(clamp((-c - 0.6) / 0.6, 0, 1));
        const mid = r.left + r.width / 2;
        const col = r.width < vw * 0.7 ? (mid < vw / 2 - 8 ? -1 : mid > vw / 2 + 8 ? 1 : 0) : 0;
        const rx = tin * 34 - tout * 12 - st.py * 7 * st.press;
        const ry = -col * tin * 18 + st.px * 9 * st.press;
        const sc = 1 - tin * 0.1 - tout * 0.05 - st.press * 0.035;
        const out = "perspective(1000px) translate3d(0," + (tin * 50).toFixed(1) + "px," + (-tin * 80).toFixed(1) + "px) rotateX(" + rx.toFixed(1) + "deg) rotateY(" + ry.toFixed(1) + "deg) scale(" + sc.toFixed(3) + ")";
        if (out === st.out) continue;   // nada cambió: no se toca el estilo
        st.out = out;
        el.style.transform = out;
        el.style.opacity = (1 - tin * 0.6 - tout * 0.3).toFixed(2);
      }
      if (busy) kick();
    };
    function kick() { if (!raf) raf = requestAnimationFrame(frame); }

    scan();
    document.querySelectorAll(".catalog-cards-grid").forEach((grid) => {
      new MutationObserver(() => { scan(); kick(); }).observe(grid, { childList: true });
    });
    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    kick();
  }

  // ── Armado por página ────────────────────────────────────────────────────
  function buildSections() {
    if (page === "home") {
      buildMarquee($(".simple-hero"), "after");
      buildShowroom($(".mx-marquee"));
      buildStory($("#catalogo-home"));
      buildSorteo($("#promo-poster-section"), "before");
    } else if (page === "catalogo") {
      const cta = $(".catalog-cta-strip");
      buildSorteo(cta, "before");
      buildMarquee(cta, "before");
    } else if (page === "nosotros") {
      buildMarquee($(".about-hero-section"), "after");
      buildSorteo($(".location-section"), "before");
    } else if (page === "sorteo") {
      buildSorteo($(".bases-cta"), "before", true);
    }
  }

  function init() {
    initLockWatch();
    initSmoothScroll();
    initGyro();
    runIntro();
    initHero();
    initPageEntrance();
    buildSections();
    initCharTitles();
    initScrub();
    initReveals();
    initCards();
    initMagnetic();
    initNightRide();
    initFooterWord();
    initTouch3D();
    initAboutTilt();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
