// 마을: 숲처럼 걸어 다니는 큰 지도. 여관 / 상점 / 대장간 / 현자의 집 / 동물 쉼터 / 우리 집 / 숲 입구
import { W, H, COLORS, TILE, SOLID_TILES, wd, PX } from '../config.js';
import Data from '../systems/Data.js';
import GameState from '../systems/GameState.js';
import Audio from '../systems/Audio.js';
import { txt, Button, panel, UIGroup, DialogBox, confirm, toast, soundButton, fadeIn, fadeOut, tween, DEPTH, setupCamera } from '../systems/UI.js';
import { makeCharacter, buildTilemap, img, unit, setPose, face, retexture } from '../systems/Assets.js';

// 마을 지도: 40 x 28 칸. 건물은 가로 3칸 x 세로 2칸을 차지하고, 문은 바로 아래 칸.
const GW = 40, GH = 28;
const BUILDINGS = [
  { key: 'inn',     name: '여관',      bx: 8,  by: 4 },
  { key: 'shop',    name: '상점',      bx: 15, by: 4 },
  { key: 'smithy',  name: '대장간',    bx: 25, by: 4 },
  { key: 'sage',    name: '현자의 집', bx: 33, by: 4 },
  { key: 'shelter', name: '동물 쉼터', bx: 8,  by: 18 },
  { key: 'home',    name: '우리 집',   bx: 26, by: 18 },
  { key: 'gate',    name: '숲 입구',   bx: 36, by: 12 },
];
// 꾸밈 (가구 그림 재사용): [그림, 칸 x, 칸 y, 가로 칸, 세로 칸]
const DECOR = [
  ['f_bench', 10, 12, 2, 1], ['f_bench', 3, 12, 2, 1], ['f_swing', 31, 22, 2, 2], ['f_flowerbed', 22, 18, 2, 1], ['f_flowerbed', 29, 18, 2, 1],
  ['f_birdhouse', 15, 22, 1, 2], ['f_tree_small', 34, 17, 2, 2], ['f_bench', 18, 10, 2, 1], ['f_flowerbed', 21, 10, 2, 1], ['f_pond', 34, 22, 2, 1],
];
const CHESTS = [{ x: 3, y: 3, item: 'potion_s', count: 2 }, { x: 37, y: 25, item: 'snack', count: 2 }, { x: 2, y: 25, item: 'berry', count: 1 }];
const SPAWN = { x: 20, y: 13 };
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// 지도 만들기 (타일 번호는 config.js 의 TILE_LEGEND 와 같음: 0 풀, 1 나무, 3 물, 4 꽃, 8 돌바닥, 10 덤불, 11 흙길)
function makeGrid() {
  const g = Array.from({ length: GH }, () => Array(GW).fill(0));
  const set = (x0, y0, x1, y1, t) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = t; };
  // 풀밭에 꽃·나무·덤불 뿌리기 (항상 같은 모양이 되게 정해진 난수)
  let seed = 20261114; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
    const r = rnd(), pasture = y >= 22 && y <= 25 && x >= 3 && x <= 14;
    if (r < 0.08) g[y][x] = 4; else if (!pasture && r < 0.13) g[y][x] = 1; else if (!pasture && r < 0.15) g[y][x] = 10;
  }
  set(0, 0, GW - 1, 0, 1); set(0, GH - 1, GW - 1, GH - 1, 1); set(0, 0, 0, GH - 1, 1); set(GW - 1, 0, GW - 1, GH - 1, 1);
  set(5, 9, 8, 11, 3);                         // 연못
  set(4, 12, 9, 12, 0); set(4, 8, 4, 12, 0); set(9, 8, 9, 12, 0); set(4, 8, 9, 8, 0); // 연못 둘레는 걸을 수 있게
  set(3, 22, 14, 25, 0); for (const [x, y] of [[4, 23], [7, 24], [10, 22], [12, 25], [13, 23]]) g[y][x] = 4; // 쉼터 풀밭
  set(3, 7, 36, 7, 11); set(20, 7, 20, 20, 11); set(4, 13, 17, 13, 11); set(12, 13, 12, 20, 11); set(5, 20, 30, 20, 11); set(23, 14, 36, 14, 11);
  set(30, 20, 30, 24, 11); set(30, 24, 36, 24, 11); // 동쪽 꽃밭 놀이터 가는 길
  set(17, 11, 23, 15, 8);                      // 광장
  for (const b of BUILDINGS) {
    set(b.bx - 1, b.by - 2, b.bx + 1, b.by, 0); // 건물 자리와 지붕 위는 비운다
    const to = b.by < 7 ? 7 : b.key === 'gate' ? 14 : 20;
    set(b.bx, b.by + 1, b.bx, to, 11);         // 문 앞길
  }
  for (const [, x, y, w, h] of DECOR) set(x, y - 1, x + w - 1, y + h - 1, 0);
  for (const c of CHESTS) { set(c.x - 1, c.y - 1, c.x + 1, c.y + 1, 0); }
  set(3, 3, 3, 7, 0); set(37, 24, 37, 25, 0); set(2, 20, 5, 20, 11); set(2, 20, 2, 25, 0); // 상자까지 가는 길
  set(0, 0, GW - 1, 0, 1); set(0, GH - 1, GW - 1, GH - 1, 1); set(0, 0, 0, GH - 1, 1); set(GW - 1, 0, GW - 1, GH - 1, 1);
  return g;
}

export default class VillageScene extends Phaser.Scene {
  constructor() { super('Village'); }
  init(data) { this.params = data || {}; }

  create() {
    // 카메라 두 대: 아래는 그레이스를 따라다니는 마을 카메라, 위는 움직이지 않는 화면(UI) 카메라
    setupCamera(this);
    const mapW = GW * TILE, mapH = GH * TILE;
    this.wcam = this.cameras.add(0, 0);
    this.wcam.setZoom(PX).setRoundPixels(true).setBounds(0, 0, mapW, mapH);
    const cams = this.cameras.cameras; cams.splice(cams.indexOf(this.wcam), 1); cams.unshift(this.wcam);
    this.worldMode = false;
    const sort = (obj) => { (this.worldMode ? this.cameras.main : this.wcam).ignore(obj); };
    this.events.on('addedtoscene', sort);
    this.events.once('shutdown', () => this.events.off('addedtoscene', sort));
    fadeIn(this);
    // 씬 인스턴스가 재사용되므로 상태 초기화
    this.busy = false; this.panelGroup = null; this.listGroup = null; this.moneyText = null; this.leaving = false;
    this.path = []; this.moving = false; this.pending = null; this.marker = null; this.dog = null; this.nextTile = null;
    Audio.playBgm('village');
    const s = GameState.s;
    GameState.setLocation({ scene: 'Village' });
    if (this.params.wokeAtInn) GameState.healAll();
    GameState.save();

    this.world(() => {
      // 바닥
      this.grid = makeGrid();
      buildTilemap(this, this.grid, 0, 0);
      this.blocked = new Set(); this.objects = []; this.doors = {};
      const block = (x0, y0, w, h) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.blocked.add(x + ',' + y); };

      // 건물
      this.buildings = {};
      for (const b of BUILDINGS) {
        const x = b.bx * TILE + TILE / 2, y = (b.by + 1) * TILE;
        const im = img(this, x, y, 'bld_' + b.key).setOrigin(0.5, 1).setDepth(wd(y));
        im.setInteractive({ useHandCursor: true });
        im.on('pointerup', (pointer) => { if (!this.busy && pointer.getDistance() <= 10 * PX) this.goTo(b); });
        const label = txt(this, x, y + 1, b.name, { size: 11, origin: [0.5, 0], depth: DEPTH.WORLD_UI });
        this.buildings[b.key] = { ...b, x, y, img: im, label, door: [b.bx, b.by + 1] };
        block(b.bx - 1, b.by - 1, 3, 2);
        this.doors[b.bx + ',' + (b.by + 1)] = b.key;
      }
      // 꾸밈
      for (const [key, x, y, w, h] of DECOR) {
        if (!this.textures.exists(key)) continue;
        const wy = (y + h) * TILE;
        img(this, x * TILE, wy, key).setOrigin(0, 1).setDepth(wd(wy - 1));
        block(x, y, w, h);
      }
      // 보물 상자
      for (const c of CHESTS) {
        const key = `village:${c.x},${c.y}`, wp = this.tileToWorld(c.x, c.y);
        const obj = { ...c, type: 'chest', key, opened: !!s.flags.chests[key] };
        obj.sprite = img(this, wp.x, wp.y, obj.opened ? 'chest_open' : 'chest').setDepth(wd(wp.y));
        this.blocked.add(c.x + ',' + c.y); this.makeTappable(obj.sprite, () => this.approach(obj)); this.objects.push(obj);
      }
      // 안내 동물 반디 (광장)
      {
        const obj = { type: 'guide', x: 22, y: 12 }, wp = this.tileToWorld(obj.x, obj.y);
        this.guide = obj.sprite = unit(this, wp.x, wp.y + 8, 'guide').setOrigin(0.5, 1).setDepth(wd(wp.y + 8));
        this.tweens.add({ targets: this.guide, y: this.guide.y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        txt(this, wp.x, wp.y + 9, Data.strings.guideAnimal, { size: 11, origin: [0.5, 0], color: COLORS.yellow, depth: DEPTH.WORLD_UI });
        this.blocked.add(obj.x + ',' + obj.y); this.makeTappable(obj.sprite, () => this.approach(obj)); this.objects.push(obj);
      }
      // 쉼터 풀밭: 함께 다니지 않는 친구들이 놀고 있어요
      this.spawnPasture();

      // 주인공
      const at = this.params.openAnimal ? 'shelter' : this.params.wokeAtInn ? 'inn' : this.params.at;
      const start = this.buildings[at] ? this.buildings[at].door : [SPAWN.x, SPAWN.y];
      this.tx = start[0]; this.ty = start[1];
      const wp = this.tileToWorld(this.tx, this.ty);
      this.hero = makeCharacter(this, wp.x, wp.y + 8, s.player.look); this.hero.setDepth(wd(this.hero.y));
      this.wcam.startFollow(this.hero, true, 1, 1);
      // 밀꾸가 함께 다니면 마을에서 그레이스 뒤를 졸졸 따라온다
      this.refreshDog();
    });

    // HUD
    this.hud = new UIGroup();
    this.hud.add(panel(this, 2, 2, 150, 18, { color: 0x000000, alpha: 0.55, border: false }));
    this.hudText = this.hud.add(txt(this, 6, 4, '', { size: 11 }));
    this.tip = txt(this, W / 2, H - 14, '가고 싶은 곳을 탭하세요', { size: 11, origin: 0.5, color: '#fff4d6' });
    this.tweens.add({ targets: this.tip, alpha: 0, delay: 3500, duration: 800 });
    soundButton(this);
    this.dialog = new DialogBox(this);
    this.refreshHud();

    // 땅을 탭하면 그곳으로 걸어간다
    this.input.on('pointerup', (pointer, over) => {
      if (this.busy || this.leaving) return;
      if (pointer.getDistance() > 10 * PX) return;
      if (over && over.length) return;
      const p = this.wcam.getWorldPoint(pointer.x, pointer.y);
      this.tapTile(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
    });

    // 미니게임에서 돌아왔으면 쉼터 앞에 서서 그 동물 화면을 다시 연다
    if (this.params.openAnimal && s.animals[this.params.openAnimal]) this.openAnimalDetail(this.params.openAnimal);
    // 환영 / 여관에서 깨어남
    if (this.params.wokeAtInn) this.say(Data.dialogues.lose.map(Data.fmt.bind(Data)));
    else if (this.params.welcome) this.say(Data.dialogues.villageWelcome.map(Data.fmt.bind(Data)));
    else if (this.params.cleared) { const st = Data.stage(this.params.cleared); this.say(Data.dialogues.stageClear.map(l => Data.fmt(l, { stage: st ? st.name : '숲' }))); }
  }

  // 마을 안(움직이는 카메라)에 놓이는 것을 만들 때 감싼다. 감싸지 않으면 화면에 고정된 UI 가 된다.
  world(fn) { const prev = this.worldMode; this.worldMode = true; try { return fn(); } finally { this.worldMode = prev; } }
  tileToWorld(x, y) { return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 }; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < GW && y < GH; }
  walkable(x, y) { return this.inBounds(x, y) && !SOLID_TILES.has(this.grid[y][x]) && !this.blocked.has(x + ',' + y); }
  makeTappable(sprite, fn) {
    sprite.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-6 * PX, -6 * PX, sprite.width + 12 * PX, sprite.height + 12 * PX), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    sprite.on('pointerup', (pointer) => { if (!this.busy && pointer.getDistance() <= 10 * PX) fn(); });
  }
  spawnPasture() {
    const s = GameState.s, ids = Object.keys(s.animals).filter(id => !s.party.includes(id)).slice(0, 6);
    const spots = [[5, 23], [9, 24], [12, 22], [7, 22], [13, 25], [4, 25]];
    ids.forEach((id, i) => {
      const [gx, gy] = spots[i], x = gx * TILE + 8, y = (gy + 1) * TILE;
      const sp = unit(this, x, y, GameState.animalSprite(id)).setOrigin(0.5, 1).setDepth(wd(y)); setPose(sp, 'move');
      const dx = Phaser.Math.Between(10, 22) * (i % 2 ? -1 : 1); face(sp, dx, 0);
      this.tweens.add({ targets: sp, x: x + dx, duration: Phaser.Math.Between(1800, 3000), yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 250,
        onYoyo: () => face(sp, -dx, 0), onRepeat: () => face(sp, dx, 0) });
      this.makeTappable(sp, () => { Audio.sfx('tap'); toast(this, `${GameState.animalName(id)}  ${'♥'.repeat(GameState.hearts(id))}`, { y: 60 }); });
    });
  }

  refreshHud() {
    const s = GameState.s;
    this.hudText.setText(`★${Data.strings.money} ${s.stardust}   ◆${Data.strings.shard} ${s.shards}`);
  }
  async say(lines) { this.busy = true; await this.dialog.show(lines); this.busy = false; }
  async guideHint() {
    if (this.busy) return;
    const s = GameState.s, M = Data.dialogues.milkku;
    // 밀꾸가 침대 밑에 숨어 있으면 그 힌트부터
    if (GameState.milkkuHiding()) return this.say([Data.fmt(M.hintHiding)]);
    // 집에 침대가 없으면 세 번에 한 번 침대를 권한다 (보통 힌트 차례는 건너뛰지 않음)
    if (!s.animals.milkku && !GameState.hasBed() && s.day >= 3) {
      s.flags.bedHint = ((s.flags.bedHint || 0) + 1) % 3;
      if (s.flags.bedHint === 1) return this.say([Data.fmt(M.hintBed)]);
    }
    const hints = Data.dialogues.guideHints; const i = (s.flags.hintIndex || 0) % hints.length;
    s.flags.hintIndex = (i + 1) % hints.length;
    await this.say([Data.fmt(hints[i])]);
  }
  // 밀꾸가 함께 다니면 그레이스 곁에 나타나고, 쉼터에서 쉬게 하면 사라진다. 씻어서 하얘지면 그림도 바뀐다.
  refreshDog() {
    const s = GameState.s, want = !!(s.animals.milkku && s.party.includes('milkku'));
    if (!want) { if (this.dog) { this.tweens.killTweensOf(this.dog); this.dog.destroy(); this.dog = null; } return; }
    const key = GameState.animalSprite('milkku');
    if (this.dog) { if (this.dog.animKey !== key) retexture(this.dog, key); return; }
    this.world(() => {
      const x = this.hero.x - 12, y = this.hero.y + 2;
      this.dog = unit(this, x, y, key).setOrigin(0.5, 1).setDepth(wd(y));
      this.dog.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-6 * PX, -6 * PX, 28 * PX, 28 * PX), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
      this.dog.on('pointerup', () => this.dogBark());
    });
  }
  dogBark() {
    if (!this.dog || this.busy) return;
    Audio.sfx('tap');
    this.world(() => {
      const t = txt(this, this.dog.x, this.dog.y - 20, Data.dialogues.milkku.bark, { size: 11, origin: 0.5, depth: DEPTH.WORLD_UI });
      this.tweens.add({ targets: t, y: t.y - 10, alpha: 0, duration: 700, onComplete: () => t.destroy() });
    });
    if (!this.tweens.isTweening(this.dog)) this.tweens.add({ targets: this.dog, y: this.dog.y - 6, duration: 110, yoyo: true });
  }
  // 밀꾸는 그레이스가 방금 있던 자리로 한 걸음 늦게 따라온다
  dogFollow(x, y, last) {
    const d = this.dog; if (!d) return;
    if (Math.abs(x - d.x) + Math.abs(y - d.y) < 1) return;
    face(d, x - d.x, y - d.y); setPose(d, 'move');
    this.tweens.killTweensOf(d);
    this.tweens.add({ targets: d, x, y, duration: 170, ease: 'Linear', onUpdate: () => d.setDepth(wd(d.y - 0.5)),
      onComplete: () => { if (last && d.active) setPose(d, 'idle'); } });
  }

  // ---------- 걷기 (숲과 같은 방식: 탭한 칸까지 길 찾기) ----------
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
  here() { return this.moving && this.nextTile ? this.nextTile : [this.tx, this.ty]; }
  walk(path, pending, mx, my) {
    this.pending = pending || null;
    this.showMarker(mx, my);
    this.path = path;
    if (!this.moving) this.stepNext();
  }
  tapTile(gx, gy) {
    if (!this.inBounds(gx, gy)) return;
    const obj = this.objects.find(o => o.x === gx && o.y === gy);
    if (obj) return this.approach(obj);
    if (!this.walkable(gx, gy)) { Audio.sfx('error'); return; }
    const path = this.bfs(this.here(), (x, y) => x === gx && y === gy);
    if (!path) { Audio.sfx('error'); return; }
    const door = this.doors[gx + ',' + gy];
    this.walk(path, door ? { door } : null, gx, gy);
  }
  approach(obj) {
    const from = this.here(), adjacent = (x, y) => Math.abs(x - obj.x) + Math.abs(y - obj.y) === 1;
    if (adjacent(from[0], from[1]) && !this.moving) return this.interact(obj);
    const path = this.bfs(from, adjacent);
    if (!path) { Audio.sfx('error'); return; }
    this.walk(path, { obj }, obj.x, obj.y);
  }
  // 건물을 탭하면 문 앞까지 걸어가서 들어간다
  goTo(b) {
    if (this.busy) return;
    Audio.sfx('tap');
    const B = this.buildings[b.key], [dx, dy] = B.door, from = this.here();
    if (from[0] === dx && from[1] === dy && !this.moving) return this.openFacility(b.key);
    const path = this.bfs(from, (x, y) => x === dx && y === dy);
    if (!path) { Audio.sfx('error'); return; }
    this.walk(path, { door: b.key }, dx, dy);
  }
  showMarker(gx, gy) {
    this.world(() => {
      const wp = this.tileToWorld(gx, gy);
      if (this.marker) this.marker.destroy();
      const m = this.marker = this.add.rectangle(wp.x, wp.y, TILE, TILE, 0xffffff, 0).setStrokeStyle(1, 0xffffff, 0.9).setDepth(DEPTH.WORLD_UI);
      this.tweens.add({ targets: m, alpha: 0, duration: 700, onComplete: () => { m.destroy(); if (this.marker === m) this.marker = null; } });
    });
  }
  stepNext() {
    if (this.leaving || this.busy) { this.path = []; this.moving = false; setPose(this.hero, 'idle'); if (this.dog) setPose(this.dog, 'idle'); return; }
    if (!this.path.length) { this.moving = false; setPose(this.hero, 'idle'); this.arrive(); return; }
    const [nx, ny] = this.path.shift();
    if (!this.walkable(nx, ny)) { this.path = []; this.moving = false; setPose(this.hero, 'idle'); return; }
    this.moving = true; this.nextTile = [nx, ny];
    let sx = nx - this.tx, sy = ny - this.ty, px = nx, py = ny;
    for (const [qx, qy] of this.path.slice(0, 2)) { sx += qx - px; sy += qy - py; px = qx; py = qy; }
    face(this.hero, sx === 0 ? nx - this.tx : sx, sy);
    this.dogFollow(this.hero.x, this.hero.y, !this.path.length);
    const wp = this.tileToWorld(nx, ny);
    this.tweens.add({ targets: this.hero, x: wp.x, y: wp.y + 8, duration: 150, ease: 'Linear',
      onUpdate: () => { this.hero.setDepth(wd(this.hero.y)); },
      onComplete: () => { this.tx = nx; this.ty = ny; this.stepNext(); } });
    setPose(this.hero, 'move');
  }
  arrive() {
    const p = this.pending; this.pending = null;
    if (!p) return;
    if (p.door && this.doors[this.tx + ',' + this.ty] === p.door) return this.openFacility(p.door);
    if (p.obj && Math.abs(p.obj.x - this.tx) + Math.abs(p.obj.y - this.ty) === 1) this.interact(p.obj);
  }
  interact(obj) {
    face(this.hero, obj.x - this.tx, obj.y - this.ty);
    if (obj.type === 'guide') return this.guideHint();
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
    }
  }

  // ---------- 공통 패널 ----------
  openPanel(title) {
    this.busy = true;
    if (this.listGroup) this.listGroup.destroy(); if (this.panelGroup) this.panelGroup.destroy();
    const g = new UIGroup();
    g.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(DEPTH.MODAL - 2).setInteractive());
    g.add(panel(this, 8, 8, W - 16, H - 16, { depth: DEPTH.MODAL - 1 }));
    g.add(txt(this, W / 2, 16, title, { size: 14, origin: [0.5, 0], color: COLORS.yellow, depth: DEPTH.MODAL }));
    g.add(new Button(this, W - 70, H - 36, 58, 24, '나가기', () => this.closePanel(), { depth: DEPTH.MODAL, color: 0x555577 }));
    this.moneyText = g.add(txt(this, 16, H - 30, '', { size: 11, depth: DEPTH.MODAL }));
    this.panelGroup = g; this.listGroup = new UIGroup(); this.page = 0;
    this.updateMoney();
    return g;
  }
  updateMoney() { const s = GameState.s; if (this.moneyText && this.moneyText.active) this.moneyText.setText(`★${s.stardust}  ◆${s.shards}`); this.refreshHud(); }
  closePanel() {
    if (this.listGroup) this.listGroup.destroy(); if (this.panelGroup) this.panelGroup.destroy();
    this.listGroup = null; this.panelGroup = null; this.busy = false; GameState.save();
    this.refreshDog(); // 쉼터에서 함께 가기/쉬게 하기를 바꿨을 수 있다
  }
  // rows: [{label, right, sub, onTap, enabled, color}] 5줄씩 페이지
  renderList(rows, perPage = 5) {
    this.listGroup.destroy(); this.listGroup = new UIGroup();
    const g = this.listGroup, top = 36, rowH = 30;
    const pages = Math.max(1, Math.ceil(rows.length / perPage));
    this.page = Math.min(this.page, pages - 1);
    const slice = rows.slice(this.page * perPage, this.page * perPage + perPage);
    if (!rows.length) g.add(txt(this, W / 2, 100, '아직 아무것도 없어요.', { size: 11, origin: 0.5, depth: DEPTH.MODAL }));
    slice.forEach((r, i) => {
      const y = top + i * rowH;
      const b = g.add(new Button(this, 16, y, W - 32, rowH - 4, '', r.onTap, { depth: DEPTH.MODAL, color: r.color ?? 0x3d4066 }));
      b.label.setOrigin(0, 0.5).setPosition(24, y + (rowH - 4) / 2 - (r.sub ? 5 : 0)).setText(r.label);
      if (r.sub) g.add(txt(this, 24, y + 15, r.sub, { size: 11, color: '#b8c0e0', depth: DEPTH.MODAL + 1, strokeThickness: 1 }));
      if (r.right) g.add(txt(this, W - 24, y + (rowH - 4) / 2, r.right, { size: 11, origin: [1, 0.5], color: r.rightColor || COLORS.yellow, depth: DEPTH.MODAL + 1 }));
      if (r.enabled === false) b.setEnabled(false);
    });
    if (pages > 1) {
      g.add(new Button(this, W / 2 - 60, H - 36, 40, 24, '◀', () => { this.page = (this.page + pages - 1) % pages; this.renderList(rows, perPage); }, { depth: DEPTH.MODAL }));
      g.add(txt(this, W / 2, H - 24, `${this.page + 1}/${pages}`, { size: 11, origin: 0.5, depth: DEPTH.MODAL }));
      g.add(new Button(this, W / 2 + 20, H - 36, 40, 24, '▶', () => { this.page = (this.page + 1) % pages; this.renderList(rows, perPage); }, { depth: DEPTH.MODAL }));
    }
  }

  openFacility(key) {
    switch (key) {
      case 'inn': return this.openInn();
      case 'shop': return this.openShop();
      case 'smithy': return this.openSmithy();
      case 'sage': return this.openSage();
      case 'shelter': return this.openShelter();
      case 'gate': return this.openGate();
      case 'home': return this.goHome();
    }
  }

  // ---------- 여관 ----------
  async openInn() {
    this.busy = true;
    const ok = await confirm(this, '여관에서 쉬어 갈까요?\n(모두 회복 + 저장, 무료)', '쉬기', '아니요');
    if (ok) {
      await fadeOut(this, 300);
      GameState.healAll(); GameState.save();
      fadeIn(this, 300);
      Audio.sfx('heal');
      await this.dialog.show([Data.fmt(Data.dialogues.innRest)]);
    }
    this.busy = false;
  }

  // ---------- 상점 ----------
  openShop() {
    this.openPanel('상점');
    const render = () => {
      const s = GameState.s;
      const rows = Object.entries(Data.items).filter(([, it]) => it.shop).map(([id, it]) => ({
        label: `${it.name}  (가진 것 ${s.inventory[id] || 0})`, sub: it.desc, right: `★${it.price}`,
        enabled: s.stardust >= it.price,
        onTap: () => { s.stardust -= it.price; GameState.addItem(id, 1); Audio.sfx('chest'); toast(this, `${it.name}을(를) 샀어요!`); this.updateMoney(); render(); },
      }));
      this.renderList(rows);
    };
    render();
  }

  // ---------- 대장간 ----------
  openSmithy() {
    this.openPanel('대장간');
    const slotName = { weapon: '무기', armor: '옷', bracelet: '팔찌' };
    const render = () => {
      const s = GameState.s;
      const order = { weapon: 0, armor: 1, bracelet: 2 };
      const rows = Object.entries(Data.equipment).sort((a, b) => order[a[1].slot] - order[b[1].slot] || a[1].price - b[1].price).map(([id, e]) => {
        const equipped = s.player.equip[e.slot] === id, owned = s.ownedEquip.includes(id);
        return {
          label: `[${slotName[e.slot]}] ${e.name}${equipped ? ' ✓' : ''}`, sub: e.desc,
          right: equipped ? '착용 중' : owned ? '바꾸기' : `★${e.price}`, rightColor: equipped ? '#7ee081' : COLORS.yellow,
          color: equipped ? 0x2e5a3a : 0x3d4066,
          enabled: !equipped && (owned || s.stardust >= e.price),
          onTap: () => {
            if (!owned) { s.stardust -= e.price; s.ownedEquip.push(id); Audio.sfx('chest'); toast(this, `${e.name}을(를) 만들었어요!`); }
            else Audio.sfx('defend');
            s.player.equip[e.slot] = id;
            if (e.slot === 'weapon') this.hero.setWeapon(id);
            const st = GameState.playerStats(); s.player.hp = Math.min(s.player.hp, st.hp); s.player.mp = Math.min(s.player.mp, st.mp);
            this.updateMoney(); render();
          },
        };
      });
      this.renderList(rows);
    };
    render();
  }

  // ---------- 현자의 집 ----------
  openSage() {
    this.openPanel('현자의 집');
    const render = () => {
      const s = GameState.s;
      const owners = [{ id: 'player', name: s.player.name, skills: Data.player.skills }];
      for (const id of Object.keys(s.animals)) owners.push({ id, name: GameState.animalName(id), skills: Data.animal(id).skills });
      const rows = [];
      for (const o of owners) for (const sk of o.skills) {
        const lv = GameState.skillLevel(o.id, sk), data = Data.skill(sk), cost = lv; // 1→2: 1개, 2→3: 2개
        const max = lv >= 3;
        rows.push({
          label: `${o.name} - ${data.name}  Lv${lv}`, sub: data.desc,
          right: max ? '최고!' : `◆${cost}`, rightColor: max ? '#7ee081' : COLORS.yellow,
          enabled: !max && s.shards >= cost,
          onTap: () => { s.shards -= cost; GameState.setSkillLevel(o.id, sk, lv + 1); Audio.sfx('levelup'); toast(this, `${data.name}이(가) Lv${lv + 1}이 되었어요!`); this.updateMoney(); render(); },
        });
      }
      this.renderList(rows);
    };
    render();
  }

  // ---------- 동물 쉼터 ----------
  openShelter() {
    this.openPanel(`${Data.strings.cageName} (3마리까지 함께)`);
    const render = () => {
      const s = GameState.s;
      const rows = Object.entries(s.animals).map(([id, rec]) => {
        const a = Data.animal(id), inParty = s.party.includes(id), st = GameState.animalStatus(id), h = GameState.hearts(id);
        return {
          label: `${GameState.animalName(id)} Lv${rec.level}  ${'♥'.repeat(h)}${'♡'.repeat(5 - h)}`,
          sub: `${a.role}  HP ${rec.hp}/${GameState.animalStats(id).hp}  상태: ${st.text}`,
          right: inParty ? '함께 가요' : '쉬는 중', rightColor: inParty ? '#7ee081' : '#b8c0e0',
          color: inParty ? 0x2e5a3a : 0x3d4066,
          onTap: () => this.openAnimalDetail(id),
        };
      });
      this.renderList(rows);
    };
    render();
  }
  openAnimalDetail(id) {
    const a = { ...Data.animal(id), name: GameState.animalName(id) }; // 밀꾸는 깨끗하면 '밀크'
    this.openPanel(a.name);
    const g = this.listGroup;
    const sprite = g.add(unit(this, 60, 118, GameState.animalSprite(id)).setScale(3 / PX).setDepth(DEPTH.MODAL));
    this.tweens.add({ targets: sprite, y: 114, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const info = g.add(txt(this, 112, 36, '', { size: 11, depth: DEPTH.MODAL, lineSpacing: 4 }));
    const best = g.add(txt(this, 16, 142, '', { size: 11, depth: DEPTH.MODAL, lineSpacing: 2, color: '#b8c0e0', strokeThickness: 1 }));
    const btns = new UIGroup(); g.add(btns);
    const say = (m) => toast(this, m, { y: 120, duration: 1500 });
    const render = () => {
      const s = GameState.s, rec = s.animals[id], st = GameState.animalStatus(id), h = GameState.hearts(id), stats = GameState.animalStats(id);
      const inParty = s.party.includes(id);
      info.setText([
        `Lv${rec.level}  ${a.role}   HP ${rec.hp}/${stats.hp}`,
        `친구 레벨 ${'♥'.repeat(h)}${'♡'.repeat(5 - h)}${rec.friend >= 80 ? '  힘이 나요!' : ''}`,
        `상태: ${st.text}${rec.dirt >= 5 && !rec.sick ? ' (샤워해 주세요)' : ''}`,
      ].join('\n'));
      const bs = rec.best || {};
      best.setText(`최고 기록\n간식 ${bs.catch || 0}개\n숨바꼭질 ${bs.hide || 0}/3\n헹구기 ${bs.shower || 0}/10`);
      btns.destroy(); btns.items = [];
      const B = (i, label, fn, opts = {}) => {
        const col = i % 2, row = Math.floor(i / 2);
        return btns.add(new Button(this, 112 + col * 100, 96 + row * 30, 96, 26, label, fn, { depth: DEPTH.MODAL, ...opts }));
      };
      const canGo = GameState.canBattle(id);
      B(0, inParty ? '쉬게 하기' : '함께 가기', () => {
        const r = GameState.toggleParty(id);
        if (r === 'full') { Audio.sfx('error'); say('3마리까지만 데려갈 수 있어요!'); }
        render();
      }, { color: inParty ? 0x555577 : COLORS.ok }).setEnabled(inParty || canGo);
      B(1, GameState.canPlay(id) ? '놀아주기 ♥' : '그냥 놀기', () => this.choosePlay(id), { color: 0xd6679a }).setEnabled(!rec.sick);
      B(2, rec.dirt >= 5 ? '샤워 (필요!)' : '샤워', () => this.startMiniGame(id, 'shower'), { color: 0x4a90e2 }).setEnabled(rec.dirt > 0 && !rec.sick);
      const snacks = s.inventory.snack || 0, meds = s.inventory.medicine || 0;
      B(3, `간식 주기 (${snacks})`, () => {
        if (!GameState.snack(id)) return;
        Audio.sfx('heal'); this.hop(sprite); say(Data.fmt(Data.dialogues.care.snack).replace(/\{name\}/g, a.name));
        if (!s.animals[id].sulk && rec.sulk === false) { /* 상태 갱신은 render 에서 */ }
        render();
      }, { color: 0xe08a3c }).setEnabled(snacks > 0 && rec.friend < GameState.FRIEND_MAX);
      B(4, `감기약 주기 (${meds})`, () => {
        if (!GameState.cure(id)) return;
        Audio.sfx('levelup'); this.hop(sprite); say(Data.fmt(Data.dialogues.care.cure).replace(/\{name\}/g, a.name)); render();
      }, { color: 0x3fa34d }).setEnabled(rec.sick && meds > 0);
      B(5, '목록으로', () => this.openShelter(), { color: 0x555577 });
      this.updateMoney();
      // 아픈/삐진 동물이 파티에 있으면 뺀다
      if (!canGo && inParty) { GameState.leaveParty(id); render(); }
    };
    render();
  }
  hop(obj) { this.tweens.add({ targets: obj, y: obj.y - 10, duration: 120, yoyo: true, repeat: 1 }); }
  // 놀이 고르기
  choosePlay(id) {
    const a = { ...Data.animal(id), name: GameState.animalName(id) }, g = new UIGroup(), w = 220, h = 124, x = (W - w) / 2, y = (H - h) / 2, d = DEPTH.MODAL + 10;
    g.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5).setDepth(d - 1).setInteractive());
    g.add(panel(this, x, y, w, h, { depth: d }));
    g.add(txt(this, W / 2, y + 8, `${a.name}와(과) 뭐 하고 놀까요?`, { size: 11, origin: [0.5, 0], color: COLORS.yellow, depth: d + 1 }));
    g.add(txt(this, W / 2, y + 22, GameState.canPlay(id) ? '잘하면 하트가 더 많이 올라요!' : '오늘은 하트 없이 그냥 놀아요', { size: 11, origin: [0.5, 0], color: '#b8c0e0', depth: d + 1, strokeThickness: 1 }));
    g.add(new Button(this, x + 14, y + 40, w - 28, 24, '간식 받아먹기', () => { g.destroy(); this.startMiniGame(id, 'catch'); }, { depth: d + 1, color: 0xe08a3c }));
    g.add(new Button(this, x + 14, y + 68, w - 28, 24, '숨바꼭질', () => { g.destroy(); this.startMiniGame(id, 'hide'); }, { depth: d + 1, color: 0x3fa34d }));
    g.add(new Button(this, x + w - 74, y + 96, 60, 22, '취소', () => g.destroy(), { depth: d + 1, color: 0x555577 }));
  }
  async startMiniGame(id, type) {
    if (this.leaving) return; this.leaving = true;
    GameState.save();
    await fadeOut(this, 200);
    this.scene.start('MiniGame', { animalId: id, type });
  }

  // ---------- 우리 집 ----------
  async goHome() {
    this.busy = true;
    await fadeOut(this, 250);
    this.scene.start('Home', {});
  }

  // ---------- 숲 입구 ----------
  openGate() {
    this.openPanel('어느 숲으로 갈까요?');
    const s = GameState.s;
    const rows = Data.stageList().map(st => {
      const cleared = !!s.flags.cleared[st.id], locked = st.locked || !st.maps;
      const prev = st.requires ? Data.stage(st.requires) : null;
      const needPrev = !!(st.requires && !s.flags.cleared[st.requires]);
      return {
        label: `${st.order}. ${st.name}${cleared ? ' ✓' : ''}`,
        right: locked ? '준비 중' : needPrev ? Data.fmt(Data.dialogues.gateLocked, { prev: prev ? prev.name : '' }) : cleared ? '깨끗해졌어요' : '가기!',
        rightColor: locked || needPrev ? '#8890aa' : cleared ? '#7ee081' : COLORS.yellow,
        enabled: !locked && !needPrev,
        onTap: async () => {
          this.closePanel();
          this.busy = true;
          await fadeOut(this);
          delete s.flags.defeated[st.id]; // 다시 들어가면 적이 다시 나타남
          s.day += 1; // 숲에 다녀오면 하루가 지나요 (놀아주기 횟수 기준)
          this.scene.start('Field', { stageId: st.id, mapId: st.start.map, x: st.start.x, y: st.start.y, fresh: true });
        },
      };
    });
    this.renderList(rows);
  }
}
