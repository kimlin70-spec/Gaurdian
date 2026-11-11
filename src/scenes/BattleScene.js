// 턴제 전투. 아군 전원 명령 → 빠르기 순으로 전원 행동 → 다음 턴.
import { W, H, COLORS, wd, PX } from '../config.js';
import Data, { josa } from '../systems/Data.js';
import GameState from '../systems/GameState.js';
import Audio from '../systems/Audio.js';
import { txt, Button, panel, UIGroup, DialogBox, bar, toast, fadeIn, fadeOut, tween, wait, DEPTH, setupCamera } from '../systems/UI.js';
import { makeUnitSprite, themeOf, img, setPose, setView, fx, bodyWidth } from '../systems/Assets.js';

const CORRUPT_TINT = 0x9a7fd6;
const ALLY_POS = [[64, 100], [44, 126], [64, 152], [44, 178]];
const ENEMY_POS = { 1: [[252, 140]], 2: [[238, 112], [278, 150]], 3: [[236, 100], [282, 128], [244, 156]] };
const PANEL_Y = 182;
const CRIT_RATE = 0.12; // 아군 공격이 '아주 세게' 들어갈 확률 (적은 없음)
const REACT_POSES = new Set(['hurt', 'knockback', 'guard']); // 맞고 나서 잠깐 보이는 자세

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
    const bgKey = 'bg_battle_' + (th.name || 'green');
    if (this.textures.exists(bgKey)) {
      // 그림 배경 (보스전은 조금 어둡게)
      const bg = img(this, W / 2, H / 2, bgKey);
      if (this.isBoss) bg.setTint(0xb0a8d0);
    } else {
      this.add.rectangle(W / 2, H / 2, W, H, col(this.isBoss ? th.bossSky : th.sky));
      this.add.rectangle(W / 2, 150, W, 90, col(this.isBoss ? th.bossGround : th.ground));
      this.add.rectangle(W / 2, 106, W, 2, 0x6a6490);
    }
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
    // 서로 마주 본다: 아군은 오른쪽, 적은 왼쪽 (옆모습이 있으면 옆모습, 없으면 정면)
    setView(u.obj, 'side', u.side === 'enemy');
    if (u.side === 'enemy') {
      u.obj.setTint(CORRUPT_TINT);
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
  say(text) { this.msg.setText(josa(text)); }

  // ---------- 메인 루프 ----------
  async run() {
    for (const u of this.units) u.alive = u.hp > 0;
    this.say(this.enemies.length === 1 ? `${this.enemies[0].name}이(가) 나타났다!` : `${this.enemies[0].name} 무리가 나타났다!`);
    await wait(this, 700);
    let turn = 0;
    while (true) {
      turn++;
      const cmds = [];
      for (const u of this.units) if (u.defending) { u.defending = false; this.dropShield(u); if (u.alive) setPose(u.obj, 'idle'); }
      for (const u of this.allies) {
        if (!u.alive) continue;
        const c = (u.kind === 'animal' && u.auto) ? this.aiAlly(u) : await this.chooseCommand(u);
        if (c) cmds.push(c);
      }
      for (const u of this.enemies) { if (u.alive) cmds.push(this.aiEnemy(u)); }
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
      this.bounce(u);
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
    this.settle(a); // 아직 밀려나 있거나 폴짝 중이면 제자리에 선 뒤 행동
    if (c.type === 'defend') {
      a.defending = true; this.say(`${a.name}은(는) 방어 자세!`); Audio.sfx('defend');
      setPose(a.obj, 'guard'); // 다음 차례까지 방어 자세
      const sh = this.add.rectangle(a.x, a.y - 12, 24, 30, 0x5aa9ff, 0.35).setStrokeStyle(1, 0x9ecbff).setDepth(wd(a.y) + 0.001);
      await tween(this, { targets: sh, alpha: 0, duration: 600 }); sh.destroy();
      this.raiseShield(a); // 방어하는 동안 옅은 방패 빛이 남는다 (맞은 자세와 헷갈리지 않게)
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
    if (sk.type === 'damage' || sk.type === 'damage_all') await this.strike(a, targets, sk, lv);
    else await this.castHeal(a, targets, sk, lv);
    for (const t of targets) if (t.hp <= 0 && t.alive) await this.die(t);
  }
  // 때리기: 준비 → 달려가기 → 타격(번쩍·숫자·멈춤) → 맞은 쪽 밀려남 → 마무리 → 뒤로 폴짝
  async strike(a, targets, sk, lv) {
    const o = a.obj, dir = a.side === 'ally' ? 1 : -1, t0 = targets[0];
    const single = targets.length === 1 && sk.type === 'damage';
    // 옆모습 준비 프레임은 이미 칼을 들고 있어 정면일 때만 더 젖힌다
    setPose(o, 'attack_ready'); if (o.isHero && o.curView === 'front') o.setSwing(-20);
    await wait(this, 170);
    const gap = (bodyWidth(o) + bodyWidth(t0.obj)) / 2 + 3;
    const dest = single ? { x: t0.x - dir * gap, y: t0.y } : { x: a.x + 18 * dir, y: a.y };
    setPose(o, 'move'); this.dust(a.x, a.y);
    o.setDepth(wd(dest.y) + 0.0005);
    await tween(this, { targets: o, x: dest.x, y: dest.y, duration: single ? 240 : 130, ease: 'Quad.easeIn' });
    // 타격
    setPose(o, 'attack');
    if (o.isHero) {
      // 칼을 위에서 앞으로 휘두른다 (옆모습은 더 크게)
      const sw = { v: o.curView === 'side' ? -65 : -45 }; o.setSwing(sw.v);
      this.tweens.add({ targets: sw, v: 0, duration: 90, onUpdate: () => o.setSwing(sw.v) });
    }
    Audio.sfx(sk.fx === 'slash' ? 'slash' : sk.fx === 'star' ? 'star' : 'hit');
    let anyCrit = false;
    for (const t of targets) {
      const crit = a.side === 'ally' && Math.random() < CRIT_RATE;
      anyCrit = anyCrit || crit;
      let d = this.damage(a, t, sk.mult[lv] ?? sk.mult[0]);
      if (crit) d = Math.round(d * 1.5);
      t.hp = Math.max(0, t.hp - d);
      this.impact(t, d, crit, sk, dir);
      this.refreshUnit(t);
    }
    // 히트스톱: 맞는 순간 잠깐 멈춤 + 화면 흔들림
    this.cameras.main.shake(anyCrit ? 170 : 100, anyCrit ? 0.01 : 0.0055);
    await wait(this, anyCrit ? 150 : 85);
    for (const t of targets) this.knockback(t, dir, anyCrit);
    setPose(o, 'attack_end'); if (o.isHero) o.setSwing(0);
    await wait(this, 180);
    // 제자리로 폴짝
    const from = { x: o.x, y: o.y }, hop = { p: 0 };
    await tween(this, { targets: hop, p: 1, duration: single ? 260 : 150, ease: 'Sine.easeInOut',
      onUpdate: () => { o.x = from.x + (a.x - from.x) * hop.p; o.y = from.y + (a.y - from.y) * hop.p - Math.sin(Math.PI * hop.p) * 7; } });
    o.setPosition(a.x, a.y); o.setDepth(wd(a.y));
    if (a.alive !== false) setPose(o, a.defending ? 'guard' : 'idle');
  }
  // 맞는 순간: 맞는 자세 + 하얗게 번쩍 + 숫자 + 효과
  impact(t, dmg, crit, sk, dir) {
    setPose(t.obj, t.defending ? 'guard' : 'hurt');
    this.flashWhite(t);
    this.popNumber(t, dmg, crit);
    const hy = t.y - this.bodyHeight(t) * 0.55;
    fx(this, sk.fx === 'star' ? 'fx_star_anim' : 'fx_hit_anim', t.x - dir * 3, hy, crit ? 2.1 : 1.4, DEPTH.UI - 1);
    if (sk.fx === 'star') this.sparkle(t.x, hy, 0xffd93b);
  }
  // 맞은 쪽이 뒤로 밀렸다가 돌아온다 (보스는 조금만, 방어 중이면 거의 안 밀림)
  knockback(t, dir, crit) {
    const o = t.obj; if (!o.active) return;
    this.settle(t);
    const dist = t.enemyKind === 'boss' ? 3 : t.defending ? 2 : crit ? 14 : 8;
    if (t.hp > 0 && !t.defending) setPose(o, 'knockback');
    // 돌아온 뒤에는, 그 사이 다른 동작(다음 행동·정화)을 시작하지 않았을 때만 서 있는 자세로
    const done = () => { t.kb = null; if (t.alive && t.hp > 0 && REACT_POSES.has(o.curPose)) setPose(o, t.defending ? 'guard' : 'idle'); };
    t.kb = this.tweens.add({ targets: o, x: t.x + dir * dist, duration: 90, ease: 'Quad.easeOut',
      onComplete: () => { t.kb = this.tweens.add({ targets: o, x: t.x, duration: 230, delay: 140, ease: 'Sine.easeInOut', onComplete: done }); } });
  }
  // 남은 밀림·폴짝을 멈추고 제자리에 세운다 (새 행동을 시작할 때)
  settle(u) {
    for (const k of ['kb', 'bounceTw']) if (u[k]) { u[k].stop(); u[k] = null; }
    if (u.obj && u.obj.active && u.alive !== false) u.obj.setPosition(u.x, u.y);
  }
  // 방어하는 동안 남는 옅은 방패 빛
  raiseShield(u) {
    this.dropShield(u);
    if (!u.alive) return;
    u.shield = this.add.ellipse(u.x, u.y - 13, 26, 32, 0x5aa9ff, 0.18).setStrokeStyle(1, 0x9ecbff, 0.9).setDepth(wd(u.y) + 0.001);
    this.tweens.add({ targets: u.shield, alpha: 0.55, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }
  dropShield(u) { if (u.shield) { this.tweens.killTweensOf(u.shield); u.shield.destroy(); u.shield = null; } }
  async castHeal(a, targets, sk, lv) {
    const o = a.obj;
    setPose(o, 'happy'); this.bounce(a);
    await wait(this, 240);
    for (const t of targets) {
      const heal = (sk.power[lv] ?? sk.power[0]) + Math.floor(a.stats.atk / 2);
      t.hp = Math.min(t.maxHp, t.hp + heal);
      this.sparkle(t.x, t.y - 12, 0x7ee081); fx(this, 'fx_heal_anim', t.x, t.y - 14, 1.4);
      this.popNumber(t, `+${heal}`, false, '#7ee081');
      this.refreshUnit(t);
    }
    Audio.sfx('heal');
    await wait(this, 480);
    if (a.alive !== false) setPose(o, a.defending ? 'guard' : 'idle');
  }
  async useItem(a, c) {
    const it = Data.item(c.item);
    // 고른 친구가 그 사이 쓰러졌거나(물약) 일어났으면(깃털) 다른 친구에게. 아무도 없으면 아이템을 아낀다.
    const ok = it.type === 'revive' ? (x => !x.alive) : (x => x.alive);
    let targets = c.targets === 'allies' ? this.allies.filter(ok) : [c.target].filter(t => t && ok(t));
    if (!targets.length && c.targets !== 'allies') {
      const pool = this.allies.filter(ok).sort((p, q) => p.hp / p.maxHp - q.hp / q.maxHp);
      if (pool.length) targets = [pool[0]];
    }
    if (!targets.length) { this.say(`${it.name}을(를) 쓸 친구가 없어요.`); await wait(this, 600); return; }
    if (!GameState.useItem(c.item)) return;
    this.say(`${a.name}은(는) ${it.name}을(를) 썼다!`);
    for (const t of targets) {
      if (it.type === 'heal' || it.type === 'heal_all') { t.hp = Math.min(t.maxHp, t.hp + it.power); this.floatNumber(t, `+${it.power}`, '#7ee081'); }
      else if (it.type === 'mp') { t.mp = Math.min(t.maxMp, t.mp + it.power); this.floatNumber(t, `MP+${it.power}`, '#9ecbff'); }
      else if (it.type === 'revive') { t.alive = true; t.hp = Math.min(t.maxHp, it.power); t.obj.setAlpha(1).setAngle(0).setPosition(t.x, t.y); setPose(t.obj, 'idle'); this.floatNumber(t, '일어났다!', '#ffe066'); }
      this.sparkle(t.x, t.y - 12, 0x7ee081); this.refreshUnit(t);
    }
    Audio.sfx('heal');
    await wait(this, 500);
  }
  async die(t) {
    t.alive = false; t.defending = false; this.dropShield(t);
    setPose(t.obj, 'down');
    if (t.side === 'enemy') {
      this.say(`${t.name}은(는) 힘이 다했다...`);
      await tween(this, { targets: t.obj, alpha: 0, y: t.y + 6, duration: 400 });
      t.hpBar.setVisible(false); t.nameT.setVisible(false);
    } else {
      this.say(`${t.name}은(는) 쓰러졌다!`);
      // 옆모습·주인공은 주저앉은 그림, 정면 그림만 옆으로 눕힌다
      const lieDown = !t.obj.isHero && t.obj.curView !== 'side';
      await tween(this, { targets: t.obj, alpha: 0.45, angle: lieDown ? 90 : 0, duration: 300 });
    }
    this.refreshUnit(t);
    await wait(this, 250);
  }
  async purify(a, t) {
    if (!t || !t.alive) { this.say('정화할 대상이 없어요.'); await wait(this, 400); return; }
    if (!this.canPurify(t)) { this.say(`${t.name}의 HP가 아직 많아요!`); await wait(this, 600); return; }
    this.say(`${a.name}의 정화! ${Data.strings.gemName}이 빛난다!`);
    Audio.sfx('purify');
    this.settle(t); // 아직 밀려나 있으면 제자리로 (밀림이 끝나며 자세를 덮어쓰지 않게)
    setPose(a.obj, 'attack_ready'); setPose(t.obj, 'hurt');
    const gem = img(this, a.x, a.y - 30, 'gem').setDepth(DEPTH.UI);
    this.tweens.add({ targets: gem, scale: gem.scaleX * 1.5, alpha: 0, duration: 900, onComplete: () => gem.destroy() });
    const beam = this.add.rectangle((a.x + t.x) / 2, t.y - 14, Math.abs(t.x - a.x), 3, 0xff6fd8, 0.9).setDepth(DEPTH.UI);
    this.tweens.add({ targets: beam, alpha: 0, duration: 700, onComplete: () => beam.destroy() });
    fx(this, 'fx_purify_anim', t.x, t.y - 16, t.enemyKind === 'boss' ? 2 : 1.3);
    for (let i = 0; i < 4; i++) { this.sparkle(t.x + Phaser.Math.Between(-10, 10), t.y - 12 + Phaser.Math.Between(-12, 8), 0xff6fd8); await wait(this, 120); }
    // 보라색 → 원래 색
    const from = Phaser.Display.Color.ValueToColor(CORRUPT_TINT), to = Phaser.Display.Color.ValueToColor(0xffffff);
    await tween(this, { targets: { v: 0 }, v: 100, duration: 700, onUpdate: (tw) => { const v = tw.getValue(); const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, v); t.obj.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b)); } });
    t.obj.clearTint();
    t.alive = false; t.purified = true;
    setPose(a.obj, 'happy'); this.time.delayedCall(700, () => { if (a.alive && !this.bossPurified) setPose(a.obj, 'idle'); });
    t.hpBar.setVisible(false); t.nameT.setVisible(false);
    if (t.enemyKind === 'boss') {
      this.bossPurified = true;
      this.say(`${t.name}이(가) 정화되었다!`);
      setPose(t.obj, 'happy'); // 원래 모습으로 돌아와 기뻐한다
      await wait(this, 600);
      return;
    }
    if (t.enemyKind === 'animal') {
      const a = Data.animal(t.animalId);
      const isNew = GameState.rescueAnimal(t.animalId);
      this.rescued.push({ id: t.animalId, isNew });
      this.say(`${a.name}이(가) 정화되었다! 깨끗해졌어!`);
      setPose(t.obj, 'happy');
      this.tweens.add({ targets: t.obj, y: t.y - 10, duration: 200, yoyo: true, repeat: 2 });
      await wait(this, 800);
      setView(t.obj, 'side', true); setPose(t.obj, 'move');
      await tween(this, { targets: t.obj, x: t.x - 60, alpha: 0, duration: 500 });
    } else {
      this.purifiedPlants++;
      this.say(`${t.name}이(가) 맑아져 사라졌다!`);
      await tween(this, { targets: t.obj, alpha: 0, scale: t.obj.scaleX * 0.2, duration: 500 });
    }
    await wait(this, 300);
  }

  // ---------- 연출 ----------
  // 제자리(u.y) 기준으로 폴짝. 겹쳐 눌러도 위로 조금씩 떠오르지 않는다.
  bounce(u) {
    const o = u.obj; if (!o || !o.active) return;
    if (u.bounceTw) u.bounceTw.stop();
    o.y = u.y;
    u.bounceTw = this.tweens.add({ targets: o, y: u.y - 6, duration: 100, yoyo: true, onComplete: () => { u.bounceTw = null; } });
  }
  // 이겼을 때: 살아 있는 친구들이 기뻐하며 폴짝
  celebrate() {
    for (const a of this.allies) {
      if (!a.alive) continue;
      this.settle(a); this.dropShield(a); a.defending = false;
      setPose(a.obj, 'happy');
      this.tweens.add({ targets: a.obj, y: a.y - 8, duration: 150, yoyo: true, repeat: 2 });
    }
  }
  bodyHeight(t) { return t.obj.isHero ? 30 : Math.max(10, t.obj.displayHeight || 16); }
  flashWhite(t) {
    const o = t.obj;
    if (o.isHero) o.flashWhite(true); else o.setTintFill(0xffffff);
    this.time.delayedCall(95, () => {
      if (!o.active) return;
      if (o.isHero) o.flashWhite(false);
      else if (t.side === 'enemy' && !t.purified) o.setTint(CORRUPT_TINT);
      else o.clearTint();
    });
  }
  // 숫자가 크게 튀어나왔다가 위로 사라짐. 아주 세게 들어가면 노랗고 더 크게.
  popNumber(t, value, crit, color) {
    const y = t.y - this.bodyHeight(t) - 6;
    const n = txt(this, t.x, y, String(value), { size: 14, origin: 0.5, color: color || (crit ? '#ffe066' : '#ffffff'), depth: DEPTH.UI + 5, strokeThickness: 3 });
    n.setScale(crit ? 2.2 : 1.7);
    this.tweens.add({ targets: n, scale: crit ? 1.35 : 1, duration: 150, ease: 'Back.easeOut' });
    this.tweens.add({ targets: n, y: y - 16, alpha: 0, delay: 420, duration: 520, ease: 'Quad.easeIn', onComplete: () => n.destroy() });
    if (crit) {
      const c = txt(this, t.x, y - 14, '아주 세게!', { size: 11, origin: 0.5, color: '#ffb347', depth: DEPTH.UI + 6, strokeThickness: 3 });
      this.tweens.add({ targets: c, y: y - 24, alpha: 0, delay: 500, duration: 500, onComplete: () => c.destroy() });
    }
  }
  floatNumber(t, text, color) {
    const n = txt(this, t.x, t.y - 28, text, { size: 14, origin: 0.5, color, depth: DEPTH.UI + 5 });
    this.tweens.add({ targets: n, y: n.y - 18, alpha: 0, duration: 800, ease: 'Quad.easeOut', onComplete: () => n.destroy() });
  }
  // 달려갈 때 발밑 먼지
  dust(x, y) {
    for (let i = 0; i < 4; i++) {
      const p = this.add.circle(x + Phaser.Math.Between(-4, 4), y - 1, Phaser.Math.Between(2, 3), 0xe8dcc0, 0.8).setDepth(wd(y) + 0.0001);
      this.tweens.add({ targets: p, y: y - Phaser.Math.Between(3, 7), x: p.x + Phaser.Math.Between(-6, 6), alpha: 0, scale: 1.6, duration: 380, onComplete: () => p.destroy() });
    }
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
      GameState.addGate(this.p.stageId, this.p.enemyKey); // 보스 문 게이지 (마을에 다녀와도 유지)
    }
  }
  async onWin() {
    Audio.playBgm('victory'); Audio.sfx('win');
    this.say('이겼다!');
    this.celebrate();
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
    this.celebrate();
    const boss = this.enemies.find(e => e.enemyKind === 'boss');
    const lines = (Data.dialogues.bossPurified[boss.enemyId] || []).map(l => Data.fmt(l));
    // 보상
    const s = GameState.s, d = Data.enemy(boss.enemyId);
    s.stardust += d.stardust; s.shards += d.shards || 0;
    for (const dr of d.drops || []) if (Math.random() < dr.chance) { GameState.addItem(dr.item, 1); lines.push(`${Data.item(dr.item).name}을(를) 얻었어요!`); }
    lines.push(`경험치 +${d.exp}  ★${d.stardust}  ◆${d.shards || 0}`);
    GameState.syncFromBattle(this.allies);
    const careMsgs = GameState.afterBattle(this.allies);
    for (const a of this.allies) {
      if (!a.alive) continue;
      const rec = a.kind === 'player' ? s.player : s.animals[a.animalId];
      if (GameState.gainExp(rec, d.exp) > 0) { const st = a.kind === 'player' ? GameState.playerStats() : GameState.animalStats(a.animalId); rec.hp = st.hp; rec.mp = st.mp; lines.push(`${a.name} 레벨 업! Lv${rec.level}`); }
    }
    lines.push(...careMsgs); // 이긴 판(onWin)과 같은 순서: 레벨 업 → 돌봄 소식
    GameState.save();
    await wait(this, 400);
    await this.dialog.show(lines);
    await fadeOut(this, 400);
    this.scene.start('Purify', { stageId: this.p.stageId, bossId: boss.enemyId });
  }
}
