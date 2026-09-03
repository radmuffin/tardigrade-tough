/**
 * canvas-art.js - Living Pixel Art & Diorama Animation Engine
 * Renders Pando Aspen Grove, Mt. Everest Ascent, Caribou Migration, and Blue Whale
 * with retro pixelated aesthetics, authentic natural proportions, and celebratory particle bursts.
 */

export class PixelDiorama {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.currentTheme = 'pando';
    this.progress = 0; // 0.0 to 1.0
    this.targetProgress = 0;
    this.particles = [];
    this.floatTexts = [];
    this.animationFrameId = null;
    this.time = 0;

    this.initCanvas();
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.startLoop();
  }

  initCanvas() {
    this.ctx.imageSmoothingEnabled = false;
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = Math.floor(rect.width) || 360;
    this.height = Math.floor(rect.height) || 240;

    this.canvas.width = this.width * dpr;
    this.canvas.height = this.height * dpr;
    this.ctx.scale(dpr, dpr);
    this.ctx.imageSmoothingEnabled = false;
  }

  setTheme(theme, progress = 0) {
    this.currentTheme = theme || 'pando';
    this.targetProgress = Math.max(0, Math.min(1, progress));
    if (Math.abs(this.progress - this.targetProgress) > 0.5) {
      this.progress = this.targetProgress;
    }
  }

  setProgress(progress, triggerBurst = false, deltaText = '') {
    this.targetProgress = Math.max(0, Math.min(1, progress));
    if (triggerBurst) {
      this.spawnCelebrationBurst(deltaText);
    }
  }

  spawnCelebrationBurst(text = '') {
    const count = 35;
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: this.width * 0.5 + (Math.random() * 80 - 40),
        y: this.height * 0.5 + (Math.random() * 50 - 25),
        vx: (Math.random() - 0.5) * 7,
        vy: -Math.random() * 8 - 2,
        size: Math.floor(Math.random() * 4) + 3,
        color: this.getParticleColor(),
        alpha: 1.0,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.2,
        life: 1.0,
      });
    }

    if (text) {
      this.floatTexts.push({
        text,
        x: this.width * 0.5,
        y: this.height * 0.45,
        vy: -1.2,
        alpha: 1.0,
      });
    }
  }

  spawnEmojiReaction(emoji) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        isEmoji: true,
        emoji: emoji || '💪',
        x: Math.random() * this.width,
        y: this.height - 20,
        vx: (Math.random() - 0.5) * 2.5,
        vy: -Math.random() * 5 - 3,
        size: 26,
        alpha: 1.0,
        life: 1.0,
      });
    }
  }

  getParticleColor() {
    switch (this.currentTheme) {
      case 'pando':
        const golds = ['#f59e0b', '#fbbf24', '#facc15', '#d97706', '#b45309', '#fef08a'];
        return golds[Math.floor(Math.random() * golds.length)];
      case 'everest':
        const snows = ['#ffffff', '#e2e8f0', '#94a3b8', '#38bdf8'];
        return snows[Math.floor(Math.random() * snows.length)];
      case 'caribou':
        const tundras = ['#a3e635', '#ca8a04', '#fed7aa', '#cbd5e1'];
        return tundras[Math.floor(Math.random() * tundras.length)];
      case 'whale':
        const blues = ['#38bdf8', '#0284c7', '#bae6fd', '#06b6d4'];
        return blues[Math.floor(Math.random() * blues.length)];
      default:
        return '#10b981';
    }
  }

  startLoop() {
    const loop = () => {
      this.time += 0.03;
      // Smooth progress lerp
      this.progress += (this.targetProgress - this.progress) * 0.08;

      this.render();
      this.updateParticles();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    ctx.clearRect(0, 0, w, h);

    switch (this.currentTheme) {
      case 'pando':
        this.renderPando(ctx, w, h);
        break;
      case 'everest':
        this.renderEverest(ctx, w, h);
        break;
      case 'caribou':
        this.renderCaribou(ctx, w, h);
        break;
      case 'whale':
        this.renderWhale(ctx, w, h);
        break;
      default:
        this.renderCustom(ctx, w, h);
        break;
    }

    this.renderOverlayStats(ctx, w, h);
    this.renderParticles(ctx);
  }

  /* ========================================================================= */
  /* 🌲 PANDO ASPEN GROVE (AUTHENTIC SHEET-INSPIRED PIXEL ART)                 */
  /* ========================================================================= */
  renderPando(ctx, w, h) {
    // 1. Crisp Autumn Sky (Deep twilight to amber glow)
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#0f172a');
    skyGrad.addColorStop(0.5, '#1e293b');
    skyGrad.addColorStop(0.85, '#334155');
    skyGrad.addColorStop(1, '#475569');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Distant Utah Mountain Silhouettes (Fishlake Plateau)
    ctx.fillStyle = '#18182e';
    this.drawPixelMountain(ctx, -20, h * 0.72, w * 0.55, h * 0.35);
    ctx.fillStyle = '#22223d';
    this.drawPixelMountain(ctx, w * 0.35, h * 0.74, w * 0.7, h * 0.32);

    // 3. Forest Floor & Rich Autumn Soil
    const groundY = h * 0.78;
    ctx.fillStyle = '#451a03'; // deep soil
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.fillStyle = '#78350f'; // top soil
    ctx.fillRect(0, groundY, w, 6);

    // Fallen golden leaf carpet (multiplies as weight increases)
    const leafCount = Math.floor(35 + this.progress * 120);
    for (let i = 0; i < leafCount; i++) {
      const lx = ((i * 61 + 13) % (w - 4));
      const ly = groundY + 4 + ((i * 29) % (h - groundY - 8));
      const colors = ['#f59e0b', '#d97706', '#fbbf24', '#b45309', '#fef08a'];
      ctx.fillStyle = colors[i % colors.length];
      ctx.fillRect(lx, ly, 4, 3);
    }

    // 4. Slender Aspen Trunks (Proportional & Natural)
    // Trunks are slender (8-12px), starting from ground and extending into foliage
    const trunkDefs = [
      { x: w * 0.16, w: 9, topY: h * 0.42 },
      { x: w * 0.38, w: 12, topY: h * 0.36 },
      { x: w * 0.64, w: 11, topY: h * 0.38 },
      { x: w * 0.84, w: 8, topY: h * 0.45 },
    ];

    // Additional sapling trunks sprout as progress increases!
    if (this.progress > 0.3) {
      trunkDefs.push({ x: w * 0.28, w: 6, topY: h * 0.50 });
    }
    if (this.progress > 0.6) {
      trunkDefs.push({ x: w * 0.52, w: 7, topY: h * 0.48 });
    }
    if (this.progress > 0.8) {
      trunkDefs.push({ x: w * 0.74, w: 6, topY: h * 0.52 });
    }

    // Draw Trunks
    trunkDefs.forEach(t => {
      const trunkH = groundY - t.topY;
      // White/Silver bark base
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(t.x, t.topY, t.w, trunkH);
      // Right edge shadow
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(t.x + t.w - 3, t.topY, 3, trunkH);

      // Dark horizontal lenticels / eye knots (Iconic Aspen bark)
      ctx.fillStyle = '#1e293b';
      const knots = Math.floor(trunkH / 14);
      for (let k = 0; k < knots; k++) {
        const ky = t.topY + 8 + k * 14 + (k % 3) * 2;
        const kw = Math.min(t.w, 4 + (k % 3) * 2);
        const kx = t.x + (k % 2 === 0 ? 0 : t.w - kw);
        ctx.fillRect(kx, ky, kw, 3);
      }
    });

    // 5. Expansive, Lush Autumn Foliage Canopies (Authentic Pixel Dome Art)
    const sway = Math.sin(this.time * 1.5) * 2.5;

    // Canopy centers positioned over trunks with generous overlapping radius
    const canopies = [
      { cx: w * 0.16 + sway * 0.8, cy: h * 0.35, rx: w * 0.18, ry: h * 0.26, seed: 1 },
      { cx: w * 0.38 - sway, cy: h * 0.28, rx: w * 0.24, ry: h * 0.30, seed: 2 },
      { cx: w * 0.64 + sway, cy: h * 0.30, rx: w * 0.22, ry: h * 0.28, seed: 3 },
      { cx: w * 0.84 - sway * 0.8, cy: h * 0.38, rx: w * 0.16, ry: h * 0.24, seed: 4 },
    ];

    canopies.forEach(c => {
      this.drawLushAspenCanopy(ctx, c.cx, c.cy, c.rx, c.ry, c.seed);
    });

    // Drifting autumn leaf particles in the breeze
    if (Math.random() < 0.25 + this.progress * 0.4) {
      this.particles.push({
        x: Math.random() * w,
        y: h * 0.1 + Math.random() * (h * 0.5),
        vx: Math.sin(this.time + Math.random()) * 1.4 + 1.0,
        vy: Math.random() * 0.9 + 0.6,
        size: 3,
        color: Math.random() > 0.5 ? '#fbbf24' : '#f59e0b',
        alpha: 0.9,
        rotation: 0,
        rotSpeed: 0.05,
        life: 0.9,
      });
    }
  }

  drawLushAspenCanopy(ctx, cx, cy, baseRx, baseRy, seed) {
    // Dynamic foliage density & scale based on progress
    const growthScale = 0.85 + this.progress * 0.35;
    const rx = baseRx * growthScale;
    const ry = baseRy * growthScale;

    // Layered color steps: Shadow chestnut -> Warm amber -> Golden yellow -> Bright sunburst highlights
    const layers = [
      { col: '#78350f', scale: 1.05 },
      { col: '#b45309', scale: 0.98 },
      { col: '#d97706', scale: 0.88 },
      { col: '#f59e0b', scale: 0.74 },
      { col: '#fbbf24', scale: 0.58 },
      { col: '#fef08a', scale: 0.36 }, // crown highlights
    ];

    const pixelStep = 7;

    layers.forEach(layer => {
      ctx.fillStyle = layer.col;
      const curRx = rx * layer.scale;
      const curRy = ry * layer.scale;

      for (let ox = -curRx; ox <= curRx; ox += pixelStep) {
        for (let oy = -curRy; oy <= curRy; oy += pixelStep) {
          const norm = (ox * ox) / (curRx * curRx) + (oy * oy) / (curRy * curRy);
          if (norm <= 1.0) {
            // Leaf cluster texture variation
            const clusterNoise = Math.sin(ox * 0.25 + seed * 2.5) * Math.cos(oy * 0.25);
            if (clusterNoise > -0.3 || norm < 0.65) {
              ctx.fillRect(Math.floor(cx + ox), Math.floor(cy + oy), pixelStep - 1, pixelStep - 1);
            }
          }
        }
      }
    });
  }

  /* ========================================================================= */
  /* 🐐 MT. EVEREST GOAT ASCENT RENDERER                                      */
  /* ========================================================================= */
  renderEverest(ctx, w, h) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#0b132b');
    skyGrad.addColorStop(0.5, '#1c2541');
    skyGrad.addColorStop(0.85, '#3a506b');
    skyGrad.addColorStop(1, '#5bc0be');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Floating Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    const cloudX1 = ((this.time * 10) % (w + 120)) - 60;
    ctx.fillRect(cloudX1, h * 0.22, 80, 14);
    ctx.fillRect(cloudX1 + 18, h * 0.18, 45, 10);

    // Everest Ridge & Peak
    const peakX = w * 0.70;
    const peakY = h * 0.18;
    const baseX1 = -20;
    const baseY1 = h * 0.95;
    const baseX2 = w + 40;
    const baseY2 = h * 0.95;

    // Mountain Shadow Side
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(baseX2, baseY2);
    ctx.lineTo(peakX, baseY2);
    ctx.closePath();
    ctx.fill();

    // Mountain Sunny Side
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(baseX1, baseY1);
    ctx.lineTo(peakX, baseY2);
    ctx.closePath();
    ctx.fill();

    // Snow Cap
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(peakX - 35, peakY + 50);
    ctx.lineTo(peakX - 10, peakY + 45);
    ctx.lineTo(peakX + 15, peakY + 55);
    ctx.lineTo(peakX + 40, peakY + 48);
    ctx.closePath();
    ctx.fill();

    // Summit Victory Flag
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(peakX, peakY - 14, 12, 8);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(peakX - 1, peakY - 16, 2, 16);

    // Goat Position along Ridge
    const goatStartX = w * 0.15;
    const goatStartY = h * 0.85;
    const goatTargetX = peakX - 12;
    const goatTargetY = peakY + 10;

    const currentGoatX = goatStartX + (goatTargetX - goatStartX) * this.progress;
    const currentGoatY = goatStartY + (goatTargetY - goatStartY) * this.progress;

    const hop = Math.abs(Math.sin(this.time * 6)) * 4;
    this.drawPixelGoat(ctx, currentGoatX, currentGoatY - hop);
  }

  drawPixelGoat(ctx, x, y) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y - 10, 16, 10);
    ctx.fillRect(x + 12, y - 16, 8, 8);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(x + 16, y - 8, 4, 5);
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(x + 10, y - 20, 4, 5);
    ctx.fillRect(x + 8, y - 22, 4, 3);
    ctx.fillStyle = '#475569';
    ctx.fillRect(x + 2, y, 3, 6);
    ctx.fillRect(x + 11, y, 3, 6);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x + 16, y - 14, 2, 2);
  }

  /* ========================================================================= */
  /* 🦌 CARIBOU TUNDRA MIGRATION RENDERER                                     */
  /* ========================================================================= */
  renderCaribou(ctx, w, h) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#064e3b');
    skyGrad.addColorStop(0.4, '#065f46');
    skyGrad.addColorStop(0.8, '#0f766e');
    skyGrad.addColorStop(1, '#115e59');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Aurora Ribbon
    ctx.fillStyle = 'rgba(52, 211, 153, 0.2)';
    ctx.beginPath();
    ctx.moveTo(0, h * 0.15 + Math.sin(this.time) * 10);
    ctx.bezierCurveTo(w * 0.3, h * 0.05, w * 0.7, h * 0.3, w, h * 0.1);
    ctx.lineTo(w, h * 0.25);
    ctx.bezierCurveTo(w * 0.7, h * 0.45, w * 0.3, h * 0.2, 0, h * 0.3);
    ctx.closePath();
    ctx.fill();

    // Distant Snow Peaks
    ctx.fillStyle = '#0f172a';
    this.drawPixelMountain(ctx, 0, h * 0.6, w * 0.5, h * 0.35);
    this.drawPixelMountain(ctx, w * 0.4, h * 0.62, w * 0.6, h * 0.32);

    // Tundra Ground
    const groundY = h * 0.75;
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.fillStyle = '#52525b';
    ctx.fillRect(0, groundY, w, 6);

    // Snow patches
    ctx.fillStyle = '#e2e8f0';
    for (let i = 0; i < 6; i++) {
      const sx = ((i * 89) % w);
      ctx.fillRect(sx, groundY + 8 + (i % 3) * 6, 25, 4);
    }

    // Herd Progress
    const herdStartX = w * 0.08;
    const herdEndX = w * 0.85;
    const herdX = herdStartX + (herdEndX - herdStartX) * this.progress;
    const trot = Math.sin(this.time * 5) * 3;

    this.drawPixelCaribou(ctx, herdX, groundY - 14 + trot, 1.1);
    this.drawPixelCaribou(ctx, herdX - 26, groundY - 10 - trot * 0.8, 0.85);
    this.drawPixelCaribou(ctx, herdX - 48, groundY - 12 + trot * 0.6, 0.95);
  }

  drawPixelCaribou(ctx, x, y, scale = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, 0, 20, 10);
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(14, 2, 7, 7);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(18, -6, 8, 7);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(19, -14, 2, 9);
    ctx.fillRect(17, -12, 6, 2);
    ctx.fillRect(15, -16, 8, 2);
    ctx.fillRect(23, -17, 2, 4);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(3, 10, 3, 8);
    ctx.fillRect(14, 10, 3, 8);

    ctx.restore();
  }

  /* ========================================================================= */
  /* 🐋 THE BLUE WHALE (TROPHY ROOM / CONQUERED)                              */
  /* ========================================================================= */
  renderWhale(ctx, w, h) {
    const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
    oceanGrad.addColorStop(0, '#0284c7');
    oceanGrad.addColorStop(0.5, '#0369a1');
    oceanGrad.addColorStop(1, '#082f49');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, w, h);

    // Sun rays
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      const rx = (i * 90) + Math.sin(this.time + i) * 15;
      ctx.moveTo(rx, 0);
      ctx.lineTo(rx + 40, h);
      ctx.lineTo(rx + 80, h);
      ctx.lineTo(rx + 20, 0);
      ctx.closePath();
      ctx.fill();
    }

    const whaleY = h * 0.48 + Math.sin(this.time * 2) * 5;
    const whaleX = w * 0.45;
    this.drawPixelWhale(ctx, whaleX, whaleY);

    // Rising Bubbles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    for (let b = 0; b < 5; b++) {
      const bx = ((b * 67 + this.time * 10) % w);
      const by = h - ((this.time * 30 + b * 45) % h);
      ctx.fillRect(bx, by, 3, 3);
    }
  }

  drawPixelWhale(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-60, -15, 110, 30);
    ctx.fillRect(-85, -5, 30, 16);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(35, -12, 25, 24);
    ctx.fillStyle = '#e0f2fe';
    ctx.fillRect(-45, 8, 80, 8);
    ctx.fillStyle = '#0369a1';
    ctx.fillRect(-5, 12, 24, 10);
    ctx.fillRect(-105, -20, 22, 12);
    ctx.fillRect(-105, 10, 22, 12);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(42, -5, 4, 4);

    ctx.restore();
  }

  /* ========================================================================= */
  /* 🐻 AUTHENTIC PIXEL TARDIGRADE (WATER BEAR)                               */
  /* ========================================================================= */
  renderCustom(ctx, w, h) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Retro grid
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 20) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 20) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Authentic Water Bear / Tardigrade
    const tardX = w * 0.45;
    const tardY = h * 0.5 + Math.sin(this.time * 3) * 5;
    this.drawPixelTardigrade(ctx, tardX, tardY);
  }

  drawPixelTardigrade(ctx, x, y) {
    ctx.save();
    ctx.translate(x, y);

    // Plump segmented barrel body (Emerald/Moss)
    ctx.fillStyle = '#10b981';
    ctx.fillRect(-40, -20, 80, 40);

    // Segment creases (4 body segments)
    ctx.fillStyle = '#059669';
    ctx.fillRect(-20, -20, 5, 40);
    ctx.fillRect(0, -20, 5, 40);
    ctx.fillRect(20, -20, 5, 40);

    // Rounded posterior
    ctx.fillStyle = '#10b981';
    ctx.fillRect(-48, -12, 10, 24);

    // Snout / Head disc
    ctx.fillStyle = '#34d399';
    ctx.fillRect(38, -12, 14, 24);
    // Tubular mouth opening
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(50, -4, 4, 8);

    // Beady eyes
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(36, -14, 4, 4);

    // 4 Pairs of stubby legs with claws
    const legPositions = [-30, -10, 10, 30];
    legPositions.forEach(lx => {
      // Stubby leg
      ctx.fillStyle = '#059669';
      ctx.fillRect(lx - 4, 18, 10, 10);
      // Little sharp claws (Amber)
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(lx - 6, 26, 3, 4);
      ctx.fillRect(lx, 26, 3, 4);
      ctx.fillRect(lx + 6, 26, 3, 4);
    });

    ctx.restore();
  }

  drawPixelMountain(ctx, x, y, width, height) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + width * 0.5, y - height);
    ctx.lineTo(x + width, y);
    ctx.closePath();
    ctx.fill();
  }

  renderOverlayStats(ctx, w, h) {
    const barH = 5;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, h - barH, w, barH);

    ctx.fillStyle = '#10b981';
    ctx.fillRect(0, h - barH, w * this.progress, barH);
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.alpha -= 0.015;
      p.life -= 0.015;
      if (p.alpha <= 0 || p.y > this.height + 20) {
        this.particles.splice(i, 1);
      }
    }

    for (let i = this.floatTexts.length - 1; i >= 0; i--) {
      const ft = this.floatTexts[i];
      ft.y += ft.vy;
      ft.alpha -= 0.015;
      if (ft.alpha <= 0) {
        this.floatTexts.splice(i, 1);
      }
    }
  }

  renderParticles(ctx) {
    this.particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, p.alpha);
      if (p.isEmoji) {
        ctx.font = `${p.size}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.emoji, p.x, p.y);
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.floor(p.x), Math.floor(p.y), p.size, p.size);
      }
      ctx.restore();
    });

    this.floatTexts.forEach(ft => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, ft.alpha);
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fbbf24';
      ctx.shadowColor = '#000000';
      ctx.shadowBlur = 4;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.restore();
    });
  }
}
