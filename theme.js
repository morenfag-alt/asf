/**
 * theme.js - theme switch with View Transitions circular reveal
 * - View Transitions API: circular clip-path from click point
 * - Fallback: overlay flash animation for browsers without View Transitions
 * - Scale bounce on theme button click
 * - SVG sun/moon icons (no emoji)
 *
 * Shared across index, templates, typing.
 * Button must have id="themeBtn".
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'theme';
  var SUN_PATH = 'M12 3v1.5M12 19.5V21M4.22 4.22l1.06 1.06M18.72 18.72l1.06 1.06M3 12h1.5M19.5 12H21M4.22 19.78l1.06-1.06M18.72 5.28l1.06-1.06';
  var SUN_CIRCLE = '<circle cx="12" cy="12" r="4"/>';
  var MOON_PATH = 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z';

  function iconForTheme(theme) {
    if (theme === 'dark') {
      return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
        SUN_CIRCLE +
        '<path d="' + SUN_PATH + '"/></svg>';
    }
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="' + MOON_PATH + '"/></svg>';
  }

  function getCurrentTheme() {
    return document.documentElement.getAttribute('data-theme') || 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    var btn = document.getElementById('themeBtn');
    if (btn) {
      btn.innerHTML = iconForTheme(theme);
      btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
      btn.setAttribute('title', theme === 'dark' ? 'Light theme' : 'Dark theme');
    }
    try {
      window.dispatchEvent(new CustomEvent('themechange', { detail: { theme: theme } }));
    } catch (e) {}
  }

  function initTheme() {
    var saved = localStorage.getItem(STORAGE_KEY);
    var sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = saved || (sysDark ? 'dark' : 'light');
    applyTheme(theme);
  }

  function bounceButton() {
    var btn = document.getElementById('themeBtn');
    if (!btn) return;
    btn.style.transition = 'transform 0.15s cubic-bezier(0.32,0.72,0,1)';
    btn.style.transform = 'scale(0.82)';
    setTimeout(function() {
      btn.style.transition = 'transform 0.3s cubic-bezier(0.32,0.72,0,1)';
      btn.style.transform = 'scale(1.12)';
      setTimeout(function() {
        btn.style.transition = 'transform 0.2s cubic-bezier(0.32,0.72,0,1)';
        btn.style.transform = 'scale(1)';
      }, 200);
    }, 150);
  }

  function fallbackFlash(next) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;opacity:0;transition:opacity 0.2s ease;';
    overlay.style.background = next === 'light' ? '#ffffff' : '#0a0e1a';
    document.body.appendChild(overlay);

    // Force reflow
    overlay.offsetHeight;
    overlay.style.opacity = '0.3';

    setTimeout(function() {
      overlay.style.opacity = '0';
      setTimeout(function() {
        overlay.remove();
      }, 200);
    }, 200);
  }

  var explosionActive = false;
  var bigBangActive = false;

  function bigBangEffect(x, y) {
    if (bigBangActive) return;
    bigBangActive = true;

    var dpr = window.devicePixelRatio || 1;
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;width:' + window.innerWidth + 'px;height:' + window.innerHeight + 'px;';
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    var particles = [];
    var PARTICLE_COUNT = 80;
    var DURATION = 1200;
    var startTime = performance.now();
    var colors = ['#ffffff', '#fffbe6', '#ffd700', '#ffaa00', '#d9a468', '#b0d4ff', '#e0f0ff'];

    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 3 + Math.random() * 9;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 0.8 + Math.random() * 0.2
      });
    }

    var shockwave = { radius: 0, maxRadius: Math.max(window.innerWidth, window.innerHeight) * 0.6, opacity: 0.8 };
    var flash = { radius: 0, maxRadius: 60, opacity: 1 };

    // Safety net: remove canvas even if rAF is paused (e.g. tab hidden)
    setTimeout(function () {
      if (canvas.parentNode) canvas.remove();
      bigBangActive = false;
    }, DURATION + 100);

    function animate() {
      var elapsed = performance.now() - startTime;
      if (elapsed >= DURATION) {
        if (canvas.parentNode) canvas.remove();
        bigBangActive = false;
        return;
      }

      var progress = elapsed / DURATION;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      // Central flash (first 30% of animation)
      if (progress < 0.3) {
        var flashProgress = progress / 0.3;
        flash.radius = flash.maxRadius * flashProgress;
        flash.opacity = 1 - flashProgress;
        ctx.beginPath();
        ctx.arc(x, y, flash.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, ' + flash.opacity + ')';
        ctx.fill();
      }

      // Shockwave ring (starts at 10%, fades by 70%)
      if (progress > 0.1 && progress < 0.7) {
        var ringProgress = (progress - 0.1) / 0.6;
        shockwave.radius = shockwave.maxRadius * ringProgress;
        var ringOpacity = shockwave.opacity * (1 - ringProgress);
        ctx.beginPath();
        ctx.arc(x, y, shockwave.radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 215, 0, ' + ringOpacity + ')';
        ctx.lineWidth = 3 * (1 - ringProgress);
        ctx.stroke();

        // Secondary ring
        ctx.beginPath();
        ctx.arc(x, y, shockwave.radius * 0.7, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, ' + (ringOpacity * 0.5) + ')';
        ctx.lineWidth = 1.5 * (1 - ringProgress);
        ctx.stroke();
      }

      // Particles
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05; // slight gravity
        var alpha = p.opacity * (1 - progress);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - progress * 0.4), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  function explosionEffect(x, y) {
    if (explosionActive) return;
    explosionActive = true;

    var dpr = window.devicePixelRatio || 1;
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;z-index:99999;pointer-events:none;width:' + window.innerWidth + 'px;height:' + window.innerHeight + 'px;';
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    document.body.appendChild(canvas);

    var ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    var particles = [];
    var PARTICLE_COUNT = 50;
    var DURATION = 700;
    var startTime = performance.now();
    var colors = ['#d9a468', '#e8b783', '#c78d4e', '#f0c996', '#b87a3d'];

    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var angle = Math.random() * Math.PI * 2;
      var speed = 2 + Math.random() * 6;
      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color: colors[Math.floor(Math.random() * colors.length)],
        opacity: 0.7 + Math.random() * 0.3
      });
    }

    // Safety net: remove canvas even if rAF is paused (e.g. tab hidden)
    setTimeout(function () {
      if (canvas.parentNode) canvas.remove();
      explosionActive = false;
    }, DURATION + 100);

    function animate() {
      var elapsed = performance.now() - startTime;
      if (elapsed >= DURATION) {
        if (canvas.parentNode) canvas.remove();
        explosionActive = false;
        return;
      }

      var progress = elapsed / DURATION;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // gravity
        var alpha = p.opacity * (1 - progress);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (1 - progress * 0.3), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      requestAnimationFrame(animate);
    }

    requestAnimationFrame(animate);
  }

  function toggleTheme(event) {
    var cur = getCurrentTheme();
    var next = cur === 'dark' ? 'light' : 'dark';
    localStorage.setItem(STORAGE_KEY, next);

    // Respect prefers-reduced-motion
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Bounce the button (skip if reduced motion)
    if (!reduce) bounceButton();

    // Click coordinates for circular reveal
    var btn = document.getElementById('themeBtn');
    var x = window.innerWidth / 2;
    var y = window.innerHeight / 2;
    if (event && (event.clientX || event.clientY)) {
      x = event.clientX;
      y = event.clientY;
    } else if (btn) {
      var r = btn.getBoundingClientRect();
      x = r.left + r.width / 2;
      y = r.top + r.height / 2;
    }
    var endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    // View Transitions API
    if (!reduce && typeof document.startViewTransition === 'function') {
      var transition = document.startViewTransition(function() {
        applyTheme(next);
      });

      transition.ready.then(function() {
        var goingDark = next === 'dark';
        if (goingDark) {
          explosionEffect(x, y);
          document.documentElement.animate(
            {
              clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + endRadius + 'px at ' + x + 'px ' + y + 'px)']
            },
            {
              duration: 620,
              easing: 'cubic-bezier(0.32, 0.72, 0, 1)',
              pseudoElement: '::view-transition-new(root)'
            }
          );
        } else {
          bigBangEffect(x, y);
          document.documentElement.animate(
            {
              clipPath: ['circle(0px at ' + x + 'px ' + y + 'px)', 'circle(' + endRadius + 'px at ' + x + 'px ' + y + 'px)']
            },
            {
              duration: 900,
              easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
              pseudoElement: '::view-transition-new(root)'
            }
          );
        }
      }).catch(function() {});
      return;
    }

    // Fallback for browsers without View Transitions (skip flash if reduced motion)
    if (!reduce) fallbackFlash(next);
    applyTheme(next);
    if (!reduce && next === 'dark') explosionEffect(x, y);
    if (!reduce && next === 'light') bigBangEffect(x, y);
  }

  function bindButton() {
    var btn = document.getElementById('themeBtn');
    if (!btn) return;
    btn.textContent = '';
    btn.innerHTML = iconForTheme(getCurrentTheme());
    btn.addEventListener('click', toggleTheme);
  }

  // Initialize early
  initTheme();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindButton);
  } else {
    bindButton();
  }

  window.__themeToggle = toggleTheme;
  window.__themeApply = applyTheme;
})();
