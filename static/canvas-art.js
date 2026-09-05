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
    this._resizeHandler = () => this.resize();
    window.addEventListener('resize', this._resizeHandler);
    this.resize();
    this.startLoop();
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
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
    this.progress = this.targetProgress;
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
    skyGrad.addColorStop(0.45, '#1c2541');
    skyGrad.addColorStop(0.8, '#3a506b');
    skyGrad.addColorStop(1, '#64748b');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // High Altitude Stars / Alpine Twinkle
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    for (let i = 0; i < 15; i++) {
      const sx = ((i * 47 + 13) % w);
      const sy = ((i * 29 + 7) % Math.floor(h * 0.35));
      const sSize = (i % 3 === 0) ? 2 : 1;
      ctx.fillRect(sx, sy, sSize, sSize);
    }

    // Floating Clouds
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
    const cloudX1 = ((this.time * 12) % (w + 140)) - 70;
    ctx.fillRect(cloudX1, h * 0.22, 90, 16);
    ctx.fillRect(cloudX1 + 22, h * 0.18, 55, 12);
    const cloudX2 = (((this.time * 8) + 160) % (w + 140)) - 70;
    ctx.fillRect(cloudX2, h * 0.38, 70, 12);

    // Everest Ridge & Peak coordinates
    const peakX = w * 0.70;
    const peakY = h * 0.18;
    const baseX1 = -20;
    const baseY1 = h * 0.95;
    const baseX2 = w + 40;
    const baseY2 = h * 0.95;

    // Distant jagged background peaks
    ctx.fillStyle = '#111827';
    this.drawPixelMountain(ctx, -10, h * 0.85, w * 0.45, h * 0.45);
    this.drawPixelMountain(ctx, w * 0.25, h * 0.88, w * 0.6, h * 0.40);

    // Mountain Shadow Side (East face)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(baseX2, baseY2);
    ctx.lineTo(peakX, baseY2);
    ctx.closePath();
    ctx.fill();

    // Mountain Sunny Side (West ridge)
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(baseX1, baseY1);
    ctx.lineTo(peakX, baseY2);
    ctx.closePath();
    ctx.fill();

    // Mountain Snow Cap on Peak
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(peakX, peakY);
    ctx.lineTo(peakX - 35, peakY + 50);
    ctx.lineTo(peakX - 10, peakY + 45);
    ctx.lineTo(peakX + 15, peakY + 55);
    ctx.lineTo(peakX + 40, peakY + 48);
    ctx.closePath();
    ctx.fill();

    // Snow bands and crags on the ridge face
    ctx.fillStyle = '#e2e8f0';
    for (let i = 0; i < 5; i++) {
      const rx = peakX - 25 - i * 35;
      const ry = peakY + 55 + i * 26;
      ctx.fillRect(rx, ry, 18, 4);
      ctx.fillRect(rx + 6, ry + 4, 12, 3);
    }

    // Colorful Himalayan Prayer Flags waving along upper ridge
    const flagColors = ['#ef4444', '#3b82f6', '#f8fafc', '#10b981', '#f59e0b'];
    for (let i = 0; i < 10; i++) {
      const fx = peakX - 85 + i * 8;
      const fy = peakY + 70 - i * 5 + Math.sin(this.time * 4 + i) * 2;
      ctx.fillStyle = flagColors[i % flagColors.length];
      ctx.fillRect(fx, fy, 5, 4);
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(fx, fy - 1, 6, 1);
    }

    // Summit Victory Flag
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(peakX, peakY - 14, 12, 8);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(peakX - 1, peakY - 16, 2, 16);

    // Mountain Ridge Slope Equation
    const slope = (peakY - baseY1) / (peakX - baseX1);
    const ridgeYAt = (x) => baseY1 + slope * (x - baseX1);

    // Goat Position along Ridge: firmly standing right on the mountain ridge!
    const goatStartX = w * 0.16;
    const goatTargetX = peakX - 16;
    const currentGoatX = goatStartX + (goatTargetX - goatStartX) * this.progress;
    const currentGoatY = ridgeYAt(currentGoatX);

    // Leaping / Bounding animation
    const hopCycle = this.time * 5;
    const hop = Math.abs(Math.sin(hopCycle)) * 7;
    const hopPhase = Math.sin(hopCycle);

    this.drawPixelGoat(ctx, currentGoatX, currentGoatY - hop, 1.35, hopPhase);
  }

  drawPixelGoat(ctx, x, y, scale = 1.35, hopPhase = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const legOffset = hopPhase > 0.2 ? -2 : 0;
    // Front Legs
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(10, 0, 3, 7 + legOffset);
    ctx.fillRect(14, 0, 3, 7 - legOffset);
    ctx.fillStyle = '#0f172a'; // black cloven hooves
    ctx.fillRect(10, 7 + legOffset, 3, 2);
    ctx.fillRect(14, 7 - legOffset, 3, 2);

    // Back Legs
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, 0, 3, 7 - legOffset);
    ctx.fillRect(4, 0, 3, 7 + legOffset);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 7 - legOffset, 3, 2);
    ctx.fillRect(4, 7 + legOffset, 3, 2);

    // Body (Shaggy mountain wool coat)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, -9, 18, 10);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(2, -11, 14, 3);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(1, 0, 16, 2);

    // Fluffy Short Tail
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(-3, -8, 4, 4);

    // Head & Snout
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(14, -15, 8, 8);
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(18, -12, 6, 5);

    // Nose & Dark Eye
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(23, -11, 2, 2);
    ctx.fillRect(18, -14, 2, 2);

    // Goatee Beard
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(19, -7, 3, 5);
    ctx.fillRect(20, -2, 2, 2);

    // Ears
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(13, -16, 2, 4);

    // Backward-Sweeping Alpine Horns
    ctx.fillStyle = '#ca8a04';
    ctx.fillRect(13, -20, 3, 6);
    ctx.fillRect(11, -22, 3, 4);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(9, -23, 3, 3);

    ctx.restore();
  }

  /* ========================================================================= */
  /* 🦌 CARIBOU TUNDRA MIGRATION RENDERER                                     */
  /* ========================================================================= */
  renderCaribou(ctx, w, h) {
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#042f2e');
    skyGrad.addColorStop(0.35, '#064e3b');
    skyGrad.addColorStop(0.7, '#0f766e');
    skyGrad.addColorStop(1, '#134e4a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Shimmering Aurora Borealis Waves
    for (let i = 0; i < 3; i++) {
      const alpha = 0.18 - i * 0.04;
      ctx.fillStyle = i === 1 ? `rgba(94, 234, 212, ${alpha})` : `rgba(52, 211, 153, ${alpha})`;
      ctx.beginPath();
      const waveOffset = this.time * 0.8 + i * 1.5;
      ctx.moveTo(0, h * 0.12 + Math.sin(waveOffset) * 12);
      ctx.bezierCurveTo(
        w * 0.25, h * 0.05 + Math.cos(waveOffset) * 10,
        w * 0.65, h * 0.28 + Math.sin(waveOffset * 1.2) * 14,
        w, h * 0.08 + Math.cos(waveOffset) * 8
      );
      ctx.lineTo(w, h * 0.32);
      ctx.bezierCurveTo(
        w * 0.65, h * 0.42,
        w * 0.25, h * 0.22,
        0, h * 0.30
      );
      ctx.closePath();
      ctx.fill();
    }

    // Distant Snow Peaks
    ctx.fillStyle = '#0f172a';
    this.drawPixelMountain(ctx, -10, h * 0.65, w * 0.45, h * 0.36);
    this.drawPixelMountain(ctx, w * 0.35, h * 0.68, w * 0.65, h * 0.34);
    ctx.fillStyle = '#1e293b';
    this.drawPixelMountain(ctx, w * 0.15, h * 0.70, w * 0.4, h * 0.26);

    // Snow caps on distant peaks
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(w * 0.11, h * 0.32, 10, 4);
    ctx.fillRect(w * 0.66, h * 0.36, 12, 4);

    // Tundra Ground
    const groundY = h * 0.75;
    ctx.fillStyle = '#27272a';
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.fillStyle = '#3f3f46';
    ctx.fillRect(0, groundY, w, 6);

    // Arctic moss & Snow patches
    ctx.fillStyle = '#e2e8f0';
    for (let i = 0; i < 8; i++) {
      const sx = ((i * 73 + 17) % (w - 30));
      const sy = groundY + 4 + ((i * 19) % (h - groundY - 8));
      const sw = 20 + (i % 3) * 10;
      ctx.fillRect(sx, sy, sw, 3);
    }
    ctx.fillStyle = '#065f46';
    for (let i = 0; i < 6; i++) {
      const mx = ((i * 91 + 45) % (w - 20));
      ctx.fillRect(mx, groundY + 2, 14, 2);
    }

    // Herd Progress across the Arctic Tundra
    // Prominently placed so all 3 caribou are fully visible even at 0 progress!
    const herdStartX = w * 0.22;
    const herdEndX = w * 0.82;
    const herdX = herdStartX + (herdEndX - herdStartX) * this.progress;

    // 1. Lead Bull (Large antlers, dominant lead)
    const trotLead = Math.sin(this.time * 5.2) * 3.5;
    this.drawPixelCaribou(ctx, herdX, groundY - 15 + trotLead, 1.2, this.time * 5.2, true);

    // 2. Cow Caribou (Follows closely behind)
    const trotCow = Math.sin(this.time * 5.2 + 1.6) * 3;
    this.drawPixelCaribou(ctx, herdX - 36, groundY - 12 + trotCow, 0.96, this.time * 5.2 + 1.6, false);

    // 3. Yearling / Calf Caribou
    const trotCalf = Math.sin(this.time * 5.2 + 3.0) * 2.5;
    this.drawPixelCaribou(ctx, herdX - 66, groundY - 9 + trotCalf, 0.80, this.time * 5.2 + 3.0, false);
  }

  drawPixelCaribou(ctx, x, y, scale = 1.0, trotPhase = 0, isLead = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const legStep = Math.sin(trotPhase) * 4;

    // Trotting Legs
    ctx.fillStyle = '#451a03';
    // Back legs
    ctx.fillRect(2, 6, 3, 8 - legStep);
    ctx.fillRect(6, 6, 3, 8 + legStep);
    // Front legs
    ctx.fillRect(15, 6, 3, 8 + legStep);
    ctx.fillRect(19, 6, 3, 8 - legStep);

    // Black hooves kicking
    ctx.fillStyle = '#18181b';
    ctx.fillRect(2, 14 - legStep, 3, 2);
    ctx.fillRect(6, 14 + legStep, 3, 2);
    ctx.fillRect(15, 14 + legStep, 3, 2);
    ctx.fillRect(19, 14 - legStep, 3, 2);

    // Body (Rich brown tundra coat)
    ctx.fillStyle = '#78350f';
    ctx.fillRect(0, -4, 22, 11);
    ctx.fillStyle = '#542307';
    ctx.fillRect(2, 4, 18, 3);

    // White Rump Patch & Short Tail
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(-2, -3, 3, 6);
    ctx.fillStyle = '#78350f';
    ctx.fillRect(-4, -4, 3, 3);

    // White Neck Ruff / Mane
    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(14, -6, 8, 9);
    ctx.fillStyle = '#fde68a';
    ctx.fillRect(17, -3, 4, 6);

    // Head
    ctx.fillStyle = '#78350f';
    ctx.fillRect(19, -11, 9, 8);
    ctx.fillStyle = '#451a03';
    ctx.fillRect(25, -8, 4, 5);

    // Nostril with frost breath puff
    ctx.fillStyle = '#18181b';
    ctx.fillRect(27, -7, 2, 2);
    if (Math.sin(this.time * 3) > 0.2) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fillRect(30, -8, 3, 2);
      ctx.fillRect(32, -9, 4, 2);
    }

    // Eye
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(23, -10, 2, 2);

    // Ears
    ctx.fillStyle = '#542307';
    ctx.fillRect(18, -13, 3, 3);

    // Majestic Branching Antlers
    ctx.fillStyle = '#451a03';
    ctx.fillRect(19, -18, 3, 8);
    ctx.fillRect(17, -23, 3, 6);
    ctx.fillRect(15, -28, 3, 6);

    ctx.fillRect(18, -27, 4, 2);
    ctx.fillRect(13, -29, 3, 2);
    ctx.fillRect(20, -25, 5, 2);

    if (isLead) {
      ctx.fillRect(22, -17, 6, 2);
      ctx.fillRect(27, -19, 2, 4);
      ctx.fillRect(16, -21, 5, 2);
    }

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
