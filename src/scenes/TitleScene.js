import { W, H, COLORS, PX } from '../config.js';
import Data from '../systems/Data.js';
import GameState from '../systems/GameState.js';
import Audio from '../systems/Audio.js';
import { txt, Button, confirm, soundButton, fadeIn, fadeOut, setupCamera } from '../systems/UI.js';
import { makeCharacter, img } from '../systems/Assets.js';

export default class TitleScene extends Phaser.Scene {
  constructor() { super('Title'); }
  create() {
    setupCamera(this);
    fadeIn(this, 300);
    Audio.playBgm('title');
    // 배경: 밤하늘 + 숲 실루엣
    this.add.rectangle(W / 2, H / 2, W, H, 0x1a1b2e);
    this.add.rectangle(W / 2, H - 30, W, 60, 0x1b3a2a);
    for (let i = 0; i < 40; i++) {
      const s = this.add.rectangle(Phaser.Math.Between(0, W), Phaser.Math.Between(0, 150), 1, 1, 0xffffff, Phaser.Math.FloatBetween(0.3, 1));
      this.tweens.add({ targets: s, alpha: 0.1, duration: Phaser.Math.Between(600, 1800), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 1000) });
    }
    for (let i = 0; i < 14; i++) img(this, i * 26 + 4 + (i % 2) * 6, H - 54 + (i % 3) * 4, 'tree').setOrigin(0.5, 1).setScale(1.5 / PX).setAlpha(0.7);

    const title = txt(this, W / 2, 62, Data.strings.gameTitle, { size: 14, origin: 0.5, color: COLORS.yellow, strokeThickness: 3 }).setScale(2);
    this.tweens.add({ targets: title, y: 66, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    txt(this, W / 2, 96, '아이패드로 즐기는 도트 모험', { size: 11, origin: 0.5, color: '#cfd8ff' });

    const hasSave = GameState.hasSave();
    let look = { skin: 0, hair: 0, hairColor: 0 };
    if (hasSave) { const s = GameState.load(); if (s) look = GameState.s.player.look; }
    const hero = makeCharacter(this, 52, H - 46, look).setScale(2);
    this.tweens.add({ targets: hero, y: hero.y - 3, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const guide = img(this, W - 56, H - 48, 'guide').setOrigin(0.5, 1).setScale(2 / PX);
    this.tweens.add({ targets: guide, y: guide.y - 4, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: 200 });

    const bw = 150, bx = (W - bw) / 2;
    if (hasSave) {
      new Button(this, bx, 122, bw, 26, '이어하기', () => this.continueGame(), { color: COLORS.ok, size: 11 });
    }
    new Button(this, bx, hasSave ? 154 : 130, bw, 26, '새로 시작', () => this.newGame(hasSave), { size: 11 });
    soundButton(this);
    txt(this, 4, H - 12, 'v0.5', { size: 11, color: '#8890aa', strokeThickness: 1 });
  }

  async newGame(hasSave) {
    if (hasSave) {
      const ok = await confirm(this, '저장된 모험이 지워져요.\n새로 시작할까요?', '네, 새로!', '아니요');
      if (!ok) return;
    }
    await fadeOut(this);
    this.scene.start('CharacterCreate', {});
  }

  async continueGame() {
    if (!GameState.load()) return;
    await fadeOut(this);
    const loc = GameState.s.location || { scene: 'Village' };
    if (loc.scene === 'Field' && Data.map(loc.stageId, loc.mapId)) this.scene.start('Field', { stageId: loc.stageId, mapId: loc.mapId, x: loc.x, y: loc.y });
    else this.scene.start('Village', {});
  }
}
