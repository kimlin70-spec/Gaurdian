// 모든 JSON 데이터를 한 곳에서 꺼내 씁니다. BootScene 에서 init() 호출.
export const DATA_FILES = ['strings', 'skills', 'items', 'equipment', 'animals', 'enemies', 'player', 'dialogues', 'stages', 'assets', 'furniture', 'anim', 'anim_tweaks', 'fashion'];

const Data = {
  strings: {}, skills: {}, items: {}, equipment: {}, animals: {}, enemies: {},
  player: {}, dialogues: {}, stages: {}, assets: {}, furniture: {}, anim: {}, anim_tweaks: {}, fashion: {},

  init(cache) {
    for (const key of DATA_FILES) {
      const obj = cache.get(key) || {};
      // "_" 로 시작하는 키(설명)는 뺀다
      const clean = {};
      for (const k of Object.keys(obj)) if (!k.startsWith('_')) clean[k] = obj[k];
      this[key] = clean;
    }
    this.anim = mergeTweaks(this.anim, this.anim_tweaks);
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

// anim_tweaks.json 의 손질 값을 자동 파일(anim.json) 위에 덮어쓴다.
// 배열(각도·손 위치)은 { "프레임 번호": 값 } 으로 그 칸만, 객체(손잡이)는 키별로, 나머지는 통째로 바꾼다.
function mergeTweaks(anim, tweaks) {
  const out = { ...anim };
  for (const [sec, tv] of Object.entries(tweaks || {})) {
    const base = out[sec], isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
    if (!isObj(tv)) { out[sec] = tv; continue; } // 목록·값(facesLeft 등)은 통째로
    if (!isObj(base)) continue; // 자동 파일에 그 부분이 없으면 손질 값만으로 만들지 않는다 (반쪽짜리 데이터 방지)
    const merged = { ...base };
    for (const [field, val] of Object.entries(tv)) {
      const cur = base[field];
      if (Array.isArray(cur) && val && typeof val === 'object' && !Array.isArray(val)) {
        const arr = cur.slice();
        for (const [i, v] of Object.entries(val)) if (+i >= 0 && +i < arr.length) arr[+i] = v;
        merged[field] = arr;
      } else if (cur && typeof cur === 'object' && !Array.isArray(cur) && val && typeof val === 'object' && !Array.isArray(val)) {
        merged[field] = { ...cur, ...val };
      } else merged[field] = val;
    }
    out[sec] = merged;
  }
  return out;
}
