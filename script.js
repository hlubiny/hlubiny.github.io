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
  const debugBubbles = false; // toggle to true if you need to debug visuals
  const config = {
    maxConcurrent: 20,
    spawnIntervalMs: 800,
    minSize: 18,
    maxSize: 25,
    minDuration: 9000,
    maxDuration: 16000,
  };
  if (debugBubbles) document.body.classList.add('debug-bubbles');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bubblesLayer = document.getElementById('bubbles-layer');
  let bubbleCount = 0;
  let spawnTimer = null;

  function random(min, max) { return Math.random() * (max - min) + min; }

  function spawnBubble() {
    if (!bubblesLayer) return;
    if (prefersReduced) return;
    if (bubbleCount >= config.maxConcurrent) return;

    // wrapper for animation, inner for visual + pointer push
    const wrap = document.createElement('div');
    wrap.className = 'bubble-wrap';
    const b = document.createElement('div');
    b.className = 'bubble';

    const size = random(config.minSize, config.maxSize);
    const left = random(0, window.innerWidth - size);
    const duration = random(config.minDuration, config.maxDuration);
    const delay = random(0, 1200);
    const drift = random(-20, 20);

    // size on inner bubble
    b.style.width = `${size}px`;
    b.style.height = `${size}px`;
    // position and animation on wrapper
    wrap.style.left = `${left}px`;
    wrap.style.setProperty('--bx', `${drift}px`);
    wrap.style.setProperty('--bs', `${size / 24}`);
    // Only vertical rise animation
    wrap.style.animationDuration = `${duration}ms`;
    wrap.style.animationDelay = `${delay}ms`;

    function cleanup() {
      wrap.removeEventListener('animationend', onEnd);
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      // remove from tracking
      bubbleNodes.delete(b);
      currentOffset.delete(b);
      wrapNodes.delete(wrap);
      swayState.delete(wrap);
      bubbleCount = Math.max(0, bubbleCount - 1);
    }
    function onEnd(e) { if (e.animationName === 'bubble-rise') cleanup(); }
    wrap.addEventListener('animationend', onEnd);

    wrap.appendChild(b);
    bubblesLayer.appendChild(wrap);
    // track for repel + sway
    bubbleNodes.add(b);
    currentOffset.set(b, { x: 0, y: 0 });
    wrapNodes.add(wrap);
    swayState.set(wrap, {
      base: drift,
      amp: random(8, 22),
      freq: random(0.0015, 0.0035),
      phase: random(0, Math.PI * 2),
    });
    currentVelocity.set(b, { vx: 0, vy: 0 });
    bubbleCount += 1;
    // optional console logs when debugging
    if (debugBubbles && typeof console !== 'undefined') console.log('bubble', { size: Math.round(size), left: Math.round(left) });
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

  // Verify bubble image loads; logs result to console
  (function testBubbleAsset() {
    const img = new Image();
    img.onload = function () {
      if (typeof console !== 'undefined') console.log('bubble.png loaded', img.width + 'x' + img.height);
      document.body.classList.remove('bubbles-image-missing');
    };
    img.onerror = function () {
      if (typeof console !== 'undefined') console.error('bubble.png NOT found at ./graphics/bubble.png');
      document.body.classList.add('bubbles-image-missing');
    };
    img.src = './graphics/bubble.png';
  })();

  // Pointer/touch repel with physics + horizontal sway
  const REPEL_RADIUS = 360; // px
  const REPEL_FORCE = 0.6;  // base force (px per frame^2 at 60fps)
  const DAMPING = 0.90;     // velocity damping per frame
  const BUOYANCY = -0.08;   // gentle upward force per frame
  const bubbleNodes = new Set();        // inner visual nodes
  const wrapNodes = new Set();          // wrapper nodes
  const currentOffset = new WeakMap();  // node -> { x, y }
  const currentVelocity = new WeakMap();// node -> { vx, vy }
  const swayState = new WeakMap();      // wrap -> { base, amp, freq, phase }
  let pointerX = -9999;
  let pointerY = -9999;

  function lerp(a, b, t) { return a + (b - a) * t; }

  function trackBubbles() {
    document.querySelectorAll('.bubble').forEach((n) => bubbleNodes.add(n));
  }
  trackBubbles();

  let lastTs = 0;
  function loop(ts) {
    const dt = Math.max(8, Math.min(32, lastTs ? (ts - lastTs) : 16));
    const dtF = dt / 16;
    bubbleNodes.forEach((node) => {
      if (!node.isConnected) { bubbleNodes.delete(node); return; }
      const rect = node.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = cx - pointerX;
      const dy = cy - pointerY;
      const dist = Math.hypot(dx, dy);
      // Physics: forces and integration
      const pos = currentOffset.get(node) || { x: 0, y: 0 };
      const vel = currentVelocity.get(node) || { vx: 0, vy: 0 };
      let fx = 0, fy = BUOYANCY; // buoyancy upward
      if (dist < REPEL_RADIUS) {
        const strength = 1 - dist / REPEL_RADIUS;
        const nx = dx / (dist || 1);
        const ny = dy / (dist || 1);
        const f = REPEL_FORCE * strength;
        fx += nx * f;
        fy += ny * f;
      }
      vel.vx = (vel.vx + fx * dtF) * Math.pow(DAMPING, dtF);
      vel.vy = (vel.vy + fy * dtF) * Math.pow(DAMPING, dtF);
      const vmax = 4;
      vel.vx = Math.max(-vmax, Math.min(vmax, vel.vx));
      vel.vy = Math.max(-vmax, Math.min(vmax, vel.vy));
      pos.x += vel.vx * dtF;
      pos.y += vel.vy * dtF;
      if (dist >= REPEL_RADIUS && pos.y > 0) pos.y = Math.max(0, pos.y - 0.02 * dtF);
      currentVelocity.set(node, vel);
      currentOffset.set(node, pos);
      node.style.setProperty('--pushX', `${pos.x.toFixed(2)}px`);
      node.style.setProperty('--pushY', `${pos.y.toFixed(2)}px`);
    });
    // horizontal sway for wrappers updated via CSS var --bx
    wrapNodes.forEach((wrap) => {
      if (!wrap.isConnected) { wrapNodes.delete(wrap); swayState.delete(wrap); return; }
      const st = swayState.get(wrap);
      if (!st) return;
      const bx = st.base + st.amp * Math.sin(ts * st.freq + st.phase);
      wrap.style.setProperty('--bx', `${bx.toFixed(2)}px`);
    });
    lastTs = ts;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  window.addEventListener('pointermove', (e) => { pointerX = e.clientX; pointerY = e.clientY; }, { passive: true });
  window.addEventListener('pointerleave', () => { pointerX = -9999; pointerY = -9999; }, { passive: true });
  window.addEventListener('touchmove', (e) => {
    const t = e.touches && e.touches[0]; if (t) { pointerX = t.clientX; pointerY = t.clientY; }
  }, { passive: true });
  window.addEventListener('touchend', () => { pointerX = -9999; pointerY = -9999; }, { passive: true });
});

