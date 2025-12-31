/* eslint-disable no-restricted-globals */
const $ = (selector) => document.querySelector(selector);

const TAU = Math.PI * 2;
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const rand = (min, max) => min + Math.random() * (max - min);
const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

const blessings = [
  "愿你 2026 顺风顺水，万事皆如愿。",
  "愿你新年有光，脚下有路，心中有爱。",
  "愿你平安喜乐，岁岁常欢愉，年年皆胜意。",
  "愿你被好运拥抱，被快乐偏爱。",
  "愿你所求皆所愿，所行化坦途。",
  "愿你无惧风雨，依旧热烈明亮。",
  "愿你家人健康，事业顺利，烦恼清零。",
  "愿你心想事成，发财不发福。",
  "愿你新的一年，快乐更近一点。",
  "愿你把喜欢的事做到极致，把日子过成诗。",
];

const state = {
  reduceMotion: false,
  toastTimer: null,
  fx: {
    canvas: null,
    ctx: null,
    shells: [],
    sparks: [],
    flashes: [],
    smoke: [],
    stars: [],
    enabled: true,
    raf: 0,
    lastT: 0,
    nextAutoAt: 0,
    autoOn: true,
    maxSparks: 2600,
  },
  danmu: {
    nextAt: 0,
  },
  shape: {
    cache: new Map(), // key -> { points, w, h }
    custom: null, // { type, label, points, w, h }
    imageReady: false,
    autoUseCustom: true,
  },
};

function pickFireworkHue() {
  const palette = [18, 28, 40, 350, 330];
  const base = palette[randInt(0, palette.length - 1)];
  return (base + randInt(-10, 10) + 360) % 360;
}

function pickBlessing() {
  return blessings[randInt(0, blessings.length - 1)];
}

function showToast(msg, ms = 1400) {
  const toast = $("#toast");
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), ms);
}

function setBlessing(text) {
  const node = $("#blessingText");
  node.textContent = text;
}

function hsla(h, s, l, a) {
  return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a})`;
}

function pushFlash(x, y, hue) {
  state.fx.flashes.push({ x, y, hue, age: 0, life: 10 });
}

function pushSmoke(x, y, hue) {
  const count = randInt(6, 10);
  for (let i = 0; i < count; i++) {
    state.fx.smoke.push({
      x: x + rand(-14, 14),
      y: y + rand(-10, 10),
      vx: rand(-0.25, 0.25),
      vy: rand(-0.55, -0.10),
      r: rand(26, 54),
      hue: (hue + randInt(-18, 18) + 360) % 360,
      a: rand(0.08, 0.14),
      life: randInt(120, 200),
      age: 0,
    });
  }
}

function ensureStars() {
  if (state.fx.stars.length) return;
  const count = Math.round((innerWidth * innerHeight) / 14000);
  for (let i = 0; i < count; i++) {
    state.fx.stars.push({
      x: Math.random() * innerWidth,
      y: Math.random() * innerHeight * 0.86,
      r: Math.random() < 0.18 ? rand(1.1, 1.9) : rand(0.6, 1.2),
      a: rand(0.15, 0.55),
      tw: rand(0.0015, 0.004),
      ph: Math.random() * TAU,
    });
  }
}

function drawFlash(x, y, hue, alpha) {
  const { ctx } = state.fx;
  const r = 130 * (1 - alpha * 0.45);
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hsla(hue, 100, 70, alpha * 0.55));
  g.addColorStop(0.38, hsla(hue, 100, 62, alpha * 0.22));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function drawShell(s) {
  const { ctx } = state.fx;
  const a = 0.88;

  ctx.strokeStyle = hsla(s.hue, 100, 70, a * 0.35);
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(s.px, s.py);
  ctx.lineTo(s.x, s.y);
  ctx.stroke();

  ctx.fillStyle = hsla(s.hue, 100, 74, a);
  ctx.beginPath();
  ctx.arc(s.x, s.y, 2.2, 0, TAU);
  ctx.fill();

  ctx.fillStyle = hsla(s.hue, 100, 70, a * 0.22);
  ctx.beginPath();
  ctx.arc(s.x, s.y, 10, 0, TAU);
  ctx.fill();
}

function drawSpark(p, lifeLeft) {
  const { ctx } = state.fx;
  const twinkle = p.twinkle ? 0.78 + 0.22 * Math.sin(p.age * 0.55 + p.phase) : 1;
  const a = Math.max(0, lifeLeft) * twinkle;

  ctx.strokeStyle = hsla(p.hue, 100, p.l, a);
  ctx.lineWidth = p.size;
  ctx.beginPath();
  ctx.moveTo(p.px, p.py);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();

  if (p.glow) {
    ctx.fillStyle = hsla(p.hue, 100, Math.min(82, p.l + 12), a * 0.22);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 4.2, 0, TAU);
    ctx.fill();
  }

  ctx.fillStyle = hsla(p.hue, 100, Math.min(84, p.l + 10), a * 0.72);
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size * 0.9, 0, TAU);
  ctx.fill();
}

function drawSmoke(k) {
  const { ctx } = state.fx;
  if (!state.fx.smoke.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  const next = [];
  for (const p of state.fx.smoke) {
    p.age += k;
    const lifeLeft = 1 - p.age / p.life;
    if (lifeLeft <= 0) continue;
    p.x += p.vx * k;
    p.y += p.vy * k;
    p.vx *= 0.99;
    p.vy *= 0.995;
    const r = p.r * (1 + (1 - lifeLeft) * 1.1);
    const a = p.a * lifeLeft * 0.9;

    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    g.addColorStop(0, hsla(p.hue, 30, 62, a));
    g.addColorStop(0.55, hsla(p.hue, 25, 38, a * 0.55));
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, TAU);
    ctx.fill();
    next.push(p);
  }
  state.fx.smoke = next;
  ctx.restore();
}

function drawStars(t) {
  const { ctx } = state.fx;
  if (!state.fx.stars.length) return;
  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  for (const s of state.fx.stars) {
    const tw = 0.65 + 0.35 * Math.sin(t * s.tw + s.ph);
    ctx.globalAlpha = s.a * tw;
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function launchShell(opts = {}) {
  if (state.reduceMotion) return;
  const x = typeof opts.x === "number" ? opts.x : randInt(120, innerWidth - 120);
  const hue = typeof opts.hue === "number" ? opts.hue : pickFireworkHue();
  const style = opts.style || randomStyle();
  const payload = opts.payload ?? null;

  const minY = innerHeight * 0.08;
  const maxY = innerHeight * 0.28;

  state.fx.shells.push({
    x,
    y: innerHeight + 24,
    px: x,
    py: innerHeight + 24,
    vx: (Math.random() - 0.5) * 0.9,
    vy: -rand(9.8, 12.6),
    targetY: rand(minY, maxY),
    hue,
    style,
    payload,
    age: 0,
  });
}

function randomStyle() {
  const r = Math.random();
  if (r < 0.18) return "willow";
  if (r < 0.33) return "ring";
  if (r < 0.46) return "palm";
  return "burst";
}

function pushSparkCommon(x, y, vx, vy, hue, styleHint = "burst") {
  state.fx.sparks.push({
    x,
    y,
    px: x,
    py: y,
    vx,
    vy,
    g: styleHint === "willow" ? 0.11 + Math.random() * 0.03 : 0.10 + Math.random() * 0.03,
    drag: styleHint === "willow" ? 0.985 + Math.random() * 0.01 : 0.987 + Math.random() * 0.01,
    life: styleHint === "willow" ? randInt(90, 150) : randInt(66, 118),
    age: 0,
    size: styleHint === "willow" ? 1.2 + Math.random() * 1.6 : 1.05 + Math.random() * 1.35,
    hue,
    l: 52 + Math.random() * 24,
    twinkle: Math.random() < 0.22,
    phase: Math.random() * TAU,
    glow: Math.random() < 0.42,
  });
}

function explodeAt(x, y, hue = randInt(0, 359), style = "burst", payload = null) {
  if (state.reduceMotion) return;
  pushFlash(x, y, hue);
  pushSmoke(x, y, hue);

  if (style === "heart") {
    explodeHeart(x, y, hue);
    return;
  }
  if (style === "ring") {
    explodeRing(x, y, hue);
    return;
  }
  if (style === "palm") {
    explodePalm(x, y, hue);
    return;
  }
  if (style === "text") {
    const text = typeof payload === "string" && payload.trim() ? payload.trim() : "新年快乐";
    explodeText(x, y, hue, text);
    return;
  }
  if (style === "customShape") {
    if (payload?.points?.length) {
      explodeShape(x, y, hue, payload);
      return;
    }
  }

  const baseCount = style === "willow" ? randInt(130, 175) : randInt(120, 170);
  const speedMin = 2.2;
  const speedMax = style === "willow" ? 5.7 : 7.2;

  for (let i = 0; i < baseCount; i++) {
    const a = Math.random() * TAU;
    const sp = speedMin + Math.random() * (speedMax - speedMin);
    const vx = Math.cos(a) * sp * (0.88 + Math.random() * 0.24);
    const vy = Math.sin(a) * sp * (0.88 + Math.random() * 0.24);
    pushSparkCommon(x, y, vx, vy, hue + randInt(-12, 12), style);
  }

  addGlitter(x, y, hue);
}

function explodePalm(x, y, hue) {
  const fronds = randInt(14, 20);
  const baseSpeed = rand(5.6, 7.6);
  for (let i = 0; i < fronds; i++) {
    const a = (i / fronds) * TAU + rand(-0.08, 0.08);
    const sp = baseSpeed * (0.88 + Math.random() * 0.22);
    const vx = Math.cos(a) * sp;
    const vy = Math.sin(a) * sp;
    state.fx.sparks.push({
      x,
      y,
      px: x,
      py: y,
      vx,
      vy,
      g: 0.085 + Math.random() * 0.02,
      drag: 0.990 - Math.random() * 0.006,
      life: randInt(140, 200),
      age: 0,
      size: 1.7 + Math.random() * 1.2,
      hue: (hue + randInt(-6, 6) + 360) % 360,
      l: 62 + Math.random() * 18,
      twinkle: Math.random() < 0.08,
      phase: Math.random() * TAU,
      glow: true,
    });
  }
  addGlitter(x, y, hue);
}

function addGlitter(x, y, hue) {
  const glitterCount = randInt(28, 44);
  for (let i = 0; i < glitterCount; i++) {
    const a = Math.random() * TAU;
    const sp = 0.8 + Math.random() * 2.6;
    state.fx.sparks.push({
      x,
      y,
      px: x,
      py: y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      g: 0.08 + Math.random() * 0.03,
      drag: 0.992 - Math.random() * 0.006,
      life: randInt(90, 170),
      age: 0,
      size: 0.85 + Math.random() * 1.15,
      hue: hue + randInt(-18, 18),
      l: 68 + Math.random() * 18,
      twinkle: true,
      phase: Math.random() * TAU,
      glow: true,
    });
  }
}

function explodeRing(x, y, hue) {
  const count = randInt(120, 170);
  const speed = rand(4.8, 6.8);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + rand(-0.02, 0.02);
    const vx = Math.cos(a) * speed * (0.92 + Math.random() * 0.16);
    const vy = Math.sin(a) * speed * (0.92 + Math.random() * 0.16);
    pushSparkCommon(x, y, vx, vy, hue + randInt(-10, 10), "burst");
  }
  addGlitter(x, y, hue);
}

function explodeHeart(x, y, hue) {
  const count = 190;
  for (let i = 0; i < count; i++) {
    const t = (i / count) * TAU;
    const hx = 16 * Math.pow(Math.sin(t), 3);
    const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const vx = hx * 0.22 + (Math.random() - 0.5) * 0.18;
    const vy = -hy * 0.22 + (Math.random() - 0.5) * 0.18;
    state.fx.sparks.push({
      x,
      y,
      px: x,
      py: y,
      vx,
      vy,
      g: 0.10 + Math.random() * 0.03,
      drag: 0.988 - Math.random() * 0.01,
      life: randInt(76, 118),
      age: 0,
      size: 1.3 + Math.random() * 1.5,
      hue: hue + randInt(-10, 10),
      l: 56 + Math.random() * 18,
      twinkle: Math.random() < 0.25,
      phase: Math.random() * TAU,
      glow: Math.random() < 0.55,
    });
  }
  addGlitter(x, y, hue);
}

function samplePointsFromImageData(imageData, w, h, opts = {}) {
  const step = opts.step ?? 3;
  const alphaThreshold = opts.alphaThreshold ?? 42;
  const maxPoints = opts.maxPoints ?? 900;
  const darknessThreshold = opts.darknessThreshold ?? 250;

  const data = imageData.data;
  const pts = [];
  let seen = 0;

  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < w; x += step) {
      const idx = (y * w + x) * 4;
      const a = data[idx + 3];
      if (a < alphaThreshold) continue;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (luma > darknessThreshold && a > 200) {
        // likely a bright background; skip most of it
        if (Math.random() < 0.92) continue;
      }

      seen += 1;
      const p = { x, y };
      if (pts.length < maxPoints) pts.push(p);
      else {
        const j = Math.floor(Math.random() * seen);
        if (j < maxPoints) pts[j] = p;
      }
    }
  }

  return { points: pts, w, h };
}

function getTextShape(text) {
  const key = `text:${text}`;
  const cached = state.shape.cache.get(key);
  if (cached) return cached;

  const off = document.createElement("canvas");
  const ctx = off.getContext("2d", { willReadFrequently: true });

  const t = (text || "").trim() || "新年快乐";
  const fontSize = clamp(Math.round(Math.min(170, Math.max(90, innerWidth * 0.13))), 90, 170);
  const font = `900 ${fontSize}px ui-sans-serif, system-ui, -apple-system, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif`;

  ctx.font = font;
  const metrics = ctx.measureText(t);
  const w = Math.ceil(metrics.width + fontSize * 0.6);
  const h = Math.ceil(fontSize * 1.35);
  off.width = w;
  off.height = h;

  ctx.clearRect(0, 0, w, h);
  ctx.font = font;
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(t, w / 2, h / 2);

  const imageData = ctx.getImageData(0, 0, w, h);
  const shape = samplePointsFromImageData(imageData, w, h, { step: 3, maxPoints: 950, darknessThreshold: 255 });
  state.shape.cache.set(key, shape);
  return shape;
}

function getImageShape(img) {
  const off = document.createElement("canvas");
  const ctx = off.getContext("2d", { willReadFrequently: true });
  const maxSide = 220;
  const scale = Math.min(maxSide / img.naturalWidth, maxSide / img.naturalHeight, 1);
  const w = Math.max(2, Math.floor(img.naturalWidth * scale));
  const h = Math.max(2, Math.floor(img.naturalHeight * scale));
  off.width = w;
  off.height = h;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  // Edge/contour extraction (Sobel) to avoid "a big blob".
  const imageData = ctx.getImageData(0, 0, w, h);
  const data = imageData.data;
  const gray = new Float32Array(w * h);
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    gray[p] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  const mag = new Float32Array(w * h);
  let sum = 0;
  let sumsq = 0;
  let count = 0;
  let maxMag = 0;

  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const tl = gray[i - w - 1];
      const tc = gray[i - w];
      const tr = gray[i - w + 1];
      const ml = gray[i - 1];
      const mr = gray[i + 1];
      const bl = gray[i + w - 1];
      const bc = gray[i + w];
      const br = gray[i + w + 1];

      const gx = -tl + tr - 2 * ml + 2 * mr - bl + br;
      const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
      const m = Math.abs(gx) + Math.abs(gy);
      mag[i] = m;
      sum += m;
      sumsq += m * m;
      count += 1;
      if (m > maxMag) maxMag = m;
    }
  }

  const mean = count ? sum / count : 0;
  const variance = count ? Math.max(0, sumsq / count - mean * mean) : 0;
  const std = Math.sqrt(variance);
  let threshold = Math.max(mean + std * 1.15, maxMag * 0.22, 30);
  threshold = Math.min(threshold, maxMag * 0.55);

  const sampleEdges = (thr) => {
    const step = 2;
    const maxPoints = 1050;
    const pts = [];
    let seen = 0;
    for (let y = 1; y < h - 1; y += step) {
      for (let x = 1; x < w - 1; x += step) {
        const i = y * w + x;
        if (mag[i] <= thr) continue;
        seen += 1;
        const p = { x, y };
        if (pts.length < maxPoints) pts.push(p);
        else {
          const j = Math.floor(Math.random() * seen);
          if (j < maxPoints) pts[j] = p;
        }
      }
    }
    return { points: pts, w, h };
  };

  let shape = sampleEdges(threshold);
  if (shape.points.length < 120) shape = sampleEdges(threshold * 0.7);
  if (shape.points.length < 80) shape = sampleEdges(threshold * 0.55);
  return shape;
}

function explodeShape(x, y, hue, shape) {
  if (!shape?.points?.length) return;
  pushFlash(x, y, hue);

  const scale = clamp(240 / Math.max(shape.w, shape.h), 0.55, 1.2);
  const formTotal = randInt(18, 26);
  const holdTotal = randInt(10, 16);

  for (const pt of shape.points) {
    const dx = (pt.x - shape.w / 2) * scale;
    const dy = (pt.y - shape.h / 2) * scale;
    const tx = x + dx + rand(-0.35, 0.35);
    const ty = y + dy + rand(-0.35, 0.35);

    const m = Math.hypot(dx, dy) || 1;
    const ux = dx / m;
    const uy = dy / m;
    const releaseSpeed = 2.2 + Math.random() * 4.2;

    state.fx.sparks.push({
      kind: "shape",
      x,
      y,
      px: x,
      py: y,
      ox: x,
      oy: y,
      tx,
      ty,
      formTotal,
      formLeft: formTotal * (0.82 + Math.random() * 0.36),
      holdLeft: holdTotal * (0.8 + Math.random() * 0.5),
      rx: ux,
      ry: uy,
      releaseSpeed,
      g: 0.10 + Math.random() * 0.03,
      drag: 0.988 - Math.random() * 0.01,
      life: randInt(120, 175),
      age: 0,
      size: 1.05 + Math.random() * 1.35,
      hue: hue + randInt(-12, 12),
      l: 58 + Math.random() * 22,
      twinkle: Math.random() < 0.18,
      phase: Math.random() * TAU,
      glow: Math.random() < 0.55,
    });
  }

  addGlitter(x, y, hue);
}

function explodeText(x, y, hue, text) {
  const shape = getTextShape(text);
  explodeShape(x, y, hue, shape);
}

function showFireworksShow() {
  if (state.reduceMotion) return;
  launchShell();
  setTimeout(() => launchShell(), randInt(120, 240));
  if (Math.random() < 0.7) setTimeout(() => launchShell(), randInt(240, 420));
  showToast("新年烟花已点燃");
}

function spawnDanmu(text) {
  if (state.reduceMotion) return;
  const layer = $("#danmuLayer");
  if (!layer) return;
  const msg = (text || "").trim();
  if (!msg) return;

  const node = document.createElement("div");
  node.className = "danmu";
  node.textContent = msg;
  const maxLeft = innerWidth >= 920 ? 62 : 88;
  node.style.left = `${randInt(12, maxLeft)}%`;
  node.style.bottom = `${randInt(78, 110)}px`;
  node.style.setProperty("--h", `${randInt(0, 359)}`);

  layer.appendChild(node);
  const remove = () => node.remove();
  node.addEventListener("animationend", remove, { once: true });
  setTimeout(remove, 5200);
}

function scheduleDanmu(t) {
  state.danmu.nextAt = t + randInt(1600, 2900);
}

function setupFx() {
  const canvas = $("#fx");
  const ctx = canvas.getContext("2d", { alpha: true });
  state.fx.canvas = canvas;
  state.fx.ctx = ctx;

  const resize = () => {
    const dpr = Math.max(1, Math.min(2, devicePixelRatio || 1));
    canvas.width = Math.floor(innerWidth * dpr);
    canvas.height = Math.floor(innerHeight * dpr);
    canvas.style.width = `${innerWidth}px`;
    canvas.style.height = `${innerHeight}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const scheduleAuto = (t) => {
    state.fx.nextAutoAt = t + randInt(820, 1320);
  };

  window.addEventListener("resize", resize, { passive: true });
  resize();
  ensureStars();

  const loop = (t) => {
    const dt = state.fx.lastT ? Math.min(34, Math.max(10, t - state.fx.lastT)) : 16.7;
    const k = dt / 16.7;
    state.fx.lastT = t;

    if (!state.fx.enabled) {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
      state.fx.raf = requestAnimationFrame(loop);
      return;
    }

    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = `rgba(0,0,0,${0.20 * k})`;
    ctx.fillRect(0, 0, innerWidth, innerHeight);
    drawStars(t);
    drawSmoke(k);
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";

    // Background show
    if (!state.reduceMotion && state.fx.autoOn && !document.hidden && t >= state.fx.nextAutoAt) {
      const useCustom = state.shape.autoUseCustom && state.shape.custom?.points?.length && Math.random() < 0.26;
      const useText = !useCustom && Math.random() < 0.20;

      if (useCustom) {
        launchShell({
          style: "customShape",
          payload: state.shape.custom,
          hue: pickFireworkHue(),
          x: randInt(160, innerWidth - 160),
        });
      } else if (useText) {
        const presets = ["2026", "新年快乐", "肖博雯祝您新年快乐"];
        launchShell({
          style: "text",
          payload: presets[randInt(0, presets.length - 1)],
          hue: pickFireworkHue(),
          x: randInt(160, innerWidth - 160),
        });
      } else {
        launchShell();
        if (Math.random() < 0.22) setTimeout(() => launchShell(), randInt(120, 260));
      }

      scheduleAuto(t);
    }

    // Auto danmu
    if (!state.reduceMotion && !document.hidden && t >= state.danmu.nextAt) {
      spawnDanmu(pickBlessing());
      scheduleDanmu(t);
    }

    // Shell update
    const nextShells = [];
    for (const s of state.fx.shells) {
      s.px = s.x;
      s.py = s.y;
      s.vx *= 0.995;
      s.vy += 0.095 * k;
      s.x += s.vx * k;
      s.y += s.vy * k;
      s.age += k;

      drawShell(s);

      const reached = s.y <= s.targetY || s.vy >= -0.7;
      if (reached || s.age > 160) explodeAt(s.x, s.y, s.hue, s.style, s.payload);
      else nextShells.push(s);
    }
    state.fx.shells = nextShells;

    // Flash update
    const nextFlashes = [];
    for (const f of state.fx.flashes) {
      f.age += k;
      const a = Math.max(0, 1 - f.age / f.life);
      if (a <= 0) continue;
      drawFlash(f.x, f.y, f.hue, a);
      nextFlashes.push(f);
    }
    state.fx.flashes = nextFlashes;

    // Spark update
    const nextSparks = [];
    for (const p of state.fx.sparks) {
      p.px = p.x;
      p.py = p.y;

      if (p.kind === "shape") {
        p.age += k;
        const lifeLeft = 1 - p.age / p.life;
        if (lifeLeft <= 0) continue;

        if (p.formLeft > 0) {
          p.formLeft -= k;
          const done = 1 - clamp(p.formLeft / p.formTotal, 0, 1);
          const eased = 1 - Math.pow(1 - done, 3);
          p.x = p.ox + (p.tx - p.ox) * eased;
          p.y = p.oy + (p.ty - p.oy) * eased;
        } else if (p.holdLeft > 0) {
          p.holdLeft -= k;
          p.x = p.tx;
          p.y = p.ty;
        } else {
          p.kind = "spark";
          const speed = p.releaseSpeed;
          p.vx = p.rx * speed + rand(-0.35, 0.35);
          p.vy = p.ry * speed + rand(-0.35, 0.35) - 0.35;
          p.x = p.tx;
          p.y = p.ty;
          p.px = p.x;
          p.py = p.y;
          delete p.ox;
          delete p.oy;
          delete p.tx;
          delete p.ty;
          delete p.formLeft;
          delete p.formTotal;
          delete p.holdLeft;
          delete p.rx;
          delete p.ry;
          delete p.releaseSpeed;
        }

        drawSpark(p, lifeLeft);
        nextSparks.push(p);
        continue;
      }

      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.g * k;
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.age += k;

      const lifeLeft = 1 - p.age / p.life;
      if (lifeLeft <= 0) continue;
      drawSpark(p, lifeLeft);
      nextSparks.push(p);
    }
    state.fx.sparks = nextSparks;

    if (state.fx.sparks.length > state.fx.maxSparks) {
      state.fx.sparks.splice(0, state.fx.sparks.length - state.fx.maxSparks);
    }

    state.fx.raf = requestAnimationFrame(loop);
  };

  cancelAnimationFrame(state.fx.raf);
  state.fx.lastT = 0;
  scheduleAuto(performance.now());
  scheduleDanmu(performance.now() - 1200);
  state.fx.raf = requestAnimationFrame(loop);
}

function setReduceMotion(enabled) {
  state.reduceMotion = enabled;
  state.fx.enabled = !enabled;
  const btn = $("#btnReduceMotion");
  if (btn) {
    btn.setAttribute("aria-pressed", enabled ? "true" : "false");
    btn.textContent = enabled ? "恢复动画" : "减少动画";
    showToast(enabled ? "已减少动画" : "已恢复动画");
  }
}

function spawnHeartFirework() {
  launchShell({
    style: "heart",
    hue: randInt(320, 359),
    x: randInt(160, innerWidth - 160),
  });
  showToast("送你一朵心形烟花");
}

function spawnTextFirework(text) {
  const t = (text || "").trim() || "新年快乐";
  launchShell({
    style: "text",
    payload: t,
    hue: pickFireworkHue(),
    x: randInt(160, innerWidth - 160),
  });
  showToast(`文字烟花：${t}`);
}

function spawnCustomShapeFirework() {
  if (!state.shape.custom?.points?.length) {
    showToast("还没有自定义图形：先输入文字或上传图片");
    return;
  }
  launchShell({
    style: "customShape",
    payload: state.shape.custom,
    hue: pickFireworkHue(),
    x: randInt(160, innerWidth - 160),
  });
  showToast("自定义烟花已发射");
}

function wireUi() {
  const dock = document.querySelector(".panelDock");
  const btnUi = $("#btnUi");
  const setDockVisible = (visible) => {
    if (!dock || !btnUi) return;
    dock.classList.toggle("isHidden", !visible);
    btnUi.setAttribute("aria-expanded", visible ? "true" : "false");
  };
  btnUi?.addEventListener("click", () => {
    const hidden = dock?.classList.contains("isHidden");
    setDockVisible(Boolean(hidden));
  });

  $("#btnDraw").addEventListener("click", () => setBlessing(pickBlessing()));
  $("#btnFireworks").addEventListener("click", showFireworksShow);
  $("#btnHeart").addEventListener("click", spawnHeartFirework);

  $("#btnSendWish").addEventListener("click", () => {
    const input = $("#wishInput");
    const text = input.value.trim() || pickBlessing();
    input.value = "";
    spawnDanmu(text);
    launchShell({
      style: "heart",
      hue: randInt(320, 359),
      x: randInt(160, innerWidth - 160),
    });
  });
  $("#wishInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#btnSendWish").click();
  });

  $("#autoCustom").addEventListener("change", (e) => {
    state.shape.autoUseCustom = Boolean(e.target.checked);
  });

  $("#btnTextFirework").addEventListener("click", () => {
    const input = $("#customText");
    const text = input.value.trim() || "新年快乐";
    state.shape.custom = { type: "text", label: text, ...getTextShape(text) };
    spawnTextFirework(text);
  });

  $("#imageInput").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    state.shape.imageReady = false;
    $("#btnImageFirework").disabled = true;
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const shape = getImageShape(img);
        state.shape.custom = { type: "image", label: file.name, ...shape };
        state.shape.imageReady = true;
        $("#btnImageFirework").disabled = false;
        showToast("图片已转成粒子形状：可点“图片烟花”");
      } catch {
        showToast("图片解析失败：换一张更清晰的试试");
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showToast("图片加载失败");
    };
    img.src = url;
  });

  $("#btnImageFirework").addEventListener("click", spawnCustomShapeFirework);

  // Polaroid photo (real image, not fireworks)
  const photoInput = $("#photoInput");
  const btnPhoto = $("#btnPhoto");
  const btnPhotoClear = $("#btnPhotoClear");
  const polaroid = $("#polaroid");
  const photoPreview = $("#photoPreview");
  const photoPlaceholder = $("#photoPlaceholder");
  const defaultSrc = photoPreview?.getAttribute("src") || null;
  let hasUserPhoto = false;
  let photoUrl = null;

  const applyPreviewVisible = () => {
    if (!photoPreview || !photoPlaceholder) return;
    photoPreview.classList.add("show");
    photoPlaceholder.style.display = "none";
  };

  const applyPlaceholderVisible = () => {
    if (!photoPreview || !photoPlaceholder) return;
    photoPreview.classList.remove("show");
    photoPlaceholder.style.display = "";
  };

  const setToDefault = () => {
    hasUserPhoto = false;
    if (!photoPreview) return;
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = null;
    if (defaultSrc) {
      photoPreview.src = defaultSrc;
      applyPreviewVisible();
      if (btnPhotoClear) btnPhotoClear.disabled = true;
    } else {
      photoPreview.removeAttribute("src");
      applyPlaceholderVisible();
      if (btnPhotoClear) btnPhotoClear.disabled = true;
    }
  };

  const setPhoto = (file) => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    photoUrl = null;
    if (!file) {
      setToDefault();
      return;
    }
    hasUserPhoto = true;
    photoUrl = URL.createObjectURL(file);
    if (!photoPreview) return;

    let settled = false;
    const finalize = () => {
      if (settled) return;
      settled = true;
      applyPreviewVisible();
      if (btnPhotoClear) btnPhotoClear.disabled = false;
    };

    const fail = () => {
      if (settled) return;
      settled = true;
      applyPlaceholderVisible();
      if (btnPhotoClear) btnPhotoClear.disabled = true;
      showToast("图片预览失败：换一张试试");
    };

    photoPreview.addEventListener("load", finalize, { once: true });
    photoPreview.addEventListener("error", fail, { once: true });
    photoPreview.src = photoUrl;
    photoPreview.decode?.().then(finalize).catch(() => {});
  };

  btnPhoto?.addEventListener("click", (e) => {
    e.stopPropagation();
    photoInput?.click();
  });
  polaroid?.addEventListener("click", () => photoInput?.click());
  photoInput?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type?.startsWith("image/")) {
      showToast("请选择图片文件");
      e.target.value = "";
      return;
    }
    setPhoto(file);
    e.target.value = "";
  });
  btnPhotoClear?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (photoInput) photoInput.value = "";
    setToDefault();
  });
  polaroid?.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const wasUserPhoto = hasUserPhoto;
    if (photoInput) photoInput.value = "";
    setToDefault();
    showToast(wasUserPhoto ? "已清除照片" : "已恢复默认照片");
  });

  photoPreview?.addEventListener("error", () => {
    applyPlaceholderVisible();
  });

  // Ensure default image shows when user hasn't uploaded.
  setToDefault();

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault();
      showFireworksShow();
    }
  });

  document.addEventListener(
    "pointerdown",
    (e) => {
      if (e.target.closest("button,input")) return;
      const x = e.clientX;
      const y = e.clientY;
      if (Math.random() < 0.18) explodeAt(x, y, randInt(0, 359), "ring");
      else explodeAt(x, y, randInt(0, 359), "burst");
    },
    { passive: true },
  );

  document.addEventListener("visibilitychange", () => {
    state.fx.autoOn = !document.hidden;
  });
}

function init() {
  setupFx();
  setBlessing("点一下抽祝福：愿你 2026 平安喜乐，万事胜意。");
  wireUi();

  const prefersReduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if (prefersReduce) setReduceMotion(true);

  showToast("已升级：烟花更高更丰富 + 文字/图片粒子烟花 + 祝福自动飘");
}

init();
