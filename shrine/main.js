/* ============================================
   PARTICLE ANIMATION (Hero background)
   Tiny gold dots drifting slowly, like dust
   caught in a spotlight.
   ============================================ */

(function initParticles() {
  const canvas = document.getElementById('particles');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width, height, particles, dpr;

  function resize() {
    dpr = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function createParticles() {
    const count = Math.min(Math.floor((width * height) / 12000), 120);
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.5 + 0.5,          // radius 0.5–2
        vx: (Math.random() - 0.5) * 0.15,       // very slow drift
        vy: (Math.random() - 0.5) * 0.15,
        alpha: Math.random() * 0.5 + 0.15,      // subtle opacity
        pulse: Math.random() * Math.PI * 2,      // phase offset for shimmer
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);
    const time = performance.now() * 0.001;

    for (const p of particles) {
      p.x += p.vx;
      p.y += p.vy;

      // Wrap around edges
      if (p.x < -2) p.x = width + 2;
      if (p.x > width + 2) p.x = -2;
      if (p.y < -2) p.y = height + 2;
      if (p.y > height + 2) p.y = -2;

      // Gentle shimmer
      const shimmer = Math.sin(time * 0.8 + p.pulse) * 0.15 + 0.85;
      const alpha = p.alpha * shimmer;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201, 168, 76, ${alpha})`;
      ctx.fill();
    }

    requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();

  // Debounced resize handler
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      resize();
      createParticles();
    }, 200);
  });
})();


/* ============================================
   SCROLL REVEAL (Intersection Observer)
   Elements with class "reveal" fade/slide in
   when they enter the viewport.
   ============================================ */

(function initReveal() {
  const elements = document.querySelectorAll('.reveal');
  if (!elements.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target); // animate only once
        }
      });
    },
    {
      threshold: 0.15,
      rootMargin: '0px 0px -40px 0px',
    }
  );

  elements.forEach((el) => observer.observe(el));
})();
