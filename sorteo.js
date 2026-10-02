(function () {
  "use strict";

  if (document.body.dataset.page !== "sorteo") return;

  // ── FAQ Accordion ──
  var faqItems = document.querySelectorAll("#sorteo-faq-list .faq-item");
  faqItems.forEach(function (item) {
    var btn = item.querySelector(".faq-question");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var wasActive = item.classList.contains("active");
      faqItems.forEach(function (i) { i.classList.remove("active"); });
      if (!wasActive) item.classList.add("active");
    });
  });

  // ── Counter Animation ──
  var counterVal = document.getElementById("counter-value");
  var counterFill = document.getElementById("counter-bar-fill");
  var TARGET = 147;
  var TOTAL = 200;

  if (counterVal && counterFill) {
    var counterObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        counterFill.style.width = ((TARGET / TOTAL) * 100).toFixed(1) + "%";
        var duration = 2000;
        var start = performance.now();
        function tick(now) {
          var t = Math.min((now - start) / duration, 1);
          t = 1 - Math.pow(1 - t, 3);
          counterVal.textContent = Math.round(t * TARGET);
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
        counterObs.disconnect();
      });
    }, { threshold: 0.3 });
    counterObs.observe(counterFill.closest(".sorteo-counter-card") || counterFill);
  }

  // ── Reveal on Scroll ──
  var reveals = document.querySelectorAll("[data-reveal]");
  if (reveals.length) {
    var revealObs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          revealObs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: "0px 0px 40px 0px" });
    reveals.forEach(function (el) { revealObs.observe(el); });
  }

})();
