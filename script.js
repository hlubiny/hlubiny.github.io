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
    spawnIntervalMs: 800,
    minSize: 20,
    maxSize: 25,
  };
  const RISE_SPEED_PX_PER_S = 60; // constant vertical speed
  if (debugBubbles) document.body.classList.add('debug-bubbles');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bubblesLayer = document.getElementById('bubbles-layer');
  let bubbleCount = 0;
  let spawnTimer = null;

  function random(min, max) { return Math.random() * (max - min) + min; }

  // Shared interaction state (must be declared before use in spawnBubble)
  const bubbleNodes = new Set();        // inner visual nodes
  const wrapNodes = new Set();          // wrapper nodes
  const currentOffset = new WeakMap();  // node -> { x, y }
  const currentVelocity = new WeakMap();// node -> { vx, vy }
  const swayState = new WeakMap();      // wrap -> { base, amp, freq, phase }
  const wrapCleanup = new WeakMap();    // wrap -> cleanup fn
  let pointerX = -9999;
  let pointerY = -9999;

  function spawnBubble(opts) {
    if (!bubblesLayer) return;
    if (prefersReduced) return;
    // no hard cap; spawn rate controls density

    // wrapper for animation, inner for visual + pointer push
    const wrap = document.createElement('div');
    wrap.className = 'bubble-wrap';
    const b = document.createElement('div');
    b.className = 'bubble';

    const size = random(config.minSize, config.maxSize);
    const left = random(0, window.innerWidth - size);
    // Duration derived from travel distance to ensure constant speed
    const delay = (opts && typeof opts.delayOffsetMs === 'number') ? random(0, 600) : 0;
    const drift = random(-20, 20);
    // world-space starting position: just below current viewport
    const startTop = (opts && typeof opts.preTop === 'number')
      ? opts.preTop
      : (window.scrollY + window.innerHeight + random(10, 80));
    // Ensure travel reaches past the top of the page regardless of document height
    // Travel = distance from spawn point to above the top + small margin
    const travelY = (opts && typeof opts.travelY === 'number')
      ? Math.max(600, Math.round(opts.travelY))
      : Math.max(600, Math.round(startTop + 200));

    // size on inner bubble
    b.style.width = `${size}px`;
    b.style.height = `${size}px`;
    // position and animation on wrapper
    wrap.style.left = `${left}px`;
    wrap.style.top = `${startTop}px`;
    wrap.style.setProperty('--travelY', `${Math.round(travelY)}px`);
    wrap.style.setProperty('--bx', `${drift}px`);
    wrap.style.setProperty('--bs', `${size / 24}`);
    // Only vertical rise animation; preProgress currently unused (prewarm disabled)
    const duration = Math.max(2000, Math.round((travelY / RISE_SPEED_PX_PER_S) * 1000));
    wrap.style.animationDuration = `${duration}ms`;
    const progress = (opts && typeof opts.progress === 'number') ? Math.min(Math.max(opts.progress, 0), 0.95) : 0;
    const extraDelay = (opts && typeof opts.delayOffsetMs === 'number') ? opts.delayOffsetMs : 0;
    // allow negative delay to start mid-animation (prewarm). For normal spawns, delay is 0 for snappy entry.
    const animDelayMs = Number((delay + extraDelay - progress * duration).toFixed(0));
    wrap.style.animationDelay = `${animDelayMs}ms`;

    // Track world-space animation state for correct off-screen cleanup
    wrap._startTopPx = startTop;
    wrap._travelYPx = travelY;
    wrap._durationMs = duration;
    wrap._delayMs = animDelayMs;
    wrap._startTs = performance.now();
    wrap._sizePx = size;

    function cleanup() {
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
      // remove from tracking
      bubbleNodes.delete(b);
      currentOffset.delete(b);
      wrapNodes.delete(wrap);
      swayState.delete(wrap);
      wrapCleanup.delete(wrap);
      bubbleCount = Math.max(0, bubbleCount - 1);
    }
    // register cleanup for off-screen removal
    wrapCleanup.set(wrap, cleanup);

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
    spawnTimer = window.setInterval(() => spawnBubble(), config.spawnIntervalMs);
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
  function sizeBubblesLayer() {
    if (!bubblesLayer) return;
    const h = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    bubblesLayer.style.height = `${h}px`;
    // Match world height for texture overlays as well
    document.querySelectorAll('.texture').forEach((el) => {
      el.style.height = `${h}px`;
    });
  }
  sizeBubblesLayer();
  // Prewarm natural spacing across entire document height
  (function prewarm() {
    const docH = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
    const count = Math.min(80, Math.max(60, Math.ceil(docH / 300))); // ~1 per 300px
    const spacing = docH / count;
    for (let i = 0; i < count; i++) {
      const currentY = Math.max(0, (i + 0.5) * spacing); // target visual position now
      const travelY = currentY + 800; // ensure it will travel past the top
      const progress = Math.min(0.9, Math.max(0.1, Math.random() * 0.8)); // 10%..90%
      const preTop = currentY + progress * travelY; // so that at this progress, it's at currentY
      const delayOffsetMs = Math.round(random(0, 600));
      spawnBubble({ preTop, progress, delayOffsetMs, travelY });
    }
  })();
  window.addEventListener('resize', sizeBubblesLayer);
  window.addEventListener('load', sizeBubblesLayer);
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
      // Despawn only when reaching absolute top of the document (world space)
      const startTopPx = wrap._startTopPx;
      const travelYPx = wrap._travelYPx;
      const durationMs = wrap._durationMs;
      const delayMs = wrap._delayMs || 0;
      const startTs = wrap._startTs || 0;
      const sizePx = wrap._sizePx || 0;
      if (startTopPx != null && travelYPx != null && durationMs != null && startTs) {
        const elapsed = ts - startTs - delayMs;
        if (elapsed >= 0) {
          const progress = elapsed / durationMs;
          const currentTop = startTopPx - progress * travelYPx; // world-space top position
          if (currentTop + sizePx < 0) {
            const fn = wrapCleanup.get(wrap);
            if (typeof fn === 'function') fn();
          }
        }
      }
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

