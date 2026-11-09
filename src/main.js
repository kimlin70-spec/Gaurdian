import { GAME_W, GAME_H } from './config.js';
import Audio from './systems/Audio.js';
import BootScene from './scenes/BootScene.js';
import TitleScene from './scenes/TitleScene.js';
import CharacterCreateScene from './scenes/CharacterCreateScene.js';
import StoryIntroScene from './scenes/StoryIntroScene.js';
import VillageScene from './scenes/VillageScene.js';
import FieldScene from './scenes/FieldScene.js';
import BattleScene from './scenes/BattleScene.js';
import PurifyScene from './scenes/PurifyScene.js';
import HomeScene from './scenes/HomeScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_W,
  height: GAME_H,
  backgroundColor: '#1a1b2e',
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [BootScene, TitleScene, CharacterCreateScene, StoryIntroScene, VillageScene, FieldScene, BattleScene, PurifyScene, HomeScene],
};

async function start() {
  // 한글 도트 폰트가 준비된 뒤에 게임을 시작 (실패해도 그냥 시작)
  try {
    if (document.fonts && document.fonts.load) {
      await Promise.race([
        Promise.all([document.fonts.load('11px Galmuri11'), document.fonts.load('bold 11px Galmuri11'), document.fonts.load('14px Galmuri14')]),
        new Promise(r => setTimeout(r, 3000)),
      ]);
    }
  } catch (e) { /* ignore */ }
  // 첫 터치에서 오디오 켜기 (iOS 사파리)
  const unlock = () => { Audio.unlock(); };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.game = new Phaser.Game(config);
}
start();
