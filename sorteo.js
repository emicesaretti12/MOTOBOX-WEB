(function () {
  "use strict";

  if (document.body.dataset.page !== 'sorteo') return;

  // --- FAQ Accordion ---
  const faqItems = document.querySelectorAll('#sorteo-faq-list .faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-question');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const wasActive = item.classList.contains('active');
      faqItems.forEach(i => i.classList.remove('active'));
      if (!wasActive) item.classList.add('active');
    });
  });

  // --- Counter Animation ---
  const counterValue = document.getElementById('counter-value');
  const counterBarFill = document.getElementById('counter-bar-fill');
  const TARGET = 147;
  const TOTAL = 200;

  if (counterValue && counterBarFill) {
    const counterObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        // Animate bar
        counterBarFill.style.width = ((TARGET / TOTAL) * 100).toFixed(1) + '%';

        // Animate number
        const duration = 2000;
        const start = performance.now();

        function tick(now) {
          let t = Math.min((now - start) / duration, 1);
          // easeOutCubic
          t = 1 - Math.pow(1 - t, 3);
          counterValue.textContent = Math.round(t * TARGET);
          if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);

        counterObserver.disconnect();
      });
    }, { threshold: 0.3 });

    counterObserver.observe(counterBarFill.closest('.sorteo-counter-card') || counterBarFill);
  }

  // --- Reveal on Scroll ---
  const reveals = document.querySelectorAll('[data-reveal]');
  if (reveals.length) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('revealed');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px 40px 0px' });

    reveals.forEach(el => revealObserver.observe(el));
  }

  // --- Urgency pulse ---
  const liveIndicator = document.querySelector('.live-indicator');
  if (liveIndicator) {
    setInterval(() => {
      liveIndicator.classList.add('pulse-live');
      setTimeout(() => liveIndicator.classList.remove('pulse-live'), 1000);
    }, 4000);
  }
})();
