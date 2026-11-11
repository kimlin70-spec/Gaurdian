// 모든 JSON 데이터를 한 곳에서 꺼내 씁니다. BootScene 에서 init() 호출.
export const DATA_FILES = ['strings', 'skills', 'items', 'equipment', 'animals', 'enemies', 'player', 'dialogues', 'stages', 'assets', 'furniture', 'heroanim'];

const Data = {
  strings: {}, skills: {}, items: {}, equipment: {}, animals: {}, enemies: {},
  player: {}, dialogues: {}, stages: {}, assets: {}, furniture: {}, heroanim: {},

  init(cache) {
    for (const key of DATA_FILES) {
      const obj = cache.get(key) || {};
      // "_" 로 시작하는 키(설명)는 뺀다
      const clean = {};
      for (const k of Object.keys(obj)) if (!k.startsWith('_')) clean[k] = obj[k];
      this[key] = clean;
    }
  },

  // {hero} 같은 이름 자리표시자를 strings.json 값으로 바꾼다
  fmt(text, extra) {
    if (!text) return '';
    const s = this.strings;
    if (extra) for (const [k, v] of Object.entries(extra)) text = text.split('{' + k + '}').join(v);
    return text
      .replace(/\{hero\}/g, s.heroName).replace(/\{guide\}/g, s.guideAnimal)
      .replace(/\{world\}/g, s.worldName).replace(/\{king\}/g, s.demonKing)
      .replace(/\{cage\}/g, s.cageName).replace(/\{gem\}/g, s.gemName)
      .replace(/\{money\}/g, s.money).replace(/\{shard\}/g, s.shard);
  },

  skill(id) { return this.skills[id]; },
  item(id) { return this.items[id]; },
  equip(id) { return this.equipment[id]; },
  animal(id) { return this.animals[id]; },
  enemy(id) { return this.enemies[id]; },
  stage(id) { return this.stages[id]; },
  map(stageId, mapId) { return this.stages[stageId]?.maps?.[mapId]; },
  stageList() {
    return Object.entries(this.stages).map(([id, s]) => ({ id, ...s })).sort((a, b) => a.order - b.order);
  },
};
export default Data;
