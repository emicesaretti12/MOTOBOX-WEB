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

  // ── 1. Intro de marca (solo portada, una vez por sesión) ──────────────────
  let heroSpring = null;

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

    window.addEventListener("scroll", () => {
      scrollP = clamp(window.scrollY / (hero.offsetHeight || 1), 0, 1);
      paint(heroSpring.values);
    }, { passive: true });

    const cue = document.createElement("span");
    cue.className = "mx-scroll-cue";
    cue.setAttribute("aria-hidden", "true");
    hero.appendChild(cue);

    if (!finePointer) return;
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
      heroSpring.set({ px: x - 0.5, py: y - 0.5 });
      glowSpring.set({ x: x, y: y });
    });
    hero.addEventListener("pointerleave", () => heroSpring.set({ px: 0, py: 0 }));
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
      if (visible) raf = requestAnimationFrame(tick);
    };
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) { last = performance.now(); lastY = window.scrollY; raf = requestAnimationFrame(tick); }
    }).observe(section);
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
    for (let i = 0; i < 14; i++) {
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
          ". Girá la ruleta, sumá chances extra y anotate por WhatsApp. No hace falta comprar nada.</p>" +
        '<ul class="mx-sorteo-facts"><li>Sin obligación de compra</li><li>Una participación por DNI</li><li>Fecha del sorteo: ' + fecha + "</li></ul>" +
        '<div class="mx-sorteo-actions">' +
          '<a href="sorteo.html" class="btn-hero-red mx-magnetic" data-rifa-open>Girar la ruleta</a>' +
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

    // El escenario gira con el puntero, con resorte.
    if (finePointer) {
      const stage = section.querySelector(".mx-stage");
      const rig = section.querySelector(".mx-stage-rig");
      const tilt = spring({ x: 0, y: 0 }, (t) => {
        rig.style.transform = "rotateX(" + (t.y * -10).toFixed(3) + "deg) rotateY(" + (t.x * 14).toFixed(3) + "deg)";
      }, 90, 14);
      section.addEventListener("pointermove", (e) => {
        const r = stage.getBoundingClientRect();
        tilt.set({
          x: clamp((e.clientX - (r.left + r.width / 2)) / r.width, -1, 1),
          y: clamp((e.clientY - (r.top + r.height / 2)) / r.height, -1, 1)
        });
      });
      section.addEventListener("pointerleave", () => tilt.set({ x: 0, y: 0 }));
    }
    return section;
  }

  // ── 6. Revelados ligados al scroll + barra de progreso ───────────────────
  function initScrub() {
    if (reduce) return;
    const bar = document.createElement("div");
    bar.className = "mx-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);

    // Cada bloque arranca recortado y redondeado y se abre a medida que entra.
    const scrubbed = [];
    document.querySelectorAll(".mx-sorteo:not(.mx-sorteo--compact)").forEach((el) => scrubbed.push({ el: el, maxClip: 6, maxRound: 40, minRound: 0 }));
    document.querySelectorAll(".promo-poster-card, .cta-strip-inner").forEach((el) => {
      el.classList.add("mx-scrub");
      scrubbed.push({ el: el, maxClip: 7, maxRound: 48, minRound: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 20, zoom: true });
    });

    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      const max = document.documentElement.scrollHeight - vh;
      bar.style.transform = "scaleX(" + (max > 0 ? clamp(window.scrollY / max, 0, 1) : 0).toFixed(4) + ")";
      scrubbed.forEach((s) => {
        const r = s.el.getBoundingClientRect();
        // k = 1 con el borde superior al fondo de la pantalla; 0 cuando llega al 35 %.
        const k = clamp((r.top - vh * 0.35) / (vh * 0.65), 0, 1);
        s.el.style.clipPath = "inset(" + (k * s.maxClip).toFixed(2) + "% round " + (s.minRound + k * (s.maxRound - s.minRound)).toFixed(1) + "px)";
        if (s.zoom) {
          const img = s.el.querySelector("img");
          if (img) img.style.transform = "scale(" + (1 + k * 0.18).toFixed(4) + ")";
        }
      });
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
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
    if (reduce || !("IntersectionObserver" in window)) return;
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
    const COUNT = small ? 54 : 110;
    let W = 0, H = 0;
    const resize = () => {
      const dpr = Math.min(small ? 1.25 : 1.6, window.devicePixelRatio || 1);
      W = hero.clientWidth;
      H = hero.clientHeight;
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const rand = (a, b) => a + Math.random() * (b - a);
    const cars = [];
    const spawn = (car, initial) => {
      const oncoming = Math.random() < 0.5;
      car.oncoming = oncoming;
      car.x = oncoming ? -rand(1.6, 6.4) : rand(1.6, 6.4);
      car.z = initial ? rand(2, FAR) : (oncoming ? FAR + rand(0, 40) : rand(1.5, 4));
      car.len = rand(5, 16);
      car.v = oncoming ? rand(55, 85) : rand(10, 26);
      car.gap = rand(0.28, 0.42);
      car.tone = oncoming ? (Math.random() < 0.8 ? "255,238,214" : "190,215,255") : (Math.random() < 0.75 ? "232,46,36" : "255,112,64");
      return car;
    };
    for (let i = 0; i < COUNT; i++) cars.push(spawn({}, true));

    // Estado de cámara: valores actuales, objetivos y velocidades (resorte).
    const cam = { x: 0, pitch: 0, roll: 0, speed: 1 };
    const goal = { x: 0, pitch: 0, roll: 0, speed: 1 };
    const vel = { x: 0, pitch: 0, roll: 0, speed: 0 };
    let dash = 0, running = false, raf = 0, last = 0, boost = 1, lastScroll = window.scrollY;

    if (finePointer) {
      hero.addEventListener("pointermove", (e) => {
        const r = hero.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        goal.x = px * 2.4;
        goal.pitch = py * -24;
        goal.roll = px * -0.05;
      });
      hero.addEventListener("pointerleave", () => { goal.x = 0; goal.pitch = 0; goal.roll = 0; });
    }
    // Mantener apretado (o el dedo) sobre el hero = acelerar.
    hero.addEventListener("pointerdown", (e) => { if (!e.target.closest("a, button")) boost = 4; });
    window.addEventListener("pointerup", () => { boost = 1; });
    window.addEventListener("pointercancel", () => { boost = 1; });
    hero.querySelectorAll(".btn-hero-red").forEach((b) => {
      b.addEventListener("pointerenter", () => { boost = 2.2; });
      b.addEventListener("pointerleave", () => { boost = 1; });
    });

    const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
      last = now;
      const sy = window.scrollY;
      const scrollBoost = clamp(Math.abs(sy - lastScroll) * 0.08, 0, 2.5);
      lastScroll = sy;
      goal.speed = boost + scrollBoost;
      for (const k in cam) {
        const stiff = k === "speed" ? 18 : 40, damp = k === "speed" ? 8 : 12;
        vel[k] += (stiff * (goal[k] - cam[k]) - damp * vel[k]) * dt;
        cam[k] += vel[k] * dt;
      }

      const f = H * 1.05 * (1 - clamp(cam.speed - 1, 0, 3) * 0.07);
      const cx = W / 2;
      // El horizonte queda debajo de los botones: las luces nunca pasan detrás del texto.
      const hy = H * (small ? 0.86 : 0.8) + cam.pitch;
      const proj = (x, y, z) => [cx + (x - cam.x) * f / z, hy + (CAM_H - y) * f / z];

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(cx, hy);
      ctx.rotate(cam.roll);
      ctx.translate(-cx, -hy);

      // Resplandor de la ciudad en el horizonte
      const glow = ctx.createRadialGradient(cx, hy, 0, cx, hy, W * 0.55);
      glow.addColorStop(0, "rgba(224,46,36,0.22)");
      glow.addColorStop(0.35, "rgba(224,46,36,0.07)");
      glow.addColorStop(1, "rgba(224,46,36,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, hy - W * 0.3, W, W * 0.6);

      ctx.globalCompositeOperation = "lighter";
      ctx.lineCap = "round";

      // Bordes de la ruta
      ctx.lineWidth = 1.2;
      [-7.6, 7.6].forEach((ex) => {
        const a = proj(ex, 0, 1.2), b = proj(ex, 0, FAR);
        const g = ctx.createLinearGradient(a[0], a[1], b[0], b[1]);
        g.addColorStop(0, "rgba(255,255,255,0.28)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.strokeStyle = g;
        line(a[0], a[1], b[0], b[1]);
      });
      // Línea central discontinua que corre hacia la cámara
      const travel = 34 * cam.speed;
      dash = (dash + travel * dt) % 9;
      for (let z = 9 - dash; z < FAR * 0.7; z += 9) {
        if (z < 3) continue;
        const a = proj(0, 0, z), b = proj(0, 0, z + 4);
        const alpha = 0.32 * (1 - z / (FAR * 0.7));
        ctx.strokeStyle = "rgba(255,255,255," + alpha.toFixed(3) + ")";
        ctx.lineWidth = clamp(0.16 * f / z, 0.6, 3);
        line(a[0], a[1], b[0], b[1]);
      }

      // Luces de los autos: halo ancho + núcleo brillante
      for (let i = 0; i < cars.length; i++) {
        const c = cars[i];
        c.z += (c.oncoming ? -(c.v + travel) : c.v * 2.2) * dt;
        if (c.oncoming && c.z < 1) spawn(c, false);
        else if (!c.oncoming && c.z > FAR) spawn(c, false);
        const z1 = Math.max(1, c.z), z2 = z1 + c.len * (0.6 + cam.speed * 0.4);
        const fade = clamp((z1 - 1) / 4, 0, 1) * clamp((FAR - z1) / (FAR * 0.35), 0, 1);
        if (fade <= 0.01) continue;
        const w = clamp(0.11 * f / z1, 0.5, 7);
        for (let s = -1; s <= 1; s += 2) {
          const lx = c.x + s * c.gap;
          const a = proj(lx, LIGHT_H, z1), b = proj(lx, LIGHT_H, z2);
          ctx.strokeStyle = "rgba(" + c.tone + "," + (0.1 * fade).toFixed(3) + ")";
          ctx.lineWidth = w * 4;
          line(a[0], a[1], b[0], b[1]);
          ctx.strokeStyle = "rgba(" + c.tone + "," + (0.85 * fade).toFixed(3) + ")";
          ctx.lineWidth = w;
          line(a[0], a[1], b[0], b[1]);
        }
      }
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";
      if (running) raf = requestAnimationFrame(frame);
    };

    const start = () => {
      if (running || document.hidden) return;
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
    document.addEventListener("visibilitychange", () => { if (document.hidden) stop(); else if (inView) start(); });

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
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = word.getBoundingClientRect();
      const vh = window.innerHeight;
      // p = 0 cuando asoma por abajo, 1 cuando está entero en pantalla.
      const p = clamp((vh - r.top) / r.height, 0, 1);
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

    const wa = (m) => "https://wa.me/5493516312930?text=" + encodeURIComponent("Hola Motobox! Quiero consultar por la " + m.marca + " " + m.modelo + " 0km que vi en el showroom de la web.");

    function layout() {
      const small = window.innerWidth < 700;
      W = small ? 200 : 300;
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
      tiltEl.style.transform = "rotateX(" + tiltNow.toFixed(2) + "deg)";
      for (let i = 0; i < items.length; i++) {
        let a = ((i * step + rot) % 360 + 540) % 360 - 180;
        const c = Math.cos(a * Math.PI / 180);
        items[i].style.opacity = (0.12 + 0.88 * Math.pow((c + 1) / 2, 2.2)).toFixed(3);
        items[i].classList.toggle("is-front", Math.abs(a) < step / 2);
      }
      const idx = ((Math.round(-rot / step) % N) + N) % N;
      const real = items[idx] ? Number(items[idx].dataset.i) : 0;
      if (real !== active || force) { active = real; showInfo(real, force); }
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
        if (mode === "rest" && !hover && visible && !reduce && now - idleAt > 3600) {
          target -= step; mode = "snap"; idleAt = now;
        }
      }
      tiltNow += (tiltGoal - tiltNow) * Math.min(1, dt * 6);
      paint(false);
      const busy = dragging || mode !== "rest" || Math.abs(tiltGoal - tiltNow) > 0.02;
      raf = (busy || (visible && !reduce)) ? requestAnimationFrame(frame) : 0;
    }
    function kick() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
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
    const section = document.createElement("section");
    section.className = "mx-story";
    section.innerHTML =
      '<div class="mx-story-sticky"><div class="container mx-story-grid">' +
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
            '<path d="' + arc(RAD) + '" class="mx-g-fill" pathLength="1000"/>' +
            ticks + '<g class="mx-g-labels">' + labels + "</g>" +
            '<g class="mx-g-needle"><path d="M196 205 L200 ' + (CY - RAD + 30) + ' L204 205 Z"/><circle cx="200" cy="205" r="13"/><circle cx="200" cy="205" r="5" class="mx-g-hub"/></g>' +
          "</svg>" +
          '<div class="mx-g-read"><b class="mx-g-speed">0</b><span>km/h</span></div>' +
          '<div class="mx-g-odo"><span>000000</span> km</div>' +
        "</div></div>" +
      "</div></div>";
    anchor.after(section);
    if (reduce) { section.classList.add("is-static"); return; }

    const needle = section.querySelector(".mx-g-needle");
    const fill = section.querySelector(".mx-g-fill");
    const speedEl = section.querySelector(".mx-g-speed");
    const gauge = section.querySelector(".mx-gauge");
    const stepEls = Array.from(section.querySelectorAll(".mx-step"));
    const bars = Array.from(section.querySelectorAll(".mx-story-bar i"));
    let cur = 0;
    const s = spring({ v: 0, p: 0 }, (t) => {
      const v = clamp(t.v, -4, MAX + 6);
      needle.style.transform = "rotate(" + (-120 + (v / MAX) * SWEEP).toFixed(2) + "deg)";
      fill.style.strokeDashoffset = (1000 - clamp(v / MAX, 0, 1) * 1000).toFixed(1);
      speedEl.textContent = Math.max(0, Math.round(v));
      gauge.style.transform = "rotateX(10deg) rotateY(" + (-16 + t.p * 32).toFixed(2) + "deg)";
    }, 90, 11);

    let ticking = false;
    const update = () => {
      ticking = false;
      const r = section.getBoundingClientRect();
      const total = section.offsetHeight - window.innerHeight;
      const p = clamp(-r.top / (total || 1), 0, 1);
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
    initSmoothScroll();
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
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
