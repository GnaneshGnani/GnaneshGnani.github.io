const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function setupProjectFilters() {
  const buttons = Array.from(document.querySelectorAll(".filter-button"));
  const cards = Array.from(document.querySelectorAll(".project-card"));

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;
      buttons.forEach((item) => item.classList.toggle("is-active", item === button));
      cards.forEach((card) => {
        const categories = (card.dataset.category || "").split(/\s+/);
        card.hidden = filter !== "all" && !categories.includes(filter);
      });
    });
  });
}

async function hydrateRepoStats() {
  const cards = Array.from(document.querySelectorAll("[data-repo]"));
  await Promise.all(cards.map(async (card) => {
    const repo = card.dataset.repo;
    const stat = card.querySelector(".repo-stat");
    if (!repo || !stat) return;

    try {
      const response = await fetch(`https://api.github.com/repos/${repo}`);
      if (!response.ok) return;
      const data = await response.json();
      const language = data.language || "Repo";
      const stars = Number(data.stargazers_count || 0);
      stat.textContent = stars > 0 ? `${language} / ${stars} stars` : language;
    } catch {
      stat.textContent = "GitHub";
    }
  }));
}

function setupScrollField() {
  const canvas = document.querySelector(".scroll-field");
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!canvas || prefersReducedMotion) return;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  let width = 0;
  let height = 0;
  let dpr = 1;
  let particles = [];
  let scrollTarget = 0;
  let scrollCurrent = 0;
  let velocity = 0;
  let lastScrollY = window.scrollY;

  function seededNoise(seed) {
    return Math.sin(seed * 12.9898) * 43758.5453 % 1;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const count = clamp(Math.round((width * height) / 30000), 30, 76);
    particles = Array.from({ length: count }, (_, index) => ({
      x: Math.abs(seededNoise(index + 1)) * width,
      y: Math.abs(seededNoise(index + 31)) * height,
      drift: 0.22 + Math.abs(seededNoise(index + 63)) * 0.9,
      phase: Math.abs(seededNoise(index + 97)) * Math.PI * 2,
      radius: 1.2 + Math.abs(seededNoise(index + 151)) * 2.4,
    }));
  }

  function syncScroll() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    scrollTarget = scrollable > 0 ? window.scrollY / scrollable : 0;
    velocity = clamp((window.scrollY - lastScrollY) / 180, -1, 1);
    lastScrollY = window.scrollY;
  }

  function drawGrid(time) {
    const spacing = 54;
    const offset = (scrollCurrent * 260 + time * 0.012) % spacing;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = "rgba(22, 23, 26, 0.045)";

    for (let x = -spacing; x < width + spacing; x += spacing) {
      ctx.beginPath();
      ctx.moveTo(x + offset, 0);
      ctx.lineTo(x + offset, height);
      ctx.stroke();
    }

    for (let y = -spacing; y < height + spacing; y += spacing) {
      ctx.beginPath();
      ctx.moveTo(0, y - offset * 0.7);
      ctx.lineTo(width, y - offset * 0.7);
      ctx.stroke();
    }
    ctx.restore();
  }

  function cubicPoint(p0, p1, p2, p3, t) {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    return {
      x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
      y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y,
    };
  }

  function roundedRect(x, y, rectWidth, rectHeight, radius) {
    const r = Math.min(radius, rectWidth / 2, rectHeight / 2);
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, rectWidth, rectHeight, r);
      return;
    }
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + rectWidth - r, y);
    ctx.quadraticCurveTo(x + rectWidth, y, x + rectWidth, y + r);
    ctx.lineTo(x + rectWidth, y + rectHeight - r);
    ctx.quadraticCurveTo(x + rectWidth, y + rectHeight, x + rectWidth - r, y + rectHeight);
    ctx.lineTo(x + r, y + rectHeight);
    ctx.quadraticCurveTo(x, y + rectHeight, x, y + rectHeight - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
  }

  function drawFlowPaths(time) {
    const colors = [
      { line: "rgba(34, 124, 112, 0.42)", pulse: "rgba(34, 124, 112, 0.72)" },
      { line: "rgba(91, 75, 138, 0.36)", pulse: "rgba(91, 75, 138, 0.66)" },
      { line: "rgba(183, 121, 31, 0.34)", pulse: "rgba(183, 121, 31, 0.64)" },
      { line: "rgba(200, 85, 61, 0.3)", pulse: "rgba(200, 85, 61, 0.6)" },
    ];

    colors.forEach((color, index) => {
      const startY = height * (0.2 + index * 0.16) + Math.sin(scrollCurrent * 5 + index) * 34;
      const endY = height * (0.34 + index * 0.13) + Math.cos(scrollCurrent * 4 + index) * 44;
      const p0 = { x: -90, y: startY };
      const p1 = { x: width * (0.24 + index * 0.03), y: startY - 150 + velocity * 32 };
      const p2 = { x: width * (0.72 - index * 0.04), y: endY + 150 - velocity * 28 };
      const p3 = { x: width + 90, y: endY };

      ctx.save();
      ctx.lineWidth = 1.3;
      ctx.setLineDash([10, 18]);
      ctx.lineDashOffset = -(time * 0.04 + scrollCurrent * 420 + index * 40);
      ctx.strokeStyle = color.line;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
      ctx.stroke();
      ctx.setLineDash([]);

      for (let pulse = 0; pulse < 3; pulse += 1) {
        const t = (scrollCurrent * (0.82 + index * 0.05) + time * 0.00016 + pulse / 3 + index * 0.11) % 1;
        const point = cubicPoint(p0, p1, p2, p3, t);
        ctx.fillStyle = color.pulse;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 3.8 + Math.abs(velocity) * 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });
  }

  function drawParticles(time) {
    const positions = particles.map((particle, index) => {
      const x = particle.x + Math.sin(time * 0.0005 + particle.phase + scrollCurrent * 5) * 28;
      const y = (particle.y + scrollCurrent * height * particle.drift + Math.cos(time * 0.0004 + index) * 24) % (height + 80) - 40;
      return { x, y, radius: particle.radius };
    });

    ctx.save();
    for (let i = 0; i < positions.length; i += 1) {
      for (let j = i + 1; j < positions.length; j += 1) {
        const dx = positions[i].x - positions[j].x;
        const dy = positions[i].y - positions[j].y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance > 126) continue;
        const alpha = (1 - distance / 126) * 0.14;
        ctx.strokeStyle = `rgba(22, 23, 26, ${alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(positions[i].x, positions[i].y);
        ctx.lineTo(positions[j].x, positions[j].y);
        ctx.stroke();
      }
    }

    positions.forEach((point, index) => {
      const hue = index % 4;
      const fill = [
        "rgba(34, 124, 112, 0.5)",
        "rgba(91, 75, 138, 0.42)",
        "rgba(183, 121, 31, 0.42)",
        "rgba(200, 85, 61, 0.38)",
      ][hue];
      ctx.fillStyle = fill;
      ctx.beginPath();
      ctx.arc(point.x, point.y, point.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawEvidenceFrames(time) {
    const frameWidth = clamp(width * 0.13, 96, 160);
    const frameHeight = frameWidth * 0.58;
    const baseX = width - frameWidth - 38;
    const startY = height * 0.14 + Math.sin(scrollCurrent * 4) * 24;

    ctx.save();
    for (let index = 0; index < 4; index += 1) {
      const drift = Math.sin(time * 0.001 + index) * 5;
      const x = baseX - index * 22 + Math.sin(scrollCurrent * 6 + index) * 18;
      const y = startY + index * (frameHeight + 20) + drift;
      const alpha = 0.22 + index * 0.05;
      ctx.strokeStyle = `rgba(22, 23, 26, ${alpha})`;
      ctx.fillStyle = `rgba(255, 255, 255, ${0.28 + index * 0.03})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      roundedRect(x, y, frameWidth, frameHeight, 8);
      ctx.fill();
      ctx.stroke();

      ctx.strokeStyle = `rgba(34, 124, 112, ${0.18 + index * 0.04})`;
      ctx.beginPath();
      ctx.moveTo(x + 12, y + frameHeight - 14);
      ctx.lineTo(x + frameWidth * (0.42 + scrollCurrent * 0.18), y + 14);
      ctx.lineTo(x + frameWidth - 12, y + frameHeight * 0.48);
      ctx.stroke();

      ctx.fillStyle = `rgba(200, 85, 61, ${0.28 + index * 0.04})`;
      ctx.fillRect(x + 12, y + 12, frameWidth * (0.18 + ((scrollCurrent + index * 0.17) % 0.42)), 3);
    }
    ctx.restore();
  }

  function render(time) {
    scrollCurrent += (scrollTarget - scrollCurrent) * 0.075;
    velocity *= 0.9;
    ctx.clearRect(0, 0, width, height);
    drawGrid(time);
    drawFlowPaths(time);
    drawParticles(time);
    drawEvidenceFrames(time);
    window.requestAnimationFrame(render);
  }

  resize();
  syncScroll();
  window.addEventListener("resize", resize);
  window.addEventListener("scroll", syncScroll, { passive: true });
  window.requestAnimationFrame(render);
}

function setupScrollEffects() {
  const progress = document.querySelector(".scroll-progress span");
  const navLinks = Array.from(document.querySelectorAll(".nav-links a[href^='#']"));
  const navSections = navLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const depthTargets = prefersReducedMotion ? [] : Array.from(document.querySelectorAll(".focus-item, .project-card, .timeline article"));
  const focusPanel = document.querySelector(".current-focus");
  const timeline = document.querySelector(".timeline");
  let ticking = false;
  let scrollTimer = 0;

  function updateProgress() {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? window.scrollY / scrollable : 0;
    const boundedRatio = clamp(ratio, 0, 1);
    if (progress) {
      progress.style.transform = `scaleX(${boundedRatio})`;
    }
    document.body.classList.toggle("is-scrolled", window.scrollY > 8);
    document.documentElement.style.setProperty("--aura-shift", `${(window.scrollY * -0.018).toFixed(2)}px`);
    document.documentElement.style.setProperty("--aura-x", `${18 + boundedRatio * 64}%`);
    document.documentElement.style.setProperty("--aura-y", `${12 + Math.sin(boundedRatio * Math.PI) * 34}%`);
  }

  function updateActiveNav() {
    if (navSections.length === 0) return;
    const anchor = window.innerHeight * 0.38;
    let activeId = navSections[0].id;

    navSections.forEach((section) => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= anchor && rect.bottom >= 0) {
        activeId = section.id;
      }
    });

    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
      activeId = navSections[navSections.length - 1].id;
    }

    navLinks.forEach((link) => {
      link.classList.toggle("is-active", link.getAttribute("href") === `#${activeId}`);
    });
  }

  function updateElementProgress(element, propertyName) {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const start = window.innerHeight * 0.82;
    const end = window.innerHeight * 0.18;
    const progressRatio = clamp((start - rect.top) / (start - end + rect.height), 0, 1);
    element.style.setProperty(propertyName, `${Math.round(progressRatio * 100)}%`);
  }

  function updateDepth() {
    if (prefersReducedMotion) return;
    const viewportCenter = window.innerHeight / 2;
    depthTargets.forEach((element) => {
      if (element.hidden) return;
      const rect = element.getBoundingClientRect();
      if (rect.bottom < -120 || rect.top > window.innerHeight + 120) return;
      const center = rect.top + rect.height / 2;
      const distance = clamp((center - viewportCenter) / viewportCenter, -1, 1);
      const depthY = distance * -14;
      const rotate = distance * 1.8;
      const glow = 0.08 + (1 - Math.abs(distance)) * 0.18;
      element.style.setProperty("--depth-y", `${depthY.toFixed(2)}px`);
      element.style.setProperty("--depth-rotate", `${rotate.toFixed(2)}deg`);
      element.style.setProperty("--depth-glow", glow.toFixed(3));
    });
    updateElementProgress(focusPanel, "--focus-progress");
    updateElementProgress(timeline, "--timeline-progress");
  }

  function requestScrollUpdate() {
    document.body.classList.add("is-scrolling");
    window.clearTimeout(scrollTimer);
    scrollTimer = window.setTimeout(() => {
      document.body.classList.remove("is-scrolling");
    }, 160);

    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      updateProgress();
      updateActiveNav();
      updateDepth();
      ticking = false;
    });
  }

  updateProgress();
  updateActiveNav();
  updateDepth();
  window.addEventListener("scroll", requestScrollUpdate, { passive: true });
  window.addEventListener("resize", requestScrollUpdate);

  if (prefersReducedMotion || !("IntersectionObserver" in window)) return;

  const revealTargets = Array.from(document.querySelectorAll([
    ".intro-copy",
    ".current-focus .eyebrow",
    ".focus-item",
    ".section-heading",
    ".project-card",
    ".timeline article",
    ".resume-section",
    ".site-footer > *",
  ].join(",")));

  document.body.classList.add("motion-ready");
  document.body.classList.add("motion-rich");
  depthTargets.forEach((element) => element.classList.add("depth-card"));
  revealTargets.forEach((element, index) => {
    element.classList.add("reveal-on-scroll");
    element.style.setProperty("--reveal-index", String(index % 6));
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, {
    rootMargin: "0px 0px -8% 0px",
    threshold: 0.08,
  });

  revealTargets.forEach((element) => observer.observe(element));
}

window.addEventListener("DOMContentLoaded", () => {
  setupProjectFilters();
  setupScrollField();
  setupScrollEffects();
  hydrateRepoStats();
});
