// 게임 전역 상수. 숫자를 바꾸면 전체에 반영됩니다.
export const W = 320;
export const H = 240;
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
};
export const SOLID_TILES = new Set([1, 3, 6, 7, 9, 10]);
