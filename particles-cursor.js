/**
 * particles-cursor.js
 * Background particles (canvas) + animated wave lines.
 * Adapts to current --accent color and theme.
 */
(function () {
  'use strict';

  // Skip on touch devices
  if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;

  // Respect prefers-reduced-motion
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  function initParticles() {
    const canvas = document.createElement('canvas');
    canvas.id = 'ambient-particles';
    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      width: '100%',
      height: '100%',
      zIndex: '1',
      pointerEvents: 'none',
      opacity: '0.85',
    });
    document.body.prepend(canvas);

    const ctx = canvas.getContext('2d');
    let W, H, particles, mouse = { x: -9999, y: -9999 };
    const COUNT = 90;
    const MAX_DIST = 140;

    // Wave configuration
    const waves = [
      { amplitude: 30, frequency: 0.008, speed: 0.0004, yOffset: 0.7, opacity: 0.05 },
      { amplitude: 20, frequency: 0.012, speed: -0.0003, yOffset: 0.75, opacity: 0.04 },
      { amplitude: 40, frequency: 0.006, speed: 0.0005, yOffset: 0.65, opacity: 0.03 },
      { amplitude: 15, frequency: 0.015, speed: -0.0006, yOffset: 0.8, opacity: 0.06 },
    ];
    let waveTime = 0;

    function getAccentRgb() {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      let hex = v.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      if (/^[0-9a-f]{6}$/i.test(hex)) {
        const n = parseInt(hex, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      const m = v.match(/(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      if (m) return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])];
      return [91, 154, 255];
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      canvas.style.width = W + 'px';
      canvas.style.height = H + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function createParticle() {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.10 + Math.random() * 0.22;
      return {
        x: Math.random() * W,
        y: Math.random() * H,
        r: 0.8 + Math.random() * 1.6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        alpha: 0.2 + Math.random() * 0.4,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.005 + Math.random() * 0.01,
      };
    }

    function init() {
      resize();
      particles = Array.from({ length: COUNT }, createParticle);
    }

    function drawWaves(r, g, b, isDark) {
      // Slight mouse influence on waves
      const mouseInfluence = (mouse.x > 0 && mouse.x < W) ? (mouse.x / W - 0.5) * 20 : 0;

      waves.forEach(function(wave) {
        const baseY = H * wave.yOffset;
        const opacity = isDark ? wave.opacity * 1.2 : wave.opacity;

        ctx.beginPath();
        ctx.moveTo(0, baseY);

        for (let x = 0; x <= W; x += 4) {
          const y = baseY + Math.sin(x * wave.frequency + waveTime * wave.speed * 1000) * wave.amplitude
            + Math.sin(x * wave.frequency * 0.5 + waveTime * wave.speed * 600) * (wave.amplitude * 0.3)
            + mouseInfluence * Math.sin(x * 0.003);
          ctx.lineTo(x, y);
        }

        ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + opacity + ')';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });
    }

    function draw(timestamp) {
      waveTime = timestamp || 0;
      ctx.clearRect(0, 0, W, H);
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      const [r, g, b] = getAccentRgb();

      // Draw waves below particles
      drawWaves(r, g, b, isDark);

      // Draw particles
      particles.forEach(function(p) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < -10) p.x = W + 10;
        if (p.x > W + 10) p.x = -10;
        if (p.y < -10) p.y = H + 10;
        if (p.y > H + 10) p.y = -10;

        p.pulse += p.pulseSpeed;
        const a = p.alpha * (0.6 + 0.4 * Math.sin(p.pulse));

        const dx = p.x - mouse.x;
        const dy = p.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 80 && dist > 0) {
          const force = (80 - dist) / 80 * 0.4;
          p.x += (dx / dist) * force;
          p.y += (dy / dist) * force;
        }

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (isDark ? a * 0.8 : a * 0.45) + ')';
        ctx.fill();
      });

      // Connection lines between nearby particles
      for (let i = 0; i < particles.length; i++) {
        const pi = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const pj = particles[j];
          const dx = pi.x - pj.x, dy = pi.y - pj.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_DIST) {
            const lineA = (1 - d / MAX_DIST) * (isDark ? 0.10 : 0.05);
            ctx.beginPath();
            ctx.moveTo(pi.x, pi.y);
            ctx.lineTo(pj.x, pj.y);
            ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + lineA + ')';
            ctx.lineWidth = 0.7;
            ctx.stroke();
          }
        }
      }

      requestAnimationFrame(draw);
    }

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', function(e) { mouse.x = e.clientX; mouse.y = e.clientY; });
    window.addEventListener('mouseleave', function() { mouse.x = -9999; mouse.y = -9999; });

    init();
    requestAnimationFrame(draw);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initParticles);
  } else {
    initParticles();
  }
})();
