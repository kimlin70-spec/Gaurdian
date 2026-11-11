// 임시 도트 그래픽을 코드로 만듭니다.
// 나중에 진짜 PNG 가 생기면 data/assets.json 의 overrides 에 적으면 됩니다. (같은 키면 여기서 만들지 않음)
import { TILE, PX, wd, SNOW_FIRST_TILE } from '../config.js';

export const LOOKS = {
  skin: [0xf6d7b8, 0xd8a076, 0x8d5a3a],
  hairColor: [0x3b2314, 0xf2c14e, 0xc0392b, 0x1f1f1f],
  hairNames: ['단발', '긴 머리', '양갈래'],
  skinNames: ['밝은', '중간', '어두운'],
  hairColorNames: ['갈색', '노랑', '빨강', '검정'],
};

import { PAL, PLAYER_BODY, PLAYER_CLOTHES, HAIR, TREE, TREE_DARK, BUSH, ROCK, SPRITES, FURNITURE, TREE_SNOW, TREE_SNOW_DARK, ROCK_SNOW, WEAPONS, YARD_FURNITURE, MINIGAME } from './Pixels.js';
import Data from './Data.js';
import GameState from './GameState.js';

// 자리표시자용 알파벳 팔레트 → Phaser generate 형식
function gen(scene, key, rows, palette = PAL) {
  if (scene.textures.exists(key)) return;
  scene.textures.generate(key, { data: rows, palette, pixelWidth: PX, pixelHeight: PX });
}

// 간단한 결정적 난수 (타일 무늬용)
function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---- 타일 (16x16 x N) ----
// 나무/오염 나무/바위/덤불 칸은 바닥만 그리고, 그 위에 TREE/ROCK/BUSH 스프라이트를 얹는다 (FieldScene.decorate)
const TILE_COUNT = 12;
export const OVERLAY_TILES = { 1: 'tree', 6: 'tree_dark', 7: 'rock', 10: 'bush', 13: 'tree_snow', 16: 'tree_snow_dark', 17: 'rock_snow' };
export const BASE_OF = { 1: 0, 6: 5, 7: 0, 10: 0, 13: 12, 16: 15, 17: 12 };
function drawTile(ctx, idx, ox) {
  const r = rng(idx * 7 + 3);
  const fill = (c, x = 0, y = 0, w = TILE, h = TILE) => { ctx.fillStyle = c; ctx.fillRect(ox + x, y, w, h); };
  const speck = (c, n, w = 1, h = 1) => { ctx.fillStyle = c; for (let i = 0; i < n; i++) ctx.fillRect(ox + Math.floor(r() * (TILE - w + 1)), Math.floor(r() * (TILE - h + 1)), w, h); };
  const grass = (base, dark, light) => {
    fill(base); speck(dark, 10, 2, 1); speck(light, 6, 1, 1);
    // 풀잎 몇 개
    ctx.fillStyle = dark; for (let i = 0; i < 3; i++) { const x = ox + Math.floor(r() * 14), y = Math.floor(r() * 12); ctx.fillRect(x, y + 1, 1, 2); ctx.fillRect(x + 1, y, 1, 2); }
  };
  switch (idx) {
    case 0: case 1: case 7: case 10: grass('#6cc06a', '#58a858', '#8ad888'); break; // 풀
    case 2: fill('#d8b57c'); speck('#c7a368', 10, 2, 1); speck('#e8ca92', 6); speck('#b8946a', 3, 2, 2); break; // 길
    case 3: fill('#3f86e0'); speck('#3576cc', 6, 3, 1); ctx.fillStyle = '#9fd0ff'; ctx.fillRect(ox + 2, 4, 5, 1); ctx.fillRect(ox + 9, 9, 5, 1); ctx.fillRect(ox + 4, 13, 4, 1); ctx.fillStyle = '#dff1ff'; ctx.fillRect(ox + 3, 4, 2, 1); ctx.fillRect(ox + 10, 9, 2, 1); break; // 물
    case 4: grass('#6cc06a', '#58a858', '#8ad888'); fill('#ff6fa0', 3, 4, 3, 3); fill('#ffd93b', 4, 5, 1, 1); fill('#ffffff', 9, 9, 3, 3); fill('#ffd93b', 10, 10, 1, 1); fill('#2e7d32', 4, 7, 1, 2); fill('#2e7d32', 10, 12, 1, 2); break; // 꽃
    case 5: case 6: grass('#6e6986', '#5c5774', '#857fa0'); break; // 오염된 풀
    case 8: fill('#8e8ba0'); speck('#7e7b90', 10, 2, 1); ctx.fillStyle = '#6f6c82'; ctx.fillRect(ox, 7, 16, 1); ctx.fillRect(ox + 7, 0, 1, 8); ctx.fillRect(ox + 12, 8, 1, 8); ctx.fillStyle = '#a3a0b4'; ctx.fillRect(ox + 1, 1, 5, 1); ctx.fillRect(ox + 9, 9, 2, 1); break; // 돌바닥
    case 9: fill('#45425c'); ctx.fillStyle = '#5e5a78'; for (let y = 0; y < 16; y += 4) { const off = (y / 4) % 2 ? 4 : 0; for (let x = off; x < 16; x += 8) ctx.fillRect(ox + x + 1, y + 1, 6, 2); } ctx.fillStyle = '#6f6b8c'; for (let y = 0; y < 16; y += 4) { const off = (y / 4) % 2 ? 4 : 0; for (let x = off; x < 16; x += 8) ctx.fillRect(ox + x + 1, y + 1, 6, 1); } break; // 돌벽
    case 11: fill('#cbae84'); speck('#bb9e74', 12, 2, 1); speck('#dbbe94', 6); break; // 마을 바닥
  }
}

// 눈 숲 타일 (번호 12~19, 별도 텍스처 tiles_snow, 프레임 = 번호-12)
const SNOW_TILE_COUNT = 8;
function drawSnowTile(ctx, idx, ox) {
  const r = rng(idx * 11 + 5);
  const fill = (c, x = 0, y = 0, w = TILE, h = TILE) => { ctx.fillStyle = c; ctx.fillRect(ox + x, y, w, h); };
  const speck = (c, n, w = 1, h = 1) => { ctx.fillStyle = c; for (let i = 0; i < n; i++) ctx.fillRect(ox + Math.floor(r() * (TILE - w + 1)), Math.floor(r() * (TILE - h + 1)), w, h); };
  const snow = (base, dark, light) => { fill(base); speck(dark, 8, 2, 1); speck(light, 6); };
  switch (idx) {
    case 0: case 1: case 5: snow('#eef4fb', '#d6e2f0', '#ffffff'); break;              // 눈
    case 2: fill('#9fd8f0'); speck('#8ccbe6', 6, 3, 1); ctx.fillStyle = '#e4f7ff'; ctx.fillRect(ox + 2, 3, 6, 1); ctx.fillRect(ox + 8, 10, 5, 1); ctx.fillRect(ox + 3, 13, 3, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(ox + 3, 3, 2, 1); break; // 얼음
    case 3: case 4: snow('#8e8aa6', '#7a7694', '#a4a0bc'); break;                      // 오염된 눈
    case 6: fill('#d9dde6'); speck('#c7ccd8', 10, 2, 1); speck('#eef0f5', 5); break;  // 눈길
    case 7: snow('#eef4fb', '#d6e2f0', '#ffffff'); fill('#9fd8f0', 3, 4, 3, 3); fill('#ffffff', 4, 5, 1, 1); fill('#c9b6ff', 9, 9, 3, 3); fill('#ffffff', 10, 10, 1, 1); break; // 얼음꽃
  }
}
function genSnowTiles(scene) {
  if (scene.textures.exists('tiles_snow')) return;
  const tex = scene.textures.createCanvas('tiles_snow', TILE * SNOW_TILE_COUNT * PX, TILE * PX);
  const ctx = tex.getContext();
  ctx.scale(PX, PX);
  for (let i = 0; i < SNOW_TILE_COUNT; i++) drawSnowTile(ctx, i, i * TILE);
  tex.refresh();
  for (let i = 0; i < SNOW_TILE_COUNT; i++) tex.add(i, 0, i * TILE * PX, 0, TILE * PX, TILE * PX);
}

function genTiles(scene) {
  if (scene.textures.exists('tiles')) return;
  const tex = scene.textures.createCanvas('tiles', TILE * TILE_COUNT * PX, TILE * PX);
  const ctx = tex.getContext();
  ctx.scale(PX, PX);
  for (let i = 0; i < TILE_COUNT; i++) drawTile(ctx, i, i * TILE);
  tex.refresh();
  for (let i = 0; i < TILE_COUNT; i++) tex.add(i, 0, i * TILE * PX, 0, TILE * PX, TILE * PX);
}

// ---- 건물 (40x36) ----
const BUILDINGS = {
  inn:    { wall: '#f1e0c0', roof: '#c0392b', sign: '#ffd93b' },
  shop:   { wall: '#e8d5b0', roof: '#3fa34d', sign: '#ffffff' },
  smithy: { wall: '#8d8a9e', roof: '#4a4760', sign: '#ff8c42' },
  sage:   { wall: '#d9c9f0', roof: '#6a4fb3', sign: '#ffd93b' },
  shelter:{ wall: '#f7e6b0', roof: '#d98c5f', sign: '#5cb85c' },
  gate:   { wall: '#5a3a1a', roof: '#2e7d32', sign: '#ffd93b' },
  home:   { wall: '#fff1d6', roof: '#ff8fa8', sign: '#ff6fa0' },
};
function genBuildings(scene) {
  for (const [key, c] of Object.entries(BUILDINGS)) {
    const tkey = 'bld_' + key;
    if (scene.textures.exists(tkey)) continue;
    const w = 40, h = 36;
    const tex = scene.textures.createCanvas(tkey, w * PX, h * PX);
    const ctx = tex.getContext();
    ctx.scale(PX, PX);
    if (key === 'gate') {
      ctx.fillStyle = '#2e7d32'; ctx.fillRect(0, 4, 12, 28); ctx.fillRect(28, 4, 12, 28);
      ctx.fillStyle = '#1b5e20'; ctx.fillRect(2, 8, 8, 20); ctx.fillRect(30, 8, 8, 20);
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(10, 10, 20, 4); ctx.fillRect(12, 0, 4, 36); ctx.fillRect(24, 0, 4, 36);
      ctx.fillStyle = '#ffd93b'; ctx.fillRect(18, 2, 4, 4);
    } else {
      ctx.fillStyle = c.wall; ctx.fillRect(4, 14, 32, 22);
      ctx.fillStyle = '#1b1b2a'; ctx.fillRect(4, 14, 32, 1); ctx.fillRect(4, 35, 32, 1); ctx.fillRect(4, 14, 1, 22); ctx.fillRect(35, 14, 1, 22);
      ctx.fillStyle = c.roof;
      for (let y = 0; y < 14; y++) { const half = Math.floor((y / 14) * 20); ctx.fillRect(20 - half - 1, y, (half + 1) * 2, 1); }
      ctx.fillStyle = '#5a3a1a'; ctx.fillRect(16, 24, 8, 12);
      ctx.fillStyle = '#ffd93b'; ctx.fillRect(21, 30, 1, 1);
      ctx.fillStyle = '#7fb6f2'; ctx.fillRect(7, 20, 6, 6); ctx.fillRect(27, 20, 6, 6);
      ctx.fillStyle = c.sign; ctx.fillRect(14, 16, 12, 5);
    }
    tex.refresh();
  }
}

// ---- 외부 PNG 로 바꿀 때: BootScene.preload 에서 호출 ----
export function loadOverrides(scene, assetsJson) {
  const ov = (assetsJson && assetsJson.overrides) || {};
  for (const [key, def] of Object.entries(ov)) {
    if (def.type === 'spritesheet') scene.load.spritesheet(key, def.file, { frameWidth: def.frameWidth, frameHeight: def.frameHeight });
    else scene.load.image(key, def.file);
  }
}

// ---- 전부 만들기: BootScene.create 에서 호출 ----
export function generateAll(scene) {
  genTiles(scene);
  genSnowTiles(scene);
  genBuildings(scene);
  gen(scene, 'player_body', PLAYER_BODY);
  gen(scene, 'player_clothes', PLAYER_CLOTHES);
  HAIR.forEach((rows, i) => gen(scene, 'hair_' + i, rows));
  gen(scene, 'tree', TREE); gen(scene, 'tree_dark', TREE_DARK); gen(scene, 'bush', BUSH); gen(scene, 'rock', ROCK);
  gen(scene, 'tree_snow', TREE_SNOW); gen(scene, 'tree_snow_dark', TREE_SNOW_DARK); gen(scene, 'rock_snow', ROCK_SNOW);
  for (const [key, rows] of Object.entries(WEAPONS)) gen(scene, key, rows);
  for (const [key, rows] of Object.entries(YARD_FURNITURE)) gen(scene, key, rows);
  for (const [key, rows] of Object.entries(MINIGAME)) gen(scene, key, rows);
  for (const [key, rows] of Object.entries(SPRITES)) gen(scene, key, rows);
  for (const [key, rows] of Object.entries(FURNITURE)) gen(scene, key, rows);
  // 1x1 흰 점 (파티클/플래시용)
  if (!scene.textures.exists('dot')) {
    const t = scene.textures.createCanvas('dot', 2 * PX, 2 * PX); t.getContext().fillStyle = '#fff'; t.getContext().fillRect(0, 0, 2 * PX, 2 * PX); t.refresh();
  }
}

// 그림 만들기: 모든 텍스처는 PX 배 밀도이므로 1/PX 로 줄여서 논리 크기로 보여준다.
export function img(scene, x, y, key, frame) { return scene.add.image(x, y, key, frame).setScale(1 / PX); }

// ---------------- 애니메이션 ----------------
// _anim 시트 규칙: 동물/적/보스는 6프레임 [서기A, 서기B, 움직이기A, 움직이기B, 공격, 아파함]
export const POSE = { attack: 4, hurt: 5 };
export function registerAnims(scene) {
  const A = scene.anims, T = scene.textures;
  for (const key of T.getTextureKeys()) {
    if (!key.endsWith('_anim')) continue;
    const base = key.slice(0, -5), n = T.get(key).frameTotal - 1; // __BASE 제외
    if (key.startsWith('fx_')) { if (!A.exists(key)) A.create({ key, frames: A.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: 14, repeat: 0 }); continue; }
    if (key.startsWith('tiles_')) { if (!A.exists(key)) A.create({ key, frames: A.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: n > 2 ? 4 : 1.2, repeat: -1 }); continue; }
    if (key.startsWith('player_') || n < 6) continue;
    if (!A.exists(base + '_idle')) A.create({ key: base + '_idle', frames: A.generateFrameNumbers(key, { frames: [0, 0, 0, 0, 0, 1] }), frameRate: 3, repeat: -1 }); // 가끔 깜빡/숨쉬기
    if (!A.exists(base + '_move')) A.create({ key: base + '_move', frames: A.generateFrameNumbers(key, { frames: [2, 3] }), frameRate: 5, repeat: -1 });
  }
}
// 동물/적/주민 그림. 애니메이션 시트가 있으면 움직이는 스프라이트, 없으면 정지 그림.
export function unit(scene, x, y, key) {
  if (scene.textures.exists(key + '_anim') && scene.anims.exists(key + '_idle')) {
    const sp = scene.add.sprite(x, y, key + '_anim', 0).setScale(1 / PX);
    sp.animKey = key;
    sp.play({ key: key + '_idle', startFrame: Math.floor(Math.random() * 5) });
    return sp;
  }
  return img(scene, x, y, key);
}
// 자세 바꾸기: 'idle' | 'move' 는 반복 재생, 'attack' | 'hurt' 는 한 장면으로 멈춤
export function setPose(obj, pose) {
  if (!obj || !obj.animKey || !obj.active) return;
  if (pose === 'idle' || pose === 'move') obj.play(obj.animKey + '_' + pose, true);
  else { obj.anims.stop(); obj.setFrame(POSE[pose] ?? 0); }
}
// 한 번 재생하고 사라지는 효과 (fx_hit_anim 등). 시트가 없으면 아무것도 안 함.
export function fx(scene, key, x, y, scale = 1, depth = 150) {
  if (!scene.anims.exists(key)) return null;
  const sp = scene.add.sprite(x, y, key, 0).setScale(scale / PX).setDepth(depth);
  sp.play(key); sp.once('animationcomplete', () => sp.destroy());
  return sp;
}

// 주인공 캐릭터(몸+옷+머리+무기) 컨테이너. 24x32, origin 은 발 아래 가운데(0.5, 1).
// 몸/옷은 10프레임 시트, 머리카락과 무기는 정지 그림을 프레임에 맞춰 옮긴다 (data/heroanim.json).
export function makeCharacter(scene, x, y, look, opts = {}) {
  const HA = Data.heroanim || {}, animated = scene.textures.exists('player_body_anim') && scene.textures.exists('player_clothes_anim') && HA.seq;
  const mk = (key) => (animated ? scene.add.sprite(0, 0, key + '_anim', 0) : scene.add.image(0, 0, key)).setScale(1 / PX).setOrigin(0.5, 1);
  const body = mk('player_body').setTint(LOOKS.skin[look.skin] ?? LOOKS.skin[0]);
  const clothes = mk('player_clothes');
  const hair = img(scene, 0, 0, 'hair_' + (look.hair ?? 0)).setOrigin(0.5, 1).setTint(LOOKS.hairColor[look.hairColor] ?? LOOKS.hairColor[0]);
  const weapon = img(scene, 0, 0, 'dot').setOrigin(0.5, 1).setVisible(false);
  const c = scene.add.container(x, y, [body, clothes, hair, weapon]);
  c.setSize(24, 32);
  c.parts = { body, clothes, hair, weapon };
  let frame = 0, flip = false, wAngle = 0, wKey = null, timer = null;
  const FW = (HA.frame || [48, 64])[0], FH = (HA.frame || [48, 64])[1], K = 24 / FW; // 시트 픽셀 → 논리 픽셀
  const layout = () => {
    const ho = (HA.hairOffset && HA.hairOffset[frame]) || [0, 0];
    hair.setPosition((flip ? -1 : 1) * ho[0] * K, ho[1] * K);
    if (wKey) {
      const g = (HA.grip && HA.grip[wKey]) || [FW / 2, FH], h = (HA.hand && HA.hand[frame]) || g;
      weapon.setOrigin(flip ? 1 - g[0] / FW : g[0] / FW, g[1] / FH);            // 손잡이를 회전축으로
      weapon.setPosition((flip ? -1 : 1) * (h[0] - FW / 2) * K, (h[1] - FH) * K);
      weapon.setAngle(flip ? -wAngle : wAngle);
    }
  };
  c.setFrame = (i) => { frame = i; if (animated) { body.setFrame(i); clothes.setFrame(i); } layout(); };
  const stop = () => { if (timer) { timer.remove(false); timer = null; } };
  // 반복 동작: 'idle' | 'walk'
  c.play = (name) => {
    if (!animated || c.playing === name) return;
    stop(); c.playing = name; wAngle = 0;
    const base = HA.seq[name] || [0]; let k = 0;
    const seq = name === 'idle' && base.length > 1 ? [base[0], base[0], base[0], base[0], base[0], base[1]] : base; // 가끔만 깜빡
    c.setFrame(seq[0]);
    if (seq.length > 1) timer = scene.time.addEvent({ delay: name === 'walk' ? 110 : 330, loop: true, callback: () => { k = (k + 1) % seq.length; c.setFrame(seq[k]); } });
  };
  // 한 장면: pose('attack', 0|1) | pose('hurt') | pose('happy')
  c.pose = (name, idx = 0) => { if (!animated) return; stop(); c.playing = null; const seq = HA.seq[name] || [0]; c.setFrame(seq[Math.min(idx, seq.length - 1)]); };
  c.setWeaponAngle = (a) => { wAngle = a; layout(); };
  c.setLook = (lk) => { body.setTint(LOOKS.skin[lk.skin]); hair.setTexture('hair_' + lk.hair); hair.setTint(LOOKS.hairColor[lk.hairColor]); };
  c.setWeapon = (weaponId) => {
    const e = weaponId ? Data.equip(weaponId) : null;
    if (e && e.sprite && scene.textures.exists(e.sprite)) { wKey = e.sprite; weapon.setTexture(e.sprite).setVisible(true).setScale(1 / PX); }
    else { wKey = null; weapon.setVisible(false); }
    layout();
  };
  c.setFlip = (f) => { flip = f; body.setFlipX(f); clothes.setFlipX(f); hair.setFlipX(f); weapon.setFlipX(f); layout(); };
  c.once('destroy', stop);
  c.setWeapon(opts.weapon !== undefined ? opts.weapon : (GameState.s ? GameState.s.player.equip.weapon : null));
  if (opts.idle !== false) c.play('idle');
  return c;
}

// 타일맵 위에 나무/바위/덤불 스프라이트 얹기. grid 는 원본 타일 번호(충돌용), 그림은 바닥 타일로 바꿔 그린다.
export function decorateMap(scene, grid, ox, oy) {
  const data = grid.map(row => row.map(t => (t in BASE_OF ? BASE_OF[t] : t)));
  const sprites = [];
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) {
    const key = OVERLAY_TILES[grid[y][x]];
    if (!key) continue;
    const wy = oy + (y + 1) * TILE;
    sprites.push(img(scene, ox + x * TILE + TILE / 2, wy, key).setOrigin(0.5, 1).setDepth(wd(wy - 1)));
  }
  return { data, sprites };
}

// 타일맵 만들기 (기본 타일 + 눈 타일 두 세트). grid 는 원본 번호.
export function buildTilemap(scene, grid, ox, oy) {
  const deco = decorateMap(scene, grid, ox, oy);
  const tilemap = scene.make.tilemap({ data: deco.data, tileWidth: TILE * PX, tileHeight: TILE * PX });
  const t1 = tilemap.addTilesetImage('tiles', 'tiles', TILE * PX, TILE * PX, 0, 0, 0);
  const t2 = tilemap.addTilesetImage('tiles_snow', 'tiles_snow', TILE * PX, TILE * PX, 0, 0, SNOW_FIRST_TILE);
  const layer = tilemap.createLayer(0, [t1, t2], ox, oy).setDepth(0).setScale(1 / PX);
  // 물(3)과 얼음(14)은 움직이는 타일을 위에 덮는다
  const animTiles = { 3: 'tiles_water_anim', 14: 'tiles_ice_anim' };
  for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) {
    const key = animTiles[grid[y][x]];
    if (key && scene.anims.exists(key)) scene.add.sprite(ox + x * TILE, oy + y * TILE, key, 0).setOrigin(0).setScale(1 / PX).setDepth(0.01).play(key);
  }
  return { tilemap, layer, sprites: deco.sprites };
}

// 스테이지 테마 (없으면 초록숲)
export function themeOf(stageId) {
  const st = Data.stage(stageId);
  return (st && st.theme) || { tilesKey: 'tiles', base: 0, corrupt: 5, flower: 4, tree: 'tree', treeDark: 'tree_dark', sky: '#3b3357', ground: '#5d5876', bossSky: '#2a2240', bossGround: '#4a4760' };
}

// 유닛의 sprite 이름으로 전투/필드 스프라이트 만들기 (주인공이면 컨테이너)
const unit_ = unit;
export function makeUnitSprite(scene, unit, x, y, look) {
  if (unit.sprite === 'player') return makeCharacter(scene, x, y, look);
  const im = unit_(scene, x, y, unit.sprite).setOrigin(0.5, 1);
  if (unit.scale && unit.scale !== 1) im.setScale(unit.scale / PX);
  return im;
}

export const SPRITE_KEYS = Object.keys(SPRITES);
