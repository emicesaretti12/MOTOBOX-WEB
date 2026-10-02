(function() {
  "use strict";

  // --- CONFIG ---
  const WHATSAPP_NUM = "5493516312930";
  const WHEEL_PLAYED_KEY = "motobox_wheel_played";
  const DAY_IN_MS = 24 * 60 * 60 * 1000;
  
  const WHEEL_SEGMENTS = [
    { label: '10% OFF', color: '#e02e24', textColor: '#fff', emoji: '🔥', description: '10% de descuento en tu próxima moto 0km', type: 'discount' },
    { label: '+2 Chances', color: '#1d1d1f', textColor: '#fff', emoji: '🎰', description: '2 chances extra en el sorteo por la moto', type: 'chances' },
    { label: '5% OFF', color: '#f5f5f7', textColor: '#1d1d1f', emoji: '💰', description: '5% de descuento en tu próxima moto 0km', type: 'discount' },
    { label: 'Casco Gratis', color: '#e02e24', textColor: '#fff', emoji: '⛑️', description: 'Casco de seguridad homologado gratis con tu compra', type: 'prize' },
    { label: '+1 Chance', color: '#1d1d1f', textColor: '#fff', emoji: '🎟️', description: '1 chance extra en el sorteo por la moto', type: 'chances' },
    { label: '15% OFF', color: '#f5f5f7', textColor: '#1d1d1f', emoji: '⭐', description: '15% de descuento en tu próxima moto 0km', type: 'discount' },
    { label: 'Manual Gratis', color: '#e02e24', textColor: '#fff', emoji: '📖', description: 'Manual de Mantenimiento gratis + participás del sorteo', type: 'prize' },
    { label: '+3 Chances', color: '#1d1d1f', textColor: '#fff', emoji: '🏍️', description: '3 chances extra en el sorteo por la moto 0km', type: 'chances' }
  ];

  // --- AUDIO ---
  let audioCtx = null;
  function playTick() {
    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
      
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
      
      osc.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
    } catch(e) {
      // Ignore audio errors (e.g. autoplay policies)
    }
  }

  // --- WHEEL LOGIC ---
  function initWheel() {
    const lastPlayed = localStorage.getItem(WHEEL_PLAYED_KEY);
    if (lastPlayed && (Date.now() - parseInt(lastPlayed, 10)) < DAY_IN_MS) {
      return; // Already played in last 24h
    }

    setTimeout(() => {
      createWheelModal();
    }, 2000);
  }

  function createWheelModal() {
    if (document.getElementById('wheel-modal')) return;

    const modalHTML = `
      <div class="wheel-modal-backdrop" id="wheel-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;opacity:0;transition:opacity 0.4s ease;">
        <div class="wheel-modal-card" style="background:#fff;border-radius:20px;padding:30px;width:90%;max-width:400px;text-align:center;position:relative;box-shadow:0 10px 40px rgba(0,0,0,0.5);transform:scale(0.9);transition:transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
          <button class="wheel-close-btn" id="wheel-close-btn" style="display:none;position:absolute;top:15px;right:15px;background:none;border:none;font-size:24px;cursor:pointer;color:#999;">✕</button>
          <h2 class="wheel-modal-title" style="margin:0 0 10px;font-size:24px;color:#1d1d1f;font-weight:700;">🎰 ¡Girá y Ganá!</h2>
          <p class="wheel-modal-subtitle" style="margin:0 0 20px;font-size:15px;color:#86868b;">Tenés un giro gratis en la Ruleta de Beneficios MOTOBOX</p>
          <div class="wheel-container" style="position:relative;width:280px;height:280px;margin:0 auto 20px;">
            <div class="wheel-pointer" style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);width:30px;height:30px;background:#e02e24;clip-path:polygon(50% 100%, 0 0, 100% 0);z-index:10;"></div>
            <canvas id="wheel-canvas" width="280" height="280" style="width:100%;height:100%;border-radius:50%;box-shadow:0 4px 15px rgba(0,0,0,0.2);"></canvas>
          </div>
          <button class="wheel-spin-btn" id="wheel-spin-btn" style="background:#e02e24;color:#fff;border:none;padding:14px 28px;border-radius:30px;font-size:16px;font-weight:600;cursor:pointer;width:100%;transition:background 0.3s;">¡Girá la Ruleta!</button>
          <div class="wheel-result-overlay" id="wheel-result" style="display:none;position:absolute;top:0;left:0;width:100%;height:100%;background:#fff;border-radius:20px;flex-direction:column;align-items:center;justify-content:center;padding:30px;box-sizing:border-box;"></div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Initial animation
    requestAnimationFrame(() => {
      const modal = document.getElementById('wheel-modal');
      const card = modal.querySelector('.wheel-modal-card');
      modal.style.opacity = '1';
      card.style.transform = 'scale(1)';
    });

    setupCanvas();
    document.getElementById('wheel-spin-btn').addEventListener('click', spinWheel);
    document.getElementById('wheel-close-btn').addEventListener('click', closeWheelModal);
  }

  let canvasRot = 0;
  let isSpinning = false;
  let canvas, ctx;
  const numSegments = WHEEL_SEGMENTS.length;
  const arcSize = (2 * Math.PI) / numSegments;

  function setupCanvas() {
    canvas = document.getElementById('wheel-canvas');
    ctx = canvas.getContext('2d');
    
    // Handle retina display
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    ctx.scale(dpr, dpr);
    
    drawWheel();
  }

  function drawWheel(rotation = 0) {
    const w = 280;
    const h = 280;
    const cx = w / 2;
    const cy = h / 2;
    const r = w / 2;

    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rotation);

    for (let i = 0; i < numSegments; i++) {
      const seg = WHEEL_SEGMENTS[i];
      const startAngle = i * arcSize - Math.PI / 2; // start from top
      const endAngle = startAngle + arcSize;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, startAngle, endAngle);
      ctx.fillStyle = seg.color;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.stroke();

      // Text
      ctx.save();
      ctx.rotate(startAngle + arcSize / 2);
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = seg.textColor;
      ctx.font = 'bold 14px "Helvetica Neue", Helvetica, Arial, sans-serif';
      // Rotate text to read from outside in
      ctx.translate(r - 20, 0);
      ctx.fillText(seg.label, 0, 0);
      ctx.restore();
    }

    // Inner circle
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.25, 0, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 10;
    
    // MOTOBOX text
    ctx.fillStyle = '#1d1d1f';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px Arial';
    ctx.fillText('MOTO', 0, -6);
    ctx.fillText('BOX', 0, 6);

    ctx.restore();
  }

  function spinWheel() {
    if (isSpinning) return;
    isSpinning = true;

    // init audio context on user interaction
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    const btn = document.getElementById('wheel-spin-btn');
    btn.style.opacity = '0.5';
    btn.style.cursor = 'not-allowed';
    btn.textContent = 'Girando...';

    const winnerIndex = Math.floor(Math.random() * numSegments);
    const winnerSegment = WHEEL_SEGMENTS[winnerIndex];

    // Calculate rotation to land exactly on the winner segment
    // We want the winner segment center to end up at the top (-PI/2 in our drawing space)
    const extraSpins = 5 + Math.floor(Math.random() * 3);
    const targetRotation = (extraSpins * 2 * Math.PI) - (winnerIndex * arcSize) - (arcSize / 2);
    
    const duration = 5000;
    const startRotation = canvasRot;
    const startTime = performance.now();
    let lastTickAngle = startRotation;

    function animate(currentTime) {
      const elapsed = currentTime - startTime;
      let progress = elapsed / duration;
      
      if (progress > 1) progress = 1;
      
      // easeOutCubic
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      
      canvasRot = startRotation + (targetRotation - startRotation) * easeProgress;
      
      // Tick sound
      const currentSegment = Math.floor((-canvasRot / arcSize) + numSegments * 100) % numSegments;
      const lastSegment = Math.floor((-lastTickAngle / arcSize) + numSegments * 100) % numSegments;
      if (currentSegment !== lastSegment) {
        playTick();
      }
      lastTickAngle = canvasRot;

      drawWheel(canvasRot);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        finishSpin(winnerSegment);
      }
    }

    requestAnimationFrame(animate);
  }

  function finishSpin(winner) {
    localStorage.setItem(WHEEL_PLAYED_KEY, Date.now());
    
    const resultDiv = document.getElementById('wheel-result');
    const closeBtn = document.getElementById('wheel-close-btn');
    
    let btnText, btnLink;
    const wpMsg = encodeURIComponent(`Hola Motobox! Gané ${winner.label} (${winner.description}) en la Ruleta de Beneficios. Quiero reclamarlo.`);

    if (winner.type === 'discount' || winner.type === 'prize') {
      btnText = (winner.type === 'discount') ? 'Reclamar mi descuento' : 'Reclamar mi premio';
      btnLink = `https://wa.me/${WHATSAPP_NUM}?text=${wpMsg}`;
    } else {
      btnText = '¡Genial! Ver el Sorteo';
      btnLink = 'sorteo.html';
    }

    resultDiv.innerHTML = `
      <div style="font-size:60px;margin-bottom:10px;">${winner.emoji}</div>
      <h3 style="font-size:24px;margin:0 0 10px;color:#1d1d1f;">¡Ganaste ${winner.label}!</h3>
      <p style="font-size:16px;color:#86868b;margin:0 0 25px;">${winner.description}</p>
      <a href="${btnLink}" style="display:inline-block;background:#e02e24;color:#fff;text-decoration:none;padding:14px 28px;border-radius:30px;font-size:16px;font-weight:600;width:100%;box-sizing:border-box;">${btnText}</a>
    `;

    resultDiv.style.display = 'flex';
    resultDiv.style.opacity = '0';
    
    setTimeout(() => {
      resultDiv.style.transition = 'opacity 0.5s ease';
      resultDiv.style.opacity = '1';
      closeBtn.style.display = 'block';
      fireConfetti();
    }, 500);
  }

  function closeWheelModal() {
    const modal = document.getElementById('wheel-modal');
    modal.style.opacity = '0';
    setTimeout(() => {
      if (modal.parentNode) modal.parentNode.removeChild(modal);
    }, 400);
  }

  function fireConfetti() {
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div');
      confetti.style.position = 'fixed';
      confetti.style.left = Math.random() * 100 + 'vw';
      confetti.style.top = '-10px';
      confetti.style.width = '10px';
      confetti.style.height = '10px';
      confetti.style.backgroundColor = ['#e02e24', '#1d1d1f', '#f5f5f7', '#ffd700', '#00c3ff'][Math.floor(Math.random() * 5)];
      confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '0';
      confetti.style.zIndex = '10000';
      confetti.style.pointerEvents = 'none';
      
      document.body.appendChild(confetti);

      const duration = Math.random() * 3 + 2;
      const animationName = 'confetti-fall-' + i;
      
      const style = document.createElement('style');
      style.innerHTML = `
        @keyframes ${animationName} {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100vh) rotate(${Math.random() * 720}deg); opacity: 0; }
        }
      `;
      document.head.appendChild(style);

      confetti.style.animation = `${animationName} ${duration}s ease-in forwards`;

      setTimeout(() => {
        if (confetti.parentNode) confetti.parentNode.removeChild(confetti);
        if (style.parentNode) style.parentNode.removeChild(style);
      }, duration * 1000);
    }
  }

  // --- SORTEO PAGE SPECIFIC ---
  function initSorteoPage() {
    if (document.body.dataset.page !== 'sorteo') return;

    // FAQ Accordion
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
      const question = item.querySelector('.faq-question');
      if (question) {
        question.addEventListener('click', () => {
          const isActive = item.classList.contains('active');
          // close all
          faqItems.forEach(i => i.classList.remove('active'));
          if (!isActive) {
            item.classList.add('active');
          }
        });
      }
    });

    // Counter Animation
    const counterBar = document.getElementById('counter-bar-fill');
    const counterText = document.getElementById('counter-value');
    
    if (counterBar && counterText) {
      const targetValue = 147; // manuales vendidos
      const totalValue = 200;
      const targetPercentage = (targetValue / totalValue) * 100;
      
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            // Animate bar
            counterBar.style.transition = 'width 2s cubic-bezier(0.22, 1, 0.36, 1)';
            counterBar.style.width = `${targetPercentage}%`;
            
            // Animate number
            let start = 0;
            const duration = 2000;
            const startTime = performance.now();
            
            function animateNumber(currentTime) {
              const elapsed = currentTime - startTime;
              let progress = elapsed / duration;
              if (progress > 1) progress = 1;
              
              // easeOutCubic
              const easeProgress = 1 - Math.pow(1 - progress, 3);
              const currentVal = Math.floor(easeProgress * targetValue);
              
              counterText.textContent = currentVal;
              
              if (progress < 1) {
                requestAnimationFrame(animateNumber);
              } else {
                counterText.textContent = targetValue;
              }
            }
            requestAnimationFrame(animateNumber);
            
            observer.disconnect(); // Only animate once
          }
        });
      }, { threshold: 0.5 });
      
      observer.observe(counterBar.parentElement);
    }
  }

  // --- INIT ---
  document.addEventListener('DOMContentLoaded', () => {
    initWheel();
    initSorteoPage();
  });

})();
