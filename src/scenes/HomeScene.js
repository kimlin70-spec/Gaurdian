// 우리 집: 집 안 + 마당. 가구를 놓아 꾸미기, 제작대, 가구 가게
import { W, H, TILE, COLORS, wd, PX } from '../config.js';
import Data from '../systems/Data.js';
import GameState from '../systems/GameState.js';
import Audio from '../systems/Audio.js';
import { txt, Button, panel, UIGroup, DialogBox, toast, fadeIn, fadeOut, DEPTH, setupCamera } from '../systems/UI.js';
import { makeCharacter, img, unit, setPose, face, fx } from '../systems/Assets.js';

const COLS = 14, ROWS = 8;           // 방/마당 크기 (칸)
const OX = (W - COLS * TILE) / 2, OY = 30;
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
    this.milkkuObjs = []; this.milkkuOut = false; this.milkkuTimer = null;
    this.area = this.p.area || 'indoor';
    this.bg = new UIGroup(); this.placedSprites = []; this.animalSprites = [];
    this.add.rectangle(W / 2, H / 2, W, H, 0x2a2238);
    this.title = txt(this, W / 2, 2, '', { size: 11, origin: [0.5, 0], color: COLORS.yellow });

    // 바닥 탭 → 가구 놓기
    const floor = this.add.rectangle(OX + COLS * TILE / 2, OY + ROWS * TILE / 2, COLS * TILE, ROWS * TILE, 0xffffff, 0.001).setInteractive().setDepth(0.1);
    floor.on('pointerup', (pointer) => {
      if (this.busy || pointer.getDistance() > 10 * PX) return;
      const gx = Math.floor((pointer.worldX - OX) / TILE), gy = Math.floor((pointer.worldY - OY) / TILE);
      this.tapFloor(gx, gy);
    });

    // 아래 바
    panel(this, 2, BAR_Y, W - 4, H - BAR_Y - 2, { color: 0x1e2040 });
    this.hint = txt(this, 8, BAR_Y + 4, '', { size: 11, color: '#b8c0e0', strokeThickness: 1 });
    new Button(this, 8, BAR_Y + 20, 66, 24, '가구 고르기', () => this.openInventory());
    new Button(this, 78, BAR_Y + 20, 54, 24, '제작대', () => this.openCraft(), { color: 0xe08a3c });
    new Button(this, 136, BAR_Y + 20, 62, 24, '가구 가게', () => this.openShop(), { color: 0x3fa34d });
    this.areaBtn = new Button(this, 202, BAR_Y + 20, 60, 24, '', () => this.toggleArea(), { color: 0x6a4fb3 });
    new Button(this, W - 54, BAR_Y + 20, 46, 24, '나가기', () => this.leave(), { color: 0x555577 });
    this.dialog = new DialogBox(this);

    this.renderArea();
    if (!s.flags.homeSeen) { s.flags.homeSeen = true; this.busy = true; this.dialog.show([Data.fmt(Data.dialogues.home.welcome), Data.fmt(Data.dialogues.home.how), Data.fmt(Data.dialogues.home.yard)]).then(() => { this.busy = false; }); }
  }

  list() { return this.area === 'yard' ? GameState.s.home.yard : GameState.s.home.placed; }
  canPlaceHere(f) { const p = f.place || 'indoor'; return p === 'both' || p === (this.area === 'yard' ? 'outdoor' : 'indoor'); }
  toggleArea() { this.area = this.area === 'yard' ? 'indoor' : 'yard'; this.selected = null; this.renderArea(); }

  // ---------- 배경 ----------
  renderArea() {
    this.bg.destroy(); this.bg = new UIGroup();
    const g = this.bg;
    if (this.area === 'indoor') {
      this.title.setText(Data.strings.homeName + ' - 집 안');
      g.add(this.add.rectangle(OX + COLS * TILE / 2, OY - 10, COLS * TILE + 8, 24, 0xd9b58a).setStrokeStyle(1, 0x1b1b2a));
      g.add(this.add.rectangle(OX + COLS * TILE / 2, OY - 14, COLS * TILE + 8, 6, 0xb88a5a));
      for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) g.add(this.add.rectangle(OX + x * TILE + 8, OY + y * TILE + 8, TILE, TILE, (x + y) % 2 ? 0xe9cfa3 : 0xdcc093).setStrokeStyle(1, 0xcdb07f, 0.6));
      g.add(this.add.rectangle(OX + COLS * TILE / 2, OY + ROWS * TILE / 2, COLS * TILE, ROWS * TILE, 0, 0).setStrokeStyle(2, 0x6b4a2a));
      g.add(this.add.rectangle(OX + 40, OY - 10, 20, 14, 0x9fd0ff).setStrokeStyle(1, 0x1b1b2a));
      g.add(this.add.rectangle(OX + COLS * TILE - 40, OY - 10, 20, 14, 0x9fd0ff).setStrokeStyle(1, 0x1b1b2a));
    } else {
      this.title.setText(Data.strings.homeName + ' - 마당');
      g.add(this.add.rectangle(W / 2, OY - 12, W, 28, 0x87ceeb)); // 하늘
      for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) g.add(img(this, OX + x * TILE, OY + y * TILE, 'tiles', (x * 7 + y * 3) % 11 === 0 ? 4 : 0).setOrigin(0).setDepth(0.05));
      // 울타리
      for (let x = -1; x <= COLS; x++) { g.add(this.add.rectangle(OX + x * TILE + 8, OY - 2, 4, 12, 0xd9b58a).setStrokeStyle(1, 0x1b1b2a).setDepth(0.2)); }
      g.add(this.add.rectangle(OX + COLS * TILE / 2, OY - 4, COLS * TILE + 24, 3, 0xb88a5a).setDepth(0.21));
      for (let y = 0; y <= ROWS; y++) { g.add(this.add.rectangle(OX - 6, OY + y * TILE + 4, 4, 12, 0xd9b58a).setStrokeStyle(1, 0x1b1b2a).setDepth(0.2)); g.add(this.add.rectangle(OX + COLS * TILE + 6, OY + y * TILE + 4, 4, 12, 0xd9b58a).setStrokeStyle(1, 0x1b1b2a).setDepth(0.2)); }
      // 집 벽 한 조각 (집으로 들어가는 문)
      g.add(img(this, OX + COLS * TILE - 24, OY + 4, 'bld_home').setOrigin(0.5, 1).setScale(0.6 / PX).setDepth(0.3).setAlpha(0.9));
    }
    if (this.hero) this.hero.destroy();
    this.hero = makeCharacter(this, OX + COLS * TILE - 20, OY + ROWS * TILE - 2, GameState.s.player.look).setDepth(wd(OY + ROWS * TILE - 2));
    this.areaBtn.setLabel(this.area === 'yard' ? '집 안으로' : '마당으로');
    this.renderPlaced(); this.renderAnimals(); this.setHint();
  }
  // 마당에 함께 다니는 동물들이 놀고 있어요
  renderAnimals() {
    this.animalSprites.forEach(o => o.destroy()); this.animalSprites = [];
    if (this.area !== 'yard') return;
    const spots = [[2, 6], [6, 3], [10, 6]];
    GameState.s.party.slice(0, 3).forEach((id, i) => {
      const a = Data.animal(id); if (!a) return;
      const [gx, gy] = spots[i], x = OX + gx * TILE + 8, y = OY + (gy + 1) * TILE;
      const sp = unit(this, x, y, GameState.animalSprite(id)).setOrigin(0.5, 1).setDepth(wd(y)); setPose(sp, 'move');
      const dx = (Phaser.Math.Between(6, 12)) * (i % 2 ? -1 : 1); face(sp, dx, 0);
      this.tweens.add({ targets: sp, y: y - 6, duration: Phaser.Math.Between(400, 700), yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 200 });
      this.tweens.add({ targets: sp, x: x + dx, duration: Phaser.Math.Between(1500, 2500), yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
        onYoyo: () => face(sp, -dx, 0), onRepeat: () => face(sp, dx, 0) });
      this.animalSprites.push(sp);
    });
  }

  setHint() {
    if (this.selected) { const f = Data.furniture[this.selected]; this.hint.setText(`${f.name} 을(를) 놓을 자리를 탭하세요`); }
    else this.hint.setText(this.area === 'yard' ? '마당이에요. 가구를 탭하면 다시 들어요.' : '가구를 탭하면 다시 들어요. 아래에서 가구를 고르세요.');
  }

  // 놓인 가구 그리기
  renderPlaced() {
    this.placedSprites.forEach(o => o.destroy()); this.placedSprites = [];
    for (const pl of this.list()) {
      const f = Data.furniture[pl.id]; if (!f) continue;
      const x = OX + pl.x * TILE, y = OY + (pl.y + f.h) * TILE;
      const im = img(this, x, y, f.sprite).setOrigin(0, 1).setDepth(f.floor ? 0.5 : wd(y));
      im.setInteractive({ useHandCursor: true });
      im.on('pointerup', (pointer) => { if (this.busy || pointer.getDistance() > 10 * PX) return; this.pickUp(pl); });
      this.placedSprites.push(im);
    }
    this.renderMilkku();
  }
  occupied(gx, gy) {
    for (const pl of this.list()) {
      const f = Data.furniture[pl.id];
      if (gx >= pl.x && gx < pl.x + f.w && gy >= pl.y && gy < pl.y + f.h && !f.floor) return true;
    }
    return false;
  }
  tapFloor(gx, gy) {
    if (!this.selected) return;
    const f = Data.furniture[this.selected];
    if (!this.canPlaceHere(f)) { Audio.sfx('error'); toast(this, this.area === 'yard' ? '이건 집 안에만 놓을 수 있어요' : '이건 마당에만 놓을 수 있어요', { y: 60 }); return; }
    if (gx < 0 || gy < 0 || gx + f.w > COLS || gy + f.h > ROWS) { Audio.sfx('error'); return; }
    for (let x = gx; x < gx + f.w; x++) for (let y = gy; y < gy + f.h; y++) if (this.occupied(x, y)) { Audio.sfx('error'); toast(this, '거기엔 이미 가구가 있어요', { y: 60 }); return; }
    const s = GameState.s;
    s.home.owned[this.selected] -= 1; if (s.home.owned[this.selected] <= 0) delete s.home.owned[this.selected];
    this.list().push({ id: this.selected, x: gx, y: gy });
    Audio.sfx('chest');
    if (this.selected === 'bed' && this.area === 'indoor') { GameState.noteBedPlaced(); this.milkkuOut = false; }
    if (!s.home.owned[this.selected]) this.selected = null;
    this.renderPlaced(); this.setHint(); GameState.save();
  }
  pickUp(pl) {
    const s = GameState.s;
    const under = pl.id === 'bed' && this.area === 'indoor' && this.milkkuUnderBed();
    const found = !!s.animals.milkku;
    if (this.area === 'yard') s.home.yard = s.home.yard.filter(p => p !== pl); else s.home.placed = s.home.placed.filter(p => p !== pl);
    GameState.addFurniture(pl.id);
    Audio.sfx('tap');
    this.selected = pl.id;
    if (under) this.milkkuOut = true;
    this.renderPlaced(); this.setHint(); GameState.save();
    if (under) this.milkkuPopOut(pl, !found);
  }

  // ---------- 밀꾸 (침대 밑에 숨은 강아지) ----------
  // 꼬리만 보이는 때: 아직 못 만났는데 숨어 있음 / 친구인데 함께 다니지 않을 때는 침대 밑에서 낮잠
  milkkuUnderBed() {
    const s = GameState.s;
    if (!GameState.hasBed() || this.milkkuOut) return false;
    if (!s.animals.milkku) return GameState.milkkuHiding();
    return !s.party.includes('milkku');
  }
  clearMilkku() {
    this.milkkuObjs.forEach(o => { this.tweens.killTweensOf(o); o.destroy(); }); this.milkkuObjs = [];
    if (this.milkkuTimer) { this.milkkuTimer.remove(false); this.milkkuTimer = null; }
  }
  renderMilkku() {
    this.clearMilkku();
    if (this.area !== 'indoor') return;
    const s = GameState.s, found = !!s.animals.milkku;
    const bed = s.home.placed.find(p => p.id === 'bed');
    if (bed && this.milkkuUnderBed()) {
      // 침대 아래로 삐져나온 엉덩이와 꼬리. 살랑살랑.
      const f = Data.furniture.bed, bx = OX + bed.x * TILE + f.w * TILE * 0.66, by = OY + (bed.y + f.h) * TILE + 3;
      const tail = img(this, bx, by, 'milkku_hide').setOrigin(0.5, 1).setDepth(wd(by) + 0.0002);
      tail.setInteractive({ useHandCursor: true });
      tail.on('pointerup', (pointer) => { if (this.busy || pointer.getDistance() > 10 * PX) return; this.pickUp(bed); });
      this.tweens.add({ targets: tail, angle: { from: -7, to: 7 }, duration: found ? 900 : 280, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.milkkuObjs.push(tail);
      const say = txt(this, bx + 6, by - 14, found ? Data.dialogues.milkku.nap : Data.dialogues.milkku.sniff, { size: 11, origin: 0.5, color: '#fff4d6', depth: DEPTH.WORLD_UI }).setAlpha(0);
      this.tweens.add({ targets: say, alpha: 1, y: say.y - 3, duration: 600, yoyo: true, hold: 900, repeat: -1, repeatDelay: 1800 });
      this.milkkuObjs.push(say);
      return;
    }
    // 침대 밖으로 나온 밀꾸(방금 들춘 침대 밑, 또는 침대가 없을 때): 방 안을 총총 돌아다님
    if (this.milkkuOut || (found && !s.party.includes('milkku') && !bed)) {
      const x0 = OX + 7 * TILE, y0 = OY + 5 * TILE;
      const dog = unit(this, x0, y0, GameState.animalSprite('milkku')).setOrigin(0.5, 1).setDepth(wd(y0));
      dog.setInteractive({ useHandCursor: true });
      dog.on('pointerup', () => this.milkkuBark(dog));
      this.milkkuObjs.push(dog);
      const roam = () => {
        if (!dog.active || this.busy) return;
        const tx = OX + Phaser.Math.Between(1, COLS - 2) * TILE + 8, ty = OY + Phaser.Math.Between(2, ROWS - 1) * TILE;
        face(dog, tx - dog.x, ty - dog.y); setPose(dog, 'move');
        this.tweens.add({ targets: dog, x: tx, y: ty, duration: Phaser.Math.Distance.Between(dog.x, dog.y, tx, ty) * 22, ease: 'Linear',
          onUpdate: () => dog.setDepth(wd(dog.y)), onComplete: () => { if (dog.active) setPose(dog, 'idle'); } });
      };
      this.milkkuTimer = this.time.addEvent({ delay: 2600, loop: true, callback: roam });
    }
  }
  milkkuBark(dog) {
    if (!dog.active) return;
    Audio.sfx('tap');
    const t = txt(this, dog.x, dog.y - 20, Data.dialogues.milkku.bark, { size: 11, origin: 0.5, color: '#ffffff', depth: DEPTH.WORLD_UI });
    this.tweens.add({ targets: t, y: t.y - 10, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    this.tweens.add({ targets: dog, y: dog.y - 6, duration: 110, yoyo: true });
  }
  // 침대를 들었더니 밀꾸가! 처음이면 친구가 되고, 이미 친구면 낮잠 자다 깬다.
  async milkkuPopOut(bed, first) {
    const dog = this.milkkuObjs.find(o => o.animKey);
    if (!dog) return;
    const f = Data.furniture.bed, cx = OX + (bed.x + f.w / 2) * TILE, cy = OY + (bed.y + f.h) * TILE - 2;
    dog.setPosition(cx, cy).setDepth(wd(cy));
    this.busy = true;
    Audio.sfx('star');
    this.milkkuBark(dog);
    await new Promise(r => this.tweens.add({ targets: dog, y: cy - 10, duration: 140, yoyo: true, repeat: 1, onComplete: r }));
    if (first) {
      await this.dialog.show(Data.dialogues.milkku.found.map(l => Data.fmt(l)));
      GameState.findMilkku(); GameState.save();
      fx(this, 'fx_heal_anim', dog.x, dog.y - 8, 1.6, wd(dog.y) + 0.001);
      Audio.sfx('levelup');
      setPose(dog, 'happy');
      await this.dialog.show([Data.fmt(Data.dialogues.milkku.foundTip)]);
      setPose(dog, 'idle');
    } else {
      await this.dialog.show([Data.fmt(Data.dialogues.milkku.popOut)]);
    }
    this.busy = false;
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
  placeLabel(f) { const p = f.place || 'indoor'; return p === 'both' ? '집·마당' : p === 'outdoor' ? '마당' : '집 안'; }
  renderList(rows, perPage = 4) {
    this.lg.destroy(); this.lg = new UIGroup();
    const s = GameState.s, g = this.lg, top = 46, rowH = 34;
    const mats = ['twig', 'petal', 'pebble'].map(m => `${Data.item(m).name} ${s.inventory[m] || 0}`).join('  ');
    this.money.setText(`★${s.stardust}   ${mats}`);
    const pages = Math.max(1, Math.ceil(rows.length / perPage)); this.page = Math.min(this.page, pages - 1);
    const slice = rows.slice(this.page * perPage, this.page * perPage + perPage);
    if (!rows.length) g.add(txt(this, W / 2, 110, rows.empty || '아직 아무것도 없어요.', { size: 11, origin: 0.5, align: 'center', depth: DEPTH.MODAL }));
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
    const rows = Object.entries(s.home.owned).filter(([, n]) => n > 0).map(([id, n]) => { const f = Data.furniture[id]; const ok = this.canPlaceHere(f); return { id, label: `${f.name} ×${n}`, sub: `${f.w}×${f.h}칸 · ${this.placeLabel(f)}`, right: ok ? '놓기' : (this.area === 'yard' ? '집 안용' : '마당용'), rightColor: ok ? COLORS.yellow : '#8890aa', enabled: ok, onTap: () => { this.selected = id; this.closePanel(); } }; });
    rows.empty = '가진 가구가 없어요.\n제작대나 가구 가게에서 구해요!';
    this.renderList(rows);
  }
  openCraft() {
    this.openPanel('제작대');
    const render = () => {
      const rows = Object.entries(Data.furniture).filter(([, f]) => f.craft).sort((a, b) => Number(this.canPlaceHere(b[1])) - Number(this.canPlaceHere(a[1]))).map(([id, f]) => ({
        id, label: `${f.name} (${this.placeLabel(f)})`, sub: '재료: ' + Object.entries(f.craft).map(([m, n]) => `${Data.item(m).name} ${n}`).join(', '),
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
      const rows = Object.entries(Data.furniture).filter(([, f]) => f.price).sort((a, b) => Number(this.canPlaceHere(b[1])) - Number(this.canPlaceHere(a[1]))).map(([id, f]) => ({
        id, label: `${f.name} (${this.placeLabel(f)})`, sub: `${f.w}×${f.h}칸`, right: `★${f.price}`, enabled: s.stardust >= f.price,
        onTap: () => { s.stardust -= f.price; GameState.addFurniture(id); Audio.sfx('chest'); toast(this, `${f.name}을(를) 샀어요!`, { y: 60 }); render(); },
      }));
      this.renderList(rows);
    };
    render();
  }
  async leave() {
    if (this.busy) return; this.busy = true;
    this.clearMilkku();
    GameState.save();
    await fadeOut(this, 250);
    this.scene.start('Village', {});
  }
}
