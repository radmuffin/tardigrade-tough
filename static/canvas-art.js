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
    this.subProgress = null;
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

  isLightMode() {
    return typeof document !== 'undefined' && document.documentElement?.getAttribute('data-theme') === 'light';
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

  setTheme(theme, progress = 0, subProgress = null) {
    this.currentTheme = theme || 'pando';
    this.targetProgress = Math.max(0, Math.min(1, progress));
    this.progress = this.targetProgress;
    this.subProgress = subProgress || null;
  }

  setProgress(progress, triggerBurst = false, deltaText = '', subProgress = null) {
    this.targetProgress = Math.max(0, Math.min(1, progress));
    if (subProgress) {
      this.subProgress = subProgress;
    }
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
      case 'volcano':
        const fires = ['#ef4444', '#dc2626', '#f97316', '#fbbf24', '#7f1d1d'];
        return fires[Math.floor(Math.random() * fires.length)];
      case 'canopy':
        const emeralds = ['#10b981', '#059669', '#34d399', '#047857', '#6ee7b7'];
        return emeralds[Math.floor(Math.random() * emeralds.length)];
      case 'ironman':
        const irons = ['#94a3b8', '#cbd5e1', '#f59e0b', '#ef4444', '#38bdf8', '#fbbf24', '#f1f5f9'];
        return irons[Math.floor(Math.random() * irons.length)];
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
      case 'volcano':
        this.renderVolcano(ctx, w, h);
        break;
      case 'canopy':
        this.renderCanopy(ctx, w, h);
        break;
      case 'ironman':
        this.renderIronman(ctx, w, h);
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
    const isLight = this.isLightMode();

    // 1. Crisp Autumn Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (isLight) {
      // Radiant Utah Autumn Daylight (Cerulean to golden horizon haze)
      skyGrad.addColorStop(0, '#38bdf8');
      skyGrad.addColorStop(0.45, '#7dd3fc');
      skyGrad.addColorStop(0.8, '#bae6fd');
      skyGrad.addColorStop(1, '#fef08a');
    } else {
      // Deep twilight to amber glow
      skyGrad.addColorStop(0, '#0f172a');
      skyGrad.addColorStop(0.5, '#1e293b');
      skyGrad.addColorStop(0.85, '#334155');
      skyGrad.addColorStop(1, '#475569');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Distant Utah Mountain Silhouettes (Fishlake Plateau)
    ctx.fillStyle = isLight ? '#64748b' : '#18182e';
    this.drawPixelMountain(ctx, -20, h * 0.72, w * 0.55, h * 0.35);
    ctx.fillStyle = isLight ? '#94a3b8' : '#22223d';
    this.drawPixelMountain(ctx, w * 0.35, h * 0.74, w * 0.7, h * 0.32);

    // 3. Forest Floor & Rich Autumn Soil
    const groundY = h * 0.78;
    ctx.fillStyle = isLight ? '#78350f' : '#451a03'; // deep soil
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.fillStyle = isLight ? '#b45309' : '#78350f'; // top soil
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
    const isLight = this.isLightMode();

    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (isLight) {
      // Brilliant high-altitude Himalayan daylight
      skyGrad.addColorStop(0, '#0284c7');
      skyGrad.addColorStop(0.5, '#38bdf8');
      skyGrad.addColorStop(0.85, '#7dd3fc');
      skyGrad.addColorStop(1, '#e0f2fe');
    } else {
      // Midnight alpine sky
      skyGrad.addColorStop(0, '#0b132b');
      skyGrad.addColorStop(0.45, '#1c2541');
      skyGrad.addColorStop(0.8, '#3a506b');
      skyGrad.addColorStop(1, '#64748b');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // High Altitude Stars (night sky only)
    if (!isLight) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      for (let i = 0; i < 15; i++) {
        const sx = ((i * 47 + 13) % w);
        const sy = ((i * 29 + 7) % Math.floor(h * 0.35));
        const sSize = (i % 3 === 0) ? 2 : 1;
        ctx.fillRect(sx, sy, sSize, sSize);
      }
    }

    // Floating Clouds (crisp white in daylight, translucent in night sky)
    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.88)' : 'rgba(255, 255, 255, 0.22)';
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
    ctx.fillStyle = isLight ? '#64748b' : '#111827';
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
    const isLight = this.isLightMode();

    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (isLight) {
      // Expansive Arctic tundra daylight
      skyGrad.addColorStop(0, '#0284c7');
      skyGrad.addColorStop(0.4, '#38bdf8');
      skyGrad.addColorStop(0.75, '#ccfbf1');
      skyGrad.addColorStop(1, '#f0fdfa');
    } else {
      // Polar twilight
      skyGrad.addColorStop(0, '#042f2e');
      skyGrad.addColorStop(0.35, '#064e3b');
      skyGrad.addColorStop(0.7, '#0f766e');
      skyGrad.addColorStop(1, '#134e4a');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Northern sky phenomenon: Aurora in dark mode, ethereal Arctic cloud ribbons in light mode
    for (let i = 0; i < 3; i++) {
      const alpha = isLight ? (0.35 - i * 0.08) : (0.18 - i * 0.04);
      if (isLight) {
        ctx.fillStyle = i === 1 ? `rgba(204, 251, 241, ${alpha})` : `rgba(255, 255, 255, ${alpha})`;
      } else {
        ctx.fillStyle = i === 1 ? `rgba(94, 234, 212, ${alpha})` : `rgba(52, 211, 153, ${alpha})`;
      }
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
    ctx.fillStyle = isLight ? '#64748b' : '#0f172a';
    this.drawPixelMountain(ctx, -10, h * 0.65, w * 0.45, h * 0.36);
    this.drawPixelMountain(ctx, w * 0.35, h * 0.68, w * 0.65, h * 0.34);
    ctx.fillStyle = isLight ? '#94a3b8' : '#1e293b';
    this.drawPixelMountain(ctx, w * 0.15, h * 0.70, w * 0.4, h * 0.26);

    // Snow caps on distant peaks
    ctx.fillStyle = isLight ? '#f8fafc' : '#e2e8f0';
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
    const isLight = this.isLightMode();

    const oceanGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (isLight) {
      // Sun-drenched tropical pelagic waters
      oceanGrad.addColorStop(0, '#38bdf8');
      oceanGrad.addColorStop(0.5, '#0ea5e9');
      oceanGrad.addColorStop(1, '#0284c7');
    } else {
      // Deep ocean abyss
      oceanGrad.addColorStop(0, '#0284c7');
      oceanGrad.addColorStop(0.5, '#0369a1');
      oceanGrad.addColorStop(1, '#082f49');
    }
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, 0, w, h);

    // Sun rays (vibrant shimmering in daylight)
    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.22)' : 'rgba(255, 255, 255, 0.08)';
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
  /* 🌋 VOLCANO QUEST (MAGMA CRIMSON & OBSIDIAN PIXEL ART)                     */
  /* ========================================================================= */
  renderVolcano(ctx, w, h) {
    const isLight = this.isLightMode();

    // 1. Volcanic sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (isLight) {
      // Daylight fiery amber/peach haze
      skyGrad.addColorStop(0, '#fdba74');
      skyGrad.addColorStop(0.45, '#fed7aa');
      skyGrad.addColorStop(0.8, '#f87171');
      skyGrad.addColorStop(1, '#ef4444');
    } else {
      // Ash night sky gradient
      skyGrad.addColorStop(0, '#09090b');
      skyGrad.addColorStop(0.5, '#1c1917');
      skyGrad.addColorStop(0.85, '#431407');
      skyGrad.addColorStop(1, '#7f1d1d');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Distant volcanic ridges
    ctx.fillStyle = isLight ? '#78716c' : '#18181b';
    this.drawPixelMountain(ctx, -w * 0.1, h * 0.8, w * 0.6, h * 0.4);
    ctx.fillStyle = isLight ? '#a8a29e' : '#27272a';
    this.drawPixelMountain(ctx, w * 0.45, h * 0.82, w * 0.65, h * 0.38);

    // 3. Central Volcano Peak
    const peakX = w * 0.5;
    const peakY = h * 0.3;
    const baseW = w * 0.85;
    const baseY = h * 0.82;

    ctx.fillStyle = '#0c0a09';
    ctx.beginPath();
    ctx.moveTo(peakX - 25, peakY + 8);
    ctx.lineTo(peakX - baseW * 0.45, baseY);
    ctx.lineTo(peakX + baseW * 0.45, baseY);
    ctx.lineTo(peakX + 25, peakY + 8);
    ctx.closePath();
    ctx.fill();

    // Crater Rim & Glowing Magma Pool
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(peakX - 24, peakY + 4, 48, 8);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(peakX - 18, peakY + 6, 36, 4);

    // 4. Flowing Lava Streams down the mountainside
    const flowLen = Math.min(1.0, this.progress);
    const lavaColors = ['#f97316', '#ef4444', '#facc15', '#b91c1c'];
    for (let i = 0; i < 5; i++) {
      const offsetX = (i - 2) * 14;
      const streamYEnd = peakY + 12 + (baseY - peakY) * flowLen * (0.6 + (i % 3) * 0.2);
      ctx.strokeStyle = lavaColors[i % lavaColors.length];
      ctx.lineWidth = 3 + (i % 2);
      ctx.beginPath();
      ctx.moveTo(peakX + offsetX, peakY + 8);
      ctx.lineTo(peakX + offsetX * 1.8 + Math.sin(this.time * 2 + i) * 4, (peakY + streamYEnd) * 0.5);
      ctx.lineTo(peakX + offsetX * 2.6, streamYEnd);
      ctx.stroke();
    }

    // 5. Basalt Ground
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(0, baseY, w, h - baseY);
    ctx.fillStyle = '#292524';
    ctx.fillRect(0, baseY, w, 4);

    // Glowing fissures in ground
    for (let x = 20; x < w; x += 55) {
      ctx.fillStyle = '#f97316';
      ctx.fillRect(x + Math.sin(this.time + x) * 3, baseY + 6, 16, 2);
    }

    // Floating embers
    if (Math.random() < 0.35) {
      this.particles.push({
        x: peakX + (Math.random() * 50 - 25),
        y: peakY + (Math.random() * 10),
        vx: (Math.random() - 0.5) * 1.5,
        vy: -Math.random() * 2.0 - 1.0,
        size: Math.floor(Math.random() * 3) + 2,
        color: Math.random() > 0.4 ? '#f97316' : '#fbbf24',
        alpha: 0.9,
        life: 0.9,
      });
    }

    // Fearless Water Bear on the ridge!
    const tardX = w * 0.22;
    const tardY = baseY - 12 + Math.sin(this.time * 3) * 2;
    this.drawPixelTardigrade(ctx, tardX, tardY, 0.45);
  }

  /* ========================================================================= */
  /* 🌴 CANOPY QUEST (EMERALD RAINFOREST PIXEL ART)                            */
  /* ========================================================================= */
  renderCanopy(ctx, w, h) {
    const isLight = this.isLightMode();

    // 1. Rainforest Mist Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    if (isLight) {
      // Sunlit tropical rainforest morning
      skyGrad.addColorStop(0, '#6ee7b7');
      skyGrad.addColorStop(0.55, '#a7f3d0');
      skyGrad.addColorStop(1, '#d1fae5');
    } else {
      // Nighttime rainforest mist
      skyGrad.addColorStop(0, '#022c22');
      skyGrad.addColorStop(0.6, '#064e3b');
      skyGrad.addColorStop(1, '#065f46');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // 2. Sunbeams filtering through fog
    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.22)' : 'rgba(52, 211, 153, 0.06)';
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(w * 0.15 + i * 80, 0);
      ctx.lineTo(w * 0.3 + i * 90, h);
      ctx.lineTo(w * 0.22 + i * 90, h);
      ctx.lineTo(w * 0.08 + i * 80, 0);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Giant Ancient Redwood/Banyan Trunks
    const trunks = [
      { x: w * 0.12, w: 22 },
      { x: w * 0.42, w: 26 },
      { x: w * 0.78, w: 20 },
    ];
    trunks.forEach(t => {
      // Bark
      ctx.fillStyle = '#14532d';
      ctx.fillRect(t.x, 0, t.w, h * 0.82);
      ctx.fillStyle = '#166534';
      ctx.fillRect(t.x + 3, 0, t.w - 6, h * 0.82);
      // Moss patches
      ctx.fillStyle = '#10b981';
      for (let my = 20; my < h * 0.8; my += 35) {
        ctx.fillRect(t.x + 2, my, 8, 12);
      }
    });

    // 4. Overhanging Canopy Foliage (Layered Lush Emeralds)
    const foliageClusters = [
      { cx: w * 0.15, cy: h * 0.22, r: 48 },
      { cx: w * 0.45, cy: h * 0.18, r: 56 },
      { cx: w * 0.8, cy: h * 0.24, r: 44 },
    ];
    const emeralds = ['#064e3b', '#047857', '#059669', '#10b981', '#34d399'];
    foliageClusters.forEach(f => {
      const growthR = f.r * (0.8 + this.progress * 0.4);
      emeralds.forEach((col, idx) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(f.cx, f.cy, growthR * (1.0 - idx * 0.15), 0, Math.PI * 2);
        ctx.fill();
      });
    });

    // 5. Hanging Vines
    for (let i = 0; i < 6; i++) {
      const vx = w * 0.18 + i * 50;
      const vineLen = 30 + (i % 3) * 25 + Math.sin(this.time + i) * 4;
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(vx, h * 0.2);
      ctx.quadraticCurveTo(vx + Math.sin(this.time + i) * 6, h * 0.2 + vineLen * 0.5, vx, h * 0.2 + vineLen);
      ctx.stroke();
    }

    // 6. Forest Floor & Glowing Spores
    const groundY = h * 0.82;
    ctx.fillStyle = '#064e3b';
    ctx.fillRect(0, groundY, w, h - groundY);
    ctx.fillStyle = '#059669';
    ctx.fillRect(0, groundY, w, 5);

    // Drifting spore particles
    if (Math.random() < 0.25) {
      this.particles.push({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: Math.sin(this.time) * 0.8,
        vy: -Math.random() * 0.7 - 0.3,
        size: 2,
        color: '#6ee7b7',
        alpha: 0.85,
        life: 0.85,
      });
    }

    // Water bear hanging out on branch
    const tardX = w * 0.42 + 12;
    const tardY = h * 0.55 + Math.sin(this.time * 2) * 2;
    this.drawPixelTardigrade(ctx, tardX, tardY, 0.45);
  }

  /* ========================================================================= */
  /* 🛡️ LAZY IRONMAN (COMPOSITE TRIATHLON DIORAMA)                            */
  /* ========================================================================= */
  renderIronman(ctx, w, h) {
    const isLight = this.isLightMode();

    // 1. Sky & Atmosphere
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.42);
    if (isLight) {
      // Coastal sunrise daylight (Radiant Cerulean to Morning Gold)
      skyGrad.addColorStop(0, '#0284c7');
      skyGrad.addColorStop(0.45, '#38bdf8');
      skyGrad.addColorStop(0.8, '#fde68a');
      skyGrad.addColorStop(1, '#fef08a');
    } else {
      // Iron forge ember twilight (Midnight Obsidian to Forge Orange)
      skyGrad.addColorStop(0, '#09090b');
      skyGrad.addColorStop(0.4, '#1e1b4b');
      skyGrad.addColorStop(0.78, '#7c2d12');
      skyGrad.addColorStop(1, '#c2410c');
    }
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.42);

    // Sun / Forge Horizon
    if (isLight) {
      // Rising morning sun
      ctx.fillStyle = 'rgba(254, 240, 138, 0.4)';
      ctx.beginPath();
      ctx.arc(w * 0.8, h * 0.16, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.arc(w * 0.8, h * 0.16, 12, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Twilight stars
      ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      for (let i = 0; i < 10; i++) {
        const sx = (i * 37 + 11) % w;
        const sy = (i * 19 + 5) % Math.floor(h * 0.22);
        ctx.fillRect(sx, sy, 1, 1);
      }
      // Floating forge embers
      if (Math.random() < 0.2) {
        this.particles.push({
          x: w * 0.8 + (Math.random() * 40 - 20),
          y: h * 0.75,
          vx: (Math.random() - 0.5) * 1.5,
          vy: -Math.random() * 2.0 - 1.2,
          size: 2,
          color: Math.random() > 0.5 ? '#f97316' : '#fbbf24',
          alpha: 0.85,
          life: 0.85,
        });
      }
    }

    // Distant Coastal Headland & Mountains
    ctx.fillStyle = isLight ? '#64748b' : '#1e1b4b';
    this.drawPixelMountain(ctx, -15, h * 0.38, w * 0.45, h * 0.22);
    ctx.fillStyle = isLight ? '#94a3b8' : '#27272a';
    this.drawPixelMountain(ctx, w * 0.25, h * 0.38, w * 0.55, h * 0.18);

    // 2. TIER 1: Ocean Bay (Swim Course, h * 0.36 to h * 0.56)
    const bayY = h * 0.36;
    const bayH = h * 0.20;
    const seaGrad = ctx.createLinearGradient(0, bayY, 0, bayY + bayH);
    if (isLight) {
      seaGrad.addColorStop(0, '#0369a1');
      seaGrad.addColorStop(1, '#06b6d4');
    } else {
      seaGrad.addColorStop(0, '#082f49');
      seaGrad.addColorStop(1, '#0f766e');
    }
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, bayY, w, bayH);

    // Water Surface Waves
    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.4)' : 'rgba(94, 234, 212, 0.25)';
    for (let i = 0; i < 6; i++) {
      const wx = ((i * 68 + this.time * 15) % (w + 40)) - 20;
      const wy = bayY + 6 + (i * 5) % (bayH - 12);
      ctx.fillRect(wx, wy, 24, 2);
    }

    // Swim Buoys (Bobbing markers)
    [w * 0.22, w * 0.52, w * 0.82].forEach((bx, idx) => {
      const bob = Math.sin(this.time * 3 + idx) * 2;
      const buoyColor = idx % 2 === 0 ? '#ea580c' : '#facc15';
      ctx.fillStyle = buoyColor;
      ctx.beginPath();
      ctx.moveTo(bx, bayY + 12 + bob);
      ctx.lineTo(bx - 5, bayY + 20 + bob);
      ctx.lineTo(bx + 5, bayY + 20 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(bx - 1, bayY + 14 + bob, 2, 2);
    });

    // Armored Turtle (Swim Discipline)
    const sp = this.subProgress;
    const sPct = sp ? Math.min(1, Math.max(0, (sp.swim_current || 0) / (sp.swim_target || 2.4))) : this.progress;
    const turtleX = w * 0.10 + (w * 0.74) * sPct;
    const turtleY = bayY + bayH * 0.55 + Math.sin(this.time * 3.2) * 3;
    this.drawPixelArmoredTurtle(ctx, turtleX, turtleY, 0.85, this.time * 4);

    // 3. TIER 2: Coastal Highway (Bike Course, h * 0.56 to h * 0.74)
    const roadY = h * 0.56;
    const roadH = h * 0.18;
    ctx.fillStyle = isLight ? '#475569' : '#1e293b';
    ctx.fillRect(0, roadY, w, roadH);

    // Road Guardrail (Top border)
    ctx.fillStyle = isLight ? '#94a3b8' : '#334155';
    ctx.fillRect(0, roadY, w, 3);
    for (let gx = 10; gx < w; gx += 30) {
      ctx.fillStyle = '#cbd5e1';
      ctx.fillRect(gx, roadY - 4, 3, 4);
    }

    // Dashed Road Stripe
    ctx.fillStyle = '#f8fafc';
    for (let rx = 0; rx < w; rx += 28) {
      ctx.fillRect(rx, roadY + roadH * 0.5 - 1, 14, 2);
    }

    // Armored Jackrabbit (Bike Discipline)
    const bPct = sp ? Math.min(1, Math.max(0, (sp.bike_current || 0) / (sp.bike_target || 112.0))) : this.progress;
    const cyclistX = w * 0.08 + (w * 0.76) * bPct;
    const cyclistY = roadY + roadH * 0.55;
    this.drawPixelArmoredCyclist(ctx, cyclistX, cyclistY, 0.85, this.time * 12);

    // 4. TIER 3: Marathon Track & Iron Finish Arch (Run Course, h * 0.74 to h)
    const trackY = h * 0.74;
    const trackH = h - trackY;
    ctx.fillStyle = isLight ? '#991b1b' : '#3f0c0c';
    ctx.fillRect(0, trackY, w, trackH);

    // Track Lane Lines
    ctx.fillStyle = isLight ? 'rgba(255, 255, 255, 0.55)' : 'rgba(255, 255, 255, 0.2)';
    ctx.fillRect(0, trackY + trackH * 0.35, w, 2);
    ctx.fillRect(0, trackY + trackH * 0.70, w, 2);

    // Iron Finish Archway at the right
    const rPct = sp ? Math.min(1, Math.max(0, (sp.run_current || 0) / (sp.run_target || 26.2))) : this.progress;
    const isComplete = this.progress >= 1.0 || (sPct >= 1.0 && bPct >= 1.0 && rPct >= 1.0);
    this.drawPixelIronFinishArch(ctx, w * 0.82, trackY + trackH * 0.65, 0.9, isComplete);

    // Iron-Clad Tardigrade (Marathon Run Discipline)
    const tardStartX = w * 0.08;
    const tardTargetX = w * 0.78;
    const tardX = isComplete ? tardTargetX : (tardStartX + (tardTargetX - tardStartX) * rPct);
    const tardY = trackY + trackH * 0.50;
    this.drawPixelIroncladTardigrade(ctx, tardX, tardY, 0.38, this.time * 8, isComplete);
  }

  drawPixelArmoredTurtle(ctx, x, y, scale = 1.0, swimPhase = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const flipperAngle = Math.sin(swimPhase) * 0.45;

    // Trailing water bubbles
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(-38, 2 + Math.sin(swimPhase * 1.5) * 3, 3, 3);
    ctx.fillRect(-46, -4 + Math.cos(swimPhase * 1.5) * 4, 2, 2);
    ctx.fillRect(-54, 1, 3, 3);

    // Back flippers
    ctx.fillStyle = '#15803d';
    ctx.fillRect(-28, -8 + flipperAngle * 4, 10, 5);
    ctx.fillRect(-28, 6 - flipperAngle * 4, 10, 5);

    // Front large swimming flipper (paddling stroke)
    ctx.save();
    ctx.translate(8, 0);
    ctx.rotate(flipperAngle);
    ctx.fillStyle = '#15803d';
    ctx.fillRect(-4, -18, 14, 8);
    ctx.fillRect(2, -24, 12, 8);
    // Iron flipper armor guard
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-2, -16, 10, 5);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(0, -15, 2, 2);
    ctx.restore();

    // Armored Carapace (Iron Shell)
    ctx.fillStyle = '#1e293b';
    ctx.beginPath();
    ctx.ellipse(0, 0, 26, 17, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Shell plate highlights & steel sheen
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-14, -10, 28, 8);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-10, -8, 20, 4);

    // Riveted carapace plates (Geometric iron segments)
    ctx.fillStyle = '#334155';
    ctx.fillRect(-16, -1, 32, 2);
    ctx.fillRect(-8, -12, 2, 24);
    ctx.fillRect(8, -12, 2, 24);

    // Brass/steel rivets on shell
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(-12, -7, 2, 2);
    ctx.fillRect(0, -7, 2, 2);
    ctx.fillRect(12, -7, 2, 2);
    ctx.fillRect(-12, 5, 2, 2);
    ctx.fillRect(0, 5, 2, 2);
    ctx.fillRect(12, 5, 2, 2);

    // Front Lower Flipper
    ctx.save();
    ctx.translate(8, 6);
    ctx.rotate(-flipperAngle * 0.7);
    ctx.fillStyle = '#15803d';
    ctx.fillRect(-2, 4, 12, 6);
    ctx.fillRect(2, 8, 10, 6);
    ctx.restore();

    // Sea Turtle Head
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(22, -6, 14, 12);
    ctx.fillRect(34, -4, 5, 8);

    // Brass Swim Goggles
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(26, -7, 8, 8);
    ctx.fillRect(20, -4, 6, 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(28, -6, 5, 5);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(29, -5, 2, 2);

    ctx.restore();
  }

  drawPixelArmoredCyclist(ctx, x, y, scale = 0.95, pedalPhase = 0) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const wheelR = 12;
    const rearWheelX = -26;
    const frontWheelX = 26;
    const wheelY = 10;

    // 1. Wheels (Rear & Front)
    [rearWheelX, frontWheelX].forEach(wx => {
      ctx.fillStyle = '#0f172a';
      ctx.beginPath();
      ctx.arc(wx, wheelY, wheelR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#64748b';
      ctx.beginPath();
      ctx.arc(wx, wheelY, wheelR - 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#cbd5e1';
      ctx.beginPath();
      ctx.arc(wx, wheelY, 3, 0, Math.PI * 2);
      ctx.fill();

      // Spokes (Spinning with pedalPhase)
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      for (let a = 0; a < 4; a++) {
        const ang = pedalPhase + (a * Math.PI / 2);
        ctx.beginPath();
        ctx.moveTo(wx, wheelY);
        ctx.lineTo(wx + Math.cos(ang) * (wheelR - 3), wheelY + Math.sin(ang) * (wheelR - 3));
        ctx.stroke();
      }
    });

    // 2. Bike Frame (Aero Iron Diamond Geometry)
    const bottomBracketX = -2;
    const bottomBracketY = 8;
    const seatTubeTopX = -10;
    const seatTubeTopY = -6;
    const headTubeTopX = 18;
    const headTubeTopY = -8;

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    // Chainstay
    ctx.beginPath();
    ctx.moveTo(rearWheelX, wheelY);
    ctx.lineTo(bottomBracketX, bottomBracketY);
    // Seatstay
    ctx.lineTo(seatTubeTopX, seatTubeTopY);
    ctx.lineTo(rearWheelX, wheelY);
    // Down tube
    ctx.moveTo(bottomBracketX, bottomBracketY);
    ctx.lineTo(headTubeTopX, headTubeTopY);
    // Top tube
    ctx.moveTo(seatTubeTopX, seatTubeTopY);
    ctx.lineTo(headTubeTopX, headTubeTopY);
    // Fork
    ctx.moveTo(headTubeTopX, headTubeTopY);
    ctx.lineTo(frontWheelX, wheelY);
    ctx.stroke();

    // Saddle
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(seatTubeTopX - 8, seatTubeTopY - 4, 14, 4);

    // Aero Drop Handlebars
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(headTubeTopX, headTubeTopY);
    ctx.lineTo(headTubeTopX + 8, headTubeTopY - 4);
    ctx.lineTo(headTubeTopX + 12, headTubeTopY + 2);
    ctx.stroke();

    // 3. Jackrabbit Cyclist in Aero Tuck
    const crankR = 6;
    const pedal1X = bottomBracketX + Math.cos(pedalPhase) * crankR;
    const pedal1Y = bottomBracketY + Math.sin(pedalPhase) * crankR;
    const pedal2X = bottomBracketX - Math.cos(pedalPhase) * crankR;
    const pedal2Y = bottomBracketY - Math.sin(pedalPhase) * crankR;

    // Legs pedaling (Back leg)
    ctx.strokeStyle = '#b45309';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(seatTubeTopX + 2, seatTubeTopY - 2);
    ctx.lineTo(pedal2X - 2, pedal2Y - 8);
    ctx.lineTo(pedal2X, pedal2Y);
    ctx.stroke();

    // Rabbit Torso (Warm tawny fur + iron chestplate)
    ctx.fillStyle = '#d97706';
    ctx.fillRect(-12, -18, 22, 12);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-8, -17, 16, 8);
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(-6, -16, 12, 2);

    // Front Leg & Iron Knee Guard
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 4;
    const kneeX = (seatTubeTopX + pedal1X) * 0.5 + 4;
    const kneeY = (seatTubeTopY + pedal1Y) * 0.5 - 6;
    ctx.beginPath();
    ctx.moveTo(seatTubeTopX + 2, seatTubeTopY - 2);
    ctx.lineTo(kneeX, kneeY);
    ctx.lineTo(pedal1X, pedal1Y);
    ctx.stroke();
    ctx.fillStyle = '#475569';
    ctx.fillRect(kneeX - 3, kneeY - 3, 6, 6);

    // Arms reaching to aero bars
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(6, -14);
    ctx.lineTo(headTubeTopX + 6, headTubeTopY - 3);
    ctx.stroke();

    // Jackrabbit Head
    ctx.fillStyle = '#d97706';
    ctx.fillRect(8, -26, 12, 12);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(18, -22, 4, 6);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(16, -24, 2, 2);

    // Long aerodynamic rabbit ears streaming back
    ctx.fillStyle = '#b45309';
    ctx.fillRect(-6, -28, 16, 4);
    ctx.fillRect(-12, -26, 8, 3);
    ctx.fillStyle = '#fca5a5';
    ctx.fillRect(-4, -27, 12, 2);

    // Iron Aero Teardrop Helmet
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.moveTo(6, -27);
    ctx.lineTo(22, -27);
    ctx.lineTo(24, -20);
    ctx.lineTo(4, -20);
    ctx.lineTo(-6, -24);
    ctx.closePath();
    ctx.fill();

    // Helmet metallic visor & highlight
    ctx.fillStyle = '#cbd5e1';
    ctx.fillRect(4, -26, 16, 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(18, -24, 5, 4);

    ctx.restore();
  }

  drawPixelIroncladTardigrade(ctx, x, y, scale = 0.45, runPhase = 0, isComplete = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const bob = isComplete ? Math.sin(this.time * 6) * 3 : Math.abs(Math.sin(runPhase)) * 4;

    // Body segments (Heavy Iron Knight Armor)
    ctx.fillStyle = '#334155';
    ctx.fillRect(-42, -22 - bob, 84, 44);

    // Segmented polished plate iron (4 segments)
    ctx.fillStyle = '#64748b';
    ctx.fillRect(-40, -20 - bob, 80, 40);

    // Steel highlight ridges
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-40, -20 - bob, 80, 6);

    // Segment seams and rivets
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-20, -20 - bob, 4, 40);
    ctx.fillRect(0, -20 - bob, 4, 40);
    ctx.fillRect(20, -20 - bob, 4, 40);

    // Golden / silver rivets along segment borders
    ctx.fillStyle = '#f8fafc';
    [-20, 0, 20].forEach(sx => {
      ctx.fillRect(sx - 1, -16 - bob, 2, 2);
      ctx.fillRect(sx - 1, -6 - bob, 2, 2);
      ctx.fillRect(sx - 1, 4 - bob, 2, 2);
      ctx.fillRect(sx - 1, 14 - bob, 2, 2);
    });

    // Rounded posterior armor plate
    ctx.fillStyle = '#475569';
    ctx.fillRect(-48, -12 - bob, 10, 24);
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-46, -10 - bob, 4, 20);

    // Knight Helmet & Visor (Head)
    ctx.fillStyle = '#475569';
    ctx.fillRect(38, -16 - bob, 18, 30);
    ctx.fillStyle = '#64748b';
    ctx.fillRect(40, -14 - bob, 14, 26);

    // Horizontal Visor Slit
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(44, -8 - bob, 10, 5);
    ctx.fillStyle = '#10b981';
    ctx.fillRect(47, -7 - bob, 4, 3);

    // Helmet Crest / Red Plume waving
    const plumeWiggle = Math.sin(this.time * 8) * 3;
    ctx.fillStyle = '#dc2626';
    ctx.fillRect(40, -26 - bob, 6, 12);
    ctx.fillRect(36 + plumeWiggle, -32 - bob, 10, 8);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(38 + plumeWiggle, -28 - bob, 5, 4);

    // 4 Pairs of Armored Stubby Legs in running motion
    const legPositions = [-30, -10, 10, 30];
    legPositions.forEach((lx, idx) => {
      const legStride = isComplete ? 0 : Math.sin(runPhase + idx * 1.4) * 8;
      ctx.fillStyle = '#475569';
      ctx.fillRect(lx - 5, 18 - bob + legStride, 11, 12);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(lx - 4, 19 - bob + legStride, 8, 8);
      ctx.fillStyle = '#334155';
      ctx.fillRect(lx - 7, 28 - bob + legStride, 14, 5);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(lx - 8, 31 - bob + legStride, 3, 3);
      ctx.fillRect(lx - 2, 31 - bob + legStride, 3, 3);
      ctx.fillRect(lx + 4, 31 - bob + legStride, 3, 3);
    });

    // If complete, draw victory fist & sparkles
    if (isComplete) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(48, -36 - bob, 12, 10);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(52, -26 - bob, 4, 8);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(62, -40 - bob, 3, 3);
      ctx.fillRect(42, -42 - bob, 3, 3);
    }

    ctx.restore();
  }

  drawPixelIronFinishArch(ctx, x, y, scale = 1.0, isComplete = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    const archH = 55;
    const archW = 44;

    // Left & Right Riveted Wrought-Iron Pillars
    [-archW * 0.5, archW * 0.5].forEach(px => {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(px - 4, -archH, 8, archH);
      ctx.fillStyle = '#334155';
      ctx.fillRect(px - 3, -archH, 6, archH);
      ctx.fillStyle = '#64748b';
      ctx.fillRect(px - 1, -archH, 2, archH);

      // Iron rivet bands
      ctx.fillStyle = '#cbd5e1';
      for (let by = -archH + 10; by < 0; by += 12) {
        ctx.fillRect(px - 5, by, 10, 2);
      }

      // Forge Brazier on pillar top
      ctx.fillStyle = '#475569';
      ctx.fillRect(px - 7, -archH - 6, 14, 6);
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(px - 5, -archH - 8, 10, 2);

      // Dancing Fire in Brazier
      const flameH = (isComplete ? 16 : 9) + Math.sin(this.time * 10 + px) * 3;
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(px - 4, -archH - 8 - flameH, 8, flameH);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(px - 3, -archH - 8 - flameH * 0.8, 6, flameH * 0.8);
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(px - 2, -archH - 8 - flameH * 0.5, 4, flameH * 0.5);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 1, -archH - 8 - flameH * 0.25, 2, flameH * 0.25);
    });

    // Iron Crossbeam & Banner
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(-archW * 0.5, -archH + 4, archW, 14);
    ctx.fillStyle = '#334155';
    ctx.fillRect(-archW * 0.5 + 2, -archH + 6, archW - 4, 10);

    // Decorative Iron Anvil crest at center
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(-5, -archH + 1, 10, 3);
    ctx.fillRect(-3, -archH + 4, 6, 2);
    ctx.fillRect(-6, -archH + 6, 12, 2);

    // Checkered Banner Pattern
    const checkSize = 4;
    for (let cx = -archW * 0.5 + 4; cx < archW * 0.5 - 4; cx += checkSize) {
      const isAlt = Math.floor((cx + archW) / checkSize) % 2 === 0;
      ctx.fillStyle = isAlt ? '#ffffff' : '#000000';
      ctx.fillRect(cx, -archH + 8, checkSize, checkSize);
    }

    // Checkered Finish Line Tape Across Ground
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(-archW * 0.5, -2, archW, 3);
    for (let fx = -archW * 0.5; fx < archW * 0.5; fx += 6) {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(fx, -2, 3, 3);
    }

    ctx.restore();
  }

  /* ========================================================================= */
  /* 🐻 AUTHENTIC PIXEL TARDIGRADE (WATER BEAR)                               */
  /* ========================================================================= */
  renderCustom(ctx, w, h) {
    const isLight = this.isLightMode();

    ctx.fillStyle = isLight ? '#f8fafc' : '#0f172a';
    ctx.fillRect(0, 0, w, h);

    // Retro grid
    ctx.strokeStyle = isLight ? 'rgba(16, 185, 129, 0.25)' : 'rgba(52, 211, 153, 0.12)';
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

  drawPixelTardigrade(ctx, x, y, scale = 1.0) {
    ctx.save();
    ctx.translate(x, y);
    if (scale !== 1.0) {
      ctx.scale(scale, scale);
    }

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
    const isLight = this.isLightMode();
    const barH = 5;
    ctx.fillStyle = isLight ? 'rgba(0, 0, 0, 0.12)' : 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, h - barH, w, barH);

    if (this.currentTheme === 'ironman' && this.subProgress) {
      const sp = this.subProgress;
      const sPct = Math.min(1, Math.max(0, (sp.swim_current || 0) / (sp.swim_target || 2.4)));
      const bPct = Math.min(1, Math.max(0, (sp.bike_current || 0) / (sp.bike_target || 112.0)));
      const rPct = Math.min(1, Math.max(0, (sp.run_current || 0) / (sp.run_target || 26.2)));

      const segW = (w - 4) / 3;
      // 1. Swim segment (Cyan)
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(0, h - barH, segW * sPct, barH);
      // Divider 1
      ctx.fillStyle = isLight ? '#cbd5e1' : '#334155';
      ctx.fillRect(segW, h - barH, 2, barH);
      // 2. Bike segment (Amber)
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(segW + 2, h - barH, segW * bPct, barH);
      // Divider 2
      ctx.fillStyle = isLight ? '#cbd5e1' : '#334155';
      ctx.fillRect(segW * 2 + 2, h - barH, 2, barH);
      // 3. Run segment (Emerald)
      ctx.fillStyle = '#10b981';
      ctx.fillRect(segW * 2 + 4, h - barH, segW * rPct, barH);
    } else {
      ctx.fillStyle = '#10b981';
      ctx.fillRect(0, h - barH, w * this.progress, barH);
    }
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
