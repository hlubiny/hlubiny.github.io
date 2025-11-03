document.addEventListener('DOMContentLoaded', () => {
  // Zakázání pinch zoom na iOS a dalších zařízeních
  document.addEventListener('touchstart', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault(); // Blokuje pinch zoom
    }
  }, { passive: false });
  
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) {
      e.preventDefault(); // Blokuje pinch zoom
    }
  }, { passive: false });
  
  document.addEventListener('gesturestart', (e) => {
    e.preventDefault(); // Blokuje gesture zoom na iOS
  });
  
  document.addEventListener('gesturechange', (e) => {
    e.preventDefault(); // Blokuje gesture zoom na iOS
  });
  
  document.addEventListener('gestureend', (e) => {
    e.preventDefault(); // Blokuje gesture zoom na iOS
  });

  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  // Mobile menu toggle
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');
  if (mobileMenuToggle && mobileNav) {
    mobileMenuToggle.addEventListener('click', () => {
      const isOpen = mobileNav.classList.toggle('is-open');
      mobileMenuToggle.setAttribute('aria-expanded', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close menu when clicking a link
    mobileNav.querySelectorAll('.mobile-nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        mobileNav.classList.remove('is-open');
        mobileMenuToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      if (mobileNav.classList.contains('is-open') &&
          !mobileNav.contains(e.target) &&
          !mobileMenuToggle.contains(e.target)) {
        mobileNav.classList.remove('is-open');
        mobileMenuToggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      }
    });
  }

  // Smooth scroll is handled by CSS (scroll-behavior). Fallback for older browsers.
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });

  // Ensure the Zelena_koule_chobotnice video autoplays
  const betweenVideo = document.querySelector('.section-video-between__video');
  if (betweenVideo) {
    betweenVideo.setAttribute('autoplay', '');
    betweenVideo.setAttribute('muted', '');
    betweenVideo.setAttribute('playsinline', '');
    betweenVideo.setAttribute('loop', '');
    
    // Force play attempt
    const playPromise = betweenVideo.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Autoplay was prevented - try again on user interaction
        document.addEventListener('click', () => {
          betweenVideo.play().catch(() => {});
        }, { once: true });
      });
    }
  }

  // Bubble spawner configuration
  const debugBubbles = false; // toggle to true if you need to debug visuals
  const config = {
    spawnIntervalMs: 800,
    minSize: 20,
    maxSize: 25,
    maxLifetimeMs: 30000, // 30 seconds max lifetime
  };
  const RISE_SPEED_PX_PER_S = 60; // constant vertical speed
  if (debugBubbles) document.body.classList.add('debug-bubbles');

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = window.innerWidth <= 768; // mobile optimization
  const bubblesLayer = document.getElementById('bubbles-layer');
  const grainOverlay = document.querySelector('.grain-overlay');
  let bubbleCount = 0;
  let spawnTimer = null;
  let gradientHeight = 7000;
  let lastViewportHeight = window.innerHeight || document.documentElement.clientHeight || gradientHeight;
  const GRAIN_OVERSHOOT = 0.15; // restore original overshoot to keep grain over viewport
  let baseContentHeight = 0;

  if (isMobile) {
    config.spawnIntervalMs = Math.round(config.spawnIntervalMs * 2); // 50% fewer bubbles on mobile
  }

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

    const viewportH = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 0);
    const viewportW = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 0);
    const size = random(config.minSize, config.maxSize);
    const maxLeft = Math.max(0, viewportW - size);
    const left = random(0, maxLeft);
    // Duration derived from travel distance to ensure constant speed
    const delay = (opts && typeof opts.delayOffsetMs === 'number') ? random(0, 600) : 0;
    const drift = random(-20, 20);
    const spawnBase = viewportH > 0 ? viewportH : 600;
    const startTop = spawnBase + random(20, 140);
    const travelY = Math.max(600, Math.round(spawnBase + size + 200));

    // size on inner bubble
    b.style.width = `${size}px`;
    b.style.height = `${size}px`;
    // position and animation on wrapper
    wrap.style.left = `${Math.round(left)}px`;
    wrap.style.position = 'fixed'; // viewport-relative for all viewports
    wrap.style.top = '0px';
    wrap.style.setProperty('--startY', `${Math.round(startTop)}px`);
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
    
    function fadeOutAndCleanup() {
      if (!wrap.isConnected) return;
      wrap.style.opacity = '0';
      wrap.style.transition = 'opacity 2s ease-out';
      // Clean up after fade completes
      setTimeout(() => {
        const fn = wrapCleanup.get(wrap);
        if (typeof fn === 'function') fn();
      }, 2000);
    }
    
    // register cleanup for off-screen removal
    wrapCleanup.set(wrap, cleanup);
    // Max lifetime timeout - fade out then cleanup
    setTimeout(() => {
      if (wrap.isConnected && !wrap.classList.contains('fading-out')) {
        wrap.classList.add('fading-out');
        fadeOutAndCleanup();
      }
    }, config.maxLifetimeMs);

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

  function getDocumentHeight() {
    return Math.max(document.body.scrollHeight, document.documentElement.scrollHeight, window.innerHeight || 0);
  }

  function syncGrainOverlay(viewportH, viewportW, overshootPx = 0) {
    if (!grainOverlay) return;
    if (typeof viewportH === 'number') {
      const overshootHeight = Math.round(viewportH + overshootPx);
      grainOverlay.style.height = `${overshootHeight}px`;
    }
    if (typeof viewportW === 'number' && viewportW > 0) {
      grainOverlay.style.width = `${Math.round(viewportW)}px`;
    }
  }

  function updateGradientHeight(nextHeight, options = {}) {
    const { forceBaseUpdate = false } = options;
    const rawHeight = (typeof nextHeight === 'number' && !Number.isNaN(nextHeight))
      ? nextHeight
      : getDocumentHeight();
    if (forceBaseUpdate || baseContentHeight === 0) {
      baseContentHeight = rawHeight;
    } else {
      baseContentHeight = Math.max(baseContentHeight, rawHeight);
    }
    const visualViewport = window.visualViewport;
    const viewportH = window.innerHeight || document.documentElement.clientHeight || rawHeight;
    const viewportW = window.innerWidth || document.documentElement.clientWidth || (visualViewport ? visualViewport.width : 0);
    const visualH = visualViewport ? visualViewport.height : viewportH;
    const extra = Math.max(viewportH, visualH);
    const overshootPx = Math.round(extra * GRAIN_OVERSHOOT);
    const gradientSpan = Math.max(baseContentHeight, rawHeight);
    gradientHeight = Math.max(gradientSpan + overshootPx, extra + overshootPx);
    document.documentElement.style.setProperty('--gradient-height', `${Math.round(gradientHeight)}px`);
    syncGrainOverlay(visualH || viewportH, viewportW, overshootPx);
  }

  // Kick off
  function sizeBubblesLayer(options = {}) {
    const docHeight = getDocumentHeight();
    updateGradientHeight(docHeight, options);
    if (bubblesLayer) {
      const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
      if (viewportH) {
        bubblesLayer.style.height = `${Math.round(viewportH)}px`;
      } else {
        bubblesLayer.style.height = '100vh';
      }
    }
  }
  
  // GPU-accelerated gradient position update via transform
  let rafId = null;
  let lastScrollY = 0;
  
  function updateGradientPosition(force = false) {
    const scrollY = window.scrollY || window.pageYOffset;
    // Skip update if scroll hasn't changed (micro-optimization)
    if (!force && scrollY === lastScrollY) return;
    lastScrollY = scrollY;

    const viewportH = window.innerHeight || document.documentElement.clientHeight || 0;
    if (viewportH && Math.abs(viewportH - lastViewportHeight) > 1) {
      lastViewportHeight = viewportH;
      updateGradientHeight();
    }
    
    // Map scroll position to gradient translateY (inverse - scroll down = gradient moves up)
    const effectiveViewportH = viewportH || window.innerHeight || document.documentElement.clientHeight || 0;
    const maxTranslate = Math.max(0, gradientHeight - effectiveViewportH);
    const translateY = -Math.min(scrollY, maxTranslate);
    
    document.documentElement.style.setProperty('--bg-translate-y', `${translateY}px`);
  }
  
  // Continuous update via requestAnimationFrame for smooth GPU rendering
  function tick() {
    updateGradientPosition();
    rafId = requestAnimationFrame(tick);
  }
  
  // Start animation loop
  function startGradientAnimation() {
    if (rafId === null) {
      updateGradientPosition(true); // initial update
      rafId = requestAnimationFrame(tick);
    }
  }
  
  // Stop animation loop when page is hidden (save resources)
  function stopGradientAnimation() {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }
  
  sizeBubblesLayer({ forceBaseUpdate: true });
  startGradientAnimation();
  
  // Handle visibility changes
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopGradientAnimation();
    } else {
      startGradientAnimation();
    }
  }, { passive: true });
  // Prewarm natural spacing across entire document height
  (function prewarm() {
    if (prefersReduced) return;
    const viewportH = Math.max(1, window.innerHeight || document.documentElement.clientHeight || 0);
    const count = Math.max(8, Math.round(viewportH / 120));
    for (let i = 0; i < count; i++) {
      const progress = Math.min(0.9, Math.max(0.1, Math.random() * 0.8));
      const delayOffsetMs = Math.round(random(0, 600));
      spawnBubble({ progress, delayOffsetMs });
    }
  })();
  window.addEventListener('resize', () => {
    sizeBubblesLayer();
    updateGradientPosition(true); // force immediate update on resize
  });
  window.addEventListener('orientationchange', () => {
    sizeBubblesLayer({ forceBaseUpdate: true });
    updateGradientPosition(true);
  });
  window.addEventListener('load', () => {
    sizeBubblesLayer({ forceBaseUpdate: true });
    updateGradientPosition(true); // force immediate update on load
  });
  if (window.visualViewport && typeof window.visualViewport.addEventListener === 'function') {
    window.visualViewport.addEventListener('resize', () => {
      sizeBubblesLayer();
      updateGradientPosition(true);
    }, { passive: true });
    window.visualViewport.addEventListener('scroll', () => {
      updateGradientPosition(true);
    }, { passive: true });
  }
  startSpawning();

  // Noise animation is now CSS-only (no JS needed)

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
      
      // Check if bubble is off-screen horizontally (view space)
      const rect = wrap.getBoundingClientRect();
      const sizePx = wrap._sizePx || 0;
      const viewportW = Math.max(1, window.innerWidth || document.documentElement.clientWidth || 0);
      const isOffScreenLeft = rect.right < -sizePx;
      const isOffScreenRight = rect.left > viewportW + sizePx;
      if (isOffScreenLeft || isOffScreenRight) {
        const fn = wrapCleanup.get(wrap);
        if (typeof fn === 'function') fn();
        return;
      }

      // Despawn once bubble rises past the top edge of the viewport
      if (rect.bottom < -sizePx) {
        const fn = wrapCleanup.get(wrap);
        if (typeof fn === 'function') fn();
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

