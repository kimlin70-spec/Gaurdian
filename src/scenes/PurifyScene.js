// 보스 정화 후: 숲이 회복되는 연출 → 스테이지 클리어
import { W, H, TILE, COLORS, PX } from '../config.js';
import Data from '../systems/Data.js';
import { img } from '../systems/Assets.js';
import GameState from '../systems/GameState.js';
import Audio from '../systems/Audio.js';
import { txt, DialogBox, fadeIn, fadeOut, tween, wait, setupCamera } from '../systems/UI.js';
import { themeOf, unit, fx } from '../systems/Assets.js';

export default class PurifyScene extends Phaser.Scene {
  constructor() { super('Purify'); }
  init(data) { this.p = data || {}; }
  create() {
    setupCamera(this);
    fadeIn(this, 400);
    Audio.playBgm('victory');
    const cols = Math.ceil(W / TILE), rows = Math.ceil(H / TILE);
    const rng = (i) => ((i * 9301 + 49297) % 233280) / 233280;
    this.dark = []; this.green = [];
    const th = themeOf(this.p.stageId);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = y * cols + x, r = rng(i);
      const tree = r < 0.22 && !(y > 5 && y < 10 && x > 6 && x < 13);
      this.dark.push(img(this, x * TILE, y * TILE, th.tilesKey, th.corrupt).setOrigin(0));
      this.green.push(img(this, x * TILE, y * TILE, th.tilesKey, r > 0.9 ? th.flower : th.base).setOrigin(0).setAlpha(0));
      if (tree) {
        this.dark.push(img(this, x * TILE + 8, (y + 1) * TILE, th.treeDark).setOrigin(0.5, 1).setDepth(2));
        this.green.push(img(this, x * TILE + 8, (y + 1) * TILE, th.tree).setOrigin(0.5, 1).setDepth(3).setAlpha(0));
      }
    }
    const boss = Data.enemy(this.p.bossId);
    this.bear = unit(this, W / 2, 150, boss.sprite).setOrigin(0.5, 1).setScale(2 / PX).setTint(0x9a7fd6).setDepth(10);
    this.dialog = new DialogBox(this);
    this.play();
  }
  async play() {
    await wait(this, 500);
    Audio.sfx('purify'); fx(this, 'fx_purify_anim', W / 2, 120, 3, 25);
    // 빛의 원이 퍼지면서 숲이 초록으로
    const ring = this.add.circle(W / 2, 130, 4, 0xffffff, 0.8).setDepth(20);
    this.tweens.add({ targets: ring, radius: 260, alpha: 0, duration: 1800, ease: 'Quad.easeOut', onUpdate: () => { ring.setRadius(ring.radius); } });
    const cols = Math.ceil(W / TILE);
    this.green.forEach((g) => {
      const d = Phaser.Math.Distance.Between(g.x, g.y, W / 2, 130);
      this.tweens.add({ targets: g, alpha: 1, delay: d * 5, duration: 400 });
    });
    const from = Phaser.Display.Color.ValueToColor(0x9a7fd6), to = Phaser.Display.Color.ValueToColor(0xffffff);
    await tween(this, { targets: { v: 0 }, v: 100, duration: 1500, onUpdate: (tw) => { const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, tw.getValue()); this.bear.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b)); } });
    this.bear.clearTint();
    for (let i = 0; i < 12; i++) {
      const s = img(this, Phaser.Math.Between(20, W - 20), Phaser.Math.Between(20, H - 40), 'star').setScale(0.5 / PX).setAlpha(0).setDepth(15);
      this.tweens.add({ targets: s, alpha: 1, y: s.y - 10, duration: 500, yoyo: true, delay: i * 120, onComplete: () => s.destroy() });
    }
    await wait(this, 600);
    // 보스 대사는 전투에서 이미 보여줬으니 여기서는 스테이지 클리어 대사만
    const stName = Data.stage(this.p.stageId).name;
    await this.dialog.show(Data.dialogues.stageClear.map(l => Data.fmt(l, { stage: stName })));
    const s = GameState.s;
    s.flags.cleared[this.p.stageId] = true;
    GameState.healAll();
    GameState.setLocation({ scene: 'Village' });
    GameState.save();
    await fadeOut(this, 500);
    const st = Data.stage(this.p.stageId);
    if (st.final) this.scene.start('StoryIntro', { key: 'ending' });
    else this.scene.start('Village', { cleared: this.p.stageId, at: 'gate' });
  }
}
