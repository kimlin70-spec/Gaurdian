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

// ---- 그림 UI (assets/ui_*.png, 9분할) ----
// 모서리 8픽셀(논리)은 그대로 두고 가운데만 늘린다. 그림이 없거나 너무 작으면 null → 예전처럼 단색으로 그린다.
const SLICE = 8;
export function slice9(scene, key, x, y, w, h) {
  if (w < SLICE * 2 || h < SLICE * 2 || !scene.textures.exists(key) || scene.game.renderer.type !== Phaser.WEBGL) return null;
  const c = SLICE * PX;
  return scene.add.nineslice(x, y, key, undefined, Math.round(w * PX), Math.round(h * PX), c, c, c, c).setOrigin(0, 0).setScale(1 / PX);
}
// 버튼 색 → 버튼 그림. 목록 줄처럼 그 밖의 색은 단색 그대로.
const BUTTON_SKINS = {
  [COLORS.button]: ['ui_button'], 0x4a90e2: ['ui_button'], 0x3d6a9a: ['ui_button'],
  [COLORS.ok]: ['ui_button_green'], [COLORS.purify]: ['ui_button_pink'], 0xd6679a: ['ui_button_pink'],
  0xe08a3c: ['ui_button_orange'], 0x6a4fb3: ['ui_button_purple'],
  0x555577: ['ui_button', 0xb4b4c8], 0x333355: ['ui_button', 0x9a9ab4], // 뒤로·닫기: 차분한 색
};
const PRESS_TINT = 0xd1d1d1; // 눌렀을 때 0.82배 어둡게
const mulTint = (a, b) => (((a >> 16) * (b >> 16) / 255) << 16) | ((((a >> 8) & 255) * ((b >> 8) & 255) / 255) << 8) | ((a & 255) * (b & 255) / 255);

// 작은 그림 표시 (하트, 별, 자물쇠, 역할, 상태 등). 그림이 없으면 null.
export function icon(scene, x, y, key, opts = {}) {
  if (!scene.textures.exists(key)) return null;
  const im = scene.add.image(x, y, key).setScale((opts.scale ?? 1) / PX).setDepth(opts.depth ?? DEPTH.UI);
  if (opts.origin !== undefined) { Array.isArray(opts.origin) ? im.setOrigin(opts.origin[0], opts.origin[1]) : im.setOrigin(opts.origin); }
  if (opts.fixed) fix(im);
  return im;
}
// 하트 5칸, 별 3칸처럼 채운 그림 n 개 + 빈 그림. x 는 왼쪽 끝, y 는 가운데. 그림이 없으면 글자로.
export function iconRow(scene, x, y, n, max, full = 'ui_heart_full', empty = 'ui_heart_empty', opts = {}) {
  const g = new UIGroup(), step = opts.step ?? 10, scale = opts.scale ?? 0.8;
  if (!scene.textures.exists(full) || !scene.textures.exists(empty)) {
    const heart = full.includes('heart');
    g.add(txt(scene, x, y, (heart ? '♥' : '★').repeat(n) + (heart ? '♡' : '☆').repeat(max - n), { size: 11, origin: [0, 0.5], depth: opts.depth, fixed: opts.fixed, color: heart ? '#ff8fb0' : '#ffd93b' }));
    g.width = g.items[0].width; return g;
  }
  for (let i = 0; i < max; i++) g.add(icon(scene, x + i * step + step / 2, y, i < n ? full : empty, { scale, depth: opts.depth, fixed: opts.fixed }));
  g.width = max * step;
  return g;
}
export const ROLE_ICON = { '공격': 'role_attack', '탱커': 'role_tank', '회복': 'role_heal' };
// 별가루·보석 조각 표시: 그림 + 숫자. set(별가루, 보석 조각) 으로 갱신.
export function moneyTag(scene, x, y, opts = {}) {
  const g = new UIGroup(), o = { depth: opts.depth, fixed: opts.fixed };
  const has = scene.textures.exists('icon_stardust') && scene.textures.exists('icon_shard');
  const i1 = has ? g.add(icon(scene, x + 5, y + 6, 'icon_stardust', { scale: 0.85, ...o })) : null;
  const t1 = g.add(txt(scene, x + (has ? 12 : 0), y, '', { size: 11, ...o }));
  const i2 = has ? g.add(icon(scene, 0, y + 6, 'icon_shard', { scale: 0.85, ...o })) : null;
  const t2 = g.add(txt(scene, 0, y, '', { size: 11, ...o }));
  const off = opts.fixed ? FIX_X : 0;
  g.set = (stardust, shards) => {
    t1.setText((has ? '' : '★') + stardust);
    const nx = x + off + (has ? 12 : 0) + t1.width + 8;
    if (i2) i2.x = nx + 5;
    t2.setText((has ? '' : '◆') + shards).setX(nx + (has ? 12 : 0));
  };
  return g;
}

export function panel(scene, x, y, w, h, opts = {}) {
  // 기본 남색 창은 그림으로 (투명도·색을 따로 준 띠는 예전처럼)
  if (opts.alpha === undefined && opts.border !== false && (opts.color === undefined || opts.color === 0x1e2040 || opts.color === COLORS.panel)) {
    const n = slice9(scene, 'ui_panel_dark', x, y, w, h);
    if (n) { if (opts.fixed) fix(n); n.setDepth(opts.depth ?? DEPTH.UI); return n; }
  }
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
    this.w = w; this.h = h; this.down = false;
    // 그림 버튼(9분할) 또는 단색 버튼
    this.skin = null;
    if (BUTTON_SKINS[this.color]) { const n = slice9(scene, BUTTON_SKINS[this.color][0], x, y, w, h); if (n) this.skin = n.setOrigin(0.5, 0.5).setPosition(x + w / 2, y + h / 2).setDepth(depth); }
    this.bg = this.skin || scene.add.rectangle(x + w / 2, y + h / 2, w, h, this.color).setStrokeStyle(1, COLORS.border).setDepth(depth);
    this.label = txt(scene, x + w / 2, y + h / 2, label, { size: opts.size || 11, origin: 0.5, depth: depth + 1, color: opts.textColor, align: 'center' });
    this.fixed = !!opts.fixed;
    if (opts.fixed) { fix(this.glow); fix(this.bg); fix(this.label); }
    this.bg.setInteractive({ useHandCursor: true });
    this.bg.on('pointerdown', () => {
      if (!this.enabled) return;
      if (this.skin) { if (!this.down) { this.down = true; this.label.y += 1; } this.paint(); }
      else { this.bg.setFillStyle(COLORS.buttonDown); this.bg.setScale(0.96); this.label.setScale(0.96); }
    });
    const release = () => {
      if (this.skin) { if (this.down) { this.down = false; this.label.y -= 1; } this.paint(); }
      else { this.bg.setFillStyle(this.enabled ? this.color : COLORS.buttonDisabled); this.bg.setScale(1); this.label.setScale(1); }
    };
    this.bg.on('pointerout', release);
    this.bg.on('pointerup', () => { release(); if (!this.enabled) return; Audio.sfx('tap'); if (this.onTap) this.onTap(this); });
    this.objs = [this.glow, this.bg, this.label];
    this.paint();
  }
  // 그림 버튼의 상태(보통/눌림/꺼짐)에 맞는 그림과 색
  paint() {
    if (!this.skin) return;
    const [key, tint] = BUTTON_SKINS[this.color] || ['ui_button'];
    if (!this.enabled) { this.skin.setTexture('ui_button_off'); this.skin.tint = 0xffffff; return; }
    if (this.down && key === 'ui_button' && !tint) { this.skin.setTexture('ui_button_down'); this.skin.tint = 0xffffff; return; }
    this.skin.setTexture(key);
    this.skin.tint = this.down ? mulTint(tint ?? 0xffffff, PRESS_TINT) : (tint ?? 0xffffff);
  }
  setEnabled(b) { this.enabled = b; if (this.skin) this.paint(); else this.bg.setFillStyle(b ? this.color : COLORS.buttonDisabled); this.label.setAlpha(b ? 1 : 0.5); if (!b) this.setGlow(false); return this; }
  setGlow(b) {
    if (this.glowTween) { this.glowTween.stop(); this.glowTween = null; }
    if (b) { this.glow.setFillStyle(COLORS.gold, 0.9); this.glowTween = this.scene.tweens.add({ targets: this.glow, alpha: { from: 1, to: 0.3 }, duration: 450, yoyo: true, repeat: -1 }); }
    else { this.glow.setAlpha(1); this.glow.setFillStyle(COLORS.gold, 0); }
    return this;
  }
  setLabel(s) { this.label.setText(s); return this; }
  setColor(c) { this.color = c; if (this.skin) this.paint(); else if (this.enabled) this.bg.setFillStyle(c); return this; }
  setVisible(v) { this.objs.forEach(o => o.setVisible(v)); return this; }
  setPosition(x, y) { const w = this.w, h = this.h, ox = this.fixed ? FIX_X : 0, oy = this.fixed ? FIX_Y : 0; this.glow.setPosition(x + w / 2 + ox, y + h / 2 + oy); this.bg.setPosition(x + w / 2 + ox, y + h / 2 + oy); this.label.setPosition(x + w / 2 + ox, y + h / 2 + oy); return this; }
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
      // 꽃과 덩굴 대화창 그림(크림색 종이 + 갈색 글자). 그림이 없으면 예전 남색 창.
      const paper = slice9(sc, 'ui_dialog', 4, y, W - 8, h);
      if (paper) { if (this.opts.fixed) fix(paper); g.add(paper.setDepth(DEPTH.DIALOG)); }
      else g.add(panel(sc, 4, y, W - 8, h, { depth: DEPTH.DIALOG, fixed: this.opts.fixed, color: 0x1e2040, alpha: 1 }));
      const ink = paper ? { color: '#3b251b', stroke: false } : {};
      const body = g.add(txt(sc, 14, y + 9, '', { size: 11, wrap: W - 32, depth: DEPTH.DIALOG + 1, fixed: this.opts.fixed, lineSpacing: 3, ...ink }));
      // 다음 표시: 화살표 그림(아래로 돌려서) 또는 ▼ 글자
      const more = g.add((icon(sc, W - 16, y + h - 13, 'ui_arrow_next', { depth: DEPTH.DIALOG + 1, fixed: this.opts.fixed }) || { setAngle() { return null; } }).setAngle(90)
        || txt(sc, W - 16, y + h - 13, '▼', { size: 11, origin: 0.5, depth: DEPTH.DIALOG + 1, fixed: this.opts.fixed, color: paper ? '#b0562a' : COLORS.yellow, stroke: !paper }));
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
  // 테두리 그림이 있는 바 (opts.frame: 'hp' | 'mp'). 높이는 8로 고정, 안쪽 4픽셀이 채워진다.
  const fillKey = opts.frame ? 'ui_bar_' + opts.frame : null;
  if (fillKey && w >= 16 && scene.textures.exists('ui_bar_frame') && scene.textures.exists(fillKey) && scene.game.renderer.type === Phaser.WEBGL) {
    const inner = w - 8, lowKey = scene.textures.exists(fillKey + '_low') ? fillKey + '_low' : fillKey;
    const bg = scene.add.rectangle(x + 4, y, inner, 4, 0x1a272e).setOrigin(0, 0.5).setDepth(depth);
    const fg = scene.add.tileSprite(x + 4, y, inner * PX, 4 * PX, fillKey).setOrigin(0, 0.5).setScale(1 / PX).setDepth(depth + 1);
    const fr = scene.add.nineslice(x, y, 'ui_bar_frame', undefined, w * PX, 8 * PX, 4 * PX, 4 * PX, 0, 0).setOrigin(0, 0.5).setScale(1 / PX).setDepth(depth + 2);
    let marker = null;
    if (opts.marker !== undefined) marker = scene.add.rectangle(x + 4 + Math.round(inner * opts.marker), y, 1, 4, 0xffffff, 0.9).setOrigin(0, 0.5).setDepth(depth + 3);
    const all = [bg, fg, fr, marker].filter(Boolean);
    if (opts.fixed) all.forEach(fix);
    return {
      bg, fg, marker, frame: fr,
      set(ratio, lowColor) {
        const r = Math.max(0, Math.min(1, ratio)), px = Math.floor(inner * r);
        fg.setVisible(px > 0 && bg.visible); fg.width = Math.max(1, px) * PX; fg.shown = px > 0;
        if (lowColor !== undefined) fg.setTexture(r <= (opts.lowAt ?? 0.25) ? lowKey : fillKey);
      },
      setPosition(nx, ny) { if (opts.fixed) { nx += FIX_X; ny += FIX_Y; } bg.setPosition(nx + 4, ny); fg.setPosition(nx + 4, ny); fr.setPosition(nx, ny); if (marker) marker.setPosition(nx + 4 + Math.round(inner * opts.marker), ny); },
      setVisible(v) { all.forEach(o => o.setVisible(v)); if (v && fg.shown === false) fg.setVisible(false); },
      destroy() { all.forEach(o => o.destroy()); },
    };
  }
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
