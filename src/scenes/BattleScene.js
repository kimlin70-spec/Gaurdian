// 턴제 전투. 아군 전원 명령 → 빠르기 순으로 전원 행동 → 다음 턴.
import { W, H, COLORS, wd, PX } from '../config.js';
import Data from '../systems/Data.js';
import GameState from '../systems/GameState.js';
import Audio from '../systems/Audio.js';
import { txt, Button, panel, UIGroup, DialogBox, bar, toast, fadeIn, fadeOut, tween, wait, DEPTH, setupCamera } from '../systems/UI.js';
import { makeUnitSprite, themeOf, img } from '../systems/Assets.js';

const CORRUPT_TINT = 0x9a7fd6;
const ALLY_POS = [[64, 100], [44, 126], [64, 152], [44, 178]];
const ENEMY_POS = { 1: [[252, 140]], 2: [[238, 112], [278, 150]], 3: [[236, 100], [282, 128], [244, 156]] };
const PANEL_Y = 182;

export default class BattleScene extends Phaser.Scene {
  constructor() { super('Battle'); }
  init(data) { this.p = data || {}; }

  create() {
    setupCamera(this);
    fadeIn(this, 200);
    this.isBoss = !!this.p.boss;
    Audio.playBgm(this.isBoss ? 'boss' : 'battle');
    const s = GameState.s;

    // 배경 (스테이지 테마 색)
    const th = themeOf(this.p.stageId);
    const col = (hex) => Phaser.Display.Color.HexStringToColor(hex).color;
    this.add.rectangle(W / 2, H / 2, W, H, col(this.isBoss ? th.bossSky : th.sky));
    this.add.rectangle(W / 2, 150, W, 90, col(this.isBoss ? th.bossGround : th.ground));
    // 멀리 보이는 나무/돌벽 실루엣
    for (let i = 0; i < 14; i++) {
      const h = 30 + ((i * 37) % 26), x = i * 24 + 8;
      if (this.isBoss) this.add.rectangle(x, 105, 20, h, 0x3a3652).setOrigin(0.5, 1);
      else { this.add.rectangle(x, 105, 14, h, 0x2a2440).setOrigin(0.5, 1); this.add.rectangle(x, 105 - h, 20, 14, 0x332c4f).setOrigin(0.5, 0.5); }
    }
    this.add.rectangle(W / 2, 106, W, 2, 0x6a6490);
    this.add.rectangle(W / 2, 12, W, 24, 0x000000, 0.55);
    this.msg = txt(this, W / 2, 12, '', { size: 11, origin: 0.5, align: 'center', depth: DEPTH.UI });

    // 유닛
    this.allies = GameState.partyUnits();
    this.enemies = (this.p.enemies || ['mushroom']).map((id, i) => GameState.makeEnemyUnit(id, i));
    this.units = [...this.allies, ...this.enemies];
    this.allies.forEach((u, i) => this.placeUnit(u, ALLY_POS[i][0], ALLY_POS[i][1]));
    const ep = ENEMY_POS[this.enemies.length] || ENEMY_POS[3];
    this.enemies.forEach((u, i) => this.placeUnit(u, ep[i][0], ep[i][1]));

    // 아래 패널
    panel(this, 2, PANEL_Y - 2, W - 4, H - PANEL_Y, { color: 0x1e2040 });
    this.add.rectangle(114, PANEL_Y + (H - PANEL_Y) / 2 - 1, 1, H - PANEL_Y - 8, 0x6a6f9a);
    this.statusRows = [];
    this.allies.forEach((u, i) => this.makeStatusRow(u, i));
    this.cmd = new UIGroup();
    this.cursors = [];
    this.dialog = new DialogBox(this);
    this.threshold = GameState.purifyThreshold();
    this.rescued = []; this.purifiedPlants = 0; this.bossPurified = false;
    this.run();
  }

  // ---------- 그리기 ----------
  placeUnit(u, x, y) {
    u.x = x; u.y = y;
    u.obj = makeUnitSprite(this, u, x, y, GameState.s.player.look);
    u.obj.setDepth(wd(y));
    if (u.side === 'enemy') {
      u.obj.setFlipX(true).setTint(CORRUPT_TINT);
      u.nameT = txt(this, x, y + 2, u.name, { size: 11, origin: [0.5, 0], color: '#f2c6ff' });
      u.hpBar = bar(this, x - 20, y + 18, 40, 5, COLORS.hp, { marker: this.threshold, lowAt: this.threshold });
      u.obj.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-10 * PX, -10 * PX, u.obj.width + 20 * PX, u.obj.height + 20 * PX), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
      u.obj.on('pointerup', () => this.onTargetTap(u));
    } else {
      // 아군 스프라이트도 탭 가능(회복 대상)
      const hit = this.add.rectangle(x, y - 16, 32, 40, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
      hit.on('pointerup', () => this.onTargetTap(u));
      u.hit = hit;
    }
    if (u.side === 'ally' && u.kind !== 'player') u.obj.setFlipX(false);
  }
  makeStatusRow(u, i) {
    const y = PANEL_Y + 2 + i * 13;
    const row = {};
    row.name = txt(this, 6, y, u.name, { size: 11, strokeThickness: 1 });
    row.hp = bar(this, 56, y + 4, 50, 4, COLORS.hp, { lowAt: 0.3 });
    row.mp = bar(this, 56, y + 9, 50, 3, COLORS.mp);
    row.auto = txt(this, 48, y, '', { size: 11, color: COLORS.yellow, strokeThickness: 1 });
    if (u.friend >= 80) row.heart = txt(this, 40, y, '♥', { size: 11, color: '#ff6fa0', strokeThickness: 1 });
    const hit = this.add.rectangle(56, y + 7, 108, 14, 0xffffff, 0.001).setInteractive({ useHandCursor: true });
    hit.on('pointerup', () => { if (this.targeting) this.onTargetTap(u); else if (u.kind === 'animal') this.toggleAuto(u); });
    row.pointer = txt(this, 0, y, '▶', { size: 11, color: COLORS.yellow, strokeThickness: 1 }).setVisible(false);
    u.row = row; this.statusRows.push(row);
    this.refreshUnit(u);
  }
  refreshUnit(u) {
    if (u.row) { u.row.hp.set(u.hp / u.maxHp, COLORS.hpLow); u.row.mp.set(u.mp / u.maxMp); u.row.auto.setText(u.auto ? 'A' : ''); u.row.name.setAlpha(u.alive === false ? 0.4 : 1); }
    if (u.hpBar) u.hpBar.set(u.hp / u.maxHp, 0xffd93b);
  }
  toggleAuto(u) {
    u.auto = !u.auto; GameState.s.auto[u.animalId] = u.auto; this.refreshUnit(u); Audio.sfx('tap');
    toast(this, `${u.name}: 자동 ${u.auto ? '켬' : '끔'}`, { y: 60 });
  }
  say(text) { this.msg.setText(text); }

  // ---------- 메인 루프 ----------
  async run() {
    for (const u of this.units) u.alive = u.hp > 0;
    this.say(this.enemies.length === 1 ? `${this.enemies[0].name}이(가) 나타났다!` : `${this.enemies[0].name} 무리가 나타났다!`);
    await wait(this, 700);
    let turn = 0;
    while (true) {
      turn++;
      const cmds = [];
      for (const u of this.allies) {
        if (!u.alive) continue;
        u.defending = false;
        const c = (u.kind === 'animal' && u.auto) ? this.aiAlly(u) : await this.chooseCommand(u);
        if (c) cmds.push(c);
      }
      for (const u of this.enemies) { if (u.alive) { u.defending = false; cmds.push(this.aiEnemy(u)); } }
      cmds.sort((a, b) => (b.actor.stats.spd - a.actor.stats.spd) || (Math.random() - 0.5));
      for (const c of cmds) {
        if (!c.actor.alive) continue;
        await this.execute(c);
        if (this.bossPurified || this.checkEnd()) break;
      }
      if (this.bossPurified) return this.onBossPurified();
      const end = this.checkEnd();
      if (end === 'win') return this.onWin();
      if (end === 'lose') return this.onLose();
    }
  }
  checkEnd() {
    if (!this.enemies.some(u => u.alive)) return 'win';
    if (!this.allies.some(u => u.alive)) return 'lose';
    return null;
  }

  // ---------- 명령 고르기 (터치) ----------
  chooseCommand(u) {
    return new Promise(resolve => {
      this.current = u; this.resolveCmd = resolve;
      this.statusRows.forEach(r => r.pointer.setVisible(false));
      u.row.pointer.setVisible(true);
      this.say(`${u.name}의 차례!`);
      this.bounce(u.obj);
      this.showMainMenu(u);
    });
  }
  clearCmd() { this.cmd.destroy(); this.cmd = new UIGroup(); this.clearTargeting(); }
  finishCmd(c) { this.clearCmd(); this.current.row.pointer.setVisible(false); const r = this.resolveCmd; this.resolveCmd = null; r(c); }

  showMainMenu(u) {
    this.clearCmd();
    const bx = 120, by = PANEL_Y + 2, bw = 62, bh = 24, gap = 4;
    const B = (col, row, label, fn, opts) => this.cmd.add(new Button(this, bx + col * (bw + gap), by + row * (bh + gap), bw, bh, label, fn, opts));
    B(0, 0, '공격', () => this.pickTarget(u, { type: 'skill', skill: 'attack' }, 'enemy'));
    if (u.kind === 'player') {
      B(1, 0, '스킬', () => this.showSkillMenu(u));
      B(2, 0, '아이템', () => this.showItemMenu(u));
      B(0, 1, '방어', () => this.finishCmd({ type: 'defend', actor: u }));
      const canPurify = this.enemies.some(e => this.canPurify(e));
      const pb = B(1, 1, '정화', () => this.pickTarget(u, { type: 'purify' }, 'enemy', e => this.canPurify(e)), { color: COLORS.purify });
      pb.setEnabled(canPurify).setGlow(canPurify);
      this.cmd.add(txt(this, bx + 2 * (bw + gap) + bw / 2, by + (bh + gap) + bh / 2, canPurify ? '정화할 수\n있어요!' : `HP ${Math.round(this.threshold * 100)}%↓\n이면 정화`, { size: 11, origin: 0.5, align: 'center', color: canPurify ? COLORS.yellow : '#8890aa', strokeThickness: 1 }));
    } else {
      u.skills.forEach((sk, i) => {
        const d = Data.skill(sk), ok = u.mp >= d.mp;
        const b = B(1 + i, 0, d.name, () => this.pickTarget(u, { type: 'skill', skill: sk }, d.target), { size: 11 });
        b.setEnabled(ok);
      });
      B(0, 1, '방어', () => this.finishCmd({ type: 'defend', actor: u }));
      B(1, 1, '자동', () => { this.toggleAuto(u); if (u.auto) this.finishCmd(this.aiAlly(u)); }, { color: 0x6a4fb3 });
      const d0 = Data.skill(u.skills[0]), d1 = Data.skill(u.skills[1]);
      this.cmd.add(txt(this, bx + 2 * (bw + gap), by + (bh + gap) + 2, `MP ${u.mp}  (${d0.mp}/${d1 ? d1.mp : 0})`, { size: 11, color: '#9ecbff', strokeThickness: 1 }));
    }
  }
  showSkillMenu(u) {
    this.clearCmd();
    const rows = u.skills.map(sk => { const d = Data.skill(sk), lv = GameState.skillLevel(u.ownerId, sk); return { label: `${d.name} Lv${lv}`, sub: `MP${d.mp}`, enabled: u.mp >= d.mp, onTap: () => this.pickTarget(u, { type: 'skill', skill: sk }, d.target) }; });
    this.showChoiceList(rows, () => this.showMainMenu(u));
  }
  showItemMenu(u) {
    this.clearCmd();
    const items = GameState.itemList().filter(it => ['heal', 'mp', 'heal_all', 'revive'].includes(it.type));
    const rows = items.map(it => ({ label: `${it.name} ×${it.n}`, sub: '', enabled: true, onTap: () => {
      if (it.type === 'heal_all') return this.finishCmd({ type: 'item', item: it.id, actor: u, targets: 'allies' });
      this.pickTarget(u, { type: 'item', item: it.id }, 'ally', it.type === 'revive' ? (a => !a.alive) : (a => a.alive), it.type === 'revive');
    } }));
    if (!rows.length) this.cmd.add(txt(this, 216, PANEL_Y + 18, '아이템이 없어요', { size: 11, origin: 0.5 }));
    this.showChoiceList(rows, () => this.showMainMenu(u));
  }
  // 2열 × 2행 선택 버튼 + 뒤로
  showChoiceList(rows, onBack) {
    const bx = 120, by = PANEL_Y + 2, bw = 96, bh = 24, gap = 4;
    rows.slice(0, 4).forEach((r, i) => {
      const col = i % 2, row = Math.floor(i / 2), x = bx + col * (bw + gap), y = by + row * (bh + gap);
      const b = this.cmd.add(new Button(this, x, y, bw, bh, r.label, r.onTap, { size: 11 }));
      if (r.sub) { b.label.setOrigin(0, 0.5).setPosition(x + 4, y + bh / 2); this.cmd.add(txt(this, x + bw - 3, y + bh / 2, r.sub, { size: 11, origin: [1, 0.5], color: '#9ecbff', strokeThickness: 1, depth: DEPTH.UI + 2 })); }
      if (r.enabled === false) b.setEnabled(false);
    });
    this.cmd.add(new Button(this, W - 40, PANEL_Y + 30, 36, 24, '뒤로', onBack, { color: 0x555577 }));
  }
  pickTarget(u, cmd, side, filter, allowDead = false) {
    this.clearCmd();
    const skill = cmd.type === 'skill' ? Data.skill(cmd.skill) : null;
    if (skill && (skill.type === 'damage_all' || skill.type === 'heal_all')) return this.finishCmd({ ...cmd, actor: u, targets: skill.target === 'enemy' ? 'enemies' : 'allies' });
    const pool = (side === 'enemy' ? this.enemies : this.allies).filter(t => (allowDead ? true : t.alive) && (!filter || filter(t)));
    if (!pool.length) { Audio.sfx('error'); toast(this, '대상이 없어요', { y: 60 }); return this.showMainMenu(u); }
    if (side === 'ally' && pool.length === 1 && cmd.type !== 'purify') return this.finishCmd({ ...cmd, actor: u, target: pool[0] });
    this.targeting = { u, cmd, pool };
    this.say(cmd.type === 'purify' ? '누구를 정화할까?' : side === 'enemy' ? '누구를 공격할까?' : '누구에게 쓸까?');
    for (const t of pool) {
      const c = img(this, t.x, t.y - (t.obj.displayHeight || 24) - 8, 'cursor').setDepth(DEPTH.UI);
      this.tweens.add({ targets: c, y: c.y - 4, duration: 300, yoyo: true, repeat: -1 });
      this.cursors.push(c);
    }
    this.cmd.add(txt(this, 216, PANEL_Y + 14, '위의 친구/적을\n탭하세요', { size: 11, origin: 0.5, align: 'center', color: COLORS.yellow }));
    this.cmd.add(new Button(this, W - 40, PANEL_Y + 30, 36, 24, '뒤로', () => this.showMainMenu(u), { color: 0x555577 }));
  }
  clearTargeting() { this.targeting = null; this.cursors.forEach(c => c.destroy()); this.cursors = []; }
  onTargetTap(t) {
    if (!this.targeting) return;
    const { u, cmd, pool } = this.targeting;
    if (!pool.includes(t)) { Audio.sfx('error'); return; }
    Audio.sfx('tap');
    this.finishCmd({ ...cmd, actor: u, target: t });
  }
  canPurify(e) { return e.alive && e.hp / e.maxHp <= this.threshold + 1e-6; }

  // ---------- AI ----------
  aiEnemy(u) {
    const total = u.skillWeights.reduce((a, s) => a + s.w, 0);
    let r = Math.random() * total, pick = u.skillWeights[0].id;
    for (const s of u.skillWeights) { r -= s.w; if (r <= 0) { pick = s.id; break; } }
    const d = Data.skill(pick);
    if (!d || u.mp < d.mp) pick = 'attack';
    const sk = Data.skill(pick);
    if (sk.type === 'damage_all') return { type: 'skill', skill: pick, actor: u, targets: 'allies' };
    const alive = this.allies.filter(a => a.alive);
    return { type: 'skill', skill: pick, actor: u, target: Phaser.Utils.Array.GetRandom(alive) };
  }
  aiAlly(u) {
    const foes = this.enemies.filter(e => e.alive), friends = this.allies.filter(a => a.alive);
    const weakest = foes.slice().sort((a, b) => a.hp - b.hp)[0];
    const hurt = friends.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    for (const sk of u.skills) {
      const d = Data.skill(sk); if (u.mp < d.mp) continue;
      if (d.type === 'heal' && hurt && hurt.hp / hurt.maxHp < 0.5) return { type: 'skill', skill: sk, actor: u, target: hurt };
      if (d.type === 'heal_all' && friends.filter(f => f.hp / f.maxHp < 0.6).length >= 2) return { type: 'skill', skill: sk, actor: u, targets: 'allies' };
    }
    for (const sk of u.skills) {
      const d = Data.skill(sk); if (u.mp < d.mp || Math.random() < 0.4) continue;
      if (d.type === 'damage_all' && foes.length >= 2) return { type: 'skill', skill: sk, actor: u, targets: 'enemies' };
      if (d.type === 'damage') return { type: 'skill', skill: sk, actor: u, target: weakest };
    }
    return { type: 'skill', skill: 'attack', actor: u, target: weakest };
  }

  // ---------- 행동 실행 ----------
  resolveTargets(c, sk) {
    if (c.targets === 'enemies') return this.enemies.filter(e => e.alive);
    if (c.targets === 'allies') return c.actor.side === 'enemy' ? this.allies.filter(a => a.alive) : this.allies.filter(a => a.alive);
    if (c.target && (c.target.alive || c.allowDead)) return [c.target];
    // 대상이 사라졌으면 같은 편에서 다시 고른다
    const pool = (c.target && c.target.side === c.actor.side) ? this.allies.filter(a => a.alive) : (c.actor.side === 'ally' ? this.enemies : this.allies).filter(x => x.alive);
    return pool.length ? [Phaser.Utils.Array.GetRandom(pool)] : [];
  }
  damage(actor, target, mult) {
    let d = actor.stats.atk * mult - target.stats.def / 2;
    d *= Phaser.Math.FloatBetween(0.9, 1.1);
    d = Math.max(1, Math.round(d));
    if (target.defending) d = Math.max(1, Math.ceil(d / 2));
    return d;
  }
  async execute(c) {
    const a = c.actor;
    if (c.type === 'defend') {
      a.defending = true; this.say(`${a.name}은(는) 방어 자세!`); Audio.sfx('defend');
      const sh = this.add.rectangle(a.x, a.y - 12, 24, 30, 0x5aa9ff, 0.35).setStrokeStyle(1, 0x9ecbff);
      await tween(this, { targets: sh, alpha: 0, duration: 600 }); sh.destroy();
      return;
    }
    if (c.type === 'purify') return this.purify(a, c.target);
    if (c.type === 'item') return this.useItem(a, c);
    // 스킬/공격
    const sk = Data.skill(c.skill), lv = GameState.skillLevel(a.ownerId || a.enemyId, c.skill) - 1;
    if (a.mp < sk.mp) { this.say(`${a.name}은(는) MP가 모자라요!`); await wait(this, 500); return; }
    a.mp -= sk.mp; this.refreshUnit(a);
    const targets = this.resolveTargets(c, sk);
    if (!targets.length) return;
    this.say(c.skill === 'attack' ? `${a.name}의 공격!` : `${a.name}의 ${sk.name}!`);
    const dir = a.side === 'ally' ? 1 : -1;
    await tween(this, { targets: a.obj, x: a.x + 14 * dir, duration: 120, yoyo: true, ease: 'Quad.easeOut' });
    const fx = [];
    for (const t of targets) {
      if (sk.type === 'damage' || sk.type === 'damage_all') {
        const d = this.damage(a, t, sk.mult[lv] ?? sk.mult[0]);
        t.hp = Math.max(0, t.hp - d);
        Audio.sfx(sk.fx === 'slash' ? 'slash' : sk.fx === 'star' ? 'star' : 'hit');
        this.flash(t); this.floatNumber(t, `${d}`, '#ffffff');
        if (sk.fx === 'star') this.sparkle(t.x, t.y - 12, 0xffd93b);
      } else {
        const heal = (sk.power[lv] ?? sk.power[0]) + Math.floor(a.stats.atk / 2);
        t.hp = Math.min(t.maxHp, t.hp + heal);
        Audio.sfx('heal'); this.sparkle(t.x, t.y - 12, 0x7ee081); this.floatNumber(t, `+${heal}`, '#7ee081');
      }
      this.refreshUnit(t);
    }
    await wait(this, 450);
    for (const t of targets) if (t.hp <= 0 && t.alive) await this.die(t);
  }
  async useItem(a, c) {
    const it = Data.item(c.item);
    if (!GameState.useItem(c.item)) return;
    const targets = c.targets === 'allies' ? this.allies.filter(x => x.alive) : [c.target];
    this.say(`${a.name}은(는) ${it.name}을(를) 썼다!`);
    for (const t of targets) {
      if (it.type === 'heal' || it.type === 'heal_all') { if (!t.alive) continue; t.hp = Math.min(t.maxHp, t.hp + it.power); this.floatNumber(t, `+${it.power}`, '#7ee081'); }
      else if (it.type === 'mp') { t.mp = Math.min(t.maxMp, t.mp + it.power); this.floatNumber(t, `MP+${it.power}`, '#9ecbff'); }
      else if (it.type === 'revive') { if (t.alive) continue; t.alive = true; t.hp = Math.min(t.maxHp, it.power); t.obj.setAlpha(1); this.floatNumber(t, '일어났다!', '#ffe066'); }
      this.sparkle(t.x, t.y - 12, 0x7ee081); this.refreshUnit(t);
    }
    Audio.sfx('heal');
    await wait(this, 500);
  }
  async die(t) {
    t.alive = false;
    if (t.side === 'enemy') {
      this.say(`${t.name}은(는) 힘이 다했다...`);
      await tween(this, { targets: t.obj, alpha: 0, y: t.y + 6, duration: 400 });
      t.hpBar.setVisible(false); t.nameT.setVisible(false);
    } else {
      this.say(`${t.name}은(는) 쓰러졌다!`);
      await tween(this, { targets: t.obj, alpha: 0.3, angle: t.kind === 'player' ? 0 : 90, duration: 300 });
    }
    this.refreshUnit(t);
    await wait(this, 250);
  }
  async purify(a, t) {
    if (!t || !t.alive) { this.say('정화할 대상이 없어요.'); await wait(this, 400); return; }
    if (!this.canPurify(t)) { this.say(`${t.name}의 HP가 아직 많아요!`); await wait(this, 600); return; }
    this.say(`${a.name}의 정화! ${Data.strings.gemName}이 빛난다!`);
    Audio.sfx('purify');
    const gem = img(this, a.x, a.y - 30, 'gem').setDepth(DEPTH.UI);
    this.tweens.add({ targets: gem, scale: 1.5, alpha: 0, duration: 900, onComplete: () => gem.destroy() });
    const beam = this.add.rectangle((a.x + t.x) / 2, t.y - 14, Math.abs(t.x - a.x), 3, 0xff6fd8, 0.9).setDepth(DEPTH.UI);
    this.tweens.add({ targets: beam, alpha: 0, duration: 700, onComplete: () => beam.destroy() });
    for (let i = 0; i < 4; i++) { this.sparkle(t.x + Phaser.Math.Between(-10, 10), t.y - 12 + Phaser.Math.Between(-12, 8), 0xff6fd8); await wait(this, 120); }
    // 보라색 → 원래 색
    const from = Phaser.Display.Color.ValueToColor(CORRUPT_TINT), to = Phaser.Display.Color.ValueToColor(0xffffff);
    await tween(this, { targets: { v: 0 }, v: 100, duration: 700, onUpdate: (tw) => { const v = tw.getValue(); const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, v); t.obj.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b)); } });
    t.obj.clearTint();
    t.alive = false; t.purified = true;
    t.hpBar.setVisible(false); t.nameT.setVisible(false);
    if (t.enemyKind === 'boss') {
      this.bossPurified = true;
      this.say(`${t.name}이(가) 정화되었다!`);
      await wait(this, 600);
      return;
    }
    if (t.enemyKind === 'animal') {
      const a = Data.animal(t.animalId);
      const isNew = GameState.rescueAnimal(t.animalId);
      this.rescued.push({ id: t.animalId, isNew });
      this.say(`${a.name}이(가) 정화되었다! 깨끗해졌어!`);
      this.tweens.add({ targets: t.obj, y: t.y - 10, duration: 200, yoyo: true, repeat: 2 });
      await wait(this, 800);
      await tween(this, { targets: t.obj, x: t.x - 60, alpha: 0, duration: 500 });
    } else {
      this.purifiedPlants++;
      this.say(`${t.name}이(가) 맑아져 사라졌다!`);
      await tween(this, { targets: t.obj, alpha: 0, scale: 0.2, duration: 500 });
    }
    await wait(this, 300);
  }

  // ---------- 연출 ----------
  bounce(obj) { this.tweens.add({ targets: obj, y: obj.y - 6, duration: 100, yoyo: true }); }
  flash(t) {
    const isC = !!t.obj.parts;
    const targets = isC ? [t.obj.parts.body, t.obj.parts.clothes, t.obj.parts.hair, t.obj.parts.weapon] : [t.obj];
    const orig = isC ? null : t.obj.tintTopLeft;
    targets.forEach(o => o.setTintFill(0xffffff));
    this.tweens.add({ targets: t.obj, x: t.x + (t.side === 'ally' ? -5 : 5), duration: 60, yoyo: true, repeat: 1 });
    this.time.delayedCall(120, () => {
      if (isC) { const lk = GameState.s.player.look; t.obj.setLook(lk); t.obj.parts.clothes.clearTint(); t.obj.parts.weapon.clearTint(); }
      else if (t.side === 'enemy' && !t.purified) t.obj.setTint(CORRUPT_TINT);
      else t.obj.clearTint();
    });
    this.cameras.main.shake(80, 0.004);
  }
  floatNumber(t, text, color) {
    const n = txt(this, t.x, t.y - 28, text, { size: 14, origin: 0.5, color, depth: DEPTH.UI + 5 });
    this.tweens.add({ targets: n, y: n.y - 18, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => n.destroy() });
  }
  sparkle(x, y, color) {
    for (let i = 0; i < 6; i++) {
      const p = this.add.rectangle(x, y, 2, 2, color).setDepth(DEPTH.UI + 4);
      const ang = Math.random() * Math.PI * 2, dist = 10 + Math.random() * 12;
      this.tweens.add({ targets: p, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist, alpha: 0, duration: 500, onComplete: () => p.destroy() });
    }
  }

  // ---------- 끝 ----------
  markDefeated() {
    if (this.p.enemyKey) {
      const f = GameState.s.flags.defeated; f[this.p.stageId] = f[this.p.stageId] || {}; f[this.p.stageId][this.p.enemyKey] = true;
    }
  }
  async onWin() {
    Audio.playBgm('victory'); Audio.sfx('win');
    this.say('이겼다!');
    this.allies.filter(a => a.alive).forEach(a => this.tweens.add({ targets: a.obj, y: a.y - 8, duration: 150, yoyo: true, repeat: 2 }));
    const lines = ['이겼다!'];
    let exp = 0, money = 0, shards = 0; const drops = [];
    for (const e of this.enemies) {
      const d = Data.enemy(e.enemyId);
      exp += d.exp; money += d.stardust; shards += d.shards || 0;
      for (const dr of d.drops || []) if (Math.random() < dr.chance) drops.push(dr.item);
    }
    const s = GameState.s;
    s.stardust += money; s.shards += shards;
    let rewardLine = `경험치 +${exp}   ★${Data.strings.money} +${money}`;
    if (shards) rewardLine += `\n◆${Data.strings.shard} +${shards}`;
    lines.push(rewardLine);
    for (const it of drops) { GameState.addItem(it, 1); lines.push(`${Data.item(it).name}을(를) 얻었어요!`); }
    for (const r of this.rescued) {
      const a = Data.animal(r.id);
      lines.push(r.isNew ? `${a.name}을(를) 구했어요!\n${Data.strings.cageName}에 들어와 친구가 되었어요!` : `${a.name}이(가) 다시 깨끗해졌어요!`);
    }
    GameState.syncFromBattle(this.allies);
    const careMsgs = GameState.afterBattle(this.allies);
    for (const a of this.allies) {
      if (!a.alive) continue;
      const rec = a.kind === 'player' ? s.player : s.animals[a.animalId];
      const ups = GameState.gainExp(rec, exp);
      if (ups > 0) {
        const st = a.kind === 'player' ? GameState.playerStats() : GameState.animalStats(a.animalId);
        rec.hp = st.hp; rec.mp = st.mp; // 레벨 업 보너스: 전부 회복
        lines.push(`${a.name} 레벨 업! Lv${rec.level}\nHP ${st.hp}  공격 ${st.atk}  방어 ${st.def}`);
      }
    }
    lines.push(...careMsgs);
    this.markDefeated();
    GameState.save();
    await wait(this, 500);
    await this.dialog.show(lines);
    if (lines.some(l => l.includes('레벨 업'))) Audio.sfx('levelup');
    await fadeOut(this, 250);
    this.scene.start('Field', { stageId: this.p.stageId, mapId: this.p.mapId, x: this.p.x, y: this.p.y });
  }
  async onLose() {
    Audio.stopBgm();
    this.say('모두 쓰러졌어요...');
    GameState.syncFromBattle(this.allies);
    GameState.afterBattle(this.allies);
    GameState.save();
    await wait(this, 900);
    await fadeOut(this, 600);
    this.scene.start('Village', { wokeAtInn: true });
  }
  async onBossPurified() {
    Audio.playBgm('victory');
    const boss = this.enemies.find(e => e.enemyKind === 'boss');
    const lines = (Data.dialogues.bossPurified[boss.enemyId] || []).map(l => Data.fmt(l));
    // 보상
    const s = GameState.s, d = Data.enemy(boss.enemyId);
    s.stardust += d.stardust; s.shards += d.shards || 0;
    for (const dr of d.drops || []) if (Math.random() < dr.chance) { GameState.addItem(dr.item, 1); lines.push(`${Data.item(dr.item).name}을(를) 얻었어요!`); }
    lines.push(`경험치 +${d.exp}  ★${d.stardust}  ◆${d.shards || 0}`);
    GameState.syncFromBattle(this.allies);
    lines.push(...GameState.afterBattle(this.allies));
    for (const a of this.allies) {
      if (!a.alive) continue;
      const rec = a.kind === 'player' ? s.player : s.animals[a.animalId];
      if (GameState.gainExp(rec, d.exp) > 0) { const st = a.kind === 'player' ? GameState.playerStats() : GameState.animalStats(a.animalId); rec.hp = st.hp; rec.mp = st.mp; lines.push(`${a.name} 레벨 업! Lv${rec.level}`); }
    }
    GameState.save();
    await wait(this, 400);
    await this.dialog.show(lines);
    await fadeOut(this, 400);
    this.scene.start('Purify', { stageId: this.p.stageId, bossId: boss.enemyId });
  }
}
