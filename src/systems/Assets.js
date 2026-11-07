// 임시 도트 그래픽을 코드로 만듭니다.
// 나중에 진짜 PNG 가 생기면 data/assets.json 의 overrides 에 적으면 됩니다. (같은 키면 여기서 만들지 않음)
import { TILE, wd } from '../config.js';

export const LOOKS = {
  skin: [0xf6d7b8, 0xd8a076, 0x8d5a3a],
  hairColor: [0x3b2314, 0xf2c14e, 0xc0392b, 0x1f1f1f],
  hairNames: ['단발', '긴 머리', '양갈래'],
  skinNames: ['밝은', '중간', '어두운'],
  hairColorNames: ['갈색', '노랑', '빨강', '검정'],
};

import { PAL, PLAYER_BODY, PLAYER_CLOTHES, HAIR, TREE, TREE_DARK, BUSH, ROCK, SPRITES } from './Pixels.js';

// 자리표시자용 알파벳 팔레트 → Phaser generate 형식
function gen(scene, key, rows, palette = PAL) {
  if (scene.textures.exists(key)) return;
  scene.textures.generate(key, { data: rows, palette, pixelWidth: 1, pixelHeight: 1 });
}

// 간단한 결정적 난수 (타일 무늬용)
function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---- 타일 (16x16 x N) ----
// 나무/오염 나무/바위/덤불 칸은 바닥만 그리고, 그 위에 TREE/ROCK/BUSH 스프라이트를 얹는다 (FieldScene.decorate)
const TILE_COUNT = 12;
export const OVERLAY_TILES = { 1: 'tree', 6: 'tree_dark', 7: 'rock', 10: 'bush' };
export const BASE_OF = { 1: 0, 6: 5, 7: 0, 10: 0 };
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

function genTiles(scene) {
  if (scene.textures.exists('tiles')) return;
  const tex = scene.textures.createCanvas('tiles', TILE * TILE_COUNT, TILE);
  const ctx = tex.getContext();
  for (let i = 0; i < TILE_COUNT; i++) drawTile(ctx, i, i * TILE);
  tex.refresh();
  for (let i = 0; i < TILE_COUNT; i++) tex.add(i, 0, i * TILE, 0, TILE, TILE);
}

// ---- 건물 (40x36) ----
const BUILDINGS = {
  inn:    { wall: '#f1e0c0', roof: '#c0392b', sign: '#ffd93b' },
  shop:   { wall: '#e8d5b0', roof: '#3fa34d', sign: '#ffffff' },
  smithy: { wall: '#8d8a9e', roof: '#4a4760', sign: '#ff8c42' },
  sage:   { wall: '#d9c9f0', roof: '#6a4fb3', sign: '#ffd93b' },
  shelter:{ wall: '#f7e6b0', roof: '#d98c5f', sign: '#5cb85c' },
  gate:   { wall: '#5a3a1a', roof: '#2e7d32', sign: '#ffd93b' },
};
function genBuildings(scene) {
  for (const [key, c] of Object.entries(BUILDINGS)) {
    const tkey = 'bld_' + key;
    if (scene.textures.exists(tkey)) continue;
    const w = 40, h = 36;
    const tex = scene.textures.createCanvas(tkey, w, h);
    const ctx = tex.getContext();
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
  genBuildings(scene);
  gen(scene, 'player_body', PLAYER_BODY);
  gen(scene, 'player_clothes', PLAYER_CLOTHES);
  HAIR.forEach((rows, i) => gen(scene, 'hair_' + i, rows));
  gen(scene, 'tree', TREE); gen(scene, 'tree_dark', TREE_DARK); gen(scene, 'bush', BUSH); gen(scene, 'rock', ROCK);
  for (const [key, rows] of Object.entries(SPRITES)) gen(scene, key, rows);
  // 1x1 흰 점 (파티클/플래시용)
  if (!scene.textures.exists('dot')) {
    const t = scene.textures.createCanvas('dot', 2, 2); t.getContext().fillStyle = '#fff'; t.getContext().fillRect(0, 0, 2, 2); t.refresh();
  }
}

// 주인공 캐릭터(몸+옷+머리) 컨테이너. 24x32, origin 은 발 아래 가운데(0.5, 1).
export function makeCharacter(scene, x, y, look) {
  const body = scene.add.image(0, 0, 'player_body').setOrigin(0.5, 1).setTint(LOOKS.skin[look.skin] ?? LOOKS.skin[0]);
  const clothes = scene.add.image(0, 0, 'player_clothes').setOrigin(0.5, 1);
  const hair = scene.add.image(0, 0, 'hair_' + (look.hair ?? 0)).setOrigin(0.5, 1).setTint(LOOKS.hairColor[look.hairColor] ?? LOOKS.hairColor[0]);
  const c = scene.add.container(x, y, [body, clothes, hair]);
  c.setSize(24, 32);
  c.parts = { body, clothes, hair };
  c.setLook = (lk) => { body.setTint(LOOKS.skin[lk.skin]); hair.setTexture('hair_' + lk.hair); hair.setTint(LOOKS.hairColor[lk.hairColor]); };
  c.setFlip = (f) => { body.setFlipX(f); clothes.setFlipX(f); hair.setFlipX(f); };
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
    sprites.push(scene.add.image(ox + x * TILE + TILE / 2, wy, key).setOrigin(0.5, 1).setDepth(wd(wy - 1)));
  }
  return { data, sprites };
}

// 유닛의 sprite 이름으로 전투/필드 스프라이트 만들기 (주인공이면 컨테이너)
export function makeUnitSprite(scene, unit, x, y, look) {
  if (unit.sprite === 'player') return makeCharacter(scene, x, y, look);
  const img = scene.add.image(x, y, unit.sprite).setOrigin(0.5, 1);
  if (unit.scale && unit.scale !== 1) img.setScale(unit.scale);
  return img;
}

export const SPRITE_KEYS = Object.keys(SPRITES);
