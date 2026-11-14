import Data from './Data.js';
import Save from './Save.js';

// 진행 상태(저장되는 것 전부). 코드 어디서나 GameState.s 로 접근.
const GameState = {
  s: null,

  // ---------- 새 게임 / 저장 / 불러오기 ----------
  newGame(look) {
    const p = Data.player;
    this.s = {
      version: 1,
      player: {
        name: Data.strings.heroName,
        look: { skin: 0, hair: 0, hairColor: 0, outfit: 'basic', acc: 'none', ...(look || {}) },
        level: 1, exp: 0,
        hp: p.base.hp, mp: p.base.mp,
        equip: { ...p.startEquip },
      },
      ownedEquip: Object.values(p.startEquip),
      wardrobe: this.freeWardrobe(), // 가진 꾸미기: 머리 모양, 머리 색, 옷, 장식
      animals: {},            // id → { level, exp, hp, mp }
      party: [],              // 동물 id 최대 3
      auto: {},               // 동물 id → true 면 자동 전투
      inventory: { ...(p.startItems || {}) },
      stardust: p.startStardust || 0,
      shards: 0,
      skillLevels: {},        // ownerId → { skillId: level }
      flags: { chests: {}, defeated: {}, cleared: {}, healed: {}, gate: {}, gateOpen: {}, introSeen: false, hintIndex: 0 },
      location: { scene: 'Village' },
      day: 1,                 // 숲에 다녀올 때마다 +1 (놀아주기 하루 1번 기준)
      home: { placed: [], yard: [], owned: {} }, // 집 꾸미기: 집 안 가구, 마당 가구, 가진 가구
    };
    return this.s;
  },
  save() { if (this.s) Save.write(this.s); },
  load() {
    const s = Save.load();
    if (!s) return false;
    this.s = s;
    // 혹시 빠진 필드가 있으면 채운다(데이터 업데이트 대비)
    s.auto = s.auto || {}; s.skillLevels = s.skillLevels || {}; s.flags = s.flags || {};
    s.flags.chests = s.flags.chests || {}; s.flags.defeated = s.flags.defeated || {}; s.flags.cleared = s.flags.cleared || {};
    s.inventory = s.inventory || {}; s.party = s.party || []; s.animals = s.animals || {};
    s.ownedEquip = s.ownedEquip || Object.values(s.player.equip);
    // 꾸미기(예전 저장에는 없음): 공짜 항목과 지금 하고 있는 것은 가진 것으로
    const free = this.freeWardrobe(), lk = s.player.look; lk.outfit = lk.outfit || 'basic'; lk.acc = lk.acc || 'none';
    s.wardrobe = s.wardrobe || {};
    for (const c of ['hair', 'hairColor', 'outfit', 'acc']) { s.wardrobe[c] = [...new Set([...(s.wardrobe[c] || []), ...free[c], lk[c]])]; }
    s.flags.healed = s.flags.healed || {}; s.day = s.day || 1;
    s.flags.gate = s.flags.gate || {}; s.flags.gateOpen = s.flags.gateOpen || {};
    // 예전 저장: 이미 정화한 무리를 보스 문 게이지에 반영
    for (const [sid, keys] of Object.entries(s.flags.defeated)) { s.flags.gate[sid] = s.flags.gate[sid] || {}; for (const k of Object.keys(keys)) s.flags.gate[sid][k] = true; }
    s.home = s.home || { placed: [], yard: [], owned: {} }; s.home.yard = s.home.yard || [];
    // 밀꾸: 이미 침대를 놓아 둔 저장이면 지금부터 숲에 한 번 다녀오면 나타난다
    if (!s.flags.milkkuBedDay && s.home.placed.some(p => p.id === 'bed')) s.flags.milkkuBedDay = s.day;
    for (const id of Object.keys(s.animals)) this.fixAnimal(s.animals[id]);
    return true;
  },
  hasSave() { return Save.has(); },

  // ---------- 능력치 ----------
  statsFor(base, growth, level) {
    const out = {};
    for (const k of ['hp', 'mp', 'atk', 'def', 'spd']) out[k] = (base[k] || 0) + (growth[k] || 0) * (level - 1);
    return out;
  },
  playerStats() {
    const p = this.s.player;
    const st = this.statsFor(Data.player.base, Data.player.growth, p.level);
    for (const slot of ['weapon', 'armor', 'boots']) {
      const e = Data.equip(p.equip[slot]);
      if (e) { st.atk += e.atk || 0; st.def += e.def || 0; st.spd += e.spd || 0; }
    }
    return st;
  },
  // ---------- 꾸미기 (data/fashion.json) ----------
  fashionList(cat) { const f = Data.fashion[cat] || {}; return Array.isArray(f) ? f.map((v, i) => ({ id: i, ...v })) : Object.entries(f).map(([id, v]) => ({ id, ...v })); },
  freeWardrobe() { const w = {}; for (const c of ['hair', 'hairColor', 'outfit', 'acc']) w[c] = this.fashionList(c).filter(v => !v.price).map(v => v.id); return w; },
  ownsFashion(cat, id) { return (this.s.wardrobe[cat] || []).includes(id); },
  buyFashion(cat, id) {
    const it = this.fashionList(cat).find(v => v.id === id);
    if (!it || this.ownsFashion(cat, id) || this.s.stardust < it.price) return false;
    this.s.stardust -= it.price; this.s.wardrobe[cat].push(id); return true;
  },
  animalStats(id) {
    const a = Data.animal(id), st = this.s.animals[id];
    return this.statsFor(a.base, a.growth, st ? st.level : 1);
  },
  purifyThreshold() {
    const b = Data.equip(this.s.player.equip.bracelet);
    return b ? b.purify : 0.25;
  },
  skillLevel(ownerId, skillId) { return this.s.skillLevels[ownerId]?.[skillId] || 1; },
  setSkillLevel(ownerId, skillId, lv) {
    this.s.skillLevels[ownerId] = this.s.skillLevels[ownerId] || {};
    this.s.skillLevels[ownerId][skillId] = lv;
  },

  // ---------- 경험치 / 레벨 ----------
  expToNext(level) { return 15 + level * 10; },
  // 돌려주는 값: 올라간 레벨 수
  gainExp(unit, amount) {
    let ups = 0;
    unit.exp += amount;
    while (unit.exp >= this.expToNext(unit.level)) {
      unit.exp -= this.expToNext(unit.level);
      unit.level += 1; ups += 1;
    }
    return ups;
  },

  // ---------- 전투용 유닛 생성 ----------
  // 전투에서 쓰는 살아있는 객체. 전투가 끝나면 syncFromBattle 로 hp/mp 를 돌려받는다.
  makePlayerUnit() {
    const p = this.s.player, st = this.playerStats();
    return {
      uid: 'player', kind: 'player', side: 'ally', ownerId: 'player', name: p.name,
      sprite: 'player', stats: st, maxHp: st.hp, maxMp: st.mp,
      hp: Math.min(p.hp, st.hp), mp: Math.min(p.mp, st.mp),
      skills: Data.player.skills.slice(), auto: false,
    };
  },
  makeAnimalUnit(id) {
    const a = Data.animal(id), rec = this.s.animals[id], st = this.animalStats(id), tr = this.traits(id);
    if (rec.friend >= 80) st.atk = Math.round(st.atk * 1.1) + 1; // 하트 4개 이상이면 힘이 나요
    if (tr.cleanBonus && this.isClean(id)) { st.atk = Math.round(st.atk * (1 + tr.cleanBonus)); st.spd += 1; } // 밀크: 깨끗하면 신나요
    return {
      uid: 'animal_' + id, kind: 'animal', side: 'ally', ownerId: id, animalId: id, name: this.animalName(id),
      sprite: this.animalSprite(id), role: a.role, stats: st, maxHp: st.hp, maxMp: st.mp,
      hp: Math.min(rec.hp, st.hp), mp: Math.min(rec.mp, st.mp),
      skills: a.skills.slice(), auto: !!this.s.auto[id], friend: rec.friend,
    };
  },
  makeEnemyUnit(id, index) {
    const e = Data.enemy(id), st = { ...e.stats };
    return {
      uid: 'enemy_' + index, kind: 'enemy', side: 'enemy', enemyId: id, name: e.name, enemyKind: e.kind,
      sprite: e.sprite, scale: e.scale || 1, stats: st, maxHp: st.hp, maxMp: st.mp, hp: st.hp, mp: st.mp,
      skills: e.skills.map(s => s.id), skillWeights: e.skills, animalId: e.animal || null, auto: true,
    };
  },
  partyUnits() {
    const list = [this.makePlayerUnit()];
    for (const id of this.s.party) if (this.s.animals[id] && this.canBattle(id)) list.push(this.makeAnimalUnit(id));
    return list;
  },
  syncFromBattle(units) {
    for (const u of units) {
      if (u.kind === 'player') { this.s.player.hp = Math.max(0, u.hp); this.s.player.mp = u.mp; }
      else if (u.kind === 'animal') { const r = this.s.animals[u.animalId]; if (r) { r.hp = Math.max(0, u.hp); r.mp = u.mp; } }
    }
    // 전투 후 쓰러진 친구는 HP 1 로 살아난다(게임오버 없음)
    if (this.s.player.hp <= 0) this.s.player.hp = 1;
    for (const id of Object.keys(this.s.animals)) if (this.s.animals[id].hp <= 0) this.s.animals[id].hp = 1;
  },

  // ---------- 회복 / 동물 / 아이템 ----------
  healAll() {
    const st = this.playerStats();
    this.s.player.hp = st.hp; this.s.player.mp = st.mp;
    for (const id of Object.keys(this.s.animals)) {
      const a = this.animalStats(id); this.s.animals[id].hp = a.hp; this.s.animals[id].mp = a.mp;
    }
  },
  // opts: level(처음 레벨), friend(처음 친구 레벨), dirt(처음 더러움)
  rescueAnimal(id, opts = {}) {
    if (this.s.animals[id]) return false; // 이미 친구
    const a = Data.animal(id), level = Math.max(1, opts.level || 1), st = this.statsFor(a.base, a.growth, level);
    this.s.animals[id] = { level, exp: 0, hp: st.hp, mp: st.mp, friend: opts.friend ?? 60, dirt: opts.dirt ?? 0, sick: false, sulk: false, lastPlayDay: 0 };
    if (this.s.party.length < 3) this.s.party.push(id);
    return true;
  },
  // ---------- 동물별 특징 (밀꾸) ----------
  traits(id) { const a = Data.animal(id); return (a && a.traits) || {}; },
  // 깨끗한 그림이 따로 있는 동물(밀꾸)만: 덜 더러우면 '깨끗'
  isClean(id) {
    const a = Data.animal(id), r = this.s.animals[id];
    return !!(a && a.cleanSprite && r && r.dirt < (this.traits(id).cleanBelow || 2));
  },
  animalSprite(id) { const a = Data.animal(id); return this.isClean(id) ? a.cleanSprite : a.sprite; },
  animalName(id) { const a = Data.animal(id); return this.isClean(id) && a.cleanName ? a.cleanName : a.name; },
  // ---------- 밀꾸 (집 침대 밑에 숨은 친구) ----------
  hasBed() { return this.s.home.placed.some(p => p.id === 'bed'); },
  // 침대를 놓고 숲에 한 번 다녀오면 침대 밑에 숨어 있다
  milkkuHiding() { const f = this.s.flags; return !this.s.animals.milkku && !!f.milkkuBedDay && this.s.day > f.milkkuBedDay && this.hasBed(); },
  noteBedPlaced() { if (!this.s.flags.milkkuBedDay) this.s.flags.milkkuBedDay = this.s.day; },
  findMilkku() {
    // 숨어 있다 만난 친구라 그레이스보다 한 레벨 아래에서 시작, 처음부터 꾸질꾸질
    return this.rescueAnimal('milkku', { level: this.s.player.level - 1, friend: 80, dirt: 6 });
  },
  fixAnimal(rec) { // 예전 저장 파일 호환
    if (rec.friend === undefined) rec.friend = 60;
    if (rec.dirt === undefined) rec.dirt = 0;
    rec.sick = !!rec.sick; rec.sulk = !!rec.sulk; rec.lastPlayDay = rec.lastPlayDay || 0;
  },

  // ---------- 돌보기 (친구 레벨 / 샤워 / 아픔) ----------
  FRIEND_MAX: 100,
  hearts(id) { return Math.round((this.s.animals[id].friend / this.FRIEND_MAX) * 5); }, // 0~5
  canBattle(id) { const r = this.s.animals[id]; return r && !r.sick && !r.sulk; },
  animalStatus(id) {
    const r = this.s.animals[id];
    if (r.sick) return { text: '아픔', color: '#ff8080', icon: 'st_sick' };
    if (r.sulk) return { text: '삐짐', color: '#c0a0ff', icon: 'st_sulk' };
    if (r.dirt >= 5) return { text: this.traits(id).dirtyText || '더러움', color: '#d9b57a', icon: 'st_dirty' };
    return { text: '좋아요', color: '#7ee081', icon: 'st_happy' };
  },
  addFriend(id, n) {
    const r = this.s.animals[id];
    r.friend = Math.max(0, Math.min(this.FRIEND_MAX, r.friend + n));
    if (r.friend <= 0 && !r.sulk) { r.sulk = true; this.leaveParty(id); return 'sulk'; }
    if (r.sulk && r.friend >= 30) { r.sulk = false; return 'back'; }
    return null;
  },
  leaveParty(id) { const i = this.s.party.indexOf(id); if (i >= 0) this.s.party.splice(i, 1); },
  canPlay(id) { return this.s.animals[id].lastPlayDay < this.s.day; },
  // 미니게임 결과 반영. grade: 0(아쉬움) 1(좋음) 2(최고). 돌려주는 값: { reward, event('sulk'|'back'|null), free }
  playResult(id, type, grade, score) {
    const r = this.s.animals[id];
    r.best = r.best || {}; r.best[type] = Math.max(r.best[type] || 0, score);
    if (!this.canPlay(id)) return { reward: 0, event: null, free: true };
    r.lastPlayDay = this.s.day;
    const reward = Math.round([8, 15, 22][grade] * (this.traits(id).playBonus || 1)); // 밀꾸는 노는 걸 제일 좋아해요
    return { reward, event: this.addFriend(id, reward), free: false };
  },
  // 샤워 결과. grade: 0(실패: 절반만 깨끗, 하트 -5) 1(성공: 깨끗) 2(완벽: 깨끗 + 하트 +5)
  showerResult(id, grade, score) {
    const r = this.s.animals[id];
    r.best = r.best || {}; r.best.shower = Math.max(r.best.shower || 0, score);
    if (grade === 0) {
      const wasClean = this.isClean(id);
      r.dirt = Math.ceil(r.dirt / 2);
      // 밀꾸는 샤워에 성공해야 하얀 밀크가 된다: 실패하면 반만 씻기고 꾀죄죄한 채로
      if (!wasClean && Data.animal(id).cleanSprite) r.dirt = Math.max(r.dirt, this.traits(id).cleanBelow || 2);
      return { reward: -5, event: this.addFriend(id, -5) };
    }
    r.dirt = 0;
    if (grade === 2) return { reward: 5, event: this.addFriend(id, 5) };
    return { reward: 0, event: null };
  },
  // ---------- 보스 문 (정화 게이지) ----------
  gateCount(stageId) { return Object.keys(this.s.flags.gate[stageId] || {}).length; },
  gateNeed(stageId) { const st = Data.stage(stageId); return (st && st.bossGate) || 0; },
  gateOpen(stageId) { return !!this.s.flags.cleared[stageId] || this.gateCount(stageId) >= this.gateNeed(stageId); },
  addGate(stageId, key) { const g = this.s.flags.gate; g[stageId] = g[stageId] || {}; g[stageId][key] = true; },
  play(id) { const r = this.s.animals[id]; r.lastPlayDay = this.s.day; return this.addFriend(id, 15); },
  shower(id) { const r = this.s.animals[id]; r.dirt = 0; return this.addFriend(id, -5); },
  snack(id) { if (!this.useItem('snack')) return false; this.addFriend(id, Data.item('snack').power); return true; },
  cure(id) { if (!this.useItem('medicine')) return false; const r = this.s.animals[id]; r.sick = false; r.dirt = 0; return true; },
  // 전투 한 번 끝날 때 호출: 더러워지고, 쓰러졌으면 친구 레벨 하락. 알림 문구 목록을 돌려준다.
  afterBattle(units) {
    const msgs = [];
    for (const u of units) {
      if (u.kind !== 'animal') continue;
      const r = this.s.animals[u.animalId], tr = this.traits(u.animalId); if (!r) continue;
      const before = r.dirt, wasClean = this.isClean(u.animalId);
      r.dirt = Math.min(10, r.dirt + (tr.dirtRate || 1));
      const name = this.animalName(u.animalId); // 더러워진 뒤의 이름 (밀크 → 밀꾸)
      if (wasClean && !this.isClean(u.animalId) && tr.dirtyAgain) msgs.push(Data.fmt(tr.dirtyAgain));
      else if (before < 5 && r.dirt >= 5) msgs.push(Data.fmt(Data.dialogues.care.dirty).replace(/\{name\}/g, name));
      if (r.dirt >= 8 && !r.sick && !tr.noCold) { r.sick = true; this.leaveParty(u.animalId); msgs.push(Data.fmt(Data.dialogues.care.sick).replace(/\{name\}/g, name)); }
      if (u.hp <= 0) { const res = this.addFriend(u.animalId, -10); if (res === 'sulk') msgs.push(Data.fmt(Data.dialogues.care.sulk).replace(/\{name\}/g, name)); }
    }
    return msgs;
  },
  // 치료(다친 동물)로 구조: 정화 구조와 같지만 친구 레벨이 더 높게 시작
  healAnimal(id) { const isNew = this.rescueAnimal(id); if (isNew) this.s.animals[id].friend = 75; return isNew; },

  // ---------- 집 꾸미기 ----------
  addFurniture(id, n = 1) { this.s.home.owned[id] = (this.s.home.owned[id] || 0) + n; },
  canCraft(id) { const f = Data.furniture[id]; if (!f || !f.craft) return false; return Object.entries(f.craft).every(([m, n]) => (this.s.inventory[m] || 0) >= n); },
  craft(id) { if (!this.canCraft(id)) return false; for (const [m, n] of Object.entries(Data.furniture[id].craft)) { this.s.inventory[m] -= n; if (this.s.inventory[m] <= 0) delete this.s.inventory[m]; } this.addFurniture(id); return true; },
  toggleParty(id) {
    const i = this.s.party.indexOf(id);
    if (i >= 0) { this.s.party.splice(i, 1); return 'out'; }
    if (this.s.party.length >= 3) return 'full';
    this.s.party.push(id); return 'in';
  },
  addItem(id, n = 1) { this.s.inventory[id] = (this.s.inventory[id] || 0) + n; },
  useItem(id) {
    if (!this.s.inventory[id]) return false;
    this.s.inventory[id] -= 1; if (this.s.inventory[id] <= 0) delete this.s.inventory[id];
    return true;
  },
  itemList() { return Object.entries(this.s.inventory).filter(([, n]) => n > 0).map(([id, n]) => ({ id, n, ...Data.item(id) })); },

  // ---------- 위치 ----------
  setLocation(loc) { this.s.location = loc; },
};
export default GameState;
