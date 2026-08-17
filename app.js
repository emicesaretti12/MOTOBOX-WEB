/* ========================================================================
   MOTOBOX — Application Logic
   Renders catalog, handles filtering, scroll animations, and navigation.
   ======================================================================== */

(function () {
  "use strict";

  // --- DOM References ---
  const catalogGrid = document.getElementById("catalog-grid");
  const menuToggle = document.getElementById("menu-toggle");
  const mobileNav = document.getElementById("mobile-nav");
  const header = document.getElementById("header");
  const fab = document.getElementById("whatsapp-fab");

  // --- WhatsApp link builder ---
  function buildWhatsAppLink(moto) {
    const message = moto
      ? `Hola, quiero info sobre la ${moto.marca} ${moto.modelo}`
      : "Hola, quiero info sobre las motos disponibles";
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  }

  // --- Format price ---
  function formatPrice(price) {
    if (!price) return null;
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }).format(price);
  }

  // --- WhatsApp SVG icon (inline) ---
  const waIcon = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`;

  // --- Render catalog cards ---
  function renderCatalog(filter) {
    const filtered =
      filter === "todas"
        ? motos
        : motos.filter((m) => m.categoria === filter);

    catalogGrid.innerHTML = "";

    filtered.forEach((moto, index) => {
      const card = document.createElement("article");
      card.className = "moto-card reveal";
      card.style.transitionDelay = `${index * 60}ms`;

      const priceHTML = moto.precio
        ? `<span class="moto-card__price">${formatPrice(moto.precio)}</span>`
        : `<span class="moto-card__price moto-card__price--consult">Consultar precio</span>`;

      let badgeHTML = "";
      if (!moto.disponible) {
        badgeHTML = `<span class="moto-card__badge moto-card__badge--sold">Reservada</span>`;
      } else if (moto.destacada) {
        badgeHTML = `<span class="moto-card__badge moto-card__badge--new">Destacada</span>`;
      }

      card.innerHTML = `
        ${badgeHTML}
        <div class="moto-card__image">
          <img src="${moto.imagen}" alt="${moto.marca} ${moto.modelo}" loading="lazy">
        </div>
        <div class="moto-card__body">
          <p class="moto-card__brand">${moto.marca}</p>
          <h3 class="moto-card__model">${moto.modelo}</h3>
          <p class="moto-card__cc">${moto.cilindrada}</p>
          <div class="moto-card__footer">
            ${priceHTML}
            <a href="${buildWhatsAppLink(moto)}" class="moto-card__cta" target="_blank" rel="noopener">
              ${waIcon} Consultar
            </a>
          </div>
        </div>
      `;

      catalogGrid.appendChild(card);
    });

    // Re-observe new cards for scroll animation
    requestAnimationFrame(() => {
      document.querySelectorAll(".moto-card.reveal").forEach((el) => {
        scrollObserver.observe(el);
      });
    });
  }

  // --- Filter buttons ---
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelector(".filter-btn.active").classList.remove("active");
      btn.classList.add("active");
      renderCatalog(btn.dataset.filter);
    });
  });

  // --- Category cards click → filter catalog ---
  document.querySelectorAll(".category-card").forEach((card) => {
    card.addEventListener("click", (e) => {
      e.preventDefault();
      const category = card.dataset.category;
      
      // Set the active filter
      document.querySelector(".filter-btn.active").classList.remove("active");
      const targetBtn = document.querySelector(`.filter-btn[data-filter="${category}"]`);
      if (targetBtn) {
        targetBtn.classList.add("active");
        renderCatalog(category);
      }

      // Scroll to catalog
      document.getElementById("catalogo").scrollIntoView({ behavior: "smooth" });
    });
  });

  // --- Mobile nav toggle ---
  menuToggle.addEventListener("click", () => {
    menuToggle.classList.toggle("active");
    mobileNav.classList.toggle("active");
    document.body.classList.toggle("nav-open");
  });

  // Close mobile nav on link click
  document.querySelectorAll(".mobile-nav__link, .mobile-nav__cta").forEach((link) => {
    link.addEventListener("click", () => {
      menuToggle.classList.remove("active");
      mobileNav.classList.remove("active");
      document.body.classList.remove("nav-open");
    });
  });

  // --- Header scroll state ---
  let lastScroll = 0;
  function handleScroll() {
    const scrollY = window.scrollY;

    // Header background
    if (scrollY > 40) {
      header.classList.add("header--scrolled");
    } else {
      header.classList.remove("header--scrolled");
    }

    // WhatsApp FAB visibility
    if (scrollY > 400) {
      fab.classList.add("visible");
    } else {
      fab.classList.remove("visible");
    }

    lastScroll = scrollY;
  }

  window.addEventListener("scroll", handleScroll, { passive: true });

  // --- Scroll reveal (Intersection Observer) ---
  const scrollObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
          scrollObserver.unobserve(entry.target);
        }
      });
    },
    {
      threshold: 0.1,
      rootMargin: "0px 0px -40px 0px",
    }
  );

  document.querySelectorAll(".reveal").forEach((el) => {
    scrollObserver.observe(el);
  });

  // --- Smooth scroll for anchor links ---
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });

  // --- Image load handler ---
  function handleImageLoad() {
    document.querySelectorAll("img").forEach((img) => {
      if (img.complete) {
        img.classList.add("loaded");
      } else {
        img.addEventListener("load", () => img.classList.add("loaded"));
        img.addEventListener("error", () => {
          img.classList.add("loaded");
          img.style.opacity = "0.3";
        });
      }
    });
  }

  // --- Init ---
  renderCatalog("todas");
  handleScroll();
  handleImageLoad();
})();

