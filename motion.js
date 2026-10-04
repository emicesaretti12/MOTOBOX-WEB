/**
 * MOTOBOX — Capa de animaciones (motion.js)
 * Intro de marca, hero con profundidad, cinta de marcas, escenario 3D del sorteo,
 * revelados ligados al scroll, tarjetas en 3D y botones magnéticos.
 * Con prefers-reduced-motion no se anima nada: todo queda en su estado final.
 */
(function () {
  "use strict";

  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  const page = document.body.dataset.page || "";
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  const BRANDS = ["Honda", "Yamaha", "Suzuki", "Kawasaki", "Bajaj", "KTM", "Royal Enfield", "Benelli", "Voge", "TVS",
    "Hero", "Motomel", "Keller", "Zanella", "Corven", "Gilera", "Guerrero", "Mondial", "Beta", "Brava"];

  const ICON_MOTO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5l4-7h4l3 7"/><path d="M13.5 9.5l1.5-3h2.5"/><path d="M9 9.5H6.5"/></svg>';

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ── 1. Intro de marca (solo portada, una vez por sesión) ──────────────────
  function runIntro() {
    if (!root.classList.contains("mx-intro-on")) return;
    const done = () => {
      root.classList.remove("mx-intro-on");
      document.dispatchEvent(new CustomEvent("motobox:intro-done"));
    };
    if (reduce) { done(); return; }

    const word = "MOTOBOX";
    const chars = word.split("").map((c, i) =>
      '<span class="mx-intro-char' + (i < 4 ? " mx-intro-char--red" : "") + '" style="--i:' + i + '">' + c + "</span>"
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
      // La foto del hero baja de 1.3x a su escala normal mientras sube la cortina.
      const hero = document.querySelector(".simple-hero");
      if (hero) hero.style.setProperty("--mx-hero-t", "1.6s");
      root.classList.remove("mx-intro-on");
      setTimeout(() => {
        document.dispatchEvent(new CustomEvent("motobox:intro-done"));
        if (hero) hero.classList.add("mx-hero-live");
      }, 450);
      el.addEventListener("transitionend", (e) => { if (e.target === el) el.remove(); });
      setTimeout(() => el.remove(), 1400);
    };
    const timer = setTimeout(leave, 1750);
    el.addEventListener("click", leave);
    window.addEventListener("keydown", leave, { once: true });
  }

  // ── 2. Hero con profundidad ──────────────────────────────────────────────
  function initHero() {
    const hero = document.querySelector('[data-page="home"] .simple-hero');
    if (!hero || reduce) return;
    if (!root.classList.contains("mx-intro-on")) hero.classList.add("mx-hero-live");

    const cue = document.createElement("span");
    cue.className = "mx-scroll-cue";
    cue.setAttribute("aria-hidden", "true");
    hero.appendChild(cue);

    if (!finePointer) return;
    const glow = document.createElement("div");
    glow.className = "mx-hero-glow";
    glow.setAttribute("aria-hidden", "true");
    hero.insertBefore(glow, hero.querySelector(".simple-hero-content"));

    let raf = 0;
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      const y = (e.clientY - r.top) / r.height;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        hero.style.setProperty("--mx-px", (x - 0.5).toFixed(3));
        hero.style.setProperty("--mx-py", (y - 0.5).toFixed(3));
        hero.style.setProperty("--mx-gx", (x * 100).toFixed(1) + "%");
        hero.style.setProperty("--mx-gy", (y * 100).toFixed(1) + "%");
      });
    });
    hero.addEventListener("pointerleave", () => {
      hero.style.setProperty("--mx-px", "0");
      hero.style.setProperty("--mx-py", "0");
    });
  }

  // ── 3. Cinta de marcas (velocidad según el scroll) ───────────────────────
  function buildMarquee() {
    const hero = document.querySelector('[data-page="home"] .simple-hero');
    if (!hero) return;
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
    hero.after(section);
    if (reduce) return;

    const rows = Array.from(section.querySelectorAll(".mx-marquee-row")).map((row, i) => ({
      el: row, x: 0, dir: i % 2 ? 1 : -1, width: row.firstElementChild.offsetWidth
    }));
    const measure = () => rows.forEach((r) => { r.width = r.el.firstElementChild.offsetWidth; });
    window.addEventListener("resize", measure);

    let visible = false, lastY = window.scrollY, boost = 0, last = performance.now(), raf = 0;
    const tick = (now) => {
      const dt = Math.min(64, now - last);
      last = now;
      const y = window.scrollY;
      const v = y - lastY;
      lastY = y;
      boost += (clamp(v * 0.9, -40, 40) - boost) * 0.12;
      const speed = 0.045 * dt;
      rows.forEach((r) => {
        if (!r.width) return;
        r.x += r.dir * (speed + Math.abs(boost) * 0.35);
        if (r.x <= -r.width) r.x += r.width;
        if (r.x > 0) r.x -= r.width;
        const skew = clamp(boost * 0.25, -8, 8) * r.dir * -1;
        r.el.style.transform = "translate3d(" + r.x.toFixed(2) + "px,0,0) skewX(" + skew.toFixed(2) + "deg)";
      });
      if (visible) raf = requestAnimationFrame(tick);
    };
    rows.forEach((r) => { if (r.dir > 0) r.x = -r.width / 2; });
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      cancelAnimationFrame(raf);
      if (visible) { last = performance.now(); lastY = window.scrollY; raf = requestAnimationFrame(tick); }
    }).observe(section);
  }

  // ── 4. Escenario 3D del sorteo en la portada ─────────────────────────────
  function buildSorteo() {
    const C = typeof SORTEO_CONFIG !== "undefined" ? SORTEO_CONFIG : null;
    const anchor = document.getElementById("promo-poster-section");
    if (!C || !C.activo || page !== "home" || !anchor) return;
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

    const section = document.createElement("section");
    section.className = "mx-sorteo" + (reduce ? "" : " mx-pre");
    section.id = "sorteo-home";
    section.innerHTML =
      '<div class="container"><div class="mx-sorteo-grid">' +
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
        "</div>" +
        '<div class="mx-stage" aria-hidden="true"><div class="mx-stage-rig">' + prizeHtml + '<div class="mx-stage-floor"></div>' + sparks + "</div></div>" +
      "</div></div>";
    anchor.before(section);
    if (reduce) return;

    new IntersectionObserver((entries, io) => {
      if (!entries[0].isIntersecting) return;
      section.classList.remove("mx-pre");
      io.disconnect();
    }, { threshold: 0.25 }).observe(section);

    if (finePointer) {
      const stage = section.querySelector(".mx-stage");
      section.addEventListener("pointermove", (e) => {
        const r = stage.getBoundingClientRect();
        stage.style.setProperty("--mx-tx", clamp((e.clientX - (r.left + r.width / 2)) / r.width, -1, 1).toFixed(3));
        stage.style.setProperty("--mx-ty", clamp((e.clientY - (r.top + r.height / 2)) / r.height, -1, 1).toFixed(3));
      });
      section.addEventListener("pointerleave", () => {
        stage.style.setProperty("--mx-tx", "0");
        stage.style.setProperty("--mx-ty", "0");
      });
    }
  }

  // ── 5. Revelados ligados al scroll + barra de progreso ───────────────────
  function initScrub() {
    if (reduce) return;
    const bar = document.createElement("div");
    bar.className = "mx-progress";
    bar.setAttribute("aria-hidden", "true");
    document.body.appendChild(bar);

    // El bloque arranca recortado y con esquinas redondeadas y se abre a medida que entra.
    const scrubbed = [];
    const sorteo = document.querySelector(".mx-sorteo");
    if (sorteo) scrubbed.push({ el: sorteo, maxClip: 6, maxRound: 40, minRound: 0 });
    const poster = document.querySelector(".promo-poster-card");
    if (poster) { poster.classList.add("mx-scrub"); scrubbed.push({ el: poster, maxClip: 7, maxRound: 48, minRound: 24, zoom: true }); }

    let ticking = false;
    const update = () => {
      ticking = false;
      const vh = window.innerHeight;
      const max = document.documentElement.scrollHeight - vh;
      bar.style.setProperty("--mx-scroll", max > 0 ? (window.scrollY / max).toFixed(4) : "0");
      scrubbed.forEach((s) => {
        const r = s.el.getBoundingClientRect();
        // k = 1 cuando el borde superior está en el fondo de la pantalla, 0 cuando llega al 35 %.
        const k = clamp((r.top - vh * 0.35) / (vh * 0.65), 0, 1);
        s.el.style.setProperty("--mx-clip", (k * s.maxClip).toFixed(2) + "%");
        s.el.style.setProperty("--mx-round", (s.minRound + k * (s.maxRound - s.minRound)).toFixed(1) + "px");
        if (s.zoom) s.el.style.setProperty("--mx-k", k.toFixed(3));
      });
    };
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    update();
  }

  // ── 6. Títulos que suben desde una máscara ───────────────────────────────
  function initMasks() {
    if (reduce || !("IntersectionObserver" in window)) return;
    const sel = [".simple-catalog-title", ".promo-poster-title", ".section-header h2", ".catalog-hero h1", ".bases-hero h1"];
    // Se observa al contenedor: el recorte del propio título no debe frenar su aparición.
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.querySelectorAll(":scope > .mx-mask.mx-pre").forEach((t) => t.classList.remove("mx-pre"));
        io.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    document.querySelectorAll(sel.join(",")).forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;
      el.classList.add("mx-mask", "mx-pre");
      io.observe(el.parentElement);
    });
  }

  // ── 7. Tarjetas de motos: entran en 3D recién cuando aparecen ───────────
  function initCards() {
    if (reduce || !("IntersectionObserver" in window)) return;
    let batch = 0, batchTimer = 0;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const card = e.target;
        io.unobserve(card);
        card.style.animationDelay = Math.min(batch, 5) * 80 + "ms";
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
      new MutationObserver(() => grid.querySelectorAll(".moto-card-modern").forEach(hold))
        .observe(grid, { childList: true });
    });
  }

  // ── 8. Botones magnéticos (solo con mouse) ───────────────────────────────
  function initMagnetic() {
    if (reduce || !finePointer) return;
    // Se suma "translate" a la transición que ya tenga cada botón, sin pisar su hover.
    const prep = (b) => {
      if (b.dataset.mxMag) return;
      b.dataset.mxMag = "1";
      const t = getComputedStyle(b).transition;
      b.style.transition = (t && t !== "all 0s ease 0s" ? t + ", " : "") + "translate 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)";
    };
    document.querySelectorAll(".btn-hero-red, .btn-hero-outline, .btn-promo-whatsapp, .mx-magnetic").forEach((b) => b.classList.add("mx-magnetic"));
    document.addEventListener("pointermove", (e) => {
      const b = e.target.closest && e.target.closest(".mx-magnetic");
      if (!b) return;
      prep(b);
      const r = b.getBoundingClientRect();
      const x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      const y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      b.style.translate = (x * 6).toFixed(1) + "px " + (y * 5).toFixed(1) + "px";
    });
    document.addEventListener("pointerout", (e) => {
      const b = e.target.closest && e.target.closest(".mx-magnetic");
      if (!b || b.contains(e.relatedTarget)) return;
      b.style.translate = "0px 0px";
    });
  }

  function init() {
    runIntro();
    initHero();
    buildMarquee();
    buildSorteo();
    initScrub();
    initMasks();
    initCards();
    initMagnetic();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
