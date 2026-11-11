// 돌보기 미니게임: 샤워(문지르기 + 타이밍 헹구기), 간식 받아먹기, 숨바꼭질
import { W, H, COLORS, PX } from '../config.js';
import Data from '../systems/Data.js';
import GameState from '../systems/GameState.js';
import Audio from '../systems/Audio.js';
import { txt, Button, panel, UIGroup, DialogBox, fadeIn, fadeOut, tween, wait, bar, DEPTH, setupCamera } from '../systems/UI.js';
import { img, unit, setPose, fx } from '../systems/Assets.js';

const GRADE_TITLE = ['아쉬워요...', '잘했어요!', '완벽해요!'];

export default class MiniGameScene extends Phaser.Scene {
  constructor() { super('MiniGame'); }
  init(data) { this.p = data || {}; }

  create() {
    setupCamera(this);
    fadeIn(this);
    Audio.playBgm('village');
    this.id = this.p.animalId; this.type = this.p.type;
    this.a = Data.animal(this.id); this.rec = GameState.s.animals[this.id];
    // 씬 인스턴스가 재사용되므로 지난 게임의 상태를 전부 지운다
    this.running = false; this.ended = false; this.updater = null; this.leaving = false;
    this.note = null; this.phase = 0; this.items = []; this.spots = []; this.bushes = []; this.wiggle = null;
    this.timeLeft = null; this.onTimeEnd = null; this.score = 0; this.hits = 0; this.scrubbed = 0; this.canPick = false;
    this.spd = GameState.animalStats(this.id).spd; // 빠른 동물일수록 어려워요
    this.dialog = new DialogBox(this);
    this.hud = new UIGroup();
    this.scoreText = txt(this, W - 62, 6, '', { size: 11, origin: [1, 0], depth: DEPTH.UI });
    this.info = txt(this, W / 2, 24, '', { size: 11, origin: [0.5, 0], align: 'center', depth: DEPTH.UI, color: COLORS.yellow });
    new Button(this, W - 56, 4, 52, 20, '그만하기', () => this.quit(), { color: 0x555577, depth: DEPTH.TOP });
    this.timeBar = bar(this, 8, 12, 120, 8, COLORS.gold, { depth: DEPTH.UI });
    this.timeBar.setVisible(false);
    this.begin();
  }

  async begin() {
    const lines = Data.dialogues.minigame[this.type].map(l => Data.fmt(l, { name: this.a.name }));
    if (this.type === 'shower') this.setupShower(); else if (this.type === 'catch') this.setupCatch(); else this.setupHide();
    await this.dialog.show(lines);
    if (this.ended) return;
    this.running = true;
    if (this.type === 'shower') this.runShower(); else if (this.type === 'catch') this.runCatch(); else this.runHide();
  }
  update(time, delta) { if (this.running && this.updater) this.updater(delta / 1000); }
  setScore(text) { this.scoreText.setText(text); }
  pop(x, y, text, color = '#ffffff') {
    const t = txt(this, x, y, text, { size: 14, origin: 0.5, color, depth: DEPTH.UI + 5 });
    this.tweens.add({ targets: t, y: y - 16, alpha: 0, duration: 700, onComplete: () => t.destroy() });
  }
  splash(x, y, color, n = 6) {
    for (let i = 0; i < n; i++) {
      const p = this.add.rectangle(x, y, 2, 2, color).setDepth(DEPTH.UI + 4);
      const ang = Math.random() * Math.PI * 2, dist = 8 + Math.random() * 14;
      this.tweens.add({ targets: p, x: x + Math.cos(ang) * dist, y: y + Math.sin(ang) * dist, alpha: 0, duration: 450, onComplete: () => p.destroy() });
    }
  }
  startTimer(seconds, onEnd) {
    this.timeLeft = seconds; this.timeMax = seconds; this.timeBar.setVisible(true); this.timeBar.set(1);
    this.onTimeEnd = onEnd;
  }
  tickTimer(dt) {
    if (this.timeLeft === null || this.timeLeft === undefined) return;
    this.timeLeft -= dt; this.timeBar.set(Math.max(0, this.timeLeft / this.timeMax), 0xe74c3c);
    if (this.timeLeft <= 0) { this.timeLeft = null; const f = this.onTimeEnd; this.onTimeEnd = null; if (f) f(); }
  }

  // =====================================================================
  // 샤워: ① 문질러 거품 내기 → ② 원이 맞을 때 탭해서 헹구기
  // =====================================================================
  setupShower() {
    this.add.rectangle(W / 2, H / 2, W, H, 0xbfe6f5);
    for (let x = 0; x < W; x += 32) this.add.rectangle(x, H / 2, 1, H, 0xa8d8ec);
    for (let y = 0; y < H; y += 32) this.add.rectangle(W / 2, y, W, 1, 0xa8d8ec);
    this.add.rectangle(W / 2, 214, W, 52, 0x8fc4dc);
    // 욕조 뒤
    this.add.rectangle(W / 2, 176, 150, 44, 0xffffff).setStrokeStyle(2, 0x1b1b2a);
    this.pet = unit(this, W / 2, 178, this.a.sprite).setOrigin(0.5, 1).setScale(5 / PX).setDepth(2);
    // 욕조 앞 + 물
    this.add.rectangle(W / 2, 186, 146, 22, 0x7fc8ee).setDepth(3);
    this.add.rectangle(W / 2, 197, 154, 8, 0xf4f4f4).setStrokeStyle(2, 0x1b1b2a).setDepth(3);
    this.spots = [[-22, -58], [20, -54], [-6, -40], [24, -32], [-26, -30]].map(([dx, dy]) => {
      const dirt = this.add.circle(0, 0, 8, 0x6b4a2a, 0.9).setStrokeStyle(1, 0x3a2412).setDepth(4);
      const foam = this.add.circle(0, 0, 9, 0xffffff, 0.95).setStrokeStyle(1, 0xcfe8ff).setDepth(4).setVisible(false);
      return { dx, dy, dirt, foam, rub: 0, clean: false };
    });
    this.placeSpots();
  }
  placeSpots() { for (const s of this.spots) { s.dirt.setPosition(this.pet.x + s.dx, this.pet.y + s.dy); s.foam.setPosition(this.pet.x + s.dx, this.pet.y + s.dy); } }

  runShower() {
    // 동물이 싫어서 몸을 흔든다 (빠른 동물일수록 많이)
    const amp = 10 + this.spd * 1.6, dur = Math.max(450, 1300 - this.spd * 70);
    this.wiggle = this.tweens.add({ targets: this.pet, x: { from: W / 2 - amp, to: W / 2 + amp }, duration: dur, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.info.setText('① 더러운 곳을 문질러요!'); setPose(this.pet, 'hurt');
    this.scrubbed = 0; this.setScore(`거품 0/${this.spots.length}`);
    let last = null;
    const onMove = (pointer) => {
      if (!pointer.isDown || this.phase !== 1) { last = null; return; }
      const px = pointer.worldX, py = pointer.worldY;
      const moved = last ? Phaser.Math.Distance.Between(px, py, last.x, last.y) : 0;
      last = { x: px, y: py };
      for (const s of this.spots) {
        if (s.clean) continue;
        if (Phaser.Math.Distance.Between(px, py, s.dirt.x, s.dirt.y) < 16) {
          s.rub += moved; s.dirt.setAlpha(Math.max(0.2, 0.9 - s.rub / 60));
          if (Math.random() < 0.3) this.splash(px, py, 0xffffff, 2);
          if (s.rub >= 50) { s.clean = true; s.dirt.setVisible(false); s.foam.setVisible(true); this.scrubbed++; Audio.sfx('star'); this.setScore(`거품 ${this.scrubbed}/${this.spots.length}`); if (this.scrubbed >= this.spots.length) this.toRinse(); }
        }
      }
    };
    this.input.on('pointermove', onMove);
    this.input.on('pointerup', () => { last = null; });
    this.phase = 1;
    this.startTimer(14, () => this.toRinse());
    this.updater = (dt) => { this.placeSpots(); this.tickTimer(dt); if (this.note) this.updateNote(dt); };
  }

  async toRinse() {
    if (this.phase !== 1) return;
    this.phase = 0; this.timeLeft = null; this.timeBar.setVisible(false);
    this.info.setText('② 원이 딱 맞을 때 탭!');
    this.pop(W / 2, 90, this.scrubbed >= this.spots.length ? '거품 완성!' : '시간 끝!', '#ffe066');
    await wait(this, 900);
    if (this.ended) return;
    this.wiggle.timeScale = 0.6; // 헹굴 땐 조금 얌전
    this.hits = 0; this.noteIndex = 0; this.noteTotal = 10; this.phase = 2;
    this.setScore(`헹구기 0/${this.noteTotal}`);
    this.input.on('pointerdown', (pointer) => this.tapNote(pointer));
    this.nextNote();
  }
  nextNote() {
    if (this.ended) return;
    if (this.noteIndex >= this.noteTotal) { this.note = null; return this.endShower(); }
    const dx = Phaser.Math.Between(-26, 26), dy = Phaser.Math.Between(-62, -22);
    const T = Phaser.Math.Clamp(1450 - this.spd * 55, 780, 1300); // 원이 맞는 순간까지 걸리는 시간(ms)
    const target = this.add.circle(0, 0, 11, 0x7fd0ff, 0.6).setStrokeStyle(2, 0xffffff).setDepth(6);
    const ring = this.add.circle(0, 0, 36, 0xffffff, 0).setStrokeStyle(2, 0xffe066).setDepth(7);
    this.note = { dx, dy, T, t: 0, target, ring, done: false };
    this.noteIndex++;
    this.updateNote(0);
  }
  updateNote(dt) {
    const n = this.note; if (!n || n.done) return;
    n.t += dt * 1000;
    const x = this.pet.x + n.dx, y = this.pet.y + n.dy;
    n.target.setPosition(x, y); n.ring.setPosition(x, y);
    const r = 36 - (36 - 11) * (n.t / n.T);
    n.ring.setRadius(Math.max(3, r));
    if (n.t > n.T + 260) this.resolveNote(false, '늦었어요');
  }
  tapNote(pointer) {
    const n = this.note; if (!n || n.done || this.phase !== 2) return;
    if (Phaser.Math.Distance.Between(pointer.worldX, pointer.worldY, n.target.x, n.target.y) > 24) return; // 물방울 밖은 무시
    const err = n.t - n.T;
    if (Math.abs(err) <= 230) this.resolveNote(true, Math.abs(err) <= 90 ? '딱!' : '좋아요');
    else this.resolveNote(false, err < 0 ? '빨라요' : '늦었어요');
  }
  resolveNote(hit, label) {
    const n = this.note; n.done = true;
    const x = n.target.x, y = n.target.y;
    n.target.destroy(); n.ring.destroy();
    if (hit) { this.hits++; Audio.sfx('heal'); this.splash(x, y, 0x7fd0ff, 10); fx(this, 'fx_star_anim', x, y, 1.2, 8); this.pop(x, y - 10, label, '#7ee081'); const s = this.spots.find(sp => sp.foam.visible); if (s) s.foam.setVisible(false); }
    else { Audio.sfx('error'); this.pop(x, y - 10, label, '#ff8080'); }
    this.setScore(`헹구기 ${this.hits}/${this.noteTotal}`);
    this.time.delayedCall(380, () => this.nextNote());
  }
  endShower() {
    this.phase = 0; this.running = false; if (this.wiggle) this.wiggle.stop(); setPose(this.pet, 'idle');
    const perfect = this.hits >= 9 && this.scrubbed >= this.spots.length;
    const grade = perfect ? 2 : this.hits >= 6 ? 1 : 0;
    const res = GameState.showerResult(this.id, grade, this.hits);
    const msg = Data.fmt(Data.dialogues.care[['showerFail', 'showerOk', 'showerPerfect'][grade]], { name: this.a.name });
    if (grade === 0) this.tweens.add({ targets: this.pet, x: W + 60, duration: 600, ease: 'Quad.easeIn' });
    else this.tweens.add({ targets: this.pet, y: this.pet.y - 12, duration: 150, yoyo: true, repeat: 2 });
    this.showResult(grade, [`거품 ${this.scrubbed}/${this.spots.length}   헹구기 ${this.hits}/${this.noteTotal}`, msg, this.heartLine(res.reward)], res.event, grade === 0 || this.rec.dirt > 0);
  }

  // =====================================================================
  // 간식 받아먹기: 좌우로 끌어서 간식 받기, 진흙 피하기 (20초)
  // =====================================================================
  setupCatch() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x87ceeb);
    this.add.rectangle(W / 2, 222, W, 40, 0x6cc06a);
    this.add.rectangle(W / 2, 203, W, 2, 0x58a858);
    for (let i = 0; i < 4; i++) this.add.ellipse(40 + i * 80, 50 + (i % 2) * 20, 46, 16, 0xffffff, 0.8);
    this.pet = unit(this, W / 2, 208, this.a.sprite).setOrigin(0.5, 1).setScale(3 / PX).setDepth(5);
    this.items = []; this.score = 0; this.targetX = W / 2; this.stun = 0;
  }
  runCatch() {
    this.info.setText('간식을 받아요! 진흙은 피해요!'); setPose(this.pet, 'move');
    this.setScore('간식 0');
    const follow = (pointer) => { this.targetX = Phaser.Math.Clamp(pointer.worldX, 20, W - 20); };
    this.input.on('pointerdown', follow);
    this.input.on('pointermove', (pointer) => { if (pointer.isDown) follow(pointer); });
    let spawnIn = 0.4, elapsed = 0;
    this.startTimer(20, () => this.endCatch());
    this.updater = (dt) => {
      elapsed += dt; this.tickTimer(dt);
      if (!this.running) return;
      // 동물 이동 (진흙 맞으면 잠깐 멈춤)
      if (this.stun > 0) this.stun -= dt;
      else { const dx = this.targetX - this.pet.x; this.pet.x += Phaser.Math.Clamp(dx, -260 * dt, 260 * dt); if (Math.abs(dx) > 1) this.pet.setFlipX(dx < 0); }
      // 떨어지는 것 만들기
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawnIn = Math.max(0.38, 0.75 - elapsed * 0.015);
        const mud = Math.random() < 0.26;
        const key = mud ? 'mg_mud' : (Math.random() < 0.5 ? 'mg_carrot' : 'mg_acorn');
        const it = img(this, Phaser.Math.Between(22, W - 22), 30, key).setScale(1.5 / PX).setDepth(6);
        it.mud = mud; it.vy = 70 + elapsed * 2.5 + Math.random() * 25;
        this.items.push(it);
      }
      for (const it of this.items) {
        it.y += it.vy * dt; it.angle += (it.mud ? 40 : 90) * dt;
        const mouthY = this.pet.y - 30;
        if (!it.dead && Math.abs(it.y - mouthY) < 12 && Math.abs(it.x - this.pet.x) < 20) {
          it.dead = true;
          if (it.mud) { this.score = Math.max(0, this.score - 1); this.stun = 0.6; Audio.sfx('error'); this.pop(it.x, it.y, '철퍽!', '#c98b5b'); this.pet.setTint(0xb08a6a); setPose(this.pet, 'hurt'); this.time.delayedCall(600, () => { this.pet.clearTint(); if (this.running) setPose(this.pet, 'move'); }); }
          else { this.score += 1; Audio.sfx('chest'); this.pop(it.x, it.y, '냠!', '#ffe066'); this.tweens.add({ targets: this.pet, scaleY: 3.4 / PX, duration: 80, yoyo: true }); }
          this.setScore(`간식 ${this.score}`);
        }
        if (it.y > 206) it.dead = true;
      }
      this.items = this.items.filter(it => { if (it.dead) { it.destroy(); return false; } return true; });
    };
  }
  endCatch() {
    this.running = false; this.items.forEach(it => it.destroy()); this.items = []; setPose(this.pet, 'idle');
    const grade = this.score >= 12 ? 2 : this.score >= 6 ? 1 : 0;
    this.endPlay('catch', grade, this.score, `간식 ${this.score}개! (12개면 최고)`);
  }

  // =====================================================================
  // 숨바꼭질: 덤불 3개 중 어디 숨었는지 맞히기 (3판, 갈수록 빨라져요)
  // =====================================================================
  setupHide() {
    this.add.rectangle(W / 2, H / 2, W, H, 0x9fd8a0);
    this.add.rectangle(W / 2, 60, W, 120, 0x87ceeb);
    this.add.rectangle(W / 2, 121, W, 2, 0x58a858);
    this.slots = [80, 160, 240];
    this.bushes = this.slots.map((x, i) => {
      const b = img(this, x, 170, 'bush').setOrigin(0.5, 1).setScale(3.4 / PX).setDepth(5);
      b.slot = i;
      b.setInteractive({ useHandCursor: true });
      b.on('pointerup', () => this.pickBush(b));
      return b;
    });
    this.pet = unit(this, W / 2, 110, this.a.sprite).setOrigin(0.5, 1).setScale(2.5 / PX).setDepth(4);
    this.round = 0; this.score = 0; this.canPick = false;
  }
  runHide() { this.updater = null; this.setScore('맞힘 0/3'); this.hideRound(); }
  async hideRound() {
    if (this.ended) return;
    this.round++; this.canPick = false;
    this.info.setText(`${this.round}번째! 잘 보세요...`);
    // 동물이 덤불로 쏙
    this.pet.setAlpha(1).setPosition(W / 2, 110).setDepth(4);
    this.hiding = Phaser.Utils.Array.GetRandom(this.bushes);
    await tween(this, { targets: this.pet, y: 96, duration: 150, yoyo: true, repeat: 1 });
    await tween(this, { targets: this.pet, x: this.hiding.x, y: 166, duration: 350, ease: 'Quad.easeIn' });
    this.pet.setAlpha(0); Audio.sfx('tap');
    await wait(this, 300);
    // 섞기: 판이 갈수록 많이, 빠르게. 빠른 동물은 더 빠르게.
    const swaps = 2 + this.round * 2, dur = Math.max(170, 520 - this.round * 90 - this.spd * 8);
    for (let i = 0; i < swaps; i++) {
      if (this.ended) return;
      const [a, b] = Phaser.Utils.Array.Shuffle(this.bushes.slice()).slice(0, 2);
      const ax = this.slots[a.slot], bx = this.slots[b.slot];
      const sa = a.slot; a.slot = b.slot; b.slot = sa;
      this.tweens.add({ targets: a, y: 160, duration: dur / 2, yoyo: true });
      this.tweens.add({ targets: b, y: 180, duration: dur / 2, yoyo: true });
      this.tweens.add({ targets: a, x: bx, duration: dur, ease: 'Sine.easeInOut' });
      await tween(this, { targets: b, x: ax, duration: dur, ease: 'Sine.easeInOut' });
      await wait(this, 60);
    }
    this.info.setText('어디 숨었을까? 덤불을 탭!');
    this.canPick = true;
  }
  async pickBush(b) {
    if (!this.canPick || this.ended) return;
    this.canPick = false;
    const ok = b === this.hiding;
    // 정답 덤불에서 동물이 뿅
    this.pet.setPosition(this.hiding.x, 166).setAlpha(1).setDepth(6);
    this.tweens.add({ targets: b, angle: { from: -8, to: 8 }, duration: 60, yoyo: true, repeat: 2, onComplete: () => b.setAngle(0) });
    await tween(this, { targets: this.pet, y: 130, duration: 200, ease: 'Quad.easeOut' });
    if (ok) { this.score++; Audio.sfx('star'); this.pop(b.x, 120, '찾았다!', '#7ee081'); this.splash(b.x, 130, 0xffe066, 10); }
    else { Audio.sfx('error'); this.pop(b.x, 120, '여기 없어요', '#ff8080'); this.pop(this.hiding.x, 110, '여기!', '#ffe066'); }
    this.setScore(`맞힘 ${this.score}/3`);
    await wait(this, 1000);
    if (this.round >= 3) { this.running = false; const grade = this.score >= 3 ? 2 : this.score >= 2 ? 1 : 0; return this.endPlay('hide', grade, this.score, `3번 중 ${this.score}번 맞혔어요!`); }
    this.hideRound();
  }

  // =====================================================================
  // 결과
  // =====================================================================
  heartLine(reward) { return reward > 0 ? `친구 레벨 ♥ +${reward}` : reward < 0 ? `친구 레벨 ♥ ${reward}` : '친구 레벨은 그대로예요'; }
  endPlay(type, grade, score, line) {
    const res = GameState.playResult(this.id, type, grade, score);
    const msg = Data.fmt(Data.dialogues.care[['playSoso', 'playGood', 'playGreat'][grade]], { name: this.a.name });
    const lines = [line, msg, res.free ? Data.fmt(Data.dialogues.care.playFree) : this.heartLine(res.reward)];
    this.tweens.add({ targets: this.pet, y: this.pet.y - 12, duration: 150, yoyo: true, repeat: 2 });
    this.showResult(grade, lines, res.event, true);
  }
  showResult(grade, lines, event, canRetry) {
    this.ended = true; this.running = false; this.timeBar.setVisible(false);
    GameState.save();
    Audio.sfx(grade === 2 ? 'levelup' : grade === 1 ? 'win' : 'error');
    if (event === 'sulk') lines.push(Data.fmt(Data.dialogues.care.sulk, { name: this.a.name }));
    if (event === 'back') lines.push(`${this.a.name}이(가) 기분이 풀려서 돌아왔어요!`);
    const g = new UIGroup(), w = 260, h = 150, x = (W - w) / 2, y = (H - h) / 2;
    g.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.5).setDepth(DEPTH.MODAL - 1).setInteractive());
    g.add(panel(this, x, y, w, h, { depth: DEPTH.MODAL }));
    g.add(txt(this, W / 2, y + 10, GRADE_TITLE[grade], { size: 14, origin: [0.5, 0], color: COLORS.yellow, depth: DEPTH.MODAL + 1 }));
    g.add(txt(this, W / 2, y + 30, '★'.repeat(grade + 1) + '☆'.repeat(2 - grade), { size: 14, origin: [0.5, 0], color: '#ffd93b', depth: DEPTH.MODAL + 1 }));
    g.add(txt(this, W / 2, y + 52, lines.join('\n'), { size: 11, origin: [0.5, 0], align: 'center', wrap: w - 20, depth: DEPTH.MODAL + 1, lineSpacing: 3 }));
    const retry = g.add(new Button(this, x + 16, y + h - 32, 104, 24, '한 번 더!', async () => { await fadeOut(this, 200); this.scene.start('MiniGame', { animalId: this.id, type: this.type }); }, { depth: DEPTH.MODAL + 1, color: COLORS.ok }));
    if (!canRetry) retry.setEnabled(false);
    g.add(new Button(this, x + w - 120, y + h - 32, 104, 24, '돌아가기', () => this.back(), { depth: DEPTH.MODAL + 1 }));
  }
  async quit() { if (this.leaving) return; this.ended = true; this.running = false; this.back(); }
  async back() {
    if (this.leaving) return; this.leaving = true;
    GameState.save();
    await fadeOut(this, 200);
    this.scene.start('Village', { openAnimal: this.id });
  }
}
