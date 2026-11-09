// 탐험: 탑뷰 타일맵, 탭한 칸으로 BFS 이동, 배회하는 적, 상자, NPC, 출구
import { W, H, TILE, TILE_LEGEND, SOLID_TILES, COLORS, wd, PX, FIX_X, FIX_Y } from '../config.js';
import Data from '../systems/Data.js';
import GameState from '../systems/GameState.js';
import Audio from '../systems/Audio.js';
import { txt, Button, panel, UIGroup, DialogBox, confirm, toast, bar, fadeIn, fadeOut, tween, wait, DEPTH, setupCamera, fix } from '../systems/UI.js';
import { makeCharacter, buildTilemap, themeOf, img } from '../systems/Assets.js';

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const CORRUPT_TINT = 0x9a7fd6;

export default class FieldScene extends Phaser.Scene {
  constructor() { super('Field'); }
  init(data) { this.p = data || {}; }

  create() {
    setupCamera(this);
    const { stageId, mapId } = this.p;
    this.stage = Data.stage(stageId); this.map = Data.map(stageId, mapId);
    if (!this.map) { this.scene.start('Village', {}); return; }
    fadeIn(this);
    // 씬 인스턴스가 재사용되므로 상태를 전부 초기화
    this.transitioning = false; this.busy = false; this.boss = null; this.menu = null; this.marker = null;
    Audio.playBgm(mapId === 'boss' ? 'boss' : 'field');
    const s = GameState.s;
    GameState.setLocation({ scene: 'Field', stageId, mapId, x: this.p.x, y: this.p.y });
    GameState.save();

    // ---- 타일 ----
    this.grid = this.map.tiles || this.map.rows.map(r => r.split('').map(c => TILE_LEGEND[c] ?? 0));
    this.gw = this.grid[0].length; this.gh = this.grid.length;
    const mapW = this.gw * TILE, mapH = this.gh * TILE;
    this.ox = Math.max(0, Math.floor((W - mapW) / 2)); this.oy = Math.max(0, Math.floor((H - mapH) / 2));
    this.add.rectangle(0, 0, Math.max(W, mapW) * 2, Math.max(H, mapH) * 2, 0x0e0f1c).setOrigin(0);
    buildTilemap(this, this.grid, this.ox, this.oy);
    this.theme = themeOf(stageId);
    if (this.theme.snow) this.makeSnow();
    this.cameras.main.setBounds(0, 0, Math.max(W, mapW + this.ox * 2), Math.max(H, mapH + this.oy * 2));

    // ---- 오브젝트 ----
    this.blocked = new Set();  // 못 지나가는 오브젝트 칸
    this.objects = [];
    this.exits = {};
    for (const o of this.map.objects || []) this.spawnObject(o);

    // ---- 적 ----
    this.enemies = [];
    const defeated = (s.flags.defeated[stageId] || {});
    (this.map.enemies || []).forEach((e, i) => {
      const key = `${mapId}:${i}`;
      if (defeated[key]) return;
      this.spawnEnemy(e, key);
    });

    // ---- 주인공 ----
    this.tx = this.p.x; this.ty = this.p.y;
    const wp = this.tileToWorld(this.tx, this.ty);
    this.hero = makeCharacter(this, wp.x, wp.y + 8, s.player.look);
    this.hero.setDepth(wd(this.hero.y));
    this.cameras.main.startFollow(this.hero, true, 1, 1);
    this.cameras.main.setRoundPixels(true);
    this.path = []; this.moving = false; this.pendingInteract = null; this.busy = false;
    this.safeUntil = this.time.now + 1200; // 전투 직후 바로 또 부딪히지 않게

    // ---- HUD ----
    this.dialog = new DialogBox(this, { fixed: true });
    const nameT = txt(this, 6, 6, `${this.stage.name} - ${this.map.name}`, { size: 11, fixed: true, color: COLORS.yellow });
    this.tweens.add({ targets: nameT, alpha: 0, delay: 2500, duration: 600 });
    this.menuBtn = new Button(this, W - 54, 4, 50, 20, '메뉴', () => this.openMenu(), { fixed: true, color: 0x333355, depth: DEPTH.TOP });
    this.hpText = txt(this, 6, H - 16, '', { size: 11, fixed: true });
    this.refreshHp();

    // ---- 입력 ----
    this.input.on('pointerup', (pointer, over) => {
      if (this.busy || this.transitioning) return;
      if (pointer.getDistance() > 10 * PX) return; // 드래그는 무시
      if (over && over.length) return;        // 버튼/오브젝트 위는 각자 처리
      const gx = Math.floor((pointer.worldX - this.ox) / TILE), gy = Math.floor((pointer.worldY - this.oy) / TILE);
      this.tapTile(gx, gy);
    });
  }

  // 눈 내리는 연출 (화면 고정)
  makeSnow() {
    for (let i = 0; i < 28; i++) {
      const f = this.add.rectangle(Phaser.Math.Between(0, W), Phaser.Math.Between(0, H), 2, 2, 0xffffff, Phaser.Math.FloatBetween(0.5, 0.9)).setDepth(DEPTH.WORLD_UI - 1);
      fix(f);
      const fall = () => { f.y = FIX_Y - 4; f.x = FIX_X + Phaser.Math.Between(0, W); this.tweens.add({ targets: f, y: FIX_Y + H + 4, x: f.x + Phaser.Math.Between(-20, 20), duration: Phaser.Math.Between(3500, 6500), onComplete: fall }); };
      this.tweens.add({ targets: f, y: FIX_Y + H + 4, x: f.x + Phaser.Math.Between(-20, 20), duration: Phaser.Math.Between(1500, 6500), onComplete: fall });
    }
  }

  // ---------- 좌표 ----------
  tileToWorld(x, y) { return { x: this.ox + x * TILE + TILE / 2, y: this.oy + y * TILE + TILE / 2 }; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.gw && y < this.gh; }
  walkable(x, y) { return this.inBounds(x, y) && !SOLID_TILES.has(this.grid[y][x]) && !this.blocked.has(x + ',' + y); }
  refreshHp() { const s = GameState.s, st = GameState.playerStats(); this.hpText.setText(`${s.player.name} HP ${s.player.hp}/${st.hp}`); }

  // ---------- 오브젝트 ----------
  spawnObject(o) {
    const wp = this.tileToWorld(o.x, o.y), s = GameState.s, key = `${this.p.stageId}:${this.p.mapId}:${o.x},${o.y}`;
    const obj = { ...o, key };
    if (o.type === 'chest') {
      obj.opened = !!s.flags.chests[key];
      obj.sprite = img(this, wp.x, wp.y, obj.opened ? 'chest_open' : 'chest').setDepth(wd(wp.y));
      this.blocked.add(o.x + ',' + o.y);
      this.makeTappable(obj.sprite, () => this.approach(obj));
    } else if (o.type === 'npc') {
      obj.sprite = img(this, wp.x, wp.y + 8, o.sprite || 'guide').setOrigin(0.5, 1).setDepth(wd(wp.y + 8));
      this.tweens.add({ targets: obj.sprite, y: obj.sprite.y - 2, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      const bubble = txt(this, wp.x, wp.y - 14, '…', { size: 11, origin: 0.5, color: COLORS.yellow, depth: DEPTH.WORLD_UI });
      this.tweens.add({ targets: bubble, y: bubble.y - 2, duration: 500, yoyo: true, repeat: -1 });
      this.blocked.add(o.x + ',' + o.y);
      this.makeTappable(obj.sprite, () => this.approach(obj));
    } else if (o.type === 'exit' || o.type === 'village_exit') {
      const g = this.add.rectangle(wp.x, wp.y, TILE - 2, TILE - 2, o.type === 'village_exit' ? 0x5aa9ff : COLORS.gold, 0.35).setDepth(0.5);
      this.tweens.add({ targets: g, alpha: 0.75, duration: 600, yoyo: true, repeat: -1 });
      txt(this, wp.x, wp.y - 10, o.type === 'village_exit' ? '마을' : '▶', { size: 11, origin: 0.5, depth: DEPTH.WORLD_UI, color: COLORS.yellow });
      this.exits[o.x + ',' + o.y] = obj;
    } else if (o.type === 'injured') {
      if (s.flags.healed[key]) return;
      const a = Data.animal(o.animal);
      obj.sprite = img(this, wp.x, wp.y + 8, a.sprite).setOrigin(0.5, 1).setDepth(wd(wp.y + 8)).setAngle(-12).setAlpha(0.9);
      const bubble = txt(this, wp.x + 10, wp.y - 14, '아야', { size: 11, origin: 0.5, color: '#ff8080', depth: DEPTH.WORLD_UI });
      this.tweens.add({ targets: bubble, y: bubble.y - 2, alpha: 0.5, duration: 600, yoyo: true, repeat: -1 });
      obj.bubble = bubble;
      this.blocked.add(o.x + ',' + o.y);
      this.makeTappable(obj.sprite, () => this.approach(obj));
    } else if (o.type === 'boss') {
      if (s.flags.cleared[this.p.stageId]) return;
      const e = Data.enemy(o.enemy);
      obj.sprite = img(this, wp.x, wp.y + 8, e.sprite).setOrigin(0.5, 1).setDepth(wd(wp.y + 8)).setTint(CORRUPT_TINT);
      this.tweens.add({ targets: obj.sprite, scaleX: 1.04, scaleY: 0.96, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.blocked.add(o.x + ',' + o.y);
      this.makeTappable(obj.sprite, () => this.approach(obj));
      this.boss = obj;
    }
    this.objects.push(obj);
  }
  makeTappable(sprite, fn) {
    sprite.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-6 * PX, -6 * PX, sprite.width + 12 * PX, sprite.height + 12 * PX), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    sprite.on('pointerup', (pointer) => { if (!this.busy && !this.transitioning && pointer.getDistance() <= 10 * PX) fn(); });
  }

  spawnEnemy(e, key) {
    const wp = this.tileToWorld(e.x, e.y), data = Data.enemy(e.group[0]);
    const sprite = img(this, wp.x, wp.y + 8, data.sprite).setOrigin(0.5, 1).setDepth(wd(wp.y + 8)).setTint(CORRUPT_TINT);
    const en = { key, group: e.group, tx: e.x, ty: e.y, sprite, moving: false, timer: Phaser.Math.Between(500, 1500) };
    this.makeTappable(sprite, () => this.tapTile(en.tx, en.ty));
    this.enemies.push(en);
  }

  // ---------- 이동 ----------
  bfs(from, goalFn) {
    const seen = new Set([from.join(',')]); const q = [[from, []]];
    while (q.length) {
      const [[x, y], path] = q.shift();
      if (goalFn(x, y) && path.length) return path;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx, ny = y + dy, k = nx + ',' + ny;
        if (seen.has(k) || !this.walkable(nx, ny)) continue;
        seen.add(k); q.push([[nx, ny], [...path, [nx, ny]]]);
      }
    }
    return null;
  }
  tapTile(gx, gy) {
    if (!this.inBounds(gx, gy)) return;
    // 상자/NPC/보스를 탭한 경우
    const obj = this.objects.find(o => o.sprite && o.x === gx && o.y === gy);
    if (obj) return this.approach(obj);
    if (!this.walkable(gx, gy)) { Audio.sfx('error'); return; }
    this.pendingInteract = null;
    const from = this.moving ? [this.nextTile[0], this.nextTile[1]] : [this.tx, this.ty];
    const path = this.bfs(from, (x, y) => x === gx && y === gy);
    if (!path) { Audio.sfx('error'); return; }
    this.showMarker(gx, gy);
    this.path = path;
    if (!this.moving) this.stepNext();
  }
  approach(obj) {
    if (!obj) return;
    const from = this.moving ? [this.nextTile[0], this.nextTile[1]] : [this.tx, this.ty];
    const adjacent = (x, y) => Math.abs(x - obj.x) + Math.abs(y - obj.y) === 1;
    if (adjacent(from[0], from[1]) && !this.moving) { this.interact(obj); return; }
    const path = this.bfs(from, adjacent);
    if (!path) { Audio.sfx('error'); return; }
    this.pendingInteract = obj;
    this.showMarker(obj.x, obj.y);
    this.path = path;
    if (!this.moving) this.stepNext();
  }
  showMarker(gx, gy) {
    const wp = this.tileToWorld(gx, gy);
    if (this.marker) this.marker.destroy();
    this.marker = this.add.rectangle(wp.x, wp.y, TILE, TILE, 0xffffff, 0).setStrokeStyle(1, 0xffffff, 0.9).setDepth(DEPTH.WORLD_UI);
    this.tweens.add({ targets: this.marker, alpha: 0, duration: 700, onComplete: () => { if (this.marker) { this.marker.destroy(); this.marker = null; } } });
  }
  stepNext() {
    if (this.transitioning) { this.moving = false; return; }
    if (!this.path.length) { this.moving = false; this.arrive(); return; }
    const [nx, ny] = this.path.shift();
    if (!this.walkable(nx, ny)) { this.path = []; this.moving = false; return; }
    this.moving = true; this.nextTile = [nx, ny];
    this.hero.setFlip(nx < this.tx);
    const wp = this.tileToWorld(nx, ny);
    this.tweens.add({
      targets: this.hero, x: wp.x, y: wp.y + 8, duration: 150, ease: 'Linear',
      onUpdate: () => { this.hero.setDepth(wd(this.hero.y)); },
      onComplete: () => {
        this.tx = nx; this.ty = ny;
        if (this.checkExit()) return;
        this.stepNext();
      },
    });
    // 콩콩 걷기
    this.tweens.add({ targets: this.hero.parts.body, y: -1, duration: 75, yoyo: true });
  }
  arrive() {
    const obj = this.pendingInteract; this.pendingInteract = null;
    if (obj && Math.abs(obj.x - this.tx) + Math.abs(obj.y - this.ty) === 1) this.interact(obj);
  }
  checkExit() {
    const ex = this.exits[this.tx + ',' + this.ty];
    if (!ex) return false;
    this.transitioning = true; this.path = []; this.moving = false;
    this.goExit(ex);
    return true;
  }
  async goExit(ex) {
    await fadeOut(this, 250);
    if (ex.type === 'village_exit') { this.scene.start('Village', {}); return; }
    this.scene.start('Field', { stageId: this.p.stageId, mapId: ex.to, x: ex.tx, y: ex.ty });
  }

  // ---------- 상호작용 ----------
  async interact(obj) {
    if (this.busy) return;
    if (obj.type === 'chest') {
      if (obj.opened) { toast(this, '빈 상자예요.'); return; }
      obj.opened = true; GameState.s.flags.chests[obj.key] = true;
      obj.sprite.setTexture('chest_open');
      GameState.addItem(obj.item, obj.count || 1);
      Audio.sfx('chest');
      const it = Data.item(obj.item);
      toast(this, `${it ? it.name : obj.item} ${obj.count || 1}개를 얻었어요!`);
      this.tweens.add({ targets: obj.sprite, y: obj.sprite.y - 4, duration: 120, yoyo: true });
      GameState.save();
    } else if (obj.type === 'npc') {
      this.busy = true;
      const lines = (Data.dialogues.npc[obj.text] || ['...']).map(l => Data.fmt(l));
      this.hero.setFlip(obj.x < this.tx);
      await this.dialog.show(lines);
      this.busy = false;
    } else if (obj.type === 'injured') {
      this.busy = true;
      this.hero.setFlip(obj.x < this.tx);
      await this.dialog.show(Data.dialogues.injured.found.map(l => Data.fmt(l)));
      await this.healMinigame(obj);
      this.busy = false;
    } else if (obj.type === 'boss') {
      this.busy = true;
      const lines = (Data.dialogues.bossIntro[obj.enemy] || []).map(l => Data.fmt(l));
      if (lines.length) await this.dialog.show(lines);
      this.startBattle([obj.enemy], null, true);
    }
  }

  // ---------- 치료 미니게임: 반짝이는 상처를 탭해서 붕대 감기 ----------
  healMinigame(obj) {
    return new Promise(resolve => {
      const a = Data.animal(obj.animal), g = new UIGroup();
      g.add(fix(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(DEPTH.MODAL - 2).setInteractive()));
      g.add(panel(this, 20, 14, W - 40, H - 28, { depth: DEPTH.MODAL - 1, fixed: true }));
      g.add(txt(this, W / 2, 20, `${a.name} 치료하기`, { size: 14, origin: [0.5, 0], color: COLORS.yellow, depth: DEPTH.MODAL, fixed: true }));
      const hint = g.add(txt(this, W / 2, 40, Data.fmt(Data.dialogues.injured.how), { size: 11, origin: [0.5, 0], align: 'center', depth: DEPTH.MODAL, fixed: true, lineSpacing: 3 }));
      const big = g.add(fix(img(this, W / 2, 170, a.sprite).setScale(5 / PX).setOrigin(0.5, 1).setDepth(DEPTH.MODAL)));
      const spots = [[-12, -58], [16, -40], [-6, -18]]; // 몸 위 상처 위치 (3곳)
      let i = 0;
      const bandages = [];
      const next = () => {
        if (i >= spots.length) { finish(); return; }
        const [dx, dy] = spots[i];
        const wound = this.add.circle(big.x + dx, big.y + dy, 7, 0xff4d6d, 0.9).setDepth(DEPTH.MODAL + 1).setScrollFactor(0).setStrokeStyle(1, 0xffffff);
        const hit = this.add.circle(big.x + dx, big.y + dy, 16, 0xffffff, 0.001).setDepth(DEPTH.MODAL + 2).setScrollFactor(0).setInteractive();
        const tw = this.tweens.add({ targets: wound, scale: 1.4, alpha: 0.5, duration: 400, yoyo: true, repeat: -1 });
        g.add(wound); g.add(hit);
        hit.once('pointerdown', () => {
          tw.stop(); wound.destroy(); hit.destroy();
          Audio.sfx('chest');
          const b = this.add.rectangle(big.x + dx, big.y + dy, 16, 7, 0xfff4e0).setStrokeStyle(1, 0x1b1b2a).setAngle(-25).setDepth(DEPTH.MODAL + 1).setScrollFactor(0);
          g.add(b); bandages.push(b);
          this.tweens.add({ targets: big, x: big.x + 3, duration: 50, yoyo: true, repeat: 1 });
          hint.setText(i + 1 >= spots.length ? '다 감았어요!' : `잘했어요! ${spots.length - i - 1}곳 남았어요`);
          i += 1; this.time.delayedCall(250, next);
        });
      };
      const finish = async () => {
        Audio.sfx('purify');
        for (let k = 0; k < 8; k++) { const p = img(this, big.x + Phaser.Math.Between(-40, 40), big.y - Phaser.Math.Between(0, 80), 'star').setScale(0.6 / PX).setDepth(DEPTH.MODAL + 3).setScrollFactor(0); g.add(p); this.tweens.add({ targets: p, y: p.y - 20, alpha: 0, duration: 700, delay: k * 60 }); }
        this.tweens.add({ targets: big, y: big.y - 12, duration: 150, yoyo: true, repeat: 2 });
        await wait(this, 900);
        g.destroy();
        GameState.healAnimal(obj.animal);
        GameState.s.flags.healed[obj.key] = true;
        GameState.save();
        if (obj.bubble) obj.bubble.destroy();
        await this.dialog.show([Data.fmt(Data.dialogues.injured.done).replace(/\{name\}/g, a.name)]);
        // 친구가 되어 뛰어감
        obj.sprite.setAngle(0).setAlpha(1);
        this.blocked.delete(obj.x + ',' + obj.y);
        this.objects = this.objects.filter(o => o !== obj);
        await tween(this, { targets: obj.sprite, x: obj.sprite.x + 40, y: obj.sprite.y - 6, alpha: 0, duration: 600 });
        obj.sprite.destroy();
        resolve();
      };
      next();
    });
  }

  // ---------- 적 ----------
  update(time, delta) {
    if (this.transitioning || !this.enemies) return;
    const dialogOpen = this.dialog && this.dialog.open;
    for (const en of this.enemies) {
      if (!en.moving && !this.busy) {
        en.timer -= delta;
        if (en.timer <= 0) this.wander(en);
      }
      // 접촉 → 전투
      if (!this.busy && !dialogOpen && time > this.safeUntil) {
        const dx = en.sprite.x - this.hero.x, dy = (en.sprite.y - 8) - (this.hero.y - 10);
        if (Math.abs(dx) < 11 && Math.abs(dy) < 11) { this.startBattle(en.group, en.key, false); return; }
      }
    }
  }
  wander(en) {
    en.timer = Phaser.Math.Between(900, 2200);
    let dirs = Phaser.Utils.Array.Shuffle(DIRS.slice());
    // 가까우면(5칸 안) 절반 확률로 주인공 쪽으로
    const ddx = this.tx - en.tx, ddy = this.ty - en.ty;
    if (Math.abs(ddx) + Math.abs(ddy) <= 5 && Math.random() < 0.5) {
      dirs = Math.abs(ddx) > Math.abs(ddy) ? [[Math.sign(ddx), 0], ...dirs] : [[0, Math.sign(ddy)], ...dirs];
    }
    for (const [dx, dy] of dirs) {
      const nx = en.tx + dx, ny = en.ty + dy;
      if (!this.walkable(nx, ny) || this.exits[nx + ',' + ny]) continue;
      if (this.enemies.some(o => o !== en && o.tx === nx && o.ty === ny)) continue;
      en.moving = true; en.tx = nx; en.ty = ny;
      en.sprite.setFlipX(dx < 0);
      const wp = this.tileToWorld(nx, ny);
      this.tweens.add({ targets: en.sprite, x: wp.x, y: wp.y + 8, duration: 650, ease: 'Linear', onUpdate: () => en.sprite.setDepth(wd(en.sprite.y)), onComplete: () => { en.moving = false; } });
      return;
    }
  }

  async startBattle(group, enemyKey, isBoss) {
    if (this.transitioning) return;
    this.transitioning = true; this.busy = true;
    this.tweens.killTweensOf(this.hero);
    Audio.sfx('encounter');
    this.cameras.main.flash(200, 255, 255, 255);
    this.cameras.main.shake(200, 0.01);
    await wait(this, 350);
    GameState.setLocation({ scene: 'Field', stageId: this.p.stageId, mapId: this.p.mapId, x: this.tx, y: this.ty });
    this.scene.start('Battle', { enemies: group, enemyKey, stageId: this.p.stageId, mapId: this.p.mapId, x: this.tx, y: this.ty, boss: isBoss });
  }

  // ---------- 메뉴 ----------
  openMenu() {
    if (this.busy || this.transitioning) return;
    this.busy = true; this.path = [];
    const g = new UIGroup(); this.menu = g;
    g.add(fix(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(DEPTH.MODAL - 2).setInteractive()));
    g.add(panel(this, 8, 8, W - 16, H - 16, { depth: DEPTH.MODAL - 1, fixed: true }));
    g.add(txt(this, W / 2, 14, '메뉴', { size: 14, origin: [0.5, 0], color: COLORS.yellow, depth: DEPTH.MODAL, fixed: true }));
    this.menuInfo = g.add(txt(this, 16, 34, '', { size: 11, depth: DEPTH.MODAL, fixed: true, color: '#b8c0e0' }));
    this.menuRows = new UIGroup(); this.menuItems = new UIGroup();
    g.add(new Button(this, W - 70, H - 36, 58, 24, '닫기', () => this.closeMenu(), { depth: DEPTH.MODAL, fixed: true, color: 0x555577 }));
    g.add(new Button(this, 16, H - 36, 110, 24, '마을로 돌아가기', async () => {
      const ok = await confirm(this, '마을로 돌아갈까요?', '네', '아니요', { fixed: true });
      if (!ok) return;
      this.closeMenu(); this.transitioning = true;
      await fadeOut(this); this.scene.start('Village', {});
    }, { depth: DEPTH.MODAL, fixed: true }));
    this.selectedItem = null;
    this.renderMenu();
  }
  renderMenu() {
    this.menuRows.destroy(); this.menuRows = new UIGroup(); this.menuItems.destroy(); this.menuItems = new UIGroup();
    const s = GameState.s, units = GameState.partyUnits();
    this.menuInfo.setText(this.selectedItem ? `${Data.item(this.selectedItem).name} → 누구에게 쓸까요?` : '아이템을 고르면 친구에게 쓸 수 있어요.');
    units.forEach((u, i) => {
      const y = 50 + i * 26;
      const lvl = u.kind === 'player' ? s.player.level : s.animals[u.animalId].level;
      const b = this.menuRows.add(new Button(this, 16, y, 150, 22, '', () => this.useItemOn(u), { depth: DEPTH.MODAL, fixed: true, color: this.selectedItem ? 0x2e5a3a : 0x3d4066 }));
      b.label.setOrigin(0, 0.5).setPosition(22 + FIX_X, y + 11 + FIX_Y).setText(`${u.name} Lv${lvl}`);
      if (!this.selectedItem) b.setEnabled(false);
      this.menuRows.add(txt(this, 172, y + 2, `HP ${u.hp}/${u.maxHp}`, { size: 11, depth: DEPTH.MODAL, fixed: true, strokeThickness: 1 }));
      this.menuRows.add(txt(this, 172, y + 12, `MP ${u.mp}/${u.maxMp}`, { size: 11, depth: DEPTH.MODAL, fixed: true, strokeThickness: 1, color: '#9ecbff' }));
    });
    // 아이템 (오른쪽 열)
    const items = GameState.itemList().filter(it => ['heal', 'mp', 'heal_all'].includes(it.type));
    items.slice(0, 5).forEach((it, i) => {
      const y = 50 + i * 26;
      const b = this.menuItems.add(new Button(this, 236, y, 72, 22, `${it.name} ${it.n}`, () => { this.selectedItem = this.selectedItem === it.id ? null : it.id; this.renderMenu(); },
        { depth: DEPTH.MODAL, fixed: true, color: this.selectedItem === it.id ? COLORS.ok : 0x4a6fa5 }));
    });
    if (!items.length) this.menuItems.add(txt(this, 272, 60, '아이템 없음', { size: 11, origin: 0.5, depth: DEPTH.MODAL, fixed: true, color: '#8890aa' }));
  }
  useItemOn(u) {
    const id = this.selectedItem; if (!id) return;
    const it = Data.item(id), s = GameState.s;
    const target = u.kind === 'player' ? s.player : s.animals[u.animalId];
    if (it.type === 'heal') { if (u.hp >= u.maxHp) { toast(this, '이미 건강해요!', { fixed: true }); return; } target.hp = Math.min(u.maxHp, target.hp + it.power); }
    else if (it.type === 'mp') { if (u.mp >= u.maxMp) { toast(this, 'MP가 가득해요!', { fixed: true }); return; } target.mp = Math.min(u.maxMp, target.mp + it.power); }
    else if (it.type === 'heal_all') { for (const x of GameState.partyUnits()) { const t = x.kind === 'player' ? s.player : s.animals[x.animalId]; t.hp = Math.min(x.maxHp, t.hp + it.power); } }
    else return;
    GameState.useItem(id); Audio.sfx('heal');
    if (!s.inventory[id]) this.selectedItem = null;
    this.refreshHp(); this.renderMenu(); GameState.save();
  }
  closeMenu() { if (this.menuRows) this.menuRows.destroy(); if (this.menuItems) this.menuItems.destroy(); if (this.menu) this.menu.destroy(); this.menu = null; this.busy = false; }
}
