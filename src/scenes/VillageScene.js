// 마을: 여관 / 상점 / 대장간 / 현자의 집 / 동물 쉼터 / 숲 입구
import { W, H, COLORS, TILE, wd, PX } from '../config.js';
import Data from '../systems/Data.js';
import GameState from '../systems/GameState.js';
import Audio from '../systems/Audio.js';
import { txt, Button, panel, UIGroup, DialogBox, confirm, toast, soundButton, fadeIn, fadeOut, tween, DEPTH, setupCamera } from '../systems/UI.js';
import { makeCharacter, decorateMap, img } from '../systems/Assets.js';

const BUILDINGS = [
  { key: 'inn',     name: '여관',      x: 44,  y: 84 },
  { key: 'shop',    name: '상점',      x: 118, y: 84 },
  { key: 'smithy',  name: '대장간',    x: 192, y: 84 },
  { key: 'sage',    name: '현자의 집', x: 266, y: 84 },
  { key: 'shelter', name: '동물 쉼터', x: 70,  y: 178 },
  { key: 'home',    name: '우리 집',   x: 160, y: 178 },
  { key: 'gate',    name: '숲 입구',   x: 262, y: 178 },
];

const VILLAGE_ROWS = [
  '....................',
  '.T......T.......T...',
  '....................',
  '....................',
  '..ppppppppppppppp...',
  '..p....p....p...p...',
  '..p....p....p...p...',
  '..ppppppppppppppp...',
  '.....*..p......*....',
  '........p...........',
  '..pppppppppppppppp..',
  '..p..............p..',
  '..p..*........*..p..',
  '.T.......T..........',
  '....................',
];

export default class VillageScene extends Phaser.Scene {
  constructor() { super('Village'); }
  init(data) { this.params = data || {}; }

  create() {
    setupCamera(this);
    fadeIn(this);
    // 씬 인스턴스가 재사용되므로 상태 초기화
    this.busy = false; this.panelGroup = null; this.listGroup = null; this.moneyText = null;
    Audio.playBgm('village');
    const s = GameState.s;
    GameState.setLocation({ scene: 'Village' });
    if (this.params.wokeAtInn) GameState.healAll();
    GameState.save();

    // 바닥
    const legend = { '.': 0, 'T': 1, 'p': 11, '*': 4 };
    const grid = VILLAGE_ROWS.map(r => r.split('').map(c => legend[c] ?? 0));
    const deco = decorateMap(this, grid, 0, 0);
    const map = this.make.tilemap({ data: deco.data, tileWidth: TILE * PX, tileHeight: TILE * PX });
    const tileset = map.addTilesetImage('tiles', 'tiles', TILE * PX, TILE * PX, 0, 0);
    map.createLayer(0, tileset, 0, 0).setScale(1 / PX);

    // 건물
    this.buildings = {};
    for (const b of BUILDINGS) {
      const im = img(this, b.x, b.y, 'bld_' + b.key).setOrigin(0.5, 1).setDepth(wd(b.y));
      im.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-6 * PX, -6 * PX, 52 * PX, 48 * PX), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
      im.on('pointerup', () => this.goTo(b));
      const label = txt(this, b.x, b.y + 2, b.name, { size: 11, origin: [0.5, 0], depth: DEPTH.WORLD_UI });
      this.buildings[b.key] = { ...b, img: im, label };
    }

    // 주인공
    this.hero = makeCharacter(this, 160, 150, s.player.look); this.hero.setDepth(wd(150));
    // 안내 동물 (힌트)
    this.guide = img(this, 216, 214, 'guide').setOrigin(0.5, 1).setDepth(wd(196)).setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-8 * PX, -8 * PX, 32 * PX, 32 * PX), hitAreaCallback: Phaser.Geom.Rectangle.Contains });
    this.tweens.add({ targets: this.guide, y: this.guide.y - 3, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.guide.on('pointerup', () => this.guideHint());
    txt(this, 216, 216, Data.strings.guideAnimal, { size: 11, origin: [0.5, 0], color: COLORS.yellow });

    // HUD
    this.hud = new UIGroup();
    this.hud.add(panel(this, 2, 2, 150, 18, { color: 0x000000, alpha: 0.55, border: false }));
    this.hudText = this.hud.add(txt(this, 6, 4, '', { size: 11 }));
    soundButton(this);
    this.dialog = new DialogBox(this);
    this.busy = false;
    this.refreshHud();

    // 환영 / 여관에서 깨어남
    if (this.params.wokeAtInn) this.say(Data.dialogues.lose.map(Data.fmt.bind(Data)));
    else if (this.params.welcome) this.say(Data.dialogues.villageWelcome.map(Data.fmt.bind(Data)));
    else if (this.params.cleared) this.say(Data.dialogues.stageClear.map(Data.fmt.bind(Data)));
  }

  refreshHud() {
    const s = GameState.s;
    this.hudText.setText(`★${Data.strings.money} ${s.stardust}   ◆${Data.strings.shard} ${s.shards}`);
  }
  async say(lines) { this.busy = true; await this.dialog.show(lines); this.busy = false; }
  async guideHint() {
    if (this.busy) return;
    const hints = Data.dialogues.guideHints; const i = GameState.s.flags.hintIndex || 0;
    GameState.s.flags.hintIndex = (i + 1) % hints.length;
    await this.say([Data.fmt(hints[i])]);
  }

  async goTo(b) {
    if (this.busy) return; this.busy = true;
    Audio.sfx('tap');
    this.hero.setFlip(b.x < this.hero.x);
    const dist = Phaser.Math.Distance.Between(this.hero.x, this.hero.y, b.x, b.y + 10);
    // 이미 그 자리에 서 있으면(거리 0) 트윈을 돌리지 않는다 (0ms 트윈이 좌표를 망가뜨림)
    if (dist > 2) await tween(this, { targets: this.hero, x: b.x, y: b.y + 10, duration: Math.max(120, Math.min(900, dist * 5)), ease: 'Linear' });
    if (!Number.isFinite(this.hero.x) || !Number.isFinite(this.hero.y)) this.hero.setPosition(b.x, b.y + 10);
    this.hero.setDepth(wd(this.hero.y));
    this.busy = false;
    this.openFacility(b.key);
  }

  // ---------- 공통 패널 ----------
  openPanel(title) {
    this.busy = true;
    if (this.listGroup) this.listGroup.destroy(); if (this.panelGroup) this.panelGroup.destroy();
    const g = new UIGroup();
    g.add(this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(DEPTH.MODAL - 2).setInteractive());
    g.add(panel(this, 8, 8, W - 16, H - 16, { depth: DEPTH.MODAL - 1 }));
    g.add(txt(this, W / 2, 16, title, { size: 14, origin: [0.5, 0], color: COLORS.yellow, depth: DEPTH.MODAL }));
    g.add(new Button(this, W - 70, H - 36, 58, 24, '나가기', () => this.closePanel(), { depth: DEPTH.MODAL, color: 0x555577 }));
    this.moneyText = g.add(txt(this, 16, H - 30, '', { size: 11, depth: DEPTH.MODAL }));
    this.panelGroup = g; this.listGroup = new UIGroup(); this.page = 0;
    this.updateMoney();
    return g;
  }
  updateMoney() { const s = GameState.s; if (this.moneyText && this.moneyText.active) this.moneyText.setText(`★${s.stardust}  ◆${s.shards}`); this.refreshHud(); }
  closePanel() {
    if (this.listGroup) this.listGroup.destroy(); if (this.panelGroup) this.panelGroup.destroy();
    this.listGroup = null; this.panelGroup = null; this.busy = false; GameState.save();
  }
  // rows: [{label, right, sub, onTap, enabled, color}] 5줄씩 페이지
  renderList(rows, perPage = 5) {
    this.listGroup.destroy(); this.listGroup = new UIGroup();
    const g = this.listGroup, top = 36, rowH = 30;
    const pages = Math.max(1, Math.ceil(rows.length / perPage));
    this.page = Math.min(this.page, pages - 1);
    const slice = rows.slice(this.page * perPage, this.page * perPage + perPage);
    if (!rows.length) g.add(txt(this, W / 2, 100, '아직 아무것도 없어요.', { size: 11, origin: 0.5, depth: DEPTH.MODAL }));
    slice.forEach((r, i) => {
      const y = top + i * rowH;
      const b = g.add(new Button(this, 16, y, W - 32, rowH - 4, '', r.onTap, { depth: DEPTH.MODAL, color: r.color ?? 0x3d4066 }));
      b.label.setOrigin(0, 0.5).setPosition(24, y + (rowH - 4) / 2 - (r.sub ? 5 : 0)).setText(r.label);
      if (r.sub) g.add(txt(this, 24, y + 15, r.sub, { size: 11, color: '#b8c0e0', depth: DEPTH.MODAL + 1, strokeThickness: 1 }));
      if (r.right) g.add(txt(this, W - 24, y + (rowH - 4) / 2, r.right, { size: 11, origin: [1, 0.5], color: r.rightColor || COLORS.yellow, depth: DEPTH.MODAL + 1 }));
      if (r.enabled === false) b.setEnabled(false);
    });
    if (pages > 1) {
      g.add(new Button(this, W / 2 - 60, H - 36, 40, 24, '◀', () => { this.page = (this.page + pages - 1) % pages; this.renderList(rows, perPage); }, { depth: DEPTH.MODAL }));
      g.add(txt(this, W / 2, H - 24, `${this.page + 1}/${pages}`, { size: 11, origin: 0.5, depth: DEPTH.MODAL }));
      g.add(new Button(this, W / 2 + 20, H - 36, 40, 24, '▶', () => { this.page = (this.page + 1) % pages; this.renderList(rows, perPage); }, { depth: DEPTH.MODAL }));
    }
  }

  openFacility(key) {
    switch (key) {
      case 'inn': return this.openInn();
      case 'shop': return this.openShop();
      case 'smithy': return this.openSmithy();
      case 'sage': return this.openSage();
      case 'shelter': return this.openShelter();
      case 'gate': return this.openGate();
      case 'home': return this.goHome();
    }
  }

  // ---------- 여관 ----------
  async openInn() {
    this.busy = true;
    const ok = await confirm(this, '여관에서 쉬어 갈까요?\n(모두 회복 + 저장, 무료)', '쉬기', '아니요');
    if (ok) {
      await fadeOut(this, 300);
      GameState.healAll(); GameState.save();
      fadeIn(this, 300);
      Audio.sfx('heal');
      await this.dialog.show([Data.fmt(Data.dialogues.innRest)]);
    }
    this.busy = false;
  }

  // ---------- 상점 ----------
  openShop() {
    this.openPanel('상점');
    const render = () => {
      const s = GameState.s;
      const rows = Object.entries(Data.items).filter(([, it]) => it.shop).map(([id, it]) => ({
        label: `${it.name}  (가진 것 ${s.inventory[id] || 0})`, sub: it.desc, right: `★${it.price}`,
        enabled: s.stardust >= it.price,
        onTap: () => { s.stardust -= it.price; GameState.addItem(id, 1); Audio.sfx('chest'); toast(this, `${it.name}을(를) 샀어요!`); this.updateMoney(); render(); },
      }));
      this.renderList(rows);
    };
    render();
  }

  // ---------- 대장간 ----------
  openSmithy() {
    this.openPanel('대장간');
    const slotName = { weapon: '무기', armor: '옷', bracelet: '팔찌' };
    const render = () => {
      const s = GameState.s;
      const order = { weapon: 0, armor: 1, bracelet: 2 };
      const rows = Object.entries(Data.equipment).sort((a, b) => order[a[1].slot] - order[b[1].slot] || a[1].price - b[1].price).map(([id, e]) => {
        const equipped = s.player.equip[e.slot] === id, owned = s.ownedEquip.includes(id);
        return {
          label: `[${slotName[e.slot]}] ${e.name}${equipped ? ' ✓' : ''}`, sub: e.desc,
          right: equipped ? '착용 중' : owned ? '바꾸기' : `★${e.price}`, rightColor: equipped ? '#7ee081' : COLORS.yellow,
          color: equipped ? 0x2e5a3a : 0x3d4066,
          enabled: !equipped && (owned || s.stardust >= e.price),
          onTap: () => {
            if (!owned) { s.stardust -= e.price; s.ownedEquip.push(id); Audio.sfx('chest'); toast(this, `${e.name}을(를) 만들었어요!`); }
            else Audio.sfx('defend');
            s.player.equip[e.slot] = id;
            const st = GameState.playerStats(); s.player.hp = Math.min(s.player.hp, st.hp); s.player.mp = Math.min(s.player.mp, st.mp);
            this.updateMoney(); render();
          },
        };
      });
      this.renderList(rows);
    };
    render();
  }

  // ---------- 현자의 집 ----------
  openSage() {
    this.openPanel('현자의 집');
    const render = () => {
      const s = GameState.s;
      const owners = [{ id: 'player', name: s.player.name, skills: Data.player.skills }];
      for (const id of Object.keys(s.animals)) owners.push({ id, name: Data.animal(id).name, skills: Data.animal(id).skills });
      const rows = [];
      for (const o of owners) for (const sk of o.skills) {
        const lv = GameState.skillLevel(o.id, sk), data = Data.skill(sk), cost = lv; // 1→2: 1개, 2→3: 2개
        const max = lv >= 3;
        rows.push({
          label: `${o.name} - ${data.name}  Lv${lv}`, sub: data.desc,
          right: max ? '최고!' : `◆${cost}`, rightColor: max ? '#7ee081' : COLORS.yellow,
          enabled: !max && s.shards >= cost,
          onTap: () => { s.shards -= cost; GameState.setSkillLevel(o.id, sk, lv + 1); Audio.sfx('levelup'); toast(this, `${data.name}이(가) Lv${lv + 1}이 되었어요!`); this.updateMoney(); render(); },
        });
      }
      this.renderList(rows);
    };
    render();
  }

  // ---------- 동물 쉼터 ----------
  openShelter() {
    this.openPanel(`${Data.strings.cageName} (3마리까지 함께)`);
    const render = () => {
      const s = GameState.s;
      const rows = Object.entries(s.animals).map(([id, rec]) => {
        const a = Data.animal(id), inParty = s.party.includes(id), st = GameState.animalStatus(id), h = GameState.hearts(id);
        return {
          label: `${a.name} Lv${rec.level}  ${'♥'.repeat(h)}${'♡'.repeat(5 - h)}`,
          sub: `${a.role}  HP ${rec.hp}/${GameState.animalStats(id).hp}  상태: ${st.text}`,
          right: inParty ? '함께 가요' : '쉬는 중', rightColor: inParty ? '#7ee081' : '#b8c0e0',
          color: inParty ? 0x2e5a3a : 0x3d4066,
          onTap: () => this.openAnimalDetail(id),
        };
      });
      this.renderList(rows);
    };
    render();
  }
  openAnimalDetail(id) {
    const a = Data.animal(id);
    this.openPanel(a.name);
    const g = this.listGroup;
    const sprite = g.add(img(this, 60, 118, a.sprite).setScale(3 / PX).setDepth(DEPTH.MODAL));
    this.tweens.add({ targets: sprite, y: 114, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    const info = g.add(txt(this, 112, 36, '', { size: 11, depth: DEPTH.MODAL, lineSpacing: 4 }));
    const btns = new UIGroup(); g.add(btns);
    const say = (m) => toast(this, m, { y: 120, duration: 1500 });
    const render = () => {
      const s = GameState.s, rec = s.animals[id], st = GameState.animalStatus(id), h = GameState.hearts(id), stats = GameState.animalStats(id);
      const inParty = s.party.includes(id);
      info.setText([
        `Lv${rec.level}  ${a.role}   HP ${rec.hp}/${stats.hp}`,
        `친구 레벨 ${'♥'.repeat(h)}${'♡'.repeat(5 - h)}${rec.friend >= 80 ? '  힘이 나요!' : ''}`,
        `상태: ${st.text}${rec.dirt >= 5 && !rec.sick ? ' (샤워해 주세요)' : ''}`,
        inParty ? '지금 함께 모험 중이에요' : '쉼터에서 쉬고 있어요',
      ].join('\n'));
      btns.destroy(); btns.items = [];
      const B = (i, label, fn, opts = {}) => {
        const col = i % 2, row = Math.floor(i / 2);
        return btns.add(new Button(this, 112 + col * 100, 96 + row * 30, 96, 26, label, fn, { depth: DEPTH.MODAL, ...opts }));
      };
      const canGo = GameState.canBattle(id);
      B(0, inParty ? '쉬게 하기' : '함께 가기', () => {
        const r = GameState.toggleParty(id);
        if (r === 'full') { Audio.sfx('error'); say('3마리까지만 데려갈 수 있어요!'); }
        render();
      }, { color: inParty ? 0x555577 : COLORS.ok }).setEnabled(inParty || canGo);
      B(1, GameState.canPlay(id) ? '놀아주기 ♥' : '오늘은 놀았어요', () => {
        if (!GameState.canPlay(id)) { say(Data.fmt(Data.dialogues.care.playDone).replace(/\{name\}/g, a.name)); return; }
        const res = GameState.play(id); Audio.sfx('heal'); this.hop(sprite);
        say(Data.fmt(Data.dialogues.care.play).replace(/\{name\}/g, a.name));
        if (res === 'back') this.dialog.show([`${a.name}이(가) 기분이 풀려서 돌아왔어요!`]);
        render();
      }, { color: 0xd6679a }).setEnabled(GameState.canPlay(id) && !rec.sick);
      B(2, rec.dirt >= 5 ? '샤워 (필요!)' : '샤워', () => {
        const res = GameState.shower(id); Audio.sfx('star');
        say(Data.fmt(Data.dialogues.care.shower).replace(/\{name\}/g, a.name));
        if (res === 'sulk') this.dialog.show([Data.fmt(Data.dialogues.care.sulk).replace(/\{name\}/g, a.name)]);
        render();
      }, { color: 0x4a90e2 }).setEnabled(rec.dirt > 0 && !rec.sick);
      const snacks = s.inventory.snack || 0, meds = s.inventory.medicine || 0;
      B(3, `간식 주기 (${snacks})`, () => {
        if (!GameState.snack(id)) return;
        Audio.sfx('heal'); this.hop(sprite); say(Data.fmt(Data.dialogues.care.snack).replace(/\{name\}/g, a.name));
        if (!s.animals[id].sulk && rec.sulk === false) { /* 상태 갱신은 render 에서 */ }
        render();
      }, { color: 0xe08a3c }).setEnabled(snacks > 0 && rec.friend < GameState.FRIEND_MAX);
      B(4, `감기약 주기 (${meds})`, () => {
        if (!GameState.cure(id)) return;
        Audio.sfx('levelup'); this.hop(sprite); say(Data.fmt(Data.dialogues.care.cure).replace(/\{name\}/g, a.name)); render();
      }, { color: 0x3fa34d }).setEnabled(rec.sick && meds > 0);
      B(5, '목록으로', () => this.openShelter(), { color: 0x555577 });
      this.updateMoney();
      // 아픈/삐진 동물이 파티에 있으면 뺀다
      if (!canGo && inParty) { GameState.leaveParty(id); render(); }
    };
    render();
  }
  hop(obj) { this.tweens.add({ targets: obj, y: obj.y - 10, duration: 120, yoyo: true, repeat: 1 }); }

  // ---------- 우리 집 ----------
  async goHome() {
    this.busy = true;
    await fadeOut(this, 250);
    this.scene.start('Home', {});
  }

  // ---------- 숲 입구 ----------
  openGate() {
    this.openPanel('어느 숲으로 갈까요?');
    const s = GameState.s;
    const rows = Data.stageList().map(st => {
      const cleared = !!s.flags.cleared[st.id], locked = st.locked || !st.maps;
      return {
        label: `${st.order}. ${st.name}${cleared ? ' ✓' : ''}`,
        right: locked ? '준비 중' : cleared ? '깨끗해졌어요' : '가기!', rightColor: locked ? '#8890aa' : cleared ? '#7ee081' : COLORS.yellow,
        enabled: !locked,
        onTap: async () => {
          this.closePanel();
          this.busy = true;
          await fadeOut(this);
          delete s.flags.defeated[st.id]; // 다시 들어가면 적이 다시 나타남
          s.day += 1; // 숲에 다녀오면 하루가 지나요 (놀아주기 횟수 기준)
          this.scene.start('Field', { stageId: st.id, mapId: st.start.map, x: st.start.x, y: st.start.y, fresh: true });
        },
      };
    });
    this.renderList(rows);
  }
}
