// 왕궁: 한 화면짜리 방들을 오간다 (앞마당 → 알현실 → 공주 방 / 업무실 → 지하 던전 → 지하감옥)
// 좌표는 논리 화면(320x240) 기준. 배경 그림(bg_palace_*)은 화면 전체를 덮는다.
import { W, H, COLORS, wd, PX } from '../config.js';
import Data from '../systems/Data.js';
import GameState from '../systems/GameState.js';
import Audio from '../systems/Audio.js';
import { txt, Button, panel, UIGroup, DialogBox, toast, soundButton, fadeIn, fadeOut, DEPTH, setupCamera, moneyTag } from '../systems/UI.js';
import { openStatusMenu } from '../systems/Menu.js';
import { makeCharacter, img, unit, setPose, face } from '../systems/Assets.js';

const CORRUPT_TINT = 0x9a7fd6;
// floor: 걸을 수 있는 바닥 [x0, y0, x1, y1] (발 위치). doors: 탭하면 걸어가서 다른 방으로.
const ROOMS = {
  courtyard: { name: '왕궁 앞마당', bg: 'bg_palace_courtyard', floor: [34, 136, 286, 226], start: [160, 200],
    npcs: [{ id: 'guard', sprite: 'npc_palace_guard', x: 200, y: 147 }],
    props: [{ sprite: 'deco_palace_fountain', x: 72, y: 172 }],
    doors: [{ x: 160, y: 138, to: 'throne', label: '▲ 들어가기' }, { x: 160, y: 226, to: 'village', label: '▼ 마을' }] },
  throne: { name: '임금님의 방', bg: 'bg_palace_throne', floor: [58, 122, 262, 226], start: [160, 200],
    npcs: [{ id: 'king', sprite: 'npc_royal_king', x: 160, y: 116 }, { id: 'steward', sprite: 'npc_palace_steward', x: 215, y: 143 }],
    doors: [{ x: 62, y: 200, to: 'princess', label: '◀ 공주 방' }, { x: 258, y: 200, to: 'staff', label: '일하는 방 ▶' }, { x: 160, y: 226, to: 'courtyard', label: '▼ 앞마당' }] },
  princess: { name: '공주 방', bg: 'bg_palace_princess', floor: [82, 118, 238, 226], start: [160, 200],
    npcs: [{ id: 'princess', sprite: 'npc_princess', x: 202, y: 142 }],
    doors: [{ x: 160, y: 226, to: 'throne', label: '▼ 임금님의 방' }] },
  staff: { name: '일하는 방', bg: 'bg_palace_staff', floor: [42, 120, 280, 226], start: [160, 200],
    npcs: [{ id: 'cook', sprite: 'npc_palace_cook', x: 69, y: 142 }, { id: 'maid', sprite: 'npc_palace_maid', x: 223, y: 139 }],
    props: [{ sprite: 'prop_dungeon_stairs', x: 268, y: 168, flat: true }],
    doors: [{ x: 268, y: 160, to: 'dungeon', label: '지하 ▼' }, { x: 160, y: 226, to: 'throne', label: '▼ 임금님의 방' }] },
  dungeon: { name: '지하 던전', bg: 'bg_palace_dungeon', floor: [46, 118, 276, 226], start: [160, 205], dark: true,
    npcs: [{ id: 'dguard', sprite: 'npc_palace_guard', x: 252, y: 132 }],
    chest: { x: 44, y: 108, w: 34, h: 26, item: 'potion_l', count: 1 },
    enemies: 3,
    doors: [{ x: 150, y: 120, to: 'prison', label: '▲ 감옥' }, { x: 160, y: 226, to: 'staff', label: '▼ 위로' }] },
  prison: { name: '지하감옥', bg: 'bg_palace_prison', floor: [54, 124, 270, 226], start: [160, 200], dark: true,
    npcs: [{ id: 'pguard', sprite: 'npc_palace_guard', x: 243, y: 142 }, { id: 'wisp', sprite: 'mist_wisp', x: 262, y: 92 }],
    doors: [{ x: 160, y: 226, to: 'dungeon', label: '▼ 던전' }] },
};
// 던전에 나오는 오염된 무리 (숲을 깨끗하게 할수록 더 센 무리)
const DUNGEON_GROUPS = [
  [['mushroom'], ['vine', 'mushroom'], ['squirrel_c']],
  [['frost_vine'], ['snowman_c', 'frost_vine'], ['penguin_c']],
];

export default class PalaceScene extends Phaser.Scene {
  constructor() { super('Palace'); }
  init(data) { this.p = data || {}; }

  create() {
    setupCamera(this);
    fadeIn(this);
    const s = GameState.s;
    this.roomId = ROOMS[this.p.room] ? this.p.room : 'courtyard';
    const R = this.room = ROOMS[this.roomId];
    this.busy = false; this.leaving = false; this.pending = null; this.walkTween = null; this.enemies = [];
    Audio.playBgm(R.dark ? 'field' : 'village');
    GameState.setLocation({ scene: 'Village' }); // 이어하기는 마을에서
    GameState.save();

    if (this.textures.exists(R.bg)) img(this, W / 2, H / 2, R.bg).setDepth(0);
    else this.add.rectangle(W / 2, H / 2, W, H, R.dark ? 0x3a3f66 : 0xe8cfa0);

    // 문 (탭하면 걸어가서 이동)
    for (const d of R.doors) {
      const ly = Phaser.Math.Clamp(d.y - (d.y > 200 ? 0 : 20), 30, H - 10);
      const t = txt(this, Phaser.Math.Clamp(d.x, 34, W - 34), ly, d.label, { size: 11, origin: 0.5, color: COLORS.yellow, depth: DEPTH.WORLD_UI });
      this.tweens.add({ targets: t, alpha: 0.55, duration: 700, yoyo: true, repeat: -1 });
      const hit = this.add.rectangle(d.x, ly, Math.max(52, t.width + 12), 26, 0xffffff, 0.001).setDepth(DEPTH.WORLD_UI).setInteractive({ useHandCursor: true });
      hit.on('pointerup', (p) => { if (!this.busy && p.getDistance() <= 10 * PX) this.walkTo(d.x, d.y, { door: d }); });
    }
    // 소품
    for (const pr of R.props || []) if (this.textures.exists(pr.sprite)) img(this, pr.x, pr.y, pr.sprite).setOrigin(0.5, 1).setDepth(pr.flat ? 0.5 : wd(pr.y));
    // 사람들
    for (const n of R.npcs || []) {
      if (!this.textures.exists(n.sprite)) continue;
      const info = (Data.dialogues.palace || {})[n.id] || {};
      const sp = unit(this, n.x, n.y, n.sprite).setOrigin(0.5, 1).setDepth(wd(n.y));
      this.tweens.add({ targets: sp, y: n.y - 1.5, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      if (info.name) txt(this, n.x, n.y + 1, info.name, { size: 11, origin: [0.5, 0], color: COLORS.yellow, depth: DEPTH.WORLD_UI });
      sp.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-6 * PX, -6 * PX, sp.width + 12 * PX, sp.height + 12 * PX), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
      sp.on('pointerup', (p) => { if (!this.busy && p.getDistance() <= 10 * PX) this.walkTo(n.x + (this.hero.x < n.x ? -16 : 16), n.y + 6, { npc: n }); });
    }
    // 보물 상자 (배경에 그려져 있는 상자)
    if (R.chest) {
      const c = R.chest, key = `palace:${this.roomId}`;
      const hit = this.add.rectangle(c.x, c.y, c.w, c.h, 0xffffff, 0.001).setInteractive({ useHandCursor: true }).setDepth(DEPTH.WORLD_UI);
      if (!s.flags.chests[key]) { this.chestMark = txt(this, c.x, c.y - 22, '!', { size: 14, origin: 0.5, color: COLORS.yellow, depth: DEPTH.WORLD_UI }); this.tweens.add({ targets: this.chestMark, y: c.y - 25, duration: 400, yoyo: true, repeat: -1 }); }
      hit.on('pointerup', (p) => { if (!this.busy && p.getDistance() <= 10 * PX) this.walkTo(c.x + 14, R.floor[1] + 2, { chest: key }); });
    }
    // 던전의 오염된 무리: 하루에 한 번씩 다시 나타난다
    if (R.enemies) {
      const d = s.flags.dungeon = (s.flags.dungeon && s.flags.dungeon.day === s.day) ? s.flags.dungeon : { day: s.day, done: {} };
      if (this.p.won !== undefined && this.p.won !== null) { d.done[this.p.won] = true; GameState.save(); }
      const tier = s.flags.cleared.stage1 ? 1 : 0, spots = [[90, 150], [215, 175], [120, 205]];
      DUNGEON_GROUPS[tier].slice(0, R.enemies).forEach((group, i) => {
        if (d.done[i]) return;
        const data = Data.enemy(group[0]); if (!data) return;
        const [x, y] = spots[i];
        const sp = unit(this, x, y, data.sprite).setOrigin(0.5, 1).setDepth(wd(y)).setTint(CORRUPT_TINT);
        const en = { i, group, sprite: sp };
        const roam = () => {
          if (!sp.active || this.busy || this.leaving) return;
          const tx = Phaser.Math.Clamp(sp.x + Phaser.Math.Between(-40, 40), R.floor[0] + 10, R.floor[2] - 10), ty = Phaser.Math.Clamp(sp.y + Phaser.Math.Between(-24, 24), R.floor[1] + 16, R.floor[3] - 6);
          face(sp, tx - sp.x, ty - sp.y); setPose(sp, 'move');
          this.tweens.add({ targets: sp, x: tx, y: ty, duration: Phaser.Math.Distance.Between(sp.x, sp.y, tx, ty) * 30 + 100, onUpdate: () => sp.setDepth(wd(sp.y)), onComplete: () => { if (sp.active) setPose(sp, 'idle'); } });
        };
        this.time.addEvent({ delay: 1800 + i * 300, loop: true, callback: roam });
        this.enemies.push(en);
      });
    }

    // 주인공
    const st = Number.isFinite(this.p.x) ? [this.p.x, this.p.y] : this.entryPoint();
    this.hero = makeCharacter(this, st[0], st[1], s.player.look); this.hero.setDepth(wd(st[1]));
    this.safeUntil = this.time.now + 1500;

    // 화면 위 표시
    panel(this, 2, 2, 110, 18, { color: 0x000000, alpha: 0.55, border: false });
    moneyTag(this, 6, 4).set(s.stardust, s.shards);
    const nameT = txt(this, W / 2, 26, R.name, { size: 14, origin: 0.5, color: COLORS.yellow });
    this.tweens.add({ targets: nameT, alpha: 0, delay: 2200, duration: 600 });
    soundButton(this);
    new Button(this, W - 84, 4, 50, 18, '메뉴', () => {
      if (this.busy || this.leaving) return;
      if (this.walkTween) { this.walkTween.stop(); this.walkTween = null; setPose(this.hero, 'idle'); }
      this.busy = true; this.pending = null;
      openStatusMenu(this, { onClose: () => { this.busy = false; this.hero.refresh(); } });
    }, { depth: DEPTH.TOP, color: 0x333355 });
    this.dialog = new DialogBox(this);

    // 바닥을 탭하면 걸어간다
    this.input.on('pointerup', (pointer, over) => {
      if (this.busy || this.leaving || pointer.getDistance() > 10 * PX) return;
      if (over && over.length) return;
      this.walkTo(pointer.worldX, pointer.worldY);
    });
  }

  // 다른 방에서 들어왔을 때 서는 자리: 그 방으로 가는 문 앞
  entryPoint() {
    const R = this.room, from = R.doors.find(d => d.to === this.p.from);
    if (!from) return R.start;
    const f = R.floor;
    return [Phaser.Math.Clamp(from.x, f[0] + 8, f[2] - 8), Phaser.Math.Clamp(from.y + (from.y > 200 ? -14 : 14), f[1] + 4, f[3] - 6)];
  }
  walkTo(x, y, pending) {
    const f = this.room.floor;
    x = Phaser.Math.Clamp(x, f[0], f[2]); y = Phaser.Math.Clamp(y, f[1], f[3]);
    this.pending = pending || null;
    if (this.walkTween) this.walkTween.stop();
    const dist = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, x, y);
    if (dist < 2) return this.arrive();
    face(this.hero, x - this.hero.x, y - this.hero.y); setPose(this.hero, 'move');
    this.walkTween = this.tweens.add({ targets: this.hero, x, y, duration: dist * 11, ease: 'Linear',
      onUpdate: () => this.hero.setDepth(wd(this.hero.y)), onComplete: () => { this.walkTween = null; this.arrive(); } });
  }
  arrive() {
    setPose(this.hero, 'idle');
    const p = this.pending; this.pending = null;
    if (!p || this.busy) return;
    if (p.door) return this.go(p.door);
    if (p.npc) { face(this.hero, p.npc.x - this.hero.x, 0); return this.talk(p.npc); }
    if (p.chest) return this.openChest(p.chest);
  }
  async go(door) {
    if (this.leaving) return; this.leaving = true;
    Audio.sfx('tap');
    await fadeOut(this, 220);
    if (door.to === 'village') this.scene.start('Village', { at: 'palace' });
    else this.scene.start('Palace', { room: door.to, from: this.roomId });
  }
  async say(lines) { this.busy = true; await this.dialog.show(lines); this.busy = false; }
  // 탭할 때마다 다음 말. 임금님은 숲을 깨끗하게 할 때마다 선물을 준다.
  async talk(n) {
    if (this.busy) return;
    const s = GameState.s, info = (Data.dialogues.palace || {})[n.id] || { lines: ['...'] }, lines = [];
    if (n.id === 'king') {
      s.flags.kingGift = s.flags.kingGift || {};
      const fresh = Data.stageList().filter(st => s.flags.cleared[st.id] && !s.flags.kingGift[st.id]);
      if (fresh.length) {
        for (const st of fresh) { s.flags.kingGift[st.id] = true; s.stardust += 60; s.shards += 1; lines.push(`${info.name}: ${Data.fmt(info.gift, { stage: st.name })}`); }
        lines.push(Data.fmt(info.giftGot, { n: fresh.length * 60, m: fresh.length }));
        Audio.sfx('levelup'); GameState.save();
      }
    }
    if (!lines.length) {
      s.flags.talk = s.flags.talk || {};
      const i = (s.flags.talk[n.id] || 0) % info.lines.length; s.flags.talk[n.id] = i + 1;
      lines.push(`${info.name ? info.name + ': ' : ''}${Data.fmt(info.lines[i])}`);
    }
    await this.say(lines);
    if (n.id === 'king') this.scene.restart({ room: this.roomId, x: this.hero.x, y: this.hero.y }); // 받은 선물 숫자 갱신
  }
  openChest(key) {
    const s = GameState.s, c = this.room.chest;
    if (s.flags.chests[key]) { toast(this, '빈 상자예요.'); return; }
    s.flags.chests[key] = true; GameState.addItem(c.item, c.count || 1); GameState.save();
    Audio.sfx('chest'); if (this.chestMark) this.chestMark.destroy();
    const it = Data.item(c.item);
    toast(this, `${it ? it.name : c.item} ${c.count || 1}개를 얻었어요!`);
  }
  update() {
    if (this.busy || this.leaving || !this.hero || this.time.now < this.safeUntil) return;
    for (const en of this.enemies) {
      if (!en.sprite.active) continue;
      if (Phaser.Math.Distance.Between(en.sprite.x, en.sprite.y, this.hero.x, this.hero.y) < 13) return this.fight(en);
    }
  }
  async fight(en) {
    this.leaving = true;
    if (this.walkTween) this.walkTween.stop();
    Audio.sfx('error');
    this.cameras.main.flash(200, 255, 255, 255);
    await fadeOut(this, 300);
    this.scene.start('Battle', { enemies: en.group, stageId: 'stage1', bg: 'bg_battle_dungeon',
      returnTo: { scene: 'Palace', data: { room: this.roomId, x: Math.round(this.hero.x), y: Math.round(this.hero.y), won: en.i } } });
  }
}
