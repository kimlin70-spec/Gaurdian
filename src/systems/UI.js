// 터치용 UI 도우미. 버튼은 내부 해상도 기준 최소 16px(실제 화면 48px 이상).
import { FONT, FONT_BIG, COLORS, W, H, PX, FIX_X, FIX_Y } from '../config.js';
import Audio from './Audio.js';

export const DEPTH = { WORLD_UI: 50, UI: 100, DIALOG: 200, MODAL: 300, TOP: 400 };

// 화면에 고정(scrollFactor 0). 카메라 줌 보정 오프셋을 함께 적용한다.
export function fix(obj) { obj.setScrollFactor(0); obj.x += FIX_X; obj.y += FIX_Y; return obj; }
// 장면 카메라 기본 설정: PX 배 줌으로 320x240 논리 좌표를 640x480 캔버스에 꽉 채운다
export function setupCamera(scene) { const c = scene.cameras.main; c.setZoom(PX); c.centerOn(W / 2, H / 2); c.setRoundPixels(true); return c; }

export function txt(scene, x, y, str, opts = {}) {
  const size = opts.size || 11;
  const style = {
    fontFamily: size >= 14 ? FONT_BIG : FONT,
    fontSize: size + 'px',
    color: opts.color || COLORS.white,
    align: opts.align || 'left',
    resolution: PX,
  };
  if (opts.wrap) style.wordWrap = { width: opts.wrap, useAdvancedWrap: true };
  if (opts.stroke !== false) { style.stroke = opts.strokeColor || '#000000'; style.strokeThickness = opts.strokeThickness ?? 2; }
  if (opts.bold) style.fontStyle = 'bold';
  const t = scene.add.text(x, y, str, style);
  if (opts.origin !== undefined) { Array.isArray(opts.origin) ? t.setOrigin(opts.origin[0], opts.origin[1]) : t.setOrigin(opts.origin); }
  if (opts.fixed) fix(t);
  t.setDepth(opts.depth ?? DEPTH.UI);
  if (opts.lineSpacing) t.setLineSpacing(opts.lineSpacing);
  return t;
}

export function panel(scene, x, y, w, h, opts = {}) {
  const g = scene.add.graphics();
  g.fillStyle(opts.color ?? COLORS.panel, opts.alpha ?? 0.95);
  g.fillRoundedRect(x, y, w, h, opts.radius ?? 4);
  if (opts.border !== false) { g.lineStyle(1, opts.borderColor ?? COLORS.border, 1); g.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, opts.radius ?? 4); }
  if (opts.fixed) fix(g);
  g.setDepth(opts.depth ?? DEPTH.UI);
  return g;
}

export class Button {
  constructor(scene, x, y, w, h, label, onTap, opts = {}) {
    this.scene = scene; this.onTap = onTap; this.enabled = true; this.opts = opts;
    this.color = opts.color ?? COLORS.button;
    const depth = opts.depth ?? DEPTH.UI;
    this.glow = scene.add.rectangle(x + w / 2, y + h / 2, w + 4, h + 4, COLORS.gold, 0).setDepth(depth - 1);
    this.bg = scene.add.rectangle(x + w / 2, y + h / 2, w, h, this.color).setStrokeStyle(1, COLORS.border).setDepth(depth);
    this.label = txt(scene, x + w / 2, y + h / 2, label, { size: opts.size || 11, origin: 0.5, depth: depth + 1, color: opts.textColor, align: 'center' });
    this.fixed = !!opts.fixed;
    if (opts.fixed) { fix(this.glow); fix(this.bg); fix(this.label); }
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerdown', () => { if (!this.enabled) return; this.bg.setFillStyle(COLORS.buttonDown); this.bg.setScale(0.96); this.label.setScale(0.96); });
    const release = () => { this.bg.setFillStyle(this.enabled ? this.color : COLORS.buttonDisabled); this.bg.setScale(1); this.label.setScale(1); };
    this.bg.on('pointerout', release);
    this.bg.on('pointerup', () => { release(); if (!this.enabled) return; Audio.sfx('tap'); if (this.onTap) this.onTap(this); });
    this.objs = [this.glow, this.bg, this.label];
  }
  setEnabled(b) { this.enabled = b; this.bg.setFillStyle(b ? this.color : COLORS.buttonDisabled); this.label.setAlpha(b ? 1 : 0.5); if (!b) this.setGlow(false); return this; }
  setGlow(b) {
    if (this.glowTween) { this.glowTween.stop(); this.glowTween = null; }
    if (b) { this.glow.setFillStyle(COLORS.gold, 0.9); this.glowTween = this.scene.tweens.add({ targets: this.glow, alpha: { from: 1, to: 0.3 }, duration: 450, yoyo: true, repeat: -1 }); }
    else { this.glow.setAlpha(1); this.glow.setFillStyle(COLORS.gold, 0); }
    return this;
  }
  setLabel(s) { this.label.setText(s); return this; }
  setColor(c) { this.color = c; if (this.enabled) this.bg.setFillStyle(c); return this; }
  setVisible(v) { this.objs.forEach(o => o.setVisible(v)); return this; }
  setPosition(x, y) { const w = this.bg.width, h = this.bg.height, ox = this.fixed ? FIX_X : 0, oy = this.fixed ? FIX_Y : 0; this.glow.setPosition(x + w / 2 + ox, y + h / 2 + oy); this.bg.setPosition(x + w / 2 + ox, y + h / 2 + oy); this.label.setPosition(x + w / 2 + ox, y + h / 2 + oy); return this; }
  destroy() { if (this.glowTween) this.glowTween.stop(); this.objs.forEach(o => o.destroy()); }
}

// 여러 UI 를 묶어 한 번에 지우기
export class UIGroup {
  constructor() { this.items = []; }
  add(...objs) { for (const o of objs) this.items.push(o); return objs[objs.length - 1]; }
  setVisible(v) { this.items.forEach(o => o.setVisible && o.setVisible(v)); }
  destroy() { this.items.forEach(o => o.destroy && o.destroy()); this.items = []; }
}

// 화면 아래 대화 상자. show(['첫 줄', '둘째 줄']) → 탭하면 다음 줄, 다 보면 resolve.
export class DialogBox {
  constructor(scene, opts = {}) {
    this.scene = scene; this.opts = opts; this.open = false; this.group = null;
  }
  show(lines, opts = {}) {
    const list = Array.isArray(lines) ? lines.slice() : [lines];
    return new Promise(resolve => {
      this.hide();
      this.open = true;
      const sc = this.scene, g = new UIGroup(); this.group = g;
      const h = 58, y = H - h - 4;
      g.add(panel(sc, 4, y, W - 8, h, { depth: DEPTH.DIALOG, fixed: this.opts.fixed, color: 0x1e2040, alpha: 1 }));
      const body = g.add(txt(sc, 12, y + 8, '', { size: 11, wrap: W - 28, depth: DEPTH.DIALOG + 1, fixed: this.opts.fixed, lineSpacing: 3 }));
      const more = g.add(txt(sc, W - 14, y + h - 12, '▼', { size: 11, origin: 0.5, depth: DEPTH.DIALOG + 1, fixed: this.opts.fixed, color: COLORS.yellow }));
      sc.tweens.add({ targets: more, y: more.y + 2, duration: 400, yoyo: true, repeat: -1 });
      // 화면 전체를 덮는 터치 영역
      const zone = g.add(sc.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.001).setDepth(DEPTH.DIALOG - 1).setInteractive());
      if (this.opts.fixed) fix(zone);
      let idx = 0;
      const render = () => { body.setText(list[idx]); more.setVisible(idx < list.length - 1 || !opts.hold); };
      render();
      zone.on('pointerup', () => {
        Audio.sfx('tap');
        idx += 1;
        if (idx >= list.length) { this.hide(); resolve(); } else render();
      });
    });
  }
  hide() { if (this.group) { this.group.destroy(); this.group = null; } this.open = false; }
}

// 예/아니오 묻기
export function confirm(scene, message, yesLabel = '네', noLabel = '아니요', opts = {}) {
  return new Promise(resolve => {
    const g = new UIGroup();
    const w = 220, h = 96, x = (W - w) / 2, y = (H - h) / 2;
    g.add(scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5).setDepth(DEPTH.MODAL - 1).setInteractive());
    g.add(panel(scene, x, y, w, h, { depth: DEPTH.MODAL, fixed: opts.fixed }));
    g.add(txt(scene, W / 2, y + 26, message, { size: 11, origin: 0.5, align: 'center', wrap: w - 20, depth: DEPTH.MODAL + 1, fixed: opts.fixed, lineSpacing: 3 }));
    const done = (v) => { g.destroy(); resolve(v); };
    g.add(new Button(scene, x + 16, y + h - 34, 84, 24, yesLabel, () => done(true), { depth: DEPTH.MODAL + 1, fixed: opts.fixed, color: COLORS.ok }));
    g.add(new Button(scene, x + w - 100, y + h - 34, 84, 24, noLabel, () => done(false), { depth: DEPTH.MODAL + 1, fixed: opts.fixed }));
    if (opts.fixed) fix(g.items[0]);
  });
}

// 잠깐 떴다 사라지는 안내 글
export function toast(scene, message, opts = {}) {
  const y = opts.y ?? 40;
  const t = txt(scene, W / 2, y, message, { size: 11, origin: 0.5, align: 'center', depth: DEPTH.TOP, fixed: opts.fixed !== false, color: opts.color || COLORS.yellow });
  const bg = scene.add.rectangle(W / 2, y, t.width + 16, t.height + 8, 0x000000, 0.7).setDepth(DEPTH.TOP - 1);
  if (opts.fixed !== false) fix(bg);
  scene.tweens.add({ targets: [t, bg], y: '-=10', alpha: 0, delay: opts.duration ?? 1200, duration: 400, onComplete: () => { t.destroy(); bg.destroy(); } });
  return t;
}

// HP/MP 바
export function bar(scene, x, y, w, h, color, opts = {}) {
  const depth = opts.depth ?? DEPTH.UI;
  const bg = scene.add.rectangle(x, y, w, h, 0x000000, 0.8).setOrigin(0, 0.5).setDepth(depth);
  const fg = scene.add.rectangle(x + 1, y, w - 2, h - 2, color).setOrigin(0, 0.5).setDepth(depth + 1);
  let marker = null;
  if (opts.marker !== undefined) marker = scene.add.rectangle(x + 1 + Math.round((w - 2) * opts.marker), y, 1, h, 0xffffff, 0.9).setOrigin(0, 0.5).setDepth(depth + 2);
  if (opts.fixed) { fix(bg); fix(fg); if (marker) fix(marker); }
  const api = {
    bg, fg, marker,
    set(ratio, lowColor) {
      const r = Math.max(0, Math.min(1, ratio));
      fg.width = Math.max(0, Math.round((w - 2) * r));
      if (lowColor !== undefined) fg.setFillStyle(r <= (opts.lowAt ?? 0.25) ? lowColor : color);
    },
    setPosition(nx, ny) { if (opts.fixed) { nx += FIX_X; ny += FIX_Y; } bg.setPosition(nx, ny); fg.setPosition(nx + 1, ny); if (marker) marker.setPosition(nx + 1 + Math.round((w - 2) * opts.marker), ny); },
    setVisible(v) { bg.setVisible(v); fg.setVisible(v); if (marker) marker.setVisible(v); },
    destroy() { bg.destroy(); fg.destroy(); if (marker) marker.destroy(); },
  };
  return api;
}

// 트윈/딜레이를 await 로 쓰기
export function tween(scene, cfg) { return new Promise(res => scene.tweens.add({ ...cfg, onComplete: () => res() })); }
export function wait(scene, ms) { return new Promise(res => scene.time.delayedCall(ms, res)); }

// 화면 전환 페이드
export function fadeOut(scene, ms = 250) { return new Promise(res => { scene.cameras.main.fadeOut(ms, 0, 0, 0); scene.cameras.main.once('camerafadeoutcomplete', () => res()); }); }
export function fadeIn(scene, ms = 250) { scene.cameras.main.fadeIn(ms, 0, 0, 0); }

// 소리 켜기/끄기 작은 버튼 (오른쪽 위)
export function soundButton(scene, opts = {}) {
  const b = new Button(scene, W - 30, 4, 26, 18, Audio.muted ? '♪✕' : '♪', () => { Audio.toggleMute(); b.setLabel(Audio.muted ? '♪✕' : '♪'); }, { depth: DEPTH.TOP, fixed: true, color: 0x333355, ...opts });
  return b;
}
