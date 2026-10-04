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
    document.querySelectorAll(".simple-catalog-title, .promo-poster-title, .section-header h2, .cta-strip-inner h3").forEach((el) => {
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

  // ── Armado por página ────────────────────────────────────────────────────
  function buildSections() {
    if (page === "home") {
      buildMarquee($(".simple-hero"), "after");
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
    runIntro();
    initHero();
    initPageEntrance();
    buildSections();
    initScrub();
    initReveals();
    initCards();
    initMagnetic();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
