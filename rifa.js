/**
 * MOTOBOX — Sorteo promocional
 * Popup que aparece al entrar a la web: premios, ruleta de chances extra y participación
 * por WhatsApp (gratis o con la compra del manual, siempre con las mismas chances).
 * Se configura con SORTEO_CONFIG (data.js). Las bases completas están en sorteo.html.
 */
(function () {
  "use strict";

  if (typeof SORTEO_CONFIG === "undefined" || !SORTEO_CONFIG || !SORTEO_CONFIG.activo) return;

  const C = SORTEO_CONFIG;
  const SEGS = Array.isArray(C.ruleta) ? C.ruleta.filter((s) => s && Number(s.valor) > 0) : [];
  const PRIZES = Array.isArray(C.premios) ? C.premios.filter((p) => p && p.nombre) : [];
  if (SEGS.length < 2 || !PRIZES.length) return;

  const SEG = 360 / SEGS.length;
  const MANUAL = C.manual || {};
  const SPIN_MS = 4800;
  const STEPS = ["intro", "wheel", "ticket"];
  const WA_NUMBER = typeof WHATSAPP_NUMBER !== "undefined" ? WHATSAPP_NUMBER : "5493516312930";
  const KEY = "motobox_sorteo_" + C.id;
  const desktopMq = window.matchMedia("(min-width: 900px)");
  const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");

  const state = { open: false, step: "intro", phase: "idle", rot: 0, prize: null, flipped: false };

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
  const chancesLabel = (n) => (n === 1 ? "1 chance" : n + " chances");
  const bonus = () => (state.prize !== null ? Number(SEGS[state.prize].valor) : 0);
  const fecha = C.fechaSorteo ? String(C.fechaSorteo) : "a confirmar";
  const prizeNames = PRIZES.map((p) => p.nombre);
  const prizeList = prizeNames.length > 1 ? prizeNames.slice(0, -1).join(", ") + " y " + prizeNames[prizeNames.length - 1] : prizeNames[0];

  function pickPrize() {
    const weights = SEGS.map((s) => Math.max(0, Number(s.peso) || 0));
    const sum = weights.reduce((a, b) => a + b, 0);
    if (!sum) return Math.floor(Math.random() * SEGS.length);
    let r = Math.random() * sum;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }
  // Avance de cubic-bezier(0.23, 1, 0.32, 1) en el tiempo t: la misma curva que usa la transición del disco.
  function easeOut(t) {
    let lo = 0, hi = 1, s = t;
    for (let i = 0; i < 24; i++) {
      s = (lo + hi) / 2;
      const x = 3 * (1 - s) * (1 - s) * s * 0.23 + 3 * (1 - s) * s * s * 0.32 + s * s * s;
      if (x < t) lo = s; else hi = s;
    }
    return 1 - Math.pow(1 - s, 3);
  }

  // --- Markup ---
  const title = esc(C.titulo || "Ganate una moto 0km");
  const manualTxt = MANUAL.nombre ? esc(MANUAL.nombre) + (MANUAL.precio ? " (" + money(MANUAL.precio) + ")" : "") : "";
  const legal = '<strong>Sin obligación de compra.</strong> <a href="' + esc(C.basesUrl || "sorteo.html") + '">Bases y condiciones</a>';

  const ICON_BACK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  const ICON_CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_MOTO = '<svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="5.5" cy="16.5" r="3.5"/><circle cx="18.5" cy="16.5" r="3.5"/><path d="M5.5 16.5l4-7h4l3 7"/><path d="M13.5 9.5l1.5-3h2.5"/><path d="M9 9.5H6.5"/></svg>';

  const prizeCards = PRIZES.slice(0, 2).map((p, i) =>
    '<div class="rf-prize-card rf-prize-card--' + (i + 1) + '">' +
      (p.imagen
        ? '<img src="' + esc(p.imagen) + '" alt="' + esc(p.nombre) + ' 0km">'
        : '<div class="rf-prize-ph">' + ICON_MOTO + "</div>") +
      '<span class="rf-prize-name">' + esc(p.nombre) + "</span>" +
      (i === PRIZES.length - 1 || i === 1 ? '<div class="rf-glare"></div><div class="rf-sheen"></div>' : "") +
    "</div>"
  ).join("");

  const segColors = SEGS.map((_, i) => (SEGS.length % 2 === 1 && i === SEGS.length - 1 ? "#3a3a3c" : i % 2 ? "#1d1d1f" : "#e02e24"));
  const discBg = "conic-gradient(" + segColors.map((c, i) => c + " " + (i * SEG).toFixed(3) + "deg " + ((i + 1) * SEG).toFixed(3) + "deg").join(", ") + ")";
  const labelsHtml = SEGS.map((s, i) =>
    '<div class="rf-label" style="--a:' + (i * SEG + SEG / 2).toFixed(3) + 'deg"><b>+' + Number(s.valor) + "</b><small>" + (Number(s.valor) === 1 ? "CHANCE" : "CHANCES") + "</small></div>"
  ).join("");
  const pegsHtml = SEGS.map((_, i) => '<i class="rf-peg" style="--a:' + (i * SEG).toFixed(3) + 'deg"></i>').join("");
  let bulbsHtml = "";
  for (let i = 0; i < 16; i++) {
    bulbsHtml += '<i class="rf-bulb" style="--a:' + i * 22.5 + "deg;--d:" + (i % 2 ? "-0.8s" : "0s") + ";--dc:-" + i * 40 + 'ms"></i>';
  }
  const maxBonus = Math.max(...SEGS.map((s) => Number(s.valor)));

  const root = document.createElement("div");
  root.className = "rf";
  root.hidden = true;
  root.style.setProperty("--seg", SEG + "deg");
  root.innerHTML = `
    <div class="rf-scrim" data-rf-close></div>
    <div class="rf-dialog" role="dialog" aria-modal="true" aria-labelledby="rf-title" tabindex="-1">
      <div class="rf-grabber" aria-hidden="true"></div>
      <div class="rf-top">
        <button type="button" class="rf-icon-btn" data-rf-back aria-label="Volver">${ICON_BACK}</button>
        <div class="rf-progress" aria-hidden="true"><span></span><span></span><span></span></div>
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
          <p class="rf-sub">Sorteamos ${esc(prizeList)} 0km. Participás gratis${manualTxt ? " o con la compra del " + manualTxt : ""}, con las mismas chances.</p>
        </div>
        <div class="rf-stats rf-st rf-d2">
          <div class="rf-stat"><strong>${PRIZES.length}</strong><span>${PRIZES.length === 1 ? "moto 0km" : "motos 0km"}</span></div>
          <div class="rf-stat"><strong>Gratis</strong><span>sin obligación de compra</span></div>
          <div class="rf-stat"><strong>${C.fechaSorteo ? esc(C.fechaSorteo) : "A confirmar"}</strong><span>fecha del sorteo</span></div>
        </div>
        <p class="rf-legal rf-legal--desk">${legal}</p>
      </aside>

      <div class="rf-steps">
        <section class="rf-step" data-step="intro">
          <div class="rf-cta-block rf-st rf-d3">
            <button type="button" class="rf-btn rf-btn-red rf-btn-shine" data-rf-go="wheel"><span>Girar la ruleta y participar</span></button>
            <p class="rf-caption">Girá gratis y sumá hasta ${maxBonus} chances extra para el sorteo.</p>
            <p class="rf-legal">${legal}</p>
          </div>
        </section>

        <section class="rf-step" data-step="wheel">
          <div class="rf-head">
            <h3 class="rf-h">Girá la ruleta</h3>
            <p class="rf-p">Un giro por persona. Las chances que ganes se suman a tu participación.</p>
          </div>
          <div class="rf-wheel-area">
            <div class="rf-glow" data-rf-glow></div>
            <div class="rf-floor"></div>
            <div class="rf-wheel-persp">
              <div class="rf-wheel-tilt is-idle" data-rf-wheel>
                <div class="rf-wheel-base"></div>
                <div class="rf-wheel-ring"></div>
                ${bulbsHtml}
                <div class="rf-disc" data-rf-disc style="background:${discBg}">${labelsHtml}${pegsHtml}</div>
                <div class="rf-wedge"></div>
                <div class="rf-hub" aria-hidden="true"><span>M</span>B</div>
                <div class="rf-confetti" data-rf-confetti></div>
              </div>
            </div>
            <div class="rf-pointer" data-rf-pointer aria-hidden="true"><i></i><em></em><b></b></div>
          </div>
          <div class="rf-wheel-actions" data-rf-actions>
            <button type="button" class="rf-btn rf-btn-red rf-btn-shine" data-rf-spin><span>Girar la ruleta</span></button>
            <p class="rf-note">Girar es gratis. Podés ganar de +1 a +${maxBonus} chances.</p>
          </div>
          <div class="rf-result" data-rf-result aria-live="polite" hidden>
            <div class="rf-result-row">
              <div class="rf-badge" data-rf-badge></div>
              <div>
                <p class="rf-result-title" data-rf-result-title></p>
                <p class="rf-result-desc">Se suman a tu participación en el sorteo.</p>
              </div>
            </div>
            <button type="button" class="rf-btn rf-btn-white" data-rf-go="ticket">Ver mi participación</button>
          </div>
        </section>

        <section class="rf-step" data-step="ticket">
          <div class="rf-head">
            <h3 class="rf-h">Tu participación</h3>
            <p class="rf-p">Tocá el ticket para ver el dorso.</p>
          </div>
          <div class="rf-ticket-stage">
            <div class="rf-ticket-deal">
              <div class="rf-ticket-tilt" data-rf-ticket-tilt>
                <div class="rf-ticket-flip" data-rf-flip>
                  <div class="rf-tk-face rf-tk-front">
                    <div class="rf-tk-top"><span class="rf-tk-brand"><em>Moto</em>Box</span><span class="rf-tk-id">SORTEO N.º ${esc(C.id)}</span></div>
                    <p class="rf-tk-meta">${esc(prizeNames.join(" · "))}</p>
                    <p class="rf-tk-chances"><strong data-rf-tk-chances></strong><span data-rf-tk-chances-label></span></p>
                    <div class="rf-tk-perf"><i></i><i></i></div>
                    <div class="rf-tk-bottom">
                      <div><small>Ruleta</small><strong data-rf-tk-bonus></strong></div>
                      <div class="rf-tk-right"><small>Fecha del sorteo</small><strong>${esc(fecha.charAt(0).toUpperCase() + fecha.slice(1))}</strong></div>
                    </div>
                    <div class="rf-glare"></div>
                    <div class="rf-sheen"></div>
                  </div>
                  <div class="rf-tk-face rf-tk-back">
                    <div class="rf-tk-back-list">
                      <p class="rf-tk-small">BASES (RESUMEN)</p>
                      <p>Participación gratuita, sin obligación de compra.</p>
                      <p>Una participación por persona. Comprando o gratis, las mismas chances.</p>
                      <p>Premios: ${esc(prizeList)} 0km.</p>
                      <p>Fecha del sorteo: ${esc(fecha)}.</p>
                    </div>
                    <div class="rf-tk-back-foot"><span>Bases completas en la web</span><span>Sorteo N.º ${esc(C.id)}</span></div>
                  </div>
                </div>
                <button type="button" class="rf-ticket-hit" data-rf-flip-btn aria-label="Dar vuelta el ticket"></button>
              </div>
            </div>
          </div>
          <div class="rf-summary">
            <div><span>Participación</span><span>1 chance</span></div>
            <div class="rf-sum-benefit"><span>Ruleta</span><span data-rf-s-bonus></span></div>
            <div class="rf-sum-total"><span>Total</span><span data-rf-s-total></span></div>
          </div>
          <div class="rf-next">
            <p class="rf-next-title">Elegí cómo participar</p>
            <p class="rf-next-note">Las dos opciones suman exactamente las mismas chances.</p>
          </div>
          <div class="rf-ticket-actions">
            ${MANUAL.nombre ? '<a class="rf-btn rf-btn-red" data-rf-wa-buy href="#" target="_blank" rel="noopener">Comprar el manual' + (MANUAL.precio ? " · " + money(MANUAL.precio) : "") + "</a>" : ""}
            <a class="rf-btn rf-btn-outline" data-rf-wa-free href="#" target="_blank" rel="noopener">Participar gratis</a>
            <p class="rf-legal">${legal}</p>
          </div>
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
        <span class="rf-pill-title">${PRIZES.length === 1 ? "1 moto 0km" : PRIZES.length + " motos 0km"} · participá gratis</span>
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
  const wheel = $("[data-rf-wheel]");
  const disc = $("[data-rf-disc]");
  const pointer = $("[data-rf-pointer]");
  const glow = $("[data-rf-glow]");
  const confetti = $("[data-rf-confetti]");
  const spinBtn = $("[data-rf-spin]");
  const actions = $("[data-rf-actions]");
  const result = $("[data-rf-result]");
  const flip = $("[data-rf-flip]");

  const timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  // --- Navegación entre pasos ---
  function firstStep() { return desktopMq.matches ? "wheel" : "intro"; }

  function go(step, dir) {
    if (STEPS.indexOf(step) < 0) return;
    if (step === "intro" && desktopMq.matches) step = "wheel";
    if (step === "ticket" && state.prize === null) step = "wheel";
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
    backBtn.classList.toggle("is-hidden", idx <= STEPS.indexOf(firstStep()));
    resetTilt();
    if (step === "wheel") renderWheel(false);
    if (step === "ticket") renderTicket();
    dialog.scrollTop = 0;
    stepsBox.scrollTop = 0;
  }

  function back() {
    const idx = STEPS.indexOf(state.step);
    if (idx > STEPS.indexOf(firstStep())) go(STEPS[idx - 1], "back");
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
    go(state.prize === null ? firstStep() : "ticket");
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

  // --- Ruleta ---
  function setRotation(deg, transition) {
    state.rot = deg;
    disc.style.transition = transition;
    disc.style.transform = "translateZ(1px) rotate(" + deg.toFixed(2) + "deg)";
  }

  function renderWheel(celebrate) {
    const p = state.phase;
    wheel.classList.toggle("is-idle", p === "idle");
    wheel.classList.toggle("is-spinning", p === "windup" || p === "spin");
    wheel.classList.toggle("is-won", p === "won" && !!celebrate);
    glow.classList.toggle("is-on", p === "spin");
    glow.classList.toggle("is-half", p === "won");
    actions.hidden = p === "won";
    spinBtn.disabled = p !== "idle";
    spinBtn.firstElementChild.textContent = p === "idle" ? "Girar la ruleta" : "Girando…";
    result.hidden = p !== "won";
    if (p === "won" && state.prize !== null) {
      const n = bonus();
      $("[data-rf-badge]").textContent = "+" + n;
      $("[data-rf-result-title]").textContent = "¡Ganaste +" + chancesLabel(n) + "!";
    }
  }

  function spin() {
    if (state.phase !== "idle") return;
    const k = pickPrize();
    const center = k * SEG + SEG / 2;
    const base = state.rot - (state.rot % 360);
    const target = base + 360 * 6 + (360 - center) % 360 + (Math.random() - 0.5) * SEG * 0.55;
    if (reduceMq.matches) {
      setRotation(target, "none");
      win(k);
      return;
    }
    // Anticipación: un pequeño tirón hacia atrás antes del giro.
    const from = state.rot - 10;
    state.phase = "windup";
    renderWheel(false);
    setRotation(from, "transform 180ms var(--rf-ease-out)");
    later(() => {
      state.phase = "spin";
      renderWheel(false);
      setRotation(target, "transform " + SPIN_MS + "ms var(--rf-ease-out)");
      runFlapper(from, target);
      later(() => win(k), SPIN_MS + 60);
    }, 190);
  }

  function win(k) {
    state.phase = "won";
    state.prize = k;
    writeKey("localStorage", KEY + "_premio", String(k));
    pointer.style.transform = "";
    renderWheel(true);
    burstConfetti();
  }

  // La flecha es una lengüeta: cada separador del borde la empuja y vuelve a su lugar cuando pasa.
  let flapRaf = 0;
  function runFlapper(from, to) {
    cancelAnimationFrame(flapRaf);
    const push = SEG * 0.31, release = SEG * 0.13;
    let start = null, lastR = from, lastNow = 0;
    const frame = (now) => {
      if (start === null) { start = now; lastNow = now; }
      const t = Math.min(1, (now - start) / SPIN_MS);
      const r = from + (to - from) * easeOut(t);
      const speed = ((r - lastR) / Math.max(1, now - lastNow)) * 1000;
      lastR = r;
      lastNow = now;
      const u = ((r % SEG) + SEG) % SEG;
      const ahead = SEG - u;
      let angle = 0;
      if (speed > 700) angle = -18 - Math.random() * 6;
      else if (ahead < push) angle = -26 * (1 - ahead / push);
      else if (u < release) angle = 5 * (1 - u / release);
      pointer.style.transform = "rotate(" + angle.toFixed(2) + "deg)";
      if (t < 1) flapRaf = requestAnimationFrame(frame);
      else pointer.style.transform = "";
    };
    flapRaf = requestAnimationFrame(frame);
  }

  function burstConfetti() {
    if (reduceMq.matches) return;
    const colors = ["#e02e24", "#ffc940", "#ff8a82", "#1d1d1f"];
    let html = "";
    for (let i = 0; i < 28; i++) {
      const a = Math.round(i * (360 / 28) + ((i * 53) % 17) - 8);
      html += '<i class="rf-cf rf-cf' + (1 + (i % 3)) + '" style="--a:' + a + "deg;--c:" + colors[i % 4] + ";--w:" + (i % 2 ? 6 : 8) + "px;--h:" + (i % 2 ? 10 : 6) + "px;--d:" + (i % 5) * 18 + 'ms"></i>';
    }
    confetti.innerHTML = html;
    later(() => { confetti.innerHTML = ""; }, 1600);
  }

  // --- Ticket de participación ---
  function renderTicket() {
    const n = bonus();
    const total = 1 + n;
    countUp($("[data-rf-tk-chances]"), total);
    $("[data-rf-tk-chances-label]").textContent = total === 1 ? "chance" : "chances";
    $("[data-rf-tk-bonus]").textContent = "+" + chancesLabel(n);
    $("[data-rf-s-bonus]").textContent = "+" + chancesLabel(n);
    $("[data-rf-s-total]").textContent = chancesLabel(total);
    const prizeTxt = "En la ruleta gané +" + chancesLabel(n) + " (total: " + chancesLabel(total) + ").";
    const buy = $("[data-rf-wa-buy]");
    if (buy) {
      buy.href = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(
        "Hola Motobox! Quiero comprar el " + (MANUAL.nombre || "manual") + (MANUAL.precio ? " (" + money(MANUAL.precio) + ")" : "") +
        " y participar del Sorteo N.º " + C.id + ". " + prizeTxt + " Mi nombre y DNI: ");
    }
    $("[data-rf-wa-free]").href = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(
      "Hola Motobox! Quiero participar gratis del Sorteo N.º " + C.id + ". " + prizeTxt + " Mi nombre y DNI: ");
    state.flipped = false;
    flip.classList.remove("is-flipped");
  }

  // El número grande del ticket cuenta hasta el total de chances.
  let countRaf = 0;
  function countUp(el, to) {
    cancelAnimationFrame(countRaf);
    if (reduceMq.matches || to <= 1) { el.textContent = String(to); return; }
    let start = null;
    const frame = (now) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start - 350) / 650);
      el.textContent = String(t <= 0 ? 1 : Math.max(1, Math.round(1 + (to - 1) * (1 - Math.pow(1 - t, 3)))));
      if (t < 1) countRaf = requestAnimationFrame(frame);
    };
    el.textContent = "1";
    countRaf = requestAnimationFrame(frame);
  }

  function toggleFlip() {
    state.flipped = !state.flipped;
    flip.classList.toggle("is-flipped", state.flipped);
  }

  // --- Inclinación 3D con resorte (tarjetas de premios y ticket, solo con mouse) ---
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
      if (done) {
        spring.x = spring.tx;
        spring.y = spring.ty;
        spring.vx = spring.vy = 0;
      }
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
    const t = e.target.closest("[data-rf-close], [data-rf-back], [data-rf-go], [data-rf-spin], [data-rf-flip-btn]");
    if (!t || !root.contains(t)) return;
    if (t.hasAttribute("data-rf-close")) close();
    else if (t.hasAttribute("data-rf-back")) back();
    else if (t.hasAttribute("data-rf-go")) { if (!t.disabled) go(t.getAttribute("data-rf-go"), "fwd"); }
    else if (t.hasAttribute("data-rf-spin")) spin();
    else if (t.hasAttribute("data-rf-flip-btn")) toggleFlip();
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
    const focusables = Array.from(dialog.querySelectorAll("a[href], button:not([disabled])")).filter((el) => el.offsetParent !== null);
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

  const onBreakpoint = () => { if (state.open) go(state.step); };
  if (desktopMq.addEventListener) desktopMq.addEventListener("change", onBreakpoint);
  else if (desktopMq.addListener) desktopMq.addListener(onBreakpoint);

  // --- Inicio ---
  function init() {
    document.body.appendChild(root);
    document.body.appendChild(pill);

    const storedRaw = readKey("localStorage", KEY + "_premio");
    const stored = Number(storedRaw);
    if (storedRaw !== null && Number.isInteger(stored) && SEGS[stored]) {
      state.prize = stored;
      state.phase = "won";
      setRotation((360 - (stored * SEG + SEG / 2)) % 360, "none");
    }
    renderWheel(false);
    bindTilt($("[data-rf-tilt-hit]"), $("[data-rf-tilt]"));
    bindTilt($("[data-rf-flip-btn]"), $("[data-rf-ticket-tilt]"));

    if (window.location.hash === "#sorteo") {
      writeKey("sessionStorage", KEY + "_visto", "1");
      later(open, 300);
    } else if (document.body.dataset.page === "sorteo") {
      // En la página de bases no se abre solo: se abre con el botón "Participar".
    } else if (readKey("sessionStorage", KEY + "_visto") !== "1") {
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
