// 게임 전역 상수. 숫자를 바꾸면 전체에 반영됩니다.
export const W = 320;
export const H = 240;
// 그림 밀도: 모든 PNG/임시 그림은 논리 픽셀의 PX 배 크기. 캔버스도 PX 배(640x480)로 그려 디테일을 살린다.
export const PX = 4;
export const GAME_W = W * PX;
export const GAME_H = H * PX;
// 카메라 줌 때문에 scrollFactor 0 인 UI 는 이만큼 옮겨 놓아야 제자리에 보인다
export const FIX_X = W * (PX - 1) / 2;
export const FIX_Y = H * (PX - 1) / 2;
export const TILE = 16;
export const SAVE_KEY = 'guardian_save_v1';
export const SETTINGS_KEY = 'guardian_settings_v1';

export const FONT = 'Galmuri11';
export const FONT_BIG = 'Galmuri14';

export const COLORS = {
  bg: 0x1a1b2e,
  panel: 0x2b2d4a,
  panelLight: 0x3d4066,
  border: 0xf4f1de,
  button: 0x4a6fa5,
  buttonDown: 0x2e4a73,
  buttonDisabled: 0x55576a,
  danger: 0xc0392b,
  ok: 0x3fa34d,
  gold: 0xf5c542,
  purify: 0xff6fd8,
  hp: 0x4cd964,
  hpLow: 0xe74c3c,
  mp: 0x5aa9ff,
  white: '#ffffff',
  yellow: '#ffe066',
  shadow: '#000000',
};

// 타일 문자 → 타일 번호 (data/stages.json 의 rows 에 사용)
export const TILE_LEGEND = {
  '.': 0, // 풀
  'T': 1, // 나무 (못 지나감)
  '=': 2, // 길
  '~': 3, // 물 (못 지나감)
  '*': 4, // 꽃
  'd': 5, // 오염된 풀
  'D': 6, // 오염된 나무 (못 지나감)
  'r': 7, // 바위 (못 지나감)
  's': 8, // 돌바닥
  '#': 9, // 돌벽 (못 지나감)
  'b': 10, // 덤불 (못 지나감)
  'p': 11, // 마을 바닥(흙)
  // ---- 눈 숲 (12~19 는 tiles_snow 텍스처) ----
  'S': 12, // 눈
  'W': 13, // 눈 덮인 나무 (못 지나감)
  'I': 14, // 얼음 호수 (못 지나감)
  'F': 15, // 오염된 눈
  'X': 16, // 오염된 눈 나무 (못 지나감)
  'R': 17, // 눈 덮인 바위 (못 지나감)
  'P': 18, // 눈길
  'c': 19, // 얼음꽃
};
export const SOLID_TILES = new Set([1, 3, 6, 7, 9, 10, 13, 14, 16, 17]);
export const SNOW_FIRST_TILE = 12;

// 옆모습 그림을 쓸지 (false 면 모든 캐릭터가 정면만 본다)
export const SIDE_VIEWS = true;

// 월드 오브젝트의 깊이: y 가 클수록 앞. UI(50 이상)보다 항상 작게.
export const wd = (y) => 1 + y / 1000;
