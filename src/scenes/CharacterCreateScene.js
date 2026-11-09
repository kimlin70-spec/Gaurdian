import { W, H, COLORS, PX } from '../config.js';
import Data from '../systems/Data.js';
import GameState from '../systems/GameState.js';
import Audio from '../systems/Audio.js';
import { txt, Button, panel, fadeIn, fadeOut, DEPTH, setupCamera } from '../systems/UI.js';
import { makeCharacter, LOOKS, img } from '../systems/Assets.js';

export default class CharacterCreateScene extends Phaser.Scene {
  constructor() { super('CharacterCreate'); }
  create() {
    setupCamera(this);
    fadeIn(this);
    this.look = { skin: 0, hair: 0, hairColor: 0 };
    this.add.rectangle(W / 2, H / 2, W, H, 0x24314a);
    txt(this, W / 2, 10, '나를 꾸며요!', { size: 14, origin: 0.5, color: COLORS.yellow });

    // 미리보기
    panel(this, 10, 28, 96, 150, { color: 0x3a4a6a });
    this.add.rectangle(58, 172, 60, 6, 0x000000, 0.25).setDepth(DEPTH.UI + 1);
    this.preview = makeCharacter(this, 58, 172, this.look).setScale(3.5).setDepth(DEPTH.UI + 1);
    txt(this, 58, 34, Data.strings.heroName, { size: 11, origin: [0.5, 0], color: '#fff' });

    // 선택 줄들
    const x0 = 118, colW = 190;
    this.swatchRow('피부색', 30, LOOKS.skin, 'skin');
    this.textRow('머리 모양', 80, LOOKS.hairNames, 'hair');
    this.swatchRow('머리 색', 130, LOOKS.hairColor, 'hairColor');

    new Button(this, x0, 186, colW, 30, '완성!', () => this.finish(), { color: COLORS.ok, size: 14 });
    this.refresh();
  }

  swatchRow(label, y, colors, key) {
    txt(this, 118, y, label, { size: 11 });
    this[key + 'Marks'] = [];
    colors.forEach((c, i) => {
      const x = 118 + i * 40, sy = y + 16;
      const r = this.add.rectangle(x + 15, sy + 12, 30, 24, c).setStrokeStyle(1, 0x000000).setInteractive({ useHandCursor: true });
      const mark = this.add.rectangle(x + 15, sy + 12, 34, 28, 0xffffff, 0).setStrokeStyle(2, COLORS.gold);
      this[key + 'Marks'].push(mark);
      r.on('pointerup', () => { Audio.sfx('tap'); this.look[key] = i; this.refresh(); });
    });
  }
  textRow(label, y, names, key) {
    txt(this, 118, y, label, { size: 11 });
    this[key + 'Buttons'] = names.map((n, i) => new Button(this, 118 + i * 64, y + 16, 60, 24, n, () => { this.look[key] = i; this.refresh(); }));
  }
  refresh() {
    this.preview.setLook(this.look);
    for (const key of ['skin', 'hairColor']) this[key + 'Marks'].forEach((m, i) => m.setVisible(i === this.look[key]));
    this.hairButtons.forEach((b, i) => b.setColor(i === this.look.hair ? COLORS.ok : COLORS.button));
  }
  async finish() {
    GameState.newGame({ ...this.look });
    GameState.save();
    await fadeOut(this);
    this.scene.start('StoryIntro', { key: 'intro' });
  }
}
