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
        look: look || { skin: 0, hair: 0, hairColor: 0 },
        level: 1, exp: 0,
        hp: p.base.hp, mp: p.base.mp,
        equip: { ...p.startEquip },
      },
      ownedEquip: Object.values(p.startEquip),
      animals: {},            // id → { level, exp, hp, mp }
      party: [],              // 동물 id 최대 3
      auto: {},               // 동물 id → true 면 자동 전투
      inventory: { ...(p.startItems || {}) },
      stardust: p.startStardust || 0,
      shards: 0,
      skillLevels: {},        // ownerId → { skillId: level }
      flags: { chests: {}, defeated: {}, cleared: {}, introSeen: false, hintIndex: 0 },
      location: { scene: 'Village' },
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
    for (const slot of ['weapon', 'armor']) {
      const e = Data.equip(p.equip[slot]);
      if (e) { st.atk += e.atk || 0; st.def += e.def || 0; st.spd += e.spd || 0; }
    }
    return st;
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
    const a = Data.animal(id), rec = this.s.animals[id], st = this.animalStats(id);
    return {
      uid: 'animal_' + id, kind: 'animal', side: 'ally', ownerId: id, animalId: id, name: a.name,
      sprite: a.sprite, role: a.role, stats: st, maxHp: st.hp, maxMp: st.mp,
      hp: Math.min(rec.hp, st.hp), mp: Math.min(rec.mp, st.mp),
      skills: a.skills.slice(), auto: !!this.s.auto[id],
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
    for (const id of this.s.party) if (this.s.animals[id]) list.push(this.makeAnimalUnit(id));
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
  rescueAnimal(id) {
    if (this.s.animals[id]) return false; // 이미 친구
    const st = this.animalStats(id);
    this.s.animals[id] = { level: 1, exp: 0, hp: st.hp, mp: st.mp };
    if (this.s.party.length < 3) this.s.party.push(id);
    return true;
  },
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
