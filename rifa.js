/**
 * MOTOBOX — Rifa
 * Popup que aparece al entrar a la web: presentación del premio, ruleta de beneficios,
 * elección de números y reserva por WhatsApp. Se configura con RIFA_CONFIG (data.js).
 *
 * Si existe la tabla "rifa_numeros" en Supabase (ver supabase/rifa_numeros.sql), los números
 * reservados y vendidos se leen de ahí y se actualizan en vivo. Si no existe, todos los números
 * figuran libres y no se muestran cifras de venta.
 */
(function () {
  "use strict";

  if (typeof RIFA_CONFIG === "undefined" || !RIFA_CONFIG || !RIFA_CONFIG.activo) return;

  const C = RIFA_CONFIG;
  const SEGS = Array.isArray(C.ruleta) ? C.ruleta.filter((s) => s && s.texto) : [];
  if (SEGS.length < 2) return;

  const SEG = 360 / SEGS.length;
  const TOTAL = Math.max(1, Math.floor(Number(C.totalNumeros) || 1000));
  const DIGITS = Math.max(2, String(TOTAL - 1).length);
  const PRICE = Math.max(0, Number(C.precioNumero) || 0);
  const RANGE_SIZE = 100;
  const RANGE_COUNT = Math.ceil(TOTAL / RANGE_SIZE);
  const SPIN_MS = 4800;
  const STEPS = ["intro", "wheel", "numbers", "ticket"];
  const WA_NUMBER = typeof WHATSAPP_NUMBER !== "undefined" ? WHATSAPP_NUMBER : "5493516312930";
  const KEY = "motobox_rifa_" + C.id;
  const desktopMq = window.matchMedia("(min-width: 900px)");
  const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");

  const state = {
    open: false,
    step: "intro",
    phase: "idle", // idle | windup | spin | won
    rot: 0,
    prize: null,
    mine: [],
    range: 0,
    sold: new Set(),
    hasSales: false,
    flipped: false
  };

  // --- Helpers ---
  function readKey(kind, key) {
    try { return window[kind] ? window[kind].getItem(key) : null; } catch (e) { return null; }
  }
  function writeKey(kind, key, value) {
    try { if (window[kind]) window[kind].setItem(key, value); } catch (e) { /* almacenamiento bloqueado */ }
  }
  const pad = (n) => String(n).padStart(DIGITS, "0");
  const fmt = (x) => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const money = (x) => "$" + fmt(x);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const numbersLabel = (n) => (n === 1 ? "1 número" : n + " números");

  function prizeTitle(s) {
    if (s.tipo === "descuento") return s.valor + "% OFF";
    if (s.tipo === "regalo") return s.valor === 1 ? "+1 número gratis" : "+" + s.valor + " números gratis";
    if (s.tipo === "2x1") return "2x1 en números";
    return String(s.texto);
  }
  function prizeDesc(s) {
    if (s.tipo === "descuento") return "Se descuenta del total de tus números.";
    if (s.tipo === "regalo") return s.valor === 1 ? "Te regalamos 1 número extra al azar." : "Te regalamos " + s.valor + " números extra al azar.";
    if (s.tipo === "2x1") return "Pagás la mitad de los números que elijas.";
    return "";
  }
  function prizesNote() {
    const parts = [];
    const maxOff = Math.max(0, ...SEGS.filter((s) => s.tipo === "descuento").map((s) => Number(s.valor) || 0));
    if (maxOff) parts.push("hasta " + maxOff + "% OFF");
    if (SEGS.some((s) => s.tipo === "2x1")) parts.push("2x1");
    if (SEGS.some((s) => s.tipo === "regalo")) parts.push("números de regalo");
    if (!parts.length) return "";
    const last = parts.pop();
    return "Premios: " + (parts.length ? parts.join(", ") + " o " + last : last) + ".";
  }
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
  const title = esc(C.titulo || "Ganate esta moto 0km");
  const sorteoTxt = [C.modalidad ? "con la " + C.modalidad : "", C.fechaSorteo ? "el " + C.fechaSorteo : ""].filter(Boolean).join(" ");
  const subTxt = [C.marcaModelo, sorteoTxt ? "Se sortea " + sorteoTxt + "." : ""].filter(Boolean).map(esc).join(" · ");
  const legalParts = ['<a href="' + esc(C.basesUrl || "#") + '" target="_blank" rel="noopener">Bases y condiciones</a>'];
  if (C.organismo) legalParts.push("Rifa autorizada por " + esc(C.organismo));
  if (C.resolucion) legalParts.push("Resolución " + esc(C.resolucion));
  const legal = legalParts.join(" · ");
  const ticketMeta = esc([C.premio, C.modalidad, C.fechaSorteo].filter(Boolean).join(" · "));
  const backLines = [
    C.organismo ? "Rifa autorizada por " + C.organismo : "",
    C.resolucion ? "Resolución " + C.resolucion : "",
    sorteoTxt ? "Sorteo " + sorteoTxt : "",
    "Precio por número: " + money(PRICE)
  ].filter(Boolean).map((l) => "<p>" + esc(l) + "</p>").join("");

  const ICON_BACK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
  const ICON_CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  const segColors = SEGS.map((_, i) => (SEGS.length % 2 === 1 && i === SEGS.length - 1 ? "#3a3a3c" : i % 2 ? "#1d1d1f" : "#e02e24"));
  const discBg = "conic-gradient(" + segColors.map((c, i) => c + " " + (i * SEG).toFixed(3) + "deg " + ((i + 1) * SEG).toFixed(3) + "deg").join(", ") + ")";
  const labelsHtml = SEGS.map((s, i) =>
    '<div class="rf-label' + (String(s.texto).length > 3 ? " is-word" : "") + '" style="--a:' + (i * SEG + SEG / 2).toFixed(3) + 'deg"><b>' + esc(s.texto) + "</b><small>" + esc(s.sub || "") + "</small></div>"
  ).join("");
  const pegsHtml = SEGS.map((_, i) => '<i class="rf-peg" style="--a:' + (i * SEG).toFixed(3) + 'deg"></i>').join("");
  let bulbsHtml = "";
  for (let i = 0; i < 16; i++) {
    bulbsHtml += '<i class="rf-bulb" style="--a:' + i * 22.5 + "deg;--d:" + (i % 2 ? "-0.8s" : "0s") + ";--dc:-" + i * 40 + 'ms"></i>';
  }
  let digitStrip = "";
  for (let i = 0; i < 10; i++) digitStrip += "<span>" + i + "</span>";

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
        <div class="rf-progress" aria-hidden="true"><span></span><span></span><span></span><span></span></div>
        <button type="button" class="rf-icon-btn" data-rf-close aria-label="Cerrar">${ICON_CLOSE}</button>
      </div>

      <aside class="rf-prize">
        <div class="rf-stage rf-st">
          <div class="rf-stage-shadow"></div>
          <div class="rf-float" data-rf-tilt-hit>
            <div class="rf-card3d" data-rf-tilt>
              <div class="rf-card3d-img">
                <img src="${esc(C.imagen)}" alt="${esc(C.premio || "Premio")} que se sortea">
                <div class="rf-glare"></div>
                <div class="rf-sheen"></div>
              </div>
              <span class="rf-chip">Premio 0KM</span>
              <span class="rf-price-tag">${money(PRICE)} el número</span>
            </div>
          </div>
        </div>
        <div class="rf-prize-text rf-st rf-d1">
          <h2 class="rf-title" id="rf-title">${title}</h2>
          <p class="rf-sub">${subTxt}</p>
        </div>
        <div class="rf-stats rf-st rf-d2">
          <div class="rf-stat"><strong>${money(PRICE)}</strong><span>por número</span></div>
          <div class="rf-stat"><strong>${fmt(TOTAL)}</strong><span>números</span></div>
          <div class="rf-stat" data-rf-sales><strong data-rf-sold>0</strong><span>vendidos</span></div>
        </div>
        <div class="rf-meter-block rf-st rf-d3" data-rf-sales>
          <div class="rf-meter"><i data-rf-meter></i></div>
          <div class="rf-meter-row"><span data-rf-left></span><span data-rf-pct></span></div>
        </div>
        <p class="rf-legal rf-legal--desk">${legal}</p>
      </aside>

      <div class="rf-steps">
        <section class="rf-step" data-step="intro">
          <div class="rf-cta-block rf-st rf-d4">
            <button type="button" class="rf-btn rf-btn-red rf-btn-shine" data-rf-go="wheel"><span>Girar la ruleta y participar</span></button>
            <p class="rf-caption">Antes de elegir tus números, girá y ganá un descuento o chances extra.</p>
            <p class="rf-legal">${legal}</p>
          </div>
        </section>

        <section class="rf-step" data-step="wheel">
          <div class="rf-head">
            <h3 class="rf-h">Girá la ruleta</h3>
            <p class="rf-p">Un giro por persona. Lo que salga se aplica a tus números.</p>
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
            <p class="rf-note">${esc(prizesNote())}</p>
          </div>
          <div class="rf-result" data-rf-result aria-live="polite" hidden>
            <div class="rf-result-row">
              <div class="rf-badge" data-rf-badge></div>
              <div>
                <p class="rf-result-title" data-rf-result-title></p>
                <p class="rf-result-desc" data-rf-result-desc></p>
              </div>
            </div>
            <button type="button" class="rf-btn rf-btn-white" data-rf-go="numbers">Elegir mis números</button>
          </div>
        </section>

        <section class="rf-step" data-step="numbers">
          <div class="rf-head">
            <h3 class="rf-h">Elegí tus números</h3>
            <p class="rf-p" data-rf-hint></p>
          </div>
          <div class="rf-ranges" data-rf-ranges></div>
          <div class="rf-legend">
            <span><i class="rf-sw-free"></i>Libre</span>
            <span><i class="rf-sw-mine"></i>Tuyo</span>
            <span><i class="rf-sw-sold"></i>Vendido</span>
            <button type="button" class="rf-lucky" data-rf-lucky>+1 al azar</button>
          </div>
          <div class="rf-grid" data-rf-grid></div>
          <div class="rf-sum">
            <div class="rf-sum-row">
              <div>
                <p class="rf-sum-label">Tus chances</p>
                <div class="rf-odo is-empty" data-rf-odo aria-hidden="true">
                  <div class="rf-odo-col"><div class="rf-odo-strip">${digitStrip}</div></div>
                  <div class="rf-odo-col"><div class="rf-odo-strip">${digitStrip}</div></div>
                </div>
              </div>
              <div class="rf-sum-right" aria-live="polite">
                <p class="rf-count" data-rf-count></p>
                <p class="rf-strike" data-rf-sub hidden></p>
                <p class="rf-total" data-rf-total></p>
              </div>
            </div>
            <button type="button" class="rf-btn rf-btn-red" data-rf-go="ticket" data-rf-continue disabled>Elegí al menos 1 número</button>
          </div>
        </section>

        <section class="rf-step" data-step="ticket">
          <div class="rf-head">
            <h3 class="rf-h">Tu reserva</h3>
            <p class="rf-p">Tocá el ticket para ver el dorso.</p>
          </div>
          <div class="rf-ticket-stage">
            <div class="rf-ticket-deal">
              <div class="rf-ticket-tilt" data-rf-ticket-tilt>
                <div class="rf-ticket-flip" data-rf-flip>
                  <div class="rf-tk-face rf-tk-front">
                    <div class="rf-tk-top"><span class="rf-tk-brand"><em>Moto</em>Box</span><span class="rf-tk-id">RIFA N.º ${esc(C.id)}</span></div>
                    <p class="rf-tk-meta">${ticketMeta}</p>
                    <div class="rf-tk-chips" data-rf-chips></div>
                    <div class="rf-tk-perf"><i></i><i></i></div>
                    <div class="rf-tk-bottom">
                      <div><small>Beneficio ruleta</small><strong data-rf-tk-prize></strong></div>
                      <div class="rf-tk-right"><small>Total</small><strong class="rf-tk-total" data-rf-tk-total></strong></div>
                    </div>
                    <div class="rf-glare"></div>
                    <div class="rf-sheen"></div>
                  </div>
                  <div class="rf-tk-face rf-tk-back">
                    <div class="rf-tk-back-list"><p class="rf-tk-small">BASES DE LA RIFA</p>${backLines}</div>
                    <div class="rf-tk-back-foot"><span data-rf-tk-nums></span><span>Rifa N.º ${esc(C.id)}</span></div>
                  </div>
                </div>
                <button type="button" class="rf-ticket-hit" data-rf-flip-btn aria-label="Dar vuelta el ticket"></button>
              </div>
            </div>
          </div>
          <div class="rf-summary">
            <div><span data-rf-s-count></span><span data-rf-s-sub></span></div>
            <div class="rf-sum-benefit"><span data-rf-s-prize></span><span data-rf-s-benefit></span></div>
            <div class="rf-sum-total"><span data-rf-s-chances></span><span data-rf-s-total></span></div>
          </div>
          <div class="rf-next">
            <p class="rf-next-title">Cómo sigue</p>
            <ol>
              <li><b>1</b>Reservás tus números por WhatsApp.</li>
              <li><b>2</b>Pagás por transferencia.</li>
              <li><b>3</b>Quedan a tu nombre y participás del sorteo.</li>
            </ol>
          </div>
          <div class="rf-ticket-actions">
            <a class="rf-btn rf-btn-wa" data-rf-wa href="#" target="_blank" rel="noopener">Reservar por WhatsApp</a>
            <button type="button" class="rf-btn rf-btn-ghost" data-rf-close>Volver al sitio</button>
          </div>
        </section>
      </div>
    </div>`;

  const pill = document.createElement("div");
  pill.className = "rf-pill";
  pill.hidden = true;
  pill.innerHTML = `
    <button type="button" class="rf-pill-main" data-rf-open aria-haspopup="dialog">
      <span class="rf-pill-thumb"><img src="${esc(C.imagen)}" alt=""></span>
      <span class="rf-pill-text">
        <span class="rf-pill-kicker"><i class="rf-live"></i>Rifa N.º ${esc(C.id)}</span>
        <span class="rf-pill-title">${esc(C.premio || "Premio")} · ${money(PRICE)}</span>
      </span>
      <span class="rf-pill-cta">Participar</span>
    </button>
    <button type="button" class="rf-pill-x" data-rf-hide-pill aria-label="Ocultar la rifa">${ICON_CLOSE}</button>`;

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
  const grid = $("[data-rf-grid]");
  const ranges = $("[data-rf-ranges]");
  const odo = $("[data-rf-odo]");
  const odoStrips = Array.from(odo.querySelectorAll(".rf-odo-strip"));
  const continueBtn = $("[data-rf-continue]");
  const flip = $("[data-rf-flip]");

  const timers = [];
  function later(fn, ms) { timers.push(setTimeout(fn, ms)); }

  // --- Navegación entre pasos ---
  function firstStep() { return desktopMq.matches ? "wheel" : "intro"; }

  function go(step, dir) {
    if (STEPS.indexOf(step) < 0) return;
    if (step === "intro" && desktopMq.matches) step = "wheel";
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
    if (step === "intro") playSales();
    if (step === "wheel") renderWheel(false);
    if (step === "numbers") { renderRanges(); renderGrid(true); renderSummary(); }
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
    go(state.prize === null ? firstStep() : state.mine.length ? "ticket" : "numbers");
    if (desktopMq.matches) playSales();
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

  // --- Cifras de venta (solo con datos reales) ---
  let countRaf = 0;
  function playSales() {
    if (!state.hasSales) return;
    const sold = Math.min(TOTAL, state.sold.size);
    const soldEl = $("[data-rf-sold]"), leftEl = $("[data-rf-left]"), pctEl = $("[data-rf-pct]"), meter = $("[data-rf-meter]");
    const paint = (v) => {
      const left = TOTAL - v;
      soldEl.textContent = fmt(v);
      leftEl.textContent = left === 1 ? "Queda 1 número" : "Quedan " + fmt(left) + " números";
      pctEl.textContent = Math.round((v * 100) / TOTAL) + "% vendido";
    };
    cancelAnimationFrame(countRaf);
    meter.style.transition = "none";
    meter.style.transform = "scaleX(0)";
    void meter.offsetWidth;
    meter.style.transition = "";
    requestAnimationFrame(() => { meter.style.transform = "scaleX(" + (sold / TOTAL).toFixed(4) + ")"; });
    if (reduceMq.matches) { paint(sold); return; }
    let start = null;
    const frame = (now) => {
      if (start === null) start = now;
      const t = Math.min(1, (now - start) / 900);
      paint(Math.round(sold * (1 - Math.pow(1 - t, 3))));
      if (t < 1) countRaf = requestAnimationFrame(frame);
    };
    countRaf = requestAnimationFrame(frame);
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
      const s = SEGS[state.prize];
      const badge = $("[data-rf-badge]");
      badge.textContent = s.texto;
      badge.classList.toggle("is-word", String(s.texto).length > 3);
      $("[data-rf-result-title]").textContent = "¡Ganaste " + prizeTitle(s) + "!";
      $("[data-rf-result-desc]").textContent = prizeDesc(s);
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

  // --- Números ---
  function totals() {
    const n = state.mine.length;
    const s = state.prize !== null ? SEGS[state.prize] : null;
    const subtotal = n * PRICE;
    let discount = 0, gift = 0;
    if (s && s.tipo === "descuento") discount = Math.round((subtotal * (Number(s.valor) || 0)) / 100);
    if (s && s.tipo === "2x1") discount = Math.floor(n / 2) * PRICE;
    if (s && s.tipo === "regalo" && n > 0) gift = Number(s.valor) || 0;
    return { n, s, subtotal, discount, gift, total: subtotal - discount, chances: n + gift };
  }

  function benefitText(t) {
    if (!t.s) return "—";
    if (t.s.tipo === "regalo") return "+" + t.s.valor + " gratis";
    if (t.discount > 0) return "−" + money(t.discount);
    return t.s.tipo === "2x1" ? "Pagás la mitad" : "$0";
  }

  function hintText() {
    const s = state.prize !== null ? SEGS[state.prize] : null;
    if (!s) return "Cada número es una chance.";
    if (s.tipo === "regalo") return "Cada número es una chance. Tu premio suma " + numbersLabel(Number(s.valor) || 0) + " de regalo.";
    if (s.tipo === "2x1") return "Cada número es una chance. Con el 2x1 pagás la mitad.";
    return "Cada número es una chance. Tu " + prizeTitle(s) + " se aplica al total.";
  }

  function renderRanges() {
    ranges.hidden = RANGE_COUNT <= 1;
    if (RANGE_COUNT <= 1) return;
    let html = "";
    for (let r = 0; r < RANGE_COUNT; r++) {
      const lo = r * RANGE_SIZE, hi = Math.min(TOTAL, lo + RANGE_SIZE) - 1;
      const on = r === state.range;
      html += '<button type="button" class="rf-range' + (on ? " is-active" : "") + '" data-rf-range="' + r + '" aria-pressed="' + on + '">' + pad(lo) + "–" + pad(hi) + "</button>";
    }
    ranges.innerHTML = html;
  }

  let gridTimer = 0;
  function renderGrid(animate) {
    const lo = state.range * RANGE_SIZE, hi = Math.min(TOTAL, lo + RANGE_SIZE);
    let html = "";
    for (let i = lo; i < hi; i++) {
      const j = i - lo;
      const sold = state.sold.has(i), mine = state.mine.indexOf(i) >= 0;
      const d = Math.min(360, (Math.floor(j / 5) + (j % 5)) * 16);
      html += '<button type="button" class="rf-cell' + (mine ? " is-mine" : "") + '" data-n="' + i + '" style="--d:' + d + 'ms" aria-pressed="' + mine + '"' +
        (sold ? ' disabled aria-label="' + pad(i) + ', vendido"' : "") + ">" + pad(i) + "</button>";
    }
    grid.innerHTML = html;
    grid.classList.remove("is-entering");
    if (animate && !reduceMq.matches) {
      void grid.offsetWidth;
      grid.classList.add("is-entering");
      clearTimeout(gridTimer);
      gridTimer = setTimeout(() => grid.classList.remove("is-entering"), 700);
    }
  }

  function setRange(r) {
    if (r === state.range || r < 0 || r >= RANGE_COUNT) return;
    state.range = r;
    renderRanges();
    renderGrid(true);
    const btn = ranges.querySelector('[data-rf-range="' + r + '"]');
    if (btn) {
      const offset = btn.getBoundingClientRect().left - ranges.getBoundingClientRect().left;
      ranges.scrollTo({ left: ranges.scrollLeft + offset - 20, behavior: reduceMq.matches ? "auto" : "smooth" });
    }
  }

  function toggleNumber(cell) {
    if (cell.disabled) return;
    const n = Number(cell.dataset.n);
    const at = state.mine.indexOf(n);
    if (at >= 0) state.mine.splice(at, 1);
    else state.mine.push(n);
    const on = at < 0;
    cell.classList.toggle("is-mine", on);
    cell.setAttribute("aria-pressed", String(on));
    if (on && !reduceMq.matches && cell.animate) {
      cell.animate([{ transform: "scale(0.9)" }, { transform: "scale(1)" }], { duration: 420, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" });
    }
    renderSummary();
  }

  function lucky() {
    const free = [];
    for (let i = 0; i < TOTAL; i++) if (!state.sold.has(i) && state.mine.indexOf(i) < 0) free.push(i);
    if (!free.length) return;
    const n = free[Math.floor(Math.random() * free.length)];
    const r = Math.floor(n / RANGE_SIZE);
    if (r !== state.range) setRange(r);
    const cell = grid.querySelector('[data-n="' + n + '"]');
    if (!cell) return;
    toggleNumber(cell);
    cell.scrollIntoView({ block: "center", behavior: reduceMq.matches ? "auto" : "smooth" });
  }

  function renderSummary() {
    const t = totals();
    $("[data-rf-hint]").textContent = hintText();
    $("[data-rf-count]").textContent = numbersLabel(t.n) + " × " + money(PRICE);
    const sub = $("[data-rf-sub]");
    sub.hidden = t.discount <= 0;
    sub.textContent = money(t.subtotal);
    $("[data-rf-total]").textContent = money(t.total);
    const shown = String(Math.min(99, t.chances)).padStart(2, "0");
    odoStrips.forEach((strip, i) => { strip.style.transform = "translateY(" + -Number(shown[i]) * 34 + "px)"; });
    odo.classList.toggle("is-empty", t.chances === 0);
    continueBtn.disabled = t.n === 0;
    continueBtn.textContent = t.n ? "Continuar" : "Elegí al menos 1 número";
  }

  // --- Ticket ---
  function renderTicket() {
    const t = totals();
    const nums = state.mine.slice().sort((a, b) => a - b).map(pad);
    let chips = nums.slice(0, 9).map((n) => "<span>" + n + "</span>").join("");
    if (nums.length > 9) chips += '<span class="is-extra">+' + (nums.length - 9) + " más</span>";
    if (t.gift > 0) chips += '<span class="is-extra">+' + t.gift + " de regalo</span>";
    $("[data-rf-chips]").innerHTML = chips;
    const prize = t.s ? prizeTitle(t.s) : "Sin beneficio";
    $("[data-rf-tk-prize]").textContent = prize;
    $("[data-rf-tk-total]").textContent = money(t.total);
    $("[data-rf-tk-nums]").textContent = "Tus números: " + nums.slice(0, 4).join(" · ") + (nums.length > 4 ? " …" : "");
    $("[data-rf-s-count]").textContent = numbersLabel(t.n) + " × " + money(PRICE);
    $("[data-rf-s-sub]").textContent = money(t.subtotal);
    $("[data-rf-s-prize]").textContent = "Ruleta · " + prize;
    $("[data-rf-s-benefit]").textContent = benefitText(t);
    $("[data-rf-s-chances]").textContent = "Total · " + t.chances + (t.chances === 1 ? " chance" : " chances");
    $("[data-rf-s-total]").textContent = money(t.total);
    const msg = "Hola Motobox! Quiero reservar en la Rifa N.º " + C.id + " los números " + nums.join(", ") +
      ". Beneficio de la ruleta: " + prize + ". Total: " + money(t.total) + ".";
    $("[data-rf-wa]").href = "https://wa.me/" + WA_NUMBER + "?text=" + encodeURIComponent(msg);
    state.flipped = false;
    flip.classList.remove("is-flipped");
  }

  function toggleFlip() {
    state.flipped = !state.flipped;
    flip.classList.toggle("is-flipped", state.flipped);
  }

  // --- Inclinación 3D con resorte (tarjeta del premio y ticket, solo con mouse) ---
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

  // --- Datos de venta desde Supabase (opcional) ---
  let salesSubscribed = false;
  async function loadSales() {
    if (typeof supabaseFetch !== "function") return;
    const rows = await supabaseFetch("rifa_numeros", "select=numero,estado&rifa=eq." + encodeURIComponent(C.id));
    if (!Array.isArray(rows)) return;
    const sold = new Set();
    rows.forEach((row) => {
      const n = Number(row && row.numero);
      if (Number.isInteger(n) && n >= 0 && n < TOTAL && (row.estado === "reservado" || row.estado === "vendido")) sold.add(n);
    });
    state.sold = sold;
    state.hasSales = true;
    root.classList.add("has-sales");
    state.mine = state.mine.filter((n) => !sold.has(n));
    if (state.open) {
      if (state.step === "intro" || desktopMq.matches) playSales();
      if (state.step === "numbers") { renderGrid(false); renderSummary(); }
      if (state.step === "ticket") renderTicket();
    }
    if (!salesSubscribed && typeof supabaseClient !== "undefined" && supabaseClient) {
      salesSubscribed = true;
      try {
        supabaseClient
          .channel("motobox-rifa-" + C.id)
          .on("postgres_changes", { event: "*", schema: "public", table: "rifa_numeros" }, () => loadSales())
          .subscribe();
      } catch (e) {
        /* sin tiempo real: los datos se leen al cargar la página */
      }
    }
  }

  // --- Eventos ---
  root.addEventListener("click", (e) => {
    const t = e.target.closest("[data-rf-close], [data-rf-back], [data-rf-go], [data-rf-spin], [data-rf-lucky], [data-rf-flip-btn], [data-rf-range], .rf-cell");
    if (!t || !root.contains(t)) return;
    if (t.hasAttribute("data-rf-close")) close();
    else if (t.hasAttribute("data-rf-back")) back();
    else if (t.hasAttribute("data-rf-go")) { if (!t.disabled) go(t.getAttribute("data-rf-go"), "fwd"); }
    else if (t.hasAttribute("data-rf-spin")) spin();
    else if (t.hasAttribute("data-rf-lucky")) lucky();
    else if (t.hasAttribute("data-rf-flip-btn")) toggleFlip();
    else if (t.hasAttribute("data-rf-range")) setRange(Number(t.getAttribute("data-rf-range")));
    else if (t.classList.contains("rf-cell")) toggleNumber(t);
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
    renderSummary();
    bindTilt($("[data-rf-tilt-hit]"), $("[data-rf-tilt]"));
    bindTilt($("[data-rf-flip-btn]"), $("[data-rf-ticket-tilt]"));
    loadSales();

    if (window.location.hash === "#rifa") {
      writeKey("sessionStorage", KEY + "_visto", "1");
      later(open, 300);
    } else if (readKey("sessionStorage", KEY + "_visto") !== "1") {
      writeKey("sessionStorage", KEY + "_visto", "1");
      later(open, 900);
    } else if (readKey("sessionStorage", KEY + "_pill") !== "1") {
      pill.hidden = false;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
