document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Smooth scroll is handled by CSS (scroll-behavior). Fallback for older browsers.
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Bubble spawner configuration
  const config = {
    maxConcurrent: 20,          // maximum bubbles on screen
    spawnIntervalMs: 800,       // how often to try spawning (lower = more)
    minSize: 8,                 // px
    maxSize: 36,                // px
    minDuration: 9000,          // ms rise duration
    maxDuration: 16000,         // ms rise duration
  };

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bubblesLayer = document.getElementById('bubbles-layer');
  let bubbleCount = 0;
  let spawnTimer = null;

  function random(min, max) { return Math.random() * (max - min) + min; }

  function spawnBubble() {
    if (!bubblesLayer) return;
    if (prefersReduced) return;
    if (bubbleCount >= config.maxConcurrent) return;

    const b = document.createElement('div');
    b.className = 'bubble';

    const size = random(config.minSize, config.maxSize);
    const left = random(0, window.innerWidth - size);
    const duration = random(config.minDuration, config.maxDuration);
    const delay = random(0, 1200);
    const drift = random(-20, 20);

    b.style.width = `${size}px`;
    b.style.height = `${size}px`;
    b.style.left = `${left}px`;
    b.style.setProperty('--bx', `${drift}px`);
    b.style.setProperty('--bs', `${size / 24}`);
    b.style.animationDuration = `${duration}ms, ${Math.round(duration / 6)}ms`;
    b.style.animationDelay = `${delay}ms, 0ms`;

    function cleanup() {
      b.removeEventListener('animationend', onEnd);
      if (b.parentNode) b.parentNode.removeChild(b);
      bubbleCount = Math.max(0, bubbleCount - 1);
    }
    function onEnd(e) { if (e.animationName === 'bubble-rise') cleanup(); }
    b.addEventListener('animationend', onEnd);

    bubblesLayer.appendChild(b);
    bubbleCount += 1;
  }

  function startSpawning() {
    if (!bubblesLayer || prefersReduced) return;
    if (spawnTimer) return;
    spawnTimer = window.setInterval(spawnBubble, config.spawnIntervalMs);
  }

  function stopSpawning() {
    if (spawnTimer) {
      window.clearInterval(spawnTimer);
      spawnTimer = null;
    }
  }

  // Pause when not visible to save resources
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopSpawning(); }
    else { startSpawning(); }
  });

  // Kick off
  startSpawning();
});

