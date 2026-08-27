/**
 * MOTOBOX — Arquitectura Frontend Senior
 * Concesionaria Oficial Multimarca | Córdoba, Argentina
 * 
 * Lógica modular para 3 páginas:
 * - Home (index.html): Modelos destacados 0km, CRM Promo Poster, Acordeón FAQ
 * - Catálogo (catalogo.html): Grid completo, buscador en tiempo real, filtros por categoría y ficha técnica modal
 * - Nosotros (nosotros.html): Información institucional, showroom y contacto
 */

(function () {
  "use strict";

  // --- Helper Functions ---
  function buildWhatsAppUrl(message) {
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }

  // Determine current page context
  const currentPage = document.body.dataset.page || (
    window.location.pathname.includes("catalogo.html") ? "catalogo" :
    window.location.pathname.includes("nosotros.html") ? "nosotros" : "home"
  );

  // --- Shared Elements ---
  const header = document.getElementById("site-header");

  // ==========================================================================
  // 1. HOME PAGE LOGIC (index.html)
  // ==========================================================================
  function initHomePage() {
    function renderFeaturedCards() {
      const featuredContainer = document.getElementById("featured-cards-grid");
      if (!featuredContainer) return;
      // Filter 3 highlighted 0km models
      let featuredModels = motos.filter(m => m.destacada || m.badge === "Más Vendida" || m.badge === "Destacada");
      if (featuredModels.length === 0) {
        featuredModels = motos.slice(0, 3);
      } else {
        featuredModels = featuredModels.slice(0, 3);
      }
      featuredContainer.innerHTML = "";

      featuredModels.forEach((moto, idx) => {
        const card = document.createElement("article");
        card.className = "moto-card-modern reveal-on-scroll visible";
        card.style.transitionDelay = `${idx * 70}ms`;

        const directWaMsg = `Hola Motobox! Quiero consultar por disponibilidad de la ${moto.marca} ${moto.modelo} 0km que vi en la web.`;

        card.innerHTML = `
          <div class="moto-card-header">
            ${moto.badge ? `<span class="moto-badge-tag">${moto.badge}</span>` : ""}
            <img src="${moto.imagen}" alt="${moto.marca} ${moto.modelo} 0km" loading="lazy">
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
                <span class="spec-v">${moto.cilindrada || '-'}</span>
              </div>
              <div class="spec-item">
                <span class="spec-k">Consumo</span>
                <span class="spec-v">${moto.consumo || '-'}</span>
              </div>
              <div class="spec-item">
                <span class="spec-k">Frenos</span>
                <span class="spec-v">${moto.frenos ? moto.frenos.split('/')[0] : '-'}</span>
              </div>
            </div>

            <div class="moto-card-actions">
              <a href="${buildWhatsAppUrl(directWaMsg)}" class="btn-card-whatsapp" target="_blank" rel="noopener">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span>Consultar Stock 0km</span>
              </a>
            </div>
          </div>
        `;

        card.addEventListener("click", (e) => {
          if (e.target.closest(".btn-card-whatsapp")) return;
          window.location.href = `catalogo.html`;
        });

        featuredContainer.appendChild(card);
      });
    }

    function renderPromoPoster() {
      const promoSection = document.getElementById("promo-poster-section");
      if (typeof PROMO_CRM !== "undefined" && PROMO_CRM) {
        if (!PROMO_CRM.activo) {
          if (promoSection) promoSection.style.display = "none";
        } else {
          if (promoSection) promoSection.style.display = "";
          const promoImg = document.getElementById("promo-poster-img");
          const promoTitle = document.getElementById("promo-poster-title");
          const promoDesc = document.getElementById("promo-poster-desc");
          const promoBadge = document.getElementById("promo-poster-badge");
          const promoBtn = document.getElementById("promo-poster-btn");
          const promoBtnText = document.getElementById("promo-poster-btn-text");

          if (promoImg && PROMO_CRM.imagen) promoImg.src = PROMO_CRM.imagen;
          if (promoTitle && PROMO_CRM.titulo) promoTitle.textContent = PROMO_CRM.titulo;
          if (promoDesc && PROMO_CRM.subtitulo) promoDesc.textContent = PROMO_CRM.subtitulo;
          if (promoBadge && PROMO_CRM.badge) promoBadge.textContent = PROMO_CRM.badge;
          if (promoBtnText && PROMO_CRM.textoBoton) promoBtnText.textContent = PROMO_CRM.textoBoton;
          if (promoBtn && PROMO_CRM.mensajeWhatsApp) {
            promoBtn.href = buildWhatsAppUrl(PROMO_CRM.mensajeWhatsApp);
          }
        }
      }
    }

    renderFeaturedCards();
    renderPromoPoster();

    // Listen to Realtime updates from CRM
    document.addEventListener("motobox:motos-updated", () => {
      console.log("[MotoBox Realtime] 🔄 Re-renderizando modelos destacados...");
      renderFeaturedCards();
    });

    document.addEventListener("motobox:promo-updated", () => {
      console.log("[MotoBox Realtime] 🔄 Re-renderizando poster promocional...");
      renderPromoPoster();
    });

    // FAQ Accordion Interactivity
    const faqItems = document.querySelectorAll(".faq-item");
    faqItems.forEach(item => {
      const questionBtn = item.querySelector(".faq-question");
      if (questionBtn) {
        questionBtn.addEventListener("click", () => {
          const isCurrentActive = item.classList.contains("active");
          faqItems.forEach(i => {
            i.classList.remove("active");
            const btn = i.querySelector(".faq-question");
            if (btn) btn.setAttribute("aria-expanded", "false");
          });
          if (!isCurrentActive) {
            item.classList.add("active");
            questionBtn.setAttribute("aria-expanded", "true");
          }
        });
      }
    });
  }

  // ==========================================================================
  // 2. CATALOG PAGE LOGIC (catalogo.html)
  // ==========================================================================
  function initCatalogPage() {
    const catalogGrid = document.getElementById("catalog-cards-grid");
    if (!catalogGrid) return;

    const filterPills = document.querySelectorAll(".filter-pill");
    const searchInput = document.getElementById("catalog-search-input");
    const searchClearBtn = document.getElementById("catalog-search-clear");
    const stockSummaryText = document.getElementById("stock-summary-text");

    const motoDetailModal = document.getElementById("moto-detail-modal");
    const btnCloseMotoDetail = document.getElementById("btn-close-moto-detail");
    const motoDetailAvatar = document.getElementById("moto-detail-avatar");
    const motoDetailHeaderTitle = document.getElementById("moto-detail-header-title");
    const motoDetailHeaderCategory = document.getElementById("moto-detail-header-category");
    const motoDetailBody = document.getElementById("moto-detail-body");

    // Read initial filter from URL param (e.g. ?cat=economica)
    const urlParams = new URLSearchParams(window.location.search);
    const initialCategory = urlParams.get("cat") || "todas";

    let currentFilter = initialCategory;
    let currentSearch = "";

    // Sync active filter pill based on URL
    filterPills.forEach(pill => {
      if (pill.dataset.filter === currentFilter) {
        filterPills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
      }
    });

    function renderCatalogCards() {
      let list = currentFilter === "todas" ? motos : motos.filter(m => m.categoria === currentFilter);

      if (currentSearch.trim()) {
        const q = currentSearch.trim().toLowerCase();
        list = list.filter(m => 
          m.marca.toLowerCase().includes(q) ||
          m.modelo.toLowerCase().includes(q) ||
          (m.categoriaLabel && m.categoriaLabel.toLowerCase().includes(q)) ||
          (m.cilindrada && m.cilindrada.toLowerCase().includes(q)) ||
          (m.tagline && m.tagline.toLowerCase().includes(q))
        );
      }

      catalogGrid.innerHTML = "";

      if (stockSummaryText) {
        stockSummaryText.textContent = `${list.length} modelo${list.length === 1 ? '' : 's'} disponible${list.length === 1 ? '' : 's'}`;
      }

      if (list.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "catalog-empty-state";
        emptyState.innerHTML = `
          <div class="empty-state-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
          </div>
          <h4>No encontramos modelos para "${currentSearch}"</h4>
          <p>¿Buscás otra cilindrada o marca específica? Consultanos directamente por WhatsApp para consultar ingresos de stock.</p>
          <a href="${buildWhatsAppUrl('Hola Motobox! Busco información de stock sobre: ' + currentSearch)}" class="btn-primary-hero" target="_blank" rel="noopener">
            Consultar a un Asesor
          </a>
        `;
        catalogGrid.appendChild(emptyState);
        return;
      }

      list.forEach((moto, idx) => {
        const card = document.createElement("article");
        card.className = "moto-card-modern visible";
        card.style.transitionDelay = `${idx * 40}ms`;

        const directWaMsg = `Hola Motobox! Quiero consultar por disponibilidad y entrega inmediata de la ${moto.marca} ${moto.modelo} 0km (${moto.cilindrada}).`;

        const images = (moto.imagenes && moto.imagenes.length) ? moto.imagenes : [moto.imagen];
        const hasGallery = images.length > 1;

        const galleryHtml = hasGallery
          ? `<div class="moto-gallery">
              <div class="moto-gallery-track">
                ${images.map((img, i) => `<div class="moto-gallery-slide"><img src="${img}" alt="${moto.marca} ${moto.modelo} 0km - Foto ${i + 1}" loading="lazy"></div>`).join('')}
              </div>
              <div class="moto-gallery-dots">
                ${images.map((_, i) => `<span class="gallery-dot${i === 0 ? ' active' : ''}" data-index="${i}"></span>`).join('')}
              </div>
            </div>`
          : `<img src="${images[0]}" alt="${moto.marca} ${moto.modelo} 0km" loading="lazy">`;

        card.innerHTML = `
          <div class="moto-card-header">
            ${moto.badge ? `<span class="moto-badge-tag">${moto.badge}</span>` : ""}
            ${galleryHtml}
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
                <span class="spec-v">${moto.cilindrada || '-'}</span>
              </div>
              <div class="spec-item">
                <span class="spec-k">Consumo</span>
                <span class="spec-v">${moto.consumo || '-'}</span>
              </div>
              <div class="spec-item">
                <span class="spec-k">Frenos</span>
                <span class="spec-v">${moto.frenos ? moto.frenos.split('/')[0] : '-'}</span>
              </div>
            </div>

            <div class="moto-card-actions">
              <a href="${buildWhatsAppUrl(directWaMsg)}" class="btn-card-whatsapp" target="_blank" rel="noopener">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                <span>Consultar por WhatsApp</span>
              </a>
            </div>
          </div>
        `;

        card.addEventListener("click", (e) => {
          if (e.target.closest(".btn-card-whatsapp") || e.target.closest(".gallery-dot")) {
            return;
          }
          openMotoDetail(moto.id);
        });

        catalogGrid.appendChild(card);
      });

      // Init dots observers on gallery cards
      document.querySelectorAll(".moto-gallery-track").forEach(track => {
        const dots = track.parentElement.querySelectorAll(".gallery-dot");
        if (dots.length < 2) return;
        const slides = track.querySelectorAll(".moto-gallery-slide");

        const obsv = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const idx = Array.from(slides).indexOf(entry.target);
              dots.forEach((d, i) => d.classList.toggle("active", i === idx));
            }
          });
        }, { root: track, threshold: 0.6 });

        slides.forEach(s => obsv.observe(s));

        dots.forEach(dot => {
          dot.addEventListener("click", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const i = parseInt(dot.dataset.index, 10);
            slides[i]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
          });
        });
      });
    }

    // Detail Modal Functionality
    function openMotoDetail(motoId) {
      const moto = motos.find(m => m.id === motoId);
      if (!moto || !motoDetailModal) return;

      const images = (moto.imagenes && moto.imagenes.length) ? moto.imagenes : [moto.imagen];
      const hasMultiple = images.length > 1;

      motoDetailAvatar.textContent = moto.marca.slice(0, 2).toUpperCase();
      motoDetailHeaderTitle.textContent = `${moto.marca} ${moto.modelo}`;
      motoDetailHeaderCategory.textContent = `${moto.categoriaLabel} · 0KM Nueva`;

      const directWaMsg = `Hola Motobox! Quiero consultar disponibilidad, colores y entrega inmediata para la ${moto.marca} ${moto.modelo} 0km (${moto.cilindrada}).`;

      const galleryHtml = `
        <div class="moto-detail-gallery-box">
          <div class="moto-detail-gallery-track" id="detail-gallery-track">
            ${images.map((img, i) => `
              <div class="moto-detail-gallery-slide">
                <img src="${img}" alt="${moto.marca} ${moto.modelo} - Foto ${i + 1}" loading="eager">
              </div>
            `).join('')}
          </div>
          ${hasMultiple ? `<span class="moto-detail-counter" id="detail-gallery-counter">1 / ${images.length}</span>` : ""}
        </div>
        ${hasMultiple ? `
          <div class="moto-detail-thumbs" id="detail-gallery-thumbs">
            ${images.map((img, i) => `
              <div class="moto-detail-thumb${i === 0 ? ' active' : ''}" data-index="${i}">
                <img src="${img}" alt="Thumbnail ${i + 1}">
              </div>
            `).join('')}
          </div>
        ` : ""}
      `;

      motoDetailBody.innerHTML = `
        ${galleryHtml}

        <div class="moto-detail-info">
          ${moto.badge ? `<span class="moto-badge-tag" style="position: static; display: inline-block; margin-bottom: 0.5rem;">${moto.badge}</span>` : ""}
          <p class="moto-detail-tagline">${moto.tagline}</p>

          <p class="moto-detail-section-title">Ficha Técnica Oficial 0KM</p>
          <div class="moto-detail-specs-grid">
            <div class="moto-detail-spec-card">
              <span class="spec-k">Cilindrada</span>
              <span class="spec-v">${moto.cilindrada || '-'}</span>
            </div>
            <div class="moto-detail-spec-card">
              <span class="spec-k">Potencia</span>
              <span class="spec-v">${moto.potencia || '-'}</span>
            </div>
            <div class="moto-detail-spec-card">
              <span class="spec-k">Consumo</span>
              <span class="spec-v">${moto.consumo || '-'}</span>
            </div>
            <div class="moto-detail-spec-card">
              <span class="spec-k">Frenos</span>
              <span class="spec-v">${moto.frenos || '-'}</span>
            </div>
            <div class="moto-detail-spec-card">
              <span class="spec-k">Tanque</span>
              <span class="spec-v">${moto.tanque || '-'}</span>
            </div>
            <div class="moto-detail-spec-card">
              <span class="spec-k">Arranque</span>
              <span class="spec-v">${moto.arranque || '-'}</span>
            </div>
          </div>

          <p class="moto-detail-section-title">Beneficios y Garantías 0KM</p>
          <div class="moto-detail-perks-box">
            <p style="font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 0.5rem; line-height: 1.45;">
              ${moto.perfilComprador}
            </p>
            <ul class="moto-detail-perks-list">
              <li><strong>✓</strong> Unidad 0km nueva de fábrica lista para entrega</li>
              <li><strong>✓</strong> Garantía oficial por escrito de la marca</li>
              <li><strong>✓</strong> Casco de seguridad homologado de regalo</li>
              <li><strong>✓</strong> Gestión y trámite de patentamiento bonificado</li>
            </ul>
          </div>

          <div class="moto-detail-actions">
            <a href="${buildWhatsAppUrl(directWaMsg)}" class="btn-match-whatsapp" target="_blank" rel="noopener">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              <span>Consultar Disponibilidad por WhatsApp</span>
            </a>
          </div>
        </div>
      `;

      if (hasMultiple) {
        const track = document.getElementById("detail-gallery-track");
        const counter = document.getElementById("detail-gallery-counter");
        const thumbs = document.querySelectorAll(".moto-detail-thumb");
        const slides = track.querySelectorAll(".moto-detail-gallery-slide");

        const galleryObs = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const idx = Array.from(slides).indexOf(entry.target);
              if (counter) counter.textContent = `${idx + 1} / ${images.length}`;
              thumbs.forEach((t, i) => t.classList.toggle("active", i === idx));
            }
          });
        }, { root: track, threshold: 0.6 });

        slides.forEach(s => galleryObs.observe(s));

        thumbs.forEach(thumb => {
          thumb.addEventListener("click", () => {
            const idx = parseInt(thumb.dataset.index, 10);
            slides[idx]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
          });
        });
      }

      motoDetailModal.classList.add("open");
      document.body.style.overflow = "hidden";
    }

    function closeMotoDetail() {
      if (motoDetailModal) {
        motoDetailModal.classList.remove("open");
        document.body.style.overflow = "";
      }
    }

    if (btnCloseMotoDetail) btnCloseMotoDetail.addEventListener("click", closeMotoDetail);
    if (motoDetailModal) {
      motoDetailModal.addEventListener("click", (e) => {
        if (e.target === motoDetailModal) closeMotoDetail();
      });
    }

    // Filter pills listeners
    filterPills.forEach(pill => {
      pill.addEventListener("click", () => {
        filterPills.forEach(p => p.classList.remove("active"));
        pill.classList.add("active");
        currentFilter = pill.dataset.filter;
        renderCatalogCards();
      });
    });

    // Search input listeners
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        currentSearch = e.target.value;
        if (searchClearBtn) {
          searchClearBtn.style.display = currentSearch.trim() ? "flex" : "none";
        }
        renderCatalogCards();
      });
    }

    if (searchClearBtn) {
      searchClearBtn.addEventListener("click", () => {
        if (searchInput) {
          searchInput.value = "";
          searchInput.focus();
        }
        searchClearBtn.style.display = "none";
        currentSearch = "";
        renderCatalogCards();
      });
    }

    // Keyboard controls for detail gallery
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeMotoDetail();

      if (motoDetailModal && motoDetailModal.classList.contains("open")) {
        const track = document.getElementById("detail-gallery-track");
        if (track) {
          const slides = track.querySelectorAll(".moto-detail-gallery-slide");
          if (slides.length > 1) {
            const currentIdx = Math.round(track.scrollLeft / track.clientWidth);
            if (e.key === "ArrowRight") {
              const nextIdx = Math.min(currentIdx + 1, slides.length - 1);
              slides[nextIdx]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
            } else if (e.key === "ArrowLeft") {
              const prevIdx = Math.max(currentIdx - 1, 0);
              slides[prevIdx]?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
            }
          }
        }
      }
    });

    // Initial render
    renderCatalogCards();

    // Listen to Realtime updates from CRM
    document.addEventListener("motobox:motos-updated", () => {
      console.log("[MotoBox Realtime] 🔄 Re-renderizando catálogo en vivo...");
      renderCatalogCards();
    });
  }

  // ==========================================================================
  // 3. GLOBAL BEHAVIORS (Scroll, Navbar, Observers)
  // ==========================================================================
  let lastScrollY = 0;
  let ticking = false;

  function handleScroll() {
    if (!header) return;
    const scrollY = window.scrollY;

    if (scrollY > 25) {
      header.classList.add("scrolled");
    } else {
      header.classList.remove("scrolled");
    }

    if (scrollY > 300) {
      if (scrollY > lastScrollY + 6) {
        header.classList.add("header-hidden");
      } else if (scrollY < lastScrollY - 6) {
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

  // Async initialization to load CRM data from Supabase before rendering
  async function initApp() {
    if (typeof initDataFromCRM === "function") {
      try {
        await initDataFromCRM();
      } catch (e) {
        console.error("Error loading CRM data:", e);
      }
    }

    if (currentPage === "home") {
      initHomePage();
    } else if (currentPage === "catalogo") {
      initCatalogPage();
    }

    // Safe reveal observer (ensures no element stays invisible)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          const delay = parseInt(entry.target.style.transitionDelay, 10) || (i * 50);
          setTimeout(() => {
            entry.target.classList.add("visible");
          }, delay);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.02, rootMargin: "0px 0px 50px 0px" });

    document.querySelectorAll(".reveal-on-scroll").forEach(el => observer.observe(el));

    handleScroll();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }

})();
