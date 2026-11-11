// 인트로 / 엔딩 컷신. data/dialogues.json 의 intro, ending 페이지를 보여준다.
import { W, H, COLORS, PX } from '../config.js';
import Data from '../systems/Data.js';
import GameState from '../systems/GameState.js';
import Audio from '../systems/Audio.js';
import { txt, Button, panel, fadeIn, fadeOut, DEPTH, setupCamera } from '../systems/UI.js';
import { makeCharacter, img, unit, setView } from '../systems/Assets.js';

const BG = {
  real:   { sky: 0x87ceeb, ground: 0x6ab04c },
  portal: { sky: 0x3b2a6b, ground: 0x6a4fb3 },
  forest: { sky: 0x1b3a2a, ground: 0x2e7d32 },
};

export default class StoryIntroScene extends Phaser.Scene {
  constructor() { super('StoryIntro'); }
  init(data) { this.key = (data && data.key) || 'intro'; }
  create() {
    setupCamera(this);
    fadeIn(this);
    Audio.playBgm(this.key === 'ending' ? 'victory' : 'title');
    this.pages = (Data.dialogues[this.key] || []).map(p => ({ ...p, text: Data.fmt(p.text) }));
    this.idx = 0;
    this.sky = this.add.rectangle(W / 2, H / 2, W, H, 0x000000);
    this.ground = this.add.rectangle(W / 2, H - 40, W, 80, 0x000000);
    this.stars = [];
    for (let i = 0; i < 20; i++) {
      const s = this.add.rectangle(Phaser.Math.Between(0, W), Phaser.Math.Between(0, 120), 2, 2, 0xffffff, 0.8).setVisible(false);
      this.tweens.add({ targets: s, alpha: 0.2, duration: Phaser.Math.Between(500, 1500), yoyo: true, repeat: -1 });
      this.stars.push(s);
    }
    const look = GameState.s ? GameState.s.player.look : { skin: 0, hair: 0, hairColor: 0 };
    this.hero = makeCharacter(this, 110, 164, look).setScale(2.5);
    this.guide = unit(this, 200, 164, 'guide').setOrigin(0.5, 1).setScale(2.5 / PX);
    setView(this.guide, 'side', true); // 왼쪽의 그레이스를 본다
    this.gem = img(this, 200, 128, 'gem').setScale(1.5 / PX).setVisible(false);
    this.tweens.add({ targets: this.gem, y: 122, alpha: { from: 1, to: 0.5 }, duration: 500, yoyo: true, repeat: -1 });

    panel(this, 4, H - 62, W - 8, 58, { depth: DEPTH.DIALOG, color: 0x1e2040 });
    this.nameText = txt(this, 12, H - 58, '', { size: 11, color: COLORS.yellow, depth: DEPTH.DIALOG + 1 });
    this.body = txt(this, 12, H - 44, '', { size: 11, wrap: W - 28, depth: DEPTH.DIALOG + 1, lineSpacing: 3 });
    this.more = txt(this, W - 14, H - 14, '▼', { size: 11, origin: 0.5, color: COLORS.yellow, depth: DEPTH.DIALOG + 1 });
    this.tweens.add({ targets: this.more, y: this.more.y + 2, duration: 400, yoyo: true, repeat: -1 });

    this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.001).setInteractive().on('pointerup', () => this.next());
    new Button(this, W - 70, 4, 66, 20, '건너뛰기', () => this.finish(), { depth: DEPTH.TOP, color: 0x333355 });
    this.render();
  }
  render() {
    const p = this.pages[this.idx];
    if (!p) return this.finish();
    const bg = BG[p.bg] || BG.forest;
    this.sky.setFillStyle(bg.sky); this.ground.setFillStyle(bg.ground);
    this.stars.forEach(s => s.setVisible(p.bg !== 'real'));
    this.gem.setVisible(p.bg === 'portal');
    const who = p.who === 'hero' ? Data.strings.heroName : p.who === 'guide' ? Data.strings.guideAnimal : '';
    this.nameText.setText(who);
    this.body.setText(p.text);
    this.body.y = who ? H - 44 : H - 54;
    this.more.setVisible(this.idx < this.pages.length - 1);
    // 말하는 쪽이 콩콩 뛴다
    const target = p.who === 'hero' ? this.hero : p.who === 'guide' ? this.guide : null;
    if (target) this.tweens.add({ targets: target, y: target.y - 8, duration: 120, yoyo: true, repeat: 1 });
  }
  next() { Audio.sfx('tap'); this.idx += 1; if (this.idx >= this.pages.length) this.finish(); else this.render(); }
  async finish() {
    if (this.done) return; this.done = true;
    await fadeOut(this, 400);
    if (this.key === 'intro') {
      GameState.s.flags.introSeen = true; GameState.save();
      this.scene.start('Village', { welcome: true });
    } else {
      GameState.save();
      this.scene.start('Title', {});
    }
  }
}
