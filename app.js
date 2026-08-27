/**
 * MOTOBOX — Senior Frontend Architecture & Interactive Lead Engines
 * Concesionaria Multimarca | Córdoba, Argentina
 */

(function () {
  "use strict";

  // --- DOM References ---
  const catalogGrid = document.getElementById("catalog-cards-grid");
  const filterPills = document.querySelectorAll(".filter-pill");
  const categoryTiles = document.querySelectorAll(".category-tile");
  const header = document.getElementById("site-header");
  
  // Simulator DOM References
  const simSelectMoto = document.getElementById("sim-select-moto");
  const simAnticipoSlider = document.getElementById("sim-anticipo-slider");
  const simAnticipoDisplay = document.getElementById("sim-anticipo-display");
  const simCuotasBtns = document.querySelectorAll(".btn-cuota-term");
  const simCuotaResult = document.getElementById("sim-cuota-result");
  const simCuotaSub = document.getElementById("sim-cuota-sub");
  const simSummaryMoto = document.getElementById("sim-summary-moto");
  const simSummaryPrecio = document.getElementById("sim-summary-precio");
  const simSummaryAnticipo = document.getElementById("sim-summary-anticipo");
  const simSummaryFinanciar = document.getElementById("sim-summary-financiar");
  const btnSubmitSimWhatsapp = document.getElementById("btn-submit-sim-whatsapp");

  // Assistant Modal DOM References
  const assistantModal = document.getElementById("assistant-modal");
  const btnCloseAssistant = document.getElementById("btn-close-assistant");
  const assistantProgressFill = document.getElementById("assistant-progress-fill");
  const quizSteps = document.querySelectorAll(".quiz-step");
  const quizOptBtns = document.querySelectorAll(".quiz-opt-btn");
  const quizMatchBox = document.getElementById("quiz-match-box");
  const btnQuizWhatsappLead = document.getElementById("btn-quiz-whatsapp-lead");
  const btnRestartQuiz = document.getElementById("btn-restart-quiz");

  // Assistant Open Triggers
  const btnOpenAssistantNav = document.getElementById("btn-open-assistant-nav");
  const btnOpenAssistantHero = document.getElementById("btn-open-assistant-hero");
  const cardOpenAssistantTrigger = document.getElementById("card-open-assistant-trigger");
  const btnDockOpenAssistant = document.getElementById("btn-dock-open-assistant");

  // Trade-in Modal DOM References
  const tradeinModal = document.getElementById("tradein-modal");
  const cardOpenTradein = document.getElementById("card-open-tradein");
  const btnCloseTradein = document.getElementById("btn-close-tradein");
  const tradeinForm = document.getElementById("tradein-form");

  // --- State ---
  let currentFilter = "todas";
  let simSelectedMoto = motos[0];
  let simSelectedCuotas = 24;
  let simAnticipoPercent = 0;

  let quizAnswers = {
    uso: null,
    usoLabel: "",
    pago: null,
    pagoLabel: "",
    presupuesto: null,
    presupuestoLabel: "",
    matchedMoto: null
  };

  // --- Utilities ---
  function formatCurrency(val) {
    if (val === null || val === undefined || isNaN(val)) return null;
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0
    }).format(val);
  }

  function buildWhatsAppUrl(message) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }

  // --- 1. Catalog Engine ---
  function renderCatalog(filter) {
    currentFilter = filter;
    const filtered = filter === "todas" ? motos : motos.filter(m => m.categoria === filter);

    catalogGrid.innerHTML = "";

    filtered.forEach((moto, idx) => {
      const card = document.createElement("article");
      card.className = "moto-card-modern reveal-on-scroll";
      card.style.transitionDelay = `${idx * 60}ms`;

      const formattedPrice = moto.precio ? formatCurrency(moto.precio) : "Consultar Precio";
      const isConsultPrice = !moto.precio;

      const cuotaHtml = moto.cuotaMinimaEstimada
        ? `<div class="price-cuota-pill"><span>Cuotas fijas desde</span><strong>${formatCurrency(moto.cuotaMinimaEstimada)} / mes</strong></div>`
        : `<div class="price-cuota-pill"><span>Financiación propia</span><strong>Consultar cuota</strong></div>`;

      const directWaMsg = `Hola Motobox! Quiero consultar por disponibilidad y financiación para la ${moto.marca} ${moto.modelo} (${moto.cilindrada}).`;

      card.innerHTML = `
        <div class="moto-card-header">
          ${moto.badge ? `<span class="moto-badge-tag">${moto.badge}</span>` : ""}
          <img src="${moto.imagen}" alt="${moto.marca} ${moto.modelo}" loading="lazy">
        </div>
        
        <div class="moto-card-body">
          <div class="moto-brand-row">
            <span class="moto-brand-label">${moto.marca}</span>
            <span class="moto-category-label">${moto.categoriaLabel}</span>
          </div>

          <h3 class="moto-title-h3">${moto.modelo}</h3>
          <p class="moto-tagline">${moto.tagline}</p>

          <div class="moto-specs-strip">
            <div class="spec-item">
              <span class="spec-k">Motor</span>
              <span class="spec-v">${moto.cilindrada}</span>
            </div>
            <div class="spec-item">
              <span class="spec-k">Consumo</span>
              <span class="spec-v">${moto.consumo}</span>
            </div>
            <div class="spec-item">
              <span class="spec-k">Frenos</span>
              <span class="spec-v">${moto.frenos.split('/')[0]}</span>
            </div>
          </div>

          <div class="moto-card-actions">
            <a href="${buildWhatsAppUrl(directWaMsg)}" class="btn-card-whatsapp" target="_blank" rel="noopener">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <span>Consultar</span>
            </a>
            <button class="btn-card-simulate" data-moto-id="${moto.id}">
              <span>Simular Cuota</span>
            </button>
          </div>
        </div>
      `;

      catalogGrid.appendChild(card);
    });

    // Attach Simulate button triggers
    document.querySelectorAll(".btn-card-simulate").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const motoId = parseInt(btn.dataset.motoId, 10);
        selectMotoInSimulator(motoId);
        document.getElementById("simulador").scrollIntoView({ behavior: "smooth" });
      });
    });

    // Re-observe animations
    requestAnimationFrame(() => {
      document.querySelectorAll(".reveal-on-scroll").forEach(el => observer.observe(el));
    });
  }

  // Filter Pills Event Listeners
  filterPills.forEach(pill => {
    pill.addEventListener("click", () => {
      filterPills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      renderCatalog(pill.dataset.filter);
    });
  });

  // Category Tiles Event Listeners
  categoryTiles.forEach(tile => {
    tile.addEventListener("click", () => {
      const cat = tile.dataset.category;
      filterPills.forEach(p => {
        if (p.dataset.filter === cat) p.classList.add("active");
        else p.classList.remove("active");
      });
      renderCatalog(cat);
      document.getElementById("catalogo").scrollIntoView({ behavior: "smooth" });
    });
  });

  // --- 2. Interactive Financing Simulator Engine ---
  function initSimulator() {
    // Populate dropdown
    simSelectMoto.innerHTML = "";
    motos.forEach(moto => {
      const opt = document.createElement("option");
      opt.value = moto.id;
      opt.textContent = `${moto.marca} ${moto.modelo} (${moto.precio ? formatCurrency(moto.precio) : 'Precio a consultar'})`;
      simSelectMoto.appendChild(opt);
    });

    simSelectMoto.addEventListener("change", (e) => {
      const motoId = parseInt(e.target.value, 10);
      simSelectedMoto = motos.find(m => m.id === motoId) || motos[0];
      calculateSimulation();
    });

    simAnticipoSlider.addEventListener("input", (e) => {
      simAnticipoPercent = parseInt(e.target.value, 10);
      calculateSimulation();
    });

    simCuotasBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        simCuotasBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        simSelectedCuotas = parseInt(btn.dataset.cuotas, 10);
        calculateSimulation();
      });
    });

    calculateSimulation();
  }

  function selectMotoInSimulator(motoId) {
    simSelectedMoto = motos.find(m => m.id === motoId) || motos[0];
    simSelectMoto.value = simSelectedMoto.id;
    calculateSimulation();
  }

  function calculateSimulation() {
    const basePrice = simSelectedMoto.precio || 3500000; // Reference price if null
    const anticipoAmount = Math.round(basePrice * (simAnticipoPercent / 100));
    const montoFinanciar = basePrice - anticipoAmount;

    // Display anticipo text
    if (simAnticipoPercent === 0) {
      simAnticipoDisplay.textContent = "$0 (Financiación 100%)";
    } else {
      simAnticipoDisplay.textContent = `${formatCurrency(anticipoAmount)} (${simAnticipoPercent}%)`;
    }

    // Term display
    document.getElementById("sim-cuotas-display").textContent = `${simSelectedCuotas} Cuotas`;

    // Monthly installment calculation
    // Amortización con tasa mensual de mercado
    const r = CONFIG.tasaInteresEstimada;
    const n = simSelectedCuotas;
    let cuotaMensual = 0;

    if (montoFinanciar > 0) {
      cuotaMensual = Math.round(montoFinanciar * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1));
    }

    // Update Output Card
    if (simSelectedMoto.precio) {
      simCuotaResult.textContent = `${formatCurrency(cuotaMensual)} / mes`;
      simCuotaSub.textContent = `En ${simSelectedCuotas} cuotas fijas en pesos · Con DNI`;
      simSummaryPrecio.textContent = formatCurrency(basePrice);
      simSummaryAnticipo.textContent = simAnticipoPercent === 0 ? "$0 (Sin anticipo)" : formatCurrency(anticipoAmount);
      simSummaryFinanciar.textContent = formatCurrency(montoFinanciar);
    } else {
      simCuotaResult.textContent = "A Consultar";
      simCuotaSub.textContent = "Planes especiales y financiación directa para este modelo";
      simSummaryPrecio.textContent = "Consultar valor";
      simSummaryAnticipo.textContent = "A convenir";
      simSummaryFinanciar.textContent = "Planes a medida";
    }

    simSummaryMoto.textContent = `${simSelectedMoto.marca} ${simSelectedMoto.modelo}`;

    // WhatsApp Message
    const simMessage = simSelectedMoto.precio
      ? `Hola Motobox! Hice una simulación en la web para financiar la ${simSelectedMoto.marca} ${simSelectedMoto.modelo} ($${formatCurrency(basePrice)}):\n- Anticipo: ${simAnticipoPercent === 0 ? '$0 (100% financiado)' : formatCurrency(anticipoAmount)}\n- Plazo: ${simSelectedCuotas} cuotas de aprox ${formatCurrency(cuotaMensual)}\n¿Podrían indicarme los requisitos para pre-aprobar el crédito?`
      : `Hola Motobox! Quiero consultar por planes de financiación para la ${simSelectedMoto.marca} ${simSelectedMoto.modelo} en ${simSelectedCuotas} cuotas. ¿Qué opciones tienen disponibles?`;

    btnSubmitSimWhatsapp.href = buildWhatsAppUrl(simMessage);
  }

  // --- 3. Interactive Sales Assistant Engine (Matchmaker Quiz) ---
  function openAssistant() {
    assistantModal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeAssistant() {
    assistantModal.classList.remove("open");
    document.body.style.overflow = "";
  }

  function setQuizStep(stepNumber) {
    quizSteps.forEach(step => step.classList.remove("active"));
    const target = document.getElementById(`quiz-step-${stepNumber}`);
    if (target) target.classList.add("active");

    const progress = (stepNumber / 4) * 100;
    assistantProgressFill.style.width = `${progress}%`;
  }

  function handleQuizOption(step, val, label) {
    if (step === 1) {
      quizAnswers.uso = val;
      quizAnswers.usoLabel = label;
      setQuizStep(2);
    } else if (step === 2) {
      quizAnswers.pago = val;
      quizAnswers.pagoLabel = label;
      setQuizStep(3);
    } else if (step === 3) {
      quizAnswers.presupuesto = val;
      quizAnswers.presupuestoLabel = label;
      calculateMatchAndShowResult();
    }
  }

  function calculateMatchAndShowResult() {
    let matched = motos[0]; // default Keller

    if (quizAnswers.uso === "viajar" || quizAnswers.presupuesto === "premium") {
      matched = motos.find(m => m.modelo.includes("Tornado")) || motos[4];
    } else if (quizAnswers.uso === "estilo" || quizAnswers.presupuesto === "medio") {
      matched = motos.find(m => m.modelo.includes("NS 200")) || motos[3];
    } else if (quizAnswers.uso === "trabajo" || quizAnswers.uso === "ciudad") {
      matched = motos.find(m => m.categoria === "economica") || motos[0];
    }

    quizAnswers.matchedMoto = matched;

    const formattedPrice = matched.precio ? formatCurrency(matched.precio) : "Consultar precio";
    const cuotaDisplay = matched.cuotaMinimaEstimada ? `Cuotas desde ${formatCurrency(matched.cuotaMinimaEstimada)}` : "Financiación disponible";

    quizMatchBox.innerHTML = `
      <div class="match-box-header">
        <span class="match-tag-pill">Recomendación Personalizada</span>
        <img src="${matched.imagen}" alt="${matched.marca} ${matched.modelo}">
      </div>
      <div class="match-box-body">
        <h4 class="match-title">${matched.marca} ${matched.modelo}</h4>
        <p class="match-specs-text">
          <strong>${matched.cilindrada}</strong> · ${matched.consumo} · ${matched.perfilComprador}
        </p>
        <div class="match-price-row">
          <span>Precio de Lista:</span>
          <strong>${formattedPrice}</strong>
        </div>
        <p style="font-size: 0.75rem; color: var(--accent-live); font-weight: 600; margin-top: 0.25rem;">
          ✓ ${cuotaDisplay} · Casco y Patente bonificados con tu 0km
        </p>
      </div>
    `;

    // WhatsApp Message
    const leadMsg = `Hola Motobox! Hice el Test de Compra en la web:\n- Uso buscado: ${quizAnswers.usoLabel}\n- Forma de pago: ${quizAnswers.pagoLabel}\n- Presupuesto: ${quizAnswers.presupuestoLabel}\n\nMe recomendó la *${matched.marca} ${matched.modelo}* (${matched.cilindrada}). ¿Tienen disponibilidad para verla hoy en Santa Rosa 4227?`;

    btnQuizWhatsappLead.href = buildWhatsAppUrl(leadMsg);
    setQuizStep(4);
  }

  function resetQuiz() {
    quizAnswers = {
      uso: null,
      usoLabel: "",
      pago: null,
      pagoLabel: "",
      presupuesto: null,
      presupuestoLabel: "",
      matchedMoto: null
    };
    setQuizStep(1);
  }

  // Assistant Event Listeners
  [btnOpenAssistantNav, btnOpenAssistantHero, cardOpenAssistantTrigger, btnDockOpenAssistant].forEach(btn => {
    if (btn) btn.addEventListener("click", () => {
      openAssistant();
    });
  });

  if (btnCloseAssistant) btnCloseAssistant.addEventListener("click", closeAssistant);
  if (btnRestartQuiz) btnRestartQuiz.addEventListener("click", resetQuiz);

  quizOptBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const step = parseInt(btn.dataset.step, 10);
      const val = btn.dataset.val;
      const label = btn.dataset.label;
      handleQuizOption(step, val, label);
    });
  });

  // Modal Backdrop click to close
  assistantModal.addEventListener("click", (e) => {
    if (e.target === assistantModal) closeAssistant();
  });

  // --- 4. Trade-in / Permuta Modal Engine ---
  function openTradein() {
    tradeinModal.classList.add("open");
    document.body.style.overflow = "hidden";
  }

  function closeTradein() {
    tradeinModal.classList.remove("open");
    document.body.style.overflow = "";
  }

  if (cardOpenTradein) cardOpenTradein.addEventListener("click", openTradein);
  if (btnCloseTradein) btnCloseTradein.addEventListener("click", closeTradein);

  tradeinModal.addEventListener("click", (e) => {
    if (e.target === tradeinModal) closeTradein();
  });

  if (tradeinForm) {
    tradeinForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const motoUsada = document.getElementById("tradein-moto").value.trim();
      const anio = document.getElementById("tradein-anio").value.trim();
      const km = document.getElementById("tradein-km").value.trim() || "A verificar";
      const target0km = document.getElementById("tradein-target-moto").value;

      const msg = `Hola Motobox! Quiero cotizar mi moto usada para permuta:\n- Moto actual: ${motoUsada}\n- Año: ${anio}\n- Kilómetros: ${km}\n- Me interesa sacar: ${target0km}\n¿Me podrían pasar una cotización aproximada?`;

      window.open(buildWhatsAppUrl(msg), "_blank", "noopener");
      closeTradein();
    });
  }

  // --- 5. Global Scroll & Header Behavior ---
  let lastScrollY = 0;
  let ticking = false;

  function handleScroll() {
    const scrollY = window.scrollY;

    // Scrolled state for visual compaction
    if (scrollY > 30) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }

    // Auto-hide header on scroll down, reveal on scroll up
    if (scrollY > 300) {
      if (scrollY > lastScrollY + 5) {
        header.classList.add("header-hidden");
      } else if (scrollY < lastScrollY - 5) {
        header.classList.remove("header-hidden");
      }
    } else {
      header.classList.remove("header-hidden");
    }

    lastScrollY = scrollY;
  }

  window.addEventListener("scroll", () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        handleScroll();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // --- 6. Scroll Reveal Observer ---
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        // Stagger the reveal for a more organic, hand-crafted feel
        const delay = parseInt(entry.target.style.transitionDelay, 10) || (i * 80);
        setTimeout(() => {
          entry.target.classList.add("visible");
        }, delay);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06, rootMargin: "0px 0px -40px 0px" });

  document.querySelectorAll(".reveal-on-scroll").forEach(el => observer.observe(el));

  // --- 7. ESC Key Closes Modals ---
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAssistant();
      closeTradein();
    }
  });

  // --- 8. Smooth Anchor Navigation ---
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener("click", function (e) {
      const targetId = this.getAttribute("href");
      if (targetId === "#") return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  // --- Init Application ---
  renderCatalog("todas");
  initSimulator();
  handleScroll();

})();
