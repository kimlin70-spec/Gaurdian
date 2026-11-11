// 임시 도트 그래픽을 코드로 만듭니다.
// 나중에 진짜 PNG 가 생기면 data/assets.json 의 overrides 에 적으면 됩니다. (같은 키면 여기서 만들지 않음)
import { TILE, PX, wd, SNOW_FIRST_TILE, SIDE_VIEWS } from '../config.js';

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
// 정면 시트 (x_anim, 6프레임): 서기A, 서기B, 움직이기A, 움직이기B, 공격, 아파함
// 옆모습 시트 (x_side_anim, 14프레임, 오른쪽 보기): 서기 2, 걷기 4, 공격준비, 공격, 마무리, 맞음, 밀려남, 방어, 주저앉음, 기뻐함
// 동작 이름: 반복 = idle, move / 한 장면 = attack_ready, attack, attack_end, hurt, knockback, guard, down, happy
// 옆모습이 없는 캐릭터는 같은 이름의 동작을 정면 그림에서 가장 비슷한 프레임으로 보여준다.
export const LOOP_POSES = new Set(['idle', 'move']);
const FRONT_POSES = { attack_ready: 0, attack: 4, attack_end: 4, hurt: 5, knockback: 5, guard: 0, down: 5, happy: 3 };
const unitSide = () => (Data.anim && Data.anim.unitSide) || {};
const sidePoses = () => unitSide().poses || { attack_ready: 6, attack: 7, attack_end: 8, hurt: 9, knockback: 10, guard: 11, down: 12, happy: 13 };

export function registerAnims(scene) {
  const A = scene.anims, T = scene.textures, US = unitSide();
  const frames = (key, list) => A.generateFrameNumbers(key, { frames: list });
  for (const key of T.getTextureKeys()) {
    if (!key.endsWith('_anim')) continue;
    const base = key.slice(0, -5), n = T.get(key).frameTotal - 1; // __BASE 제외
    if (key.startsWith('fx_')) { if (!A.exists(key)) A.create({ key, frames: A.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: 14, repeat: 0 }); continue; }
    if (key.startsWith('tiles_')) { if (!A.exists(key)) A.create({ key, frames: A.generateFrameNumbers(key, { start: 0, end: n - 1 }), frameRate: n > 2 ? 4 : 1.2, repeat: -1 }); continue; }
    if (key.startsWith('player_') || n < 6) continue; // 주인공은 makeCharacter 가 직접 넘긴다
    const side = base.endsWith('_side');
    const idle = side ? ((US.seq && US.seq.idle) || [0, 1]) : [0, 1];
    const move = side ? ((US.seq && US.seq.move) || [2, 3, 4, 5]) : [2, 3];
    // 서 있을 때는 가끔만 깜빡/숨쉬기
    if (!A.exists(base + '_idle')) A.create({ key: base + '_idle', frames: frames(key, [idle[0], idle[0], idle[0], idle[0], idle[0], idle[1]]), frameRate: 3, repeat: -1 });
    if (!A.exists(base + '_move')) A.create({ key: base + '_move', frames: frames(key, move), frameRate: side ? 8 : 5, repeat: -1 });
  }
}

// 정면 그림이 원래 왼쪽을 보고 있는 캐릭터 (data/anim_tweaks.json 의 facesLeft)
const facesLeft = (key) => !!(Data.anim && Array.isArray(Data.anim.facesLeft) && Data.anim.facesLeft.includes(key));

// 동물/적/주민 그림. 애니메이션 시트가 있으면 움직이는 스프라이트, 없으면 정지 그림.
export function unit(scene, x, y, key) {
  if (scene.textures.exists(key + '_anim') && scene.anims.exists(key + '_idle')) {
    const sp = scene.add.sprite(x, y, key + '_anim', 0).setScale(1 / PX);
    sp.animKey = key; sp.curView = 'front'; sp.curPose = 'idle';
    sp.hasSide = SIDE_VIEWS && scene.anims.exists(key + '_side_idle');
    sp.facesLeft = facesLeft(key);
    sp.play({ key: key + '_idle', startFrame: Math.floor(Math.random() * 5) });
    return sp;
  }
  const im = img(scene, x, y, key);
  im.facesLeft = facesLeft(key);
  return im;
}

// 보는 방향: 'front' | 'side'. flip=true 면 왼쪽을 본다. 옆모습이 없으면 정면을 좌우로 뒤집는다.
// 정면 그림이 원래 왼쪽을 보고 있으면(facesLeft) 반대로 뒤집어야 그 방향을 본다.
export function setView(obj, view, flip) {
  if (!obj || !obj.active) return;
  if (obj.isHero) { obj.setView(view, flip); return; }
  const v = view === 'side' && obj.hasSide ? 'side' : 'front';
  if (flip !== undefined) obj.setFlipX(view === 'side' && v === 'front' && obj.facesLeft ? !flip : !!flip);
  if (!obj.animKey) return;
  if (obj.curView === v) return;
  obj.curView = v;
  obj.anims.stop();
  obj.setTexture(obj.animKey + (v === 'side' ? '_side_anim' : '_anim'), 0);
  setPose(obj, obj.curPose || 'idle', true);
}
// 움직이는 방향을 보게 한다: 옆으로 움직이면 옆모습, 위아래면 정면.
export function face(obj, dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) setView(obj, 'side', dx < 0);
  else if (dy !== 0) setView(obj, 'front', false);
}
// 자세 바꾸기. force 면 같은 반복 동작도 처음부터 다시.
export function setPose(obj, pose, force) {
  if (!obj || !obj.active) return;
  if (obj.isHero) { obj.setPose(pose); return; }
  if (!obj.animKey) return;
  if (pose === 'walk') pose = 'move';
  if (!force && obj.curPose === pose && LOOP_POSES.has(pose) && obj.anims.isPlaying) return;
  obj.curPose = pose;
  const k = obj.animKey + (obj.curView === 'side' ? '_side' : '');
  if (LOOP_POSES.has(pose)) obj.play(k + '_' + pose, false);
  else { obj.anims.stop(); obj.setFrame((obj.curView === 'side' ? sidePoses() : FRONT_POSES)[pose] ?? 0); }
}
// 같은 캐릭터의 다른 그림으로 바꾸기 (밀꾸: 꾀죄죄 ↔ 깨끗). 방향과 자세는 유지.
export function retexture(obj, key) {
  if (!obj || !obj.active || obj.isHero) return;
  const sc = obj.scene;
  if (!obj.animKey) { if (sc.textures.exists(key)) { obj.setTexture(key); obj.facesLeft = facesLeft(key); } return; }
  if (!sc.textures.exists(key + '_anim') || !sc.anims.exists(key + '_idle')) return;
  obj.animKey = key; obj.hasSide = SIDE_VIEWS && sc.anims.exists(key + '_side_idle'); obj.facesLeft = facesLeft(key);
  if (obj.curView === 'side' && !obj.hasSide) obj.curView = 'front';
  obj.anims.stop();
  obj.setTexture(key + (obj.curView === 'side' ? '_side_anim' : '_anim'), 0);
  setPose(obj, obj.curPose || 'idle', true);
}
// 한 번 재생하고 사라지는 효과 (fx_hit_anim 등). 시트가 없으면 아무것도 안 함.
export function fx(scene, key, x, y, scale = 1, depth = 150) {
  if (!scene.anims.exists(key)) return null;
  const sp = scene.add.sprite(x, y, key, 0).setScale(scale / PX).setDepth(depth);
  sp.play(key); sp.once('animationcomplete', () => sp.destroy());
  return sp;
}

// 주인공 캐릭터(몸+옷+머리+무기) 컨테이너. 24x32, origin 은 발 아래 가운데(0.5, 1).
// 몸/옷은 프레임 시트(정면 10장, 옆모습 14장), 머리카락과 무기는 정지 그림을
// data/anim.json 의 머리 이동량·손 위치·무기 각도에 맞춰 옮겨 붙인다.
export function makeCharacter(scene, x, y, look, opts = {}) {
  const AN = Data.anim || {}, HF = AN.hero || null, HS = AN.heroSide || null, T = scene.textures;
  const frontOK = !!(HF && T.exists('player_body_anim') && T.exists('player_clothes_anim'));
  const sideOK = !!(SIDE_VIEWS && frontOK && HS && T.exists('player_body_side_anim') && T.exists('player_clothes_side_anim') && T.exists('hair_0_side'));
  const mk = (key) => (frontOK ? scene.add.sprite(0, 0, key + '_anim', 0) : scene.add.image(0, 0, key)).setScale(1 / PX).setOrigin(0.5, 1);
  const body = mk('player_body'), clothes = mk('player_clothes');
  const hair = img(scene, 0, 0, 'hair_' + (look.hair ?? 0)).setOrigin(0.5, 1);
  const weapon = img(scene, 0, 0, 'dot').setOrigin(0.5, 1).setVisible(false);
  const c = scene.add.container(x, y, [body, clothes, hair, weapon]);
  c.setSize(24, 32);
  c.isHero = true;
  c.parts = { body, clothes, hair, weapon };
  c.curView = 'front'; c.curPose = null;
  let lk = { skin: 0, hair: 0, hairColor: 0, ...look }, flip = false, frame = 0, extra = 0, wKey = null, timer = null, want = 'front';
  // 옆모습 머리 그림이 아직 어색한 머리 모양(anim_tweaks.json heroSideHairOff)이면 정면만 쓴다
  const sideFor = () => sideOK && T.exists('hair_' + (lk.hair ?? 0) + '_side') && !(Array.isArray(AN.heroSideHairOff) && AN.heroSideHairOff.includes(lk.hair ?? 0));
  c.hasSide = sideFor();
  const D = () => (c.curView === 'side' ? HS : HF) || {};
  const layout = () => {
    const d = D(), FW = (d.frame || [48, 64])[0], FH = (d.frame || [48, 64])[1], k = 24 / FW, sx = flip ? -1 : 1;
    const ho = (d.hairOffset && d.hairOffset[frame]) || [0, 0];
    hair.setPosition(sx * ho[0] * k, ho[1] * k);
    if (wKey) {
      // 옆모습 손잡이 값이 없으면 정면 값을 쓴다 (같은 48x64 무기 그림)
      const g = (d.grip && d.grip[wKey]) || (HF && HF.grip && HF.grip[wKey]) || [FW / 2, FH], h = (d.hand && d.hand[frame]) || g;
      const ang = ((d.angle && d.angle[frame]) || 0) + extra;
      weapon.setOrigin(flip ? 1 - g[0] / FW : g[0] / FW, g[1] / FH);          // 손잡이를 회전축으로
      weapon.setPosition(sx * (h[0] - FW / 2) * k, (h[1] - FH) * k);
      weapon.setAngle(sx * ang);
    }
  };
  const tintAll = () => {
    body.setTint(LOOKS.skin[lk.skin] ?? LOOKS.skin[0]);
    hair.setTint(LOOKS.hairColor[lk.hairColor] ?? LOOKS.hairColor[0]);
  };
  const applyTextures = () => {
    const side = c.curView === 'side';
    if (frontOK) {
      body.setTexture(side ? 'player_body_side_anim' : 'player_body_anim', frame);
      clothes.setTexture(side ? 'player_clothes_side_anim' : 'player_clothes_anim', frame);
    }
    hair.setTexture('hair_' + (lk.hair ?? 0) + (side ? '_side' : ''));
    tintAll();
  };
  const setFrame = (i) => { frame = i; if (frontOK) { body.setFrame(i); clothes.setFrame(i); } layout(); };
  const stop = () => { if (timer) { timer.remove(false); timer = null; } };
  const loop = (name) => {
    const d = D(), base = (d.seq && d.seq[name === 'move' ? 'walk' : name]) || [0];
    const seq = name === 'idle' && base.length > 1 ? [base[0], base[0], base[0], base[0], base[0], base[1]] : base;
    let k = 0; setFrame(seq[0]);
    if (seq.length > 1) timer = scene.time.addEvent({ delay: name === 'idle' ? 330 : (c.curView === 'side' ? 120 : 110), loop: true, callback: () => { k = (k + 1) % seq.length; setFrame(seq[k]); } });
  };
  // 자세: idle / move(walk) 반복, 그 밖은 한 장면
  c.setPose = (name) => {
    if (name === 'walk') name = 'move';
    if (!frontOK) { c.curPose = name; return; }
    if (LOOP_POSES.has(name) && c.curPose === name && timer) return;
    stop(); c.curPose = name; extra = 0;
    if (LOOP_POSES.has(name)) loop(name);
    else setFrame((D().poses || {})[name] ?? 0);
  };
  c.play = (name) => c.setPose(name); // 예전 이름
  // 방향: 'front' | 'side' (+ flip=true 면 왼쪽)
  c.setView = (v, f) => {
    if (f !== undefined) flip = !!f;
    want = v;
    const nv = v === 'side' && c.hasSide ? 'side' : 'front';
    [body, clothes, hair, weapon].forEach(o => o.setFlipX(flip));
    if (nv !== c.curView) {
      c.curView = nv;
      const p = c.curPose || 'idle'; c.curPose = null;
      stop(); frame = 0; // 정면(10장)과 옆모습(14장)은 프레임 수가 달라 0번에서 다시 시작
      applyTextures(); c.setPose(p);
    } else layout();
  };
  c.setFlip = (f) => c.setView(c.curView, f);
  // 휘두르기 연출용 추가 각도 (프레임 각도에 더해짐)
  c.setSwing = (a) => { extra = a; layout(); };
  c.setLook = (l) => {
    lk = { ...lk, ...l };
    const had = c.hasSide; c.hasSide = sideFor();
    applyTextures(); layout();
    if (had !== c.hasSide) c.setView(want); // 머리 모양에 따라 옆모습을 켜고 끈다
  };
  c.setWeapon = (weaponId) => {
    const e = weaponId ? Data.equip(weaponId) : null;
    if (e && e.sprite && T.exists(e.sprite)) { wKey = e.sprite; weapon.setTexture(e.sprite).setVisible(true).setScale(1 / PX); }
    else { wKey = null; weapon.setVisible(false); }
    layout();
  };
  // 맞았을 때 하얗게 번쩍 → 원래 색
  c.flashWhite = (on) => {
    if (on) [body, clothes, hair, weapon].forEach(o => o.setTintFill(0xffffff));
    else { clothes.clearTint(); weapon.clearTint(); tintAll(); }
  };
  c.once('destroy', stop);
  applyTextures();
  c.setWeapon(opts.weapon !== undefined ? opts.weapon : (GameState.s ? GameState.s.player.equip.weapon : null));
  if (opts.view) c.setView(opts.view, opts.flip);
  if (opts.idle !== false) c.setPose('idle'); else setFrame(0);
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
// 그림의 논리 크기 (전투 거리 계산용)
export function bodyWidth(obj) {
  if (!obj) return 16;
  if (obj.isHero) return 14;
  return Math.max(10, (obj.displayWidth || 16) * 0.7);
}

export const SPRITE_KEYS = Object.keys(SPRITES);
