/**
 * smooth-cursor.js
 * Follower dot that lerps toward the real mouse position, with a velocity-based
 * motion blur capped at 6px. Native system cursor stays visible.
 */
(function () {
  'use strict';

  // Skip on touch devices
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;

  // Respect prefers-reduced-motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function initSmoothCursor() {
    const el = document.createElement('div');
    el.id = 'smooth-cursor';
    el.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:14px',
      'height:14px',
      'border-radius:50%',
      'background:var(--accent)',
      'pointer-events:none',
      'z-index:9999',
      'mix-blend-mode:normal',
      'transform:translate3d(-9999px,-9999px,0)',
      'will-change:transform,filter',
      'transition:background-color 0.3s, opacity 0.2s',
      'opacity:0',
    ].join(';') + ';';
    document.body.appendChild(el);

    let targetX = -9999;
    let targetY = -9999;
    let currentX = -9999;
    let currentY = -9999;
    let visible = false;
    const LERP = 0.18;

    function show() {
      if (visible) return;
      visible = true;
      el.style.opacity = '1';
    }

    function hide() {
      if (!visible) return;
      visible = false;
      el.style.opacity = '0';
    }

    function onMove(e) {
      targetX = e.clientX;
      targetY = e.clientY;
      if (currentX < -1000 || currentY < -1000) {
        currentX = targetX;
        currentY = targetY;
      }
      show();
    }

    function onLeave() {
      hide();
    }

    function tick() {
      currentX += (targetX - currentX) * LERP;
      currentY += (targetY - currentY) * LERP;

      const vx = targetX - currentX;
      const vy = targetY - currentY;
      const speed = Math.hypot(vx, vy);
      // Hard-clamped to 6px per user requirement.
      const blur = Math.min(6, speed * 0.35);

      el.style.transform = 'translate3d(' + (currentX - 7) + 'px,' + (currentY - 7) + 'px,0)';
      el.style.filter = 'blur(' + blur.toFixed(2) + 'px)';

      requestAnimationFrame(tick);
    }

    window.addEventListener('mousemove', onMove);
    document.addEventListener('mouseleave', onLeave);
    window.addEventListener('blur', onLeave);

    // Re-read accent on theme change (CSS var picks it up automatically, but a
    // forced read smooths over Safari paint quirks).
    window.addEventListener('themechange', function () {
      getComputedStyle(document.documentElement).getPropertyValue('--accent');
    });

    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSmoothCursor);
  } else {
    initSmoothCursor();
  }
})();
