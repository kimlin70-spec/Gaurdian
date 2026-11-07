// 임시 도트 그래픽을 코드로 만듭니다.
// 나중에 진짜 PNG 가 생기면 data/assets.json 의 overrides 에 적으면 됩니다. (같은 키면 여기서 만들지 않음)
import { TILE } from '../config.js';

export const LOOKS = {
  skin: [0xf6d7b8, 0xd8a076, 0x8d5a3a],
  hairColor: [0x3b2314, 0xf2c14e, 0xc0392b, 0x1f1f1f],
  hairNames: ['단발', '긴 머리', '양갈래'],
  skinNames: ['밝은', '중간', '어두운'],
  hairColorNames: ['갈색', '노랑', '빨강', '검정'],
};

// 공용 팔레트. '.' 은 투명
const PAL = {
  '0': '#1b1b2a', '1': '#ffffff', '2': '#f3c9a5', '3': '#d98c5f', '4': '#8b5a2b', '5': '#5a3a1a',
  '6': '#e94f64', '7': '#f6b1c3', '8': '#4caf50', '9': '#2e7d32', 'A': '#ffd93b', 'B': '#5aa9ff',
  'C': '#8e6bd8', 'D': '#9e9e9e', 'E': '#cfcfcf', 'F': '#333333',
};

// ---- 주인공 (16x24). body / hair 는 흰색으로 그리고 tint 로 색을 입힌다 ----
const PLAYER_BODY = [
  '................', '................', '................',
  '.....000000.....', '....01111110....', '...0111111110...', '...0111111110...',
  '...0101111010...', '...0111111110...', '...0111001110...', '....01111110....',
  '.....0EEEE0.....', '................', '................',
  '..01........10..', '..01........10..', '..00........00..',
  '................', '................', '................',
  '....01100110....', '....01100110....', '................', '................',
];
const PLAYER_CLOTHES = [
  '................', '................', '................', '................', '................',
  '................', '................', '................', '................', '................',
  '................', '.....066660.....', '....06666660....', '...0666666660...',
  '....06666660....', '....06666660....', '...0666666660...', '..066617716660..',
  '..066666666660..', '..006666666600..', '....0000000.....', '................',
  '....05500550....', '....0000.0000...',
];
const HAIR = [
  [ // 단발
    '................', '................', '.....000000.....', '....01111110....', '...0111111110...',
    '..011111111110..', '..011100001110..', '..0110......0110', '..0110......0110', '...00........00.',
  ],
  [ // 긴 머리
    '................', '................', '.....000000.....', '....01111110....', '...0111111110...',
    '..011111111110..', '..011100001110..', '..0110......0110', '..0110......0110', '..0110......0110',
    '..0110......0110', '..0110......0110', '..0110......0110', '...00........00.',
  ],
  [ // 양갈래
    '................', '................', '.....000000.....', '....01111110....', '...0111111110...',
    '..011111111110..', '00011100001110 0'.replace(' ', '0'), '0110110..0110110', '0110110..0110110', '.00.00....00.00.',
  ],
];

// ---- 동물 / 적 / NPC ----
const SPRITES = {
  rabbit: [
    '....00....00....', '...0110..0110...', '...0170..0710...', '...0170..0710...', '...0110000110...',
    '..011111111110..', '.01111111111110.', '.01101111110110.', '.01111177111110.', '.01111111111110.',
    '..011111111110..', '..011111111110..', '.01111111111110.', '.01111111111110.', '..0110....0110..',
    '...00......00...',
  ],
  squirrel: [
    '..........0000..', '.........033330.', '..0.0...03333330', '.04040..03344330', '.04444003333330.',
    '.04F44F03333330.', '.0444440333330..', '..044440033330..', '..0333330.0330..', '..0333330.0330..',
    '..033333000330..', '.0333333333330..', '.033333333330...', '..03333333330...', '..0440..0440....',
    '..0000..0000....',
  ],
  boar: [
    '................', '..00........00..', '.0550......0550.', '.05555000005550.', '.05555555555550.',
    '0555555555555550', '05F5555555555F50', '0555555555555550', '0555555555555550', '.05555555555550.',
    '.05511555511550.', '..055555555550..', '..0550..0550....', '..0550..0550....', '..0000..0000....',
    '................',
  ],
  bear: [
    '........................', '...0000..........0000...', '..044440........044440..', '..043340........043340..',
    '..04444000000000044440..', '.0444444444444444444440.', '.0444444444444444444440.', '.04444F44444444F4444440.',
    '.0444444443333444444440.', '.0444444433333344444440.', '.0444444433553344444440.', '.0444444433333344444440.',
    '.0444444444444444444440.', '.0444444444444444444440.', '..04444444444444444440..', '..04444444444444444440..',
    '..04444444444444444440..', '..04444444444444444440..', '..04444444444444444440..', '..0444440......0444440..',
    '..0444440......0444440..', '..0444440......0444440..', '..0000000......0000000..', '........................',
  ],
  mushroom: [
    '......0000......', '....00CCCC00....', '...0CC1CCCC10...', '..0CCCCCC1CCC0..', '.0CC1CCCCCCCCC0.',
    '.0CCCCCC1CCC1C0.', '0CCCCCCCCCCCCCC0', '0000000000000000', '...0EEEEEEEE0...', '...0EFEEEEFE0...',
    '...0EEEEEEEE0...', '...0EEE00EEE0...', '...0EEEEEEEE0...', '...0EEEEEEEE0...', '...0EEEEEEEE0...',
    '...0000000000...',
  ],
  vine: [
    '.......0........', '......088.0.....', '.....0888080....', '....08998880....', '...0899880......',
    '...0898800.0....', '..08988F8880....', '..0898888880....', '..08899888F80...', '...0889999880...',
    '....0888998880..', '.0...088899880..', '.080..0888880...', '.0880..08880....', '..0880..000.....',
    '...000..........',
  ],
  guide: [ // 안내 동물(여우 모양, 보석 팔찌)
    '................', '...0......0.....', '..030....030....', '..0330..0330....', '..0333003330....',
    '..03333333330...', '.0333F333F3330..', '.0333333333330..', '.03331133133 0..'.replace(' ', '3'), '..0333333330....',
    '..033333330.....', '.03333333330.0..', '.0333A33330..30.', '.0333333330.330.', '..0330.0330330..',
    '...00...00000...',
  ],
  bird: [
    '................', '................', '......000.......', '.....0BBB0A0....', '....0BBFBBB0....',
    '...0BBBBBB0.....', '..0BBBBBBB0.....', '.0BBBBBBBBB0....', '0BB1BBBBBBB0....', '.0BBBBBBBB0.....',
    '..0BBBBBB0......', '...0BBBB0.......', '....0000........', '....0A0.........', '...0A0..........',
    '................',
  ],
  tree_face: [
    '....00000000....', '..009999999900..', '.09999999999990.', '.09999999999990.', '..009999999900..',
    '....00000000....', '...0444444440...', '...044F44F440...', '...0444444440...', '...04400004440..'.slice(0, 16),
    '...0444444440...', '...0444444440...', '...0444444440...', '...0444444440...', '..044444444440..',
    '..000000000000..',
  ],
  chest: [
    '................', '................', '................', '..000000000000..', '.04444444444440.',
    '.04444444444440.', '.00000000000000.', '.04444A44A44440.', '.04444AAAA44440.', '.04444A44A44440.',
    '.04444444444440.', '.04444444444440.', '.00000000000000.', '................', '................',
    '................',
  ],
  chest_open: [
    '................', '..000000000000..', '.04444444444440.', '.04444444444440.', '.04444444444440.',
    '.00000000000000.', '.0AAAAAAAAAAAA0.', '.00000000000000.', '.04444444444440.', '.04444AAAA44440.',
    '.04444444444440.', '.04444444444440.', '.00000000000000.', '................', '................',
    '................',
  ],
  gem: [
    '................', '................', '................', '......0000......', '.....077770.....',
    '....07711770....', '...0771111770...', '...0777117770...', '....07777770....', '.....077770.....',
    '......0770......', '.......00.......', '................', '................', '................',
    '................',
  ],
  star: [
    '................', '.......A........', '......AAA.......', '......AAA.......', '.AAAAAAAAAAAAA..',
    '..AAAAAAAAAAA...', '...AAAAAAAAA....', '....AAAAAAA.....', '....AAAAAAA.....', '...AAAA.AAAA....',
    '..AAA.....AAA...', '.AA.........AA..', '................', '................', '................',
    '................',
  ],
  cursor: [
    '................', '.......00.......', '......0AA0......', '......0AA0......', '.....0AAAA0.....',
    '.....0AAAA0.....', '....0AAAAAA0....', '....0AAAAAA0....', '...0AAAAAAAA0...', '...000000000 ...'.replace(' ', '0'),
    '................', '................', '................', '................', '................',
    '................',
  ],
};

// 자리표시자용 알파벳 팔레트 → Phaser generate 형식
function gen(scene, key, rows, palette = PAL) {
  if (scene.textures.exists(key)) return;
  scene.textures.generate(key, { data: rows, palette, pixelWidth: 1, pixelHeight: 1 });
}

// 간단한 결정적 난수 (타일 무늬용)
function rng(seed) { let s = seed; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

// ---- 타일 (16x16 x N) ----
const TILE_COUNT = 12;
function drawTile(ctx, idx, ox) {
  const r = rng(idx * 7 + 3);
  const fill = (c, x = 0, y = 0, w = TILE, h = TILE) => { ctx.fillStyle = c; ctx.fillRect(ox + x, y, w, h); };
  const speck = (c, n) => { ctx.fillStyle = c; for (let i = 0; i < n; i++) ctx.fillRect(ox + Math.floor(r() * TILE), Math.floor(r() * TILE), 1, 1); };
  switch (idx) {
    case 0: fill('#5cb85c'); speck('#4ca84c', 14); speck('#7ed07e', 6); break; // 풀
    case 1: // 나무
      fill('#5cb85c'); speck('#4ca84c', 10);
      fill('#2e7d32', 2, 1, 12, 11); fill('#1b5e20', 1, 3, 14, 7); fill('#2e7d32', 3, 2, 10, 9);
      fill('#43a047', 4, 2, 5, 4); fill('#5a3a1a', 6, 11, 4, 5); break;
    case 2: fill('#d9b57a'); speck('#c9a46a', 10); speck('#e8c98e', 6); break; // 길
    case 3: fill('#4a90e2'); ctx.fillStyle = '#7fb6f2'; ctx.fillRect(ox + 2, 4, 6, 1); ctx.fillRect(ox + 9, 10, 5, 1); ctx.fillRect(ox + 1, 13, 4, 1); break; // 물
    case 4: fill('#5cb85c'); speck('#4ca84c', 10); fill('#ff6fa0', 3, 4, 3, 3); fill('#ffd93b', 4, 5, 1, 1); fill('#ffffff', 9, 9, 3, 3); fill('#ffd93b', 10, 10, 1, 1); break; // 꽃
    case 5: fill('#6f6a8a'); speck('#5d5876', 14); speck('#857fa3', 5); break; // 오염된 풀
    case 6: // 오염된 나무
      fill('#6f6a8a'); speck('#5d5876', 10);
      fill('#3d3357', 2, 1, 12, 11); fill('#2a2240', 1, 3, 14, 7); fill('#4a3d6b', 3, 2, 10, 9); fill('#2b1f3a', 6, 11, 4, 5); break;
    case 7: fill('#5cb85c'); speck('#4ca84c', 8); fill('#7a7a7a', 2, 4, 12, 10); fill('#9e9e9e', 3, 3, 9, 8); fill('#bdbdbd', 4, 4, 4, 3); break; // 바위
    case 8: fill('#8d8a9e'); speck('#7c7990', 10); ctx.fillStyle = '#6f6c82'; ctx.fillRect(ox, 7, 16, 1); ctx.fillRect(ox + 7, 0, 1, 8); ctx.fillRect(ox + 12, 8, 1, 8); break; // 돌바닥
    case 9: fill('#4a4760'); ctx.fillStyle = '#5e5a78'; for (let y = 0; y < 16; y += 4) { const off = (y / 4) % 2 ? 4 : 0; for (let x = off; x < 16; x += 8) ctx.fillRect(ox + x + 1, y + 1, 6, 2); } break; // 돌벽
    case 10: fill('#5cb85c'); speck('#4ca84c', 8); fill('#2e7d32', 1, 4, 14, 10); fill('#43a047', 3, 3, 10, 8); fill('#66bb6a', 5, 4, 4, 3); break; // 덤불
    case 11: fill('#c8a97e'); speck('#b8996e', 12); speck('#d8b98e', 6); break; // 마을 바닥
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
  for (const [key, rows] of Object.entries(SPRITES)) gen(scene, key, rows);
  // 1x1 흰 점 (파티클/플래시용)
  if (!scene.textures.exists('dot')) {
    const t = scene.textures.createCanvas('dot', 2, 2); t.getContext().fillStyle = '#fff'; t.getContext().fillRect(0, 0, 2, 2); t.refresh();
  }
}

// 주인공 캐릭터(몸+옷+머리) 컨테이너. origin 은 발 아래 가운데(0.5, 1).
export function makeCharacter(scene, x, y, look) {
  const body = scene.add.image(0, 0, 'player_body').setOrigin(0.5, 1).setTint(LOOKS.skin[look.skin] ?? LOOKS.skin[0]);
  const clothes = scene.add.image(0, 0, 'player_clothes').setOrigin(0.5, 1);
  const hair = scene.add.image(0, -24 + (HAIR[look.hair] || HAIR[0]).length, 'hair_' + (look.hair ?? 0)).setOrigin(0.5, 1)
    .setTint(LOOKS.hairColor[look.hairColor] ?? LOOKS.hairColor[0]);
  const c = scene.add.container(x, y, [body, clothes, hair]);
  c.setSize(16, 24);
  c.parts = { body, clothes, hair };
  c.setLook = (lk) => {
    body.setTint(LOOKS.skin[lk.skin]); hair.setTexture('hair_' + lk.hair); hair.y = -24 + HAIR[lk.hair].length; hair.setTint(LOOKS.hairColor[lk.hairColor]);
  };
  c.setFlip = (f) => { body.setFlipX(f); clothes.setFlipX(f); hair.setFlipX(f); };
  return c;
}

// 유닛의 sprite 이름으로 전투/필드 스프라이트 만들기 (주인공이면 컨테이너)
export function makeUnitSprite(scene, unit, x, y, look) {
  if (unit.sprite === 'player') return makeCharacter(scene, x, y, look);
  const img = scene.add.image(x, y, unit.sprite).setOrigin(0.5, 1);
  if (unit.scale && unit.scale !== 1) img.setScale(unit.scale);
  return img;
}

export const SPRITE_KEYS = Object.keys(SPRITES);
