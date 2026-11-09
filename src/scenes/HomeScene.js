// 우리 집: 가구를 놓아 꾸미기 + 제작대 + 가구 가게
import { W, H, TILE, COLORS, wd, PX } from '../config.js';
import Data from '../systems/Data.js';
import GameState from '../systems/GameState.js';
import Audio from '../systems/Audio.js';
import { txt, Button, panel, UIGroup, DialogBox, toast, fadeIn, fadeOut, DEPTH, setupCamera } from '../systems/UI.js';
import { makeCharacter, img } from '../systems/Assets.js';

const COLS = 14, ROWS = 8;           // 방 크기 (칸)
const OX = (W - COLS * TILE) / 2, OY = 30; // 방 위치
const BAR_Y = OY + ROWS * TILE + 6;  // 아래 바

export default class HomeScene extends Phaser.Scene {
  constructor() { super('Home'); }
  init(data) { this.p = data || {}; }

  create() {
    setupCamera(this);
    fadeIn(this);
    Audio.playBgm('village');
    const s = GameState.s;
    this.selected = null; this.busy = false; this.pg = null; this.lg = null;
    this.add.rectangle(W / 2, H / 2, W, H, 0x2a2238);
    // 벽 + 바닥
    this.add.rectangle(OX + COLS * TILE / 2, OY - 10, COLS * TILE + 8, 24, 0xd9b58a).setStrokeStyle(1, 0x1b1b2a);
    this.add.rectangle(OX + COLS * TILE / 2, OY - 14, COLS * TILE + 8, 6, 0xb88a5a);
    for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) {
      this.add.rectangle(OX + x * TILE + 8, OY + y * TILE + 8, TILE, TILE, (x + y) % 2 ? 0xe9cfa3 : 0xdcc093).setStrokeStyle(1, 0xcdb07f, 0.6);
    }
    this.add.rectangle(OX + COLS * TILE / 2, OY + ROWS * TILE / 2, COLS * TILE, ROWS * TILE, 0, 0).setStrokeStyle(2, 0x6b4a2a);
    // 창문
    this.add.rectangle(OX + 40, OY - 10, 20, 14, 0x9fd0ff).setStrokeStyle(1, 0x1b1b2a);
    this.add.rectangle(OX + COLS * TILE - 40, OY - 10, 20, 14, 0x9fd0ff).setStrokeStyle(1, 0x1b1b2a);

    txt(this, W / 2, 2, Data.strings.homeName, { size: 11, origin: [0.5, 0], color: COLORS.yellow });
    this.hero = makeCharacter(this, OX + COLS * TILE - 20, OY + ROWS * TILE - 2, s.player.look).setDepth(wd(OY + ROWS * TILE - 2));

    this.placedSprites = [];
    this.renderPlaced();

    // 바닥 탭 → 가구 놓기
    const floor = this.add.rectangle(OX + COLS * TILE / 2, OY + ROWS * TILE / 2, COLS * TILE, ROWS * TILE, 0xffffff, 0.001).setInteractive();
    floor.on('pointerup', (pointer) => {
      if (this.busy || pointer.getDistance() > 10 * PX) return;
      const gx = Math.floor((pointer.worldX - OX) / TILE), gy = Math.floor((pointer.worldY - OY) / TILE);
      this.tapFloor(gx, gy);
    });
    this.ghost = null;

    // 아래 바: 가구 선택 / 만들기 / 가게 / 나가기
    panel(this, 2, BAR_Y, W - 4, H - BAR_Y - 2, { color: 0x1e2040 });
    this.hint = txt(this, 8, BAR_Y + 4, '', { size: 11, color: '#b8c0e0', strokeThickness: 1 });
    new Button(this, 8, BAR_Y + 20, 70, 24, '가구 고르기', () => this.openInventory());
    new Button(this, 82, BAR_Y + 20, 60, 24, '제작대', () => this.openCraft(), { color: 0xe08a3c });
    new Button(this, 146, BAR_Y + 20, 60, 24, '가구 가게', () => this.openShop(), { color: 0x3fa34d });
    new Button(this, W - 66, BAR_Y + 20, 58, 24, '나가기', () => this.leave(), { color: 0x555577 });
    this.dialog = new DialogBox(this);
    this.setHint();
    if (!s.flags.homeSeen) { s.flags.homeSeen = true; this.busy = true; this.dialog.show([Data.fmt(Data.dialogues.home.welcome), Data.fmt(Data.dialogues.home.how)]).then(() => { this.busy = false; }); }
  }

  setHint() {
    if (this.selected) { const f = Data.furniture[this.selected]; this.hint.setText(`${f.name} 을(를) 놓을 자리를 탭하세요`); }
    else this.hint.setText('가구를 탭하면 다시 들어요. 아래에서 가구를 고르세요.');
  }

  // 놓인 가구 그리기
  renderPlaced() {
    this.placedSprites.forEach(o => o.destroy()); this.placedSprites = [];
    for (const pl of GameState.s.home.placed) {
      const f = Data.furniture[pl.id]; if (!f) continue;
      const x = OX + pl.x * TILE, y = OY + (pl.y + f.h) * TILE;
      const im = img(this, x, y, f.sprite).setOrigin(0, 1).setDepth(f.floor ? 0.5 : wd(y));
      im.setInteractive({ useHandCursor: true });
      im.on('pointerup', (pointer) => { if (this.busy || pointer.getDistance() > 10 * PX) return; this.pickUp(pl); });
      this.placedSprites.push(im);
    }
  }
  occupied(gx, gy, except) {
    for (const pl of GameState.s.home.placed) {
      if (pl === except) continue;
      const f = Data.furniture[pl.id];
      if (gx >= pl.x && gx < pl.x + f.w && gy >= pl.y && gy < pl.y + f.h && !f.floor) return true;
    }
    return false;
  }
  tapFloor(gx, gy) {
    if (!this.selected) return;
    const f = Data.furniture[this.selected];
    if (gx < 0 || gy < 0 || gx + f.w > COLS || gy + f.h > ROWS) { Audio.sfx('error'); return; }
    for (let x = gx; x < gx + f.w; x++) for (let y = gy; y < gy + f.h; y++) if (this.occupied(x, y)) { Audio.sfx('error'); toast(this, '거기엔 이미 가구가 있어요', { y: 60 }); return; }
    const s = GameState.s;
    s.home.owned[this.selected] -= 1; if (s.home.owned[this.selected] <= 0) delete s.home.owned[this.selected];
    s.home.placed.push({ id: this.selected, x: gx, y: gy });
    Audio.sfx('chest');
    if (!s.home.owned[this.selected]) this.selected = null;
    this.renderPlaced(); this.setHint(); GameState.save();
  }
  pickUp(pl) {
    const s = GameState.s;
    s.home.placed = s.home.placed.filter(p => p !== pl);
    GameState.addFurniture(pl.id);
    Audio.sfx('tap');
    this.selected = pl.id;
    this.renderPlaced(); this.setHint(); GameState.save();
  }

  // ---------- 패널 ----------
  openPanel(title) {
    this.closePanel();
    this.busy = true;
    const g = new UIGroup(); this.pg = g;
    g.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(DEPTH.MODAL - 2).setInteractive());
    g.add(panel(this, 8, 8, W - 16, H - 16, { depth: DEPTH.MODAL - 1 }));
    g.add(txt(this, W / 2, 16, title, { size: 14, origin: [0.5, 0], color: COLORS.yellow, depth: DEPTH.MODAL }));
    g.add(new Button(this, W - 70, H - 36, 58, 24, '닫기', () => this.closePanel(), { depth: DEPTH.MODAL, color: 0x555577 }));
    this.money = g.add(txt(this, W / 2, 32, '', { size: 11, origin: [0.5, 0], depth: DEPTH.MODAL, color: '#b8c0e0' }));
    this.lg = new UIGroup(); this.page = 0;
    return g;
  }
  closePanel() { if (this.lg) this.lg.destroy(); if (this.pg) this.pg.destroy(); this.lg = null; this.pg = null; this.busy = false; this.setHint(); GameState.save(); }
  renderList(rows, perPage = 4) {
    this.lg.destroy(); this.lg = new UIGroup();
    const s = GameState.s, g = this.lg, top = 46, rowH = 34;
    const mats = ['twig', 'petal', 'pebble'].map(m => `${Data.item(m).name} ${s.inventory[m] || 0}`).join('  ');
    this.money.setText(`★${s.stardust}   ${mats}`);
    const pages = Math.max(1, Math.ceil(rows.length / perPage)); this.page = Math.min(this.page, pages - 1);
    const slice = rows.slice(this.page * perPage, this.page * perPage + perPage);
    if (!rows.length) g.add(txt(this, W / 2, 110, rows.empty || '아직 아무것도 없어요.', { size: 11, origin: 0.5, depth: DEPTH.MODAL }));
    slice.forEach((r, i) => {
      const y = top + i * rowH;
      const b = g.add(new Button(this, 16, y, W - 32, rowH - 4, '', r.onTap, { depth: DEPTH.MODAL, color: r.color ?? 0x3d4066 }));
      const f = Data.furniture[r.id];
      const icon = g.add(img(this, 24, y + (rowH - 4) / 2, f.sprite).setDepth(DEPTH.MODAL + 1).setOrigin(0, 0.5));
      const sc = Math.min(1 / PX, 26 / Math.max(icon.width, icon.height)); icon.setScale(sc);
      b.label.setOrigin(0, 0.5).setPosition(58, y + (rowH - 4) / 2 - (r.sub ? 5 : 0)).setText(r.label);
      if (r.sub) g.add(txt(this, 58, y + 17, r.sub, { size: 11, color: '#b8c0e0', depth: DEPTH.MODAL + 1, strokeThickness: 1 }));
      if (r.right) g.add(txt(this, W - 24, y + (rowH - 4) / 2, r.right, { size: 11, origin: [1, 0.5], color: r.rightColor || COLORS.yellow, depth: DEPTH.MODAL + 1 }));
      if (r.enabled === false) b.setEnabled(false);
    });
    if (pages > 1) {
      g.add(new Button(this, W / 2 - 60, H - 36, 40, 24, '◀', () => { this.page = (this.page + pages - 1) % pages; this.renderList(rows, perPage); }, { depth: DEPTH.MODAL }));
      g.add(txt(this, W / 2, H - 24, `${this.page + 1}/${pages}`, { size: 11, origin: 0.5, depth: DEPTH.MODAL }));
      g.add(new Button(this, W / 2 + 20, H - 36, 40, 24, '▶', () => { this.page = (this.page + 1) % pages; this.renderList(rows, perPage); }, { depth: DEPTH.MODAL }));
    }
  }

  openInventory() {
    this.openPanel('가진 가구');
    const s = GameState.s;
    const rows = Object.entries(s.home.owned).filter(([, n]) => n > 0).map(([id, n]) => ({ id, label: `${Data.furniture[id].name} ×${n}`, sub: `${Data.furniture[id].w}×${Data.furniture[id].h}칸`, right: '놓기', onTap: () => { this.selected = id; this.closePanel(); } }));
    rows.empty = '가진 가구가 없어요.\n제작대나 가구 가게에서 구해요!';
    this.renderList(rows);
  }
  openCraft() {
    this.openPanel('제작대');
    const render = () => {
      const rows = Object.entries(Data.furniture).filter(([, f]) => f.craft).map(([id, f]) => ({
        id, label: f.name, sub: '재료: ' + Object.entries(f.craft).map(([m, n]) => `${Data.item(m).name} ${n}`).join(', '),
        right: GameState.canCraft(id) ? '만들기!' : '재료 부족', rightColor: GameState.canCraft(id) ? COLORS.yellow : '#8890aa',
        enabled: GameState.canCraft(id),
        onTap: () => { if (GameState.craft(id)) { Audio.sfx('levelup'); toast(this, `${f.name}을(를) 만들었어요!`, { y: 60 }); render(); } },
      }));
      this.renderList(rows);
    };
    render();
  }
  openShop() {
    this.openPanel('가구 가게');
    const render = () => {
      const s = GameState.s;
      const rows = Object.entries(Data.furniture).filter(([, f]) => f.price).map(([id, f]) => ({
        id, label: f.name, sub: `${f.w}×${f.h}칸`, right: `★${f.price}`, enabled: s.stardust >= f.price,
        onTap: () => { s.stardust -= f.price; GameState.addFurniture(id); Audio.sfx('chest'); toast(this, `${f.name}을(를) 샀어요!`, { y: 60 }); render(); },
      }));
      this.renderList(rows);
    };
    render();
  }
  async leave() {
    if (this.busy) return; this.busy = true;
    GameState.save();
    await fadeOut(this, 250);
    this.scene.start('Village', {});
  }
}
