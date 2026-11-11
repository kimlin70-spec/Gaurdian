// 모든 JSON 데이터를 한 곳에서 꺼내 씁니다. BootScene 에서 init() 호출.
export const DATA_FILES = ['strings', 'skills', 'items', 'equipment', 'animals', 'enemies', 'player', 'dialogues', 'stages', 'assets', 'furniture', 'anim', 'anim_tweaks'];

const Data = {
  strings: {}, skills: {}, items: {}, equipment: {}, animals: {}, enemies: {},
  player: {}, dialogues: {}, stages: {}, assets: {}, furniture: {}, anim: {}, anim_tweaks: {},

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

  // {hero} 같은 이름 자리표시자를 strings.json 값으로 바꾸고, 이(가) 같은 조사를 받침에 맞게 고른다
  fmt(text, extra) {
    if (!text) return '';
    const s = this.strings;
    if (extra) for (const [k, v] of Object.entries(extra)) text = text.split('{' + k + '}').join(v);
    return josa(text
      .replace(/\{hero\}/g, s.heroName).replace(/\{guide\}/g, s.guideAnimal)
      .replace(/\{world\}/g, s.worldName).replace(/\{king\}/g, s.demonKing)
      .replace(/\{cage\}/g, s.cageName).replace(/\{gem\}/g, s.gemName)
      .replace(/\{money\}/g, s.money).replace(/\{shard\}/g, s.shard));
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

// 조사 고르기: 이름 뒤에 "이(가)"처럼 두 가지를 다 써 두면, 바로 앞 글자의 받침을 보고 하나만 남긴다.
//   밀꾸이(가) → 밀꾸가   곰이(가) → 곰이   그레이스은(는) → 그레이스는   숲(으)로 → 숲으로   길(으)로 → 길로
// 앞 글자가 한글이 아니면(숫자·영어·괄호 등) 읽는 법을 알 수 없으니 두 가지를 그대로 둔다.
// Data.fmt 와 화면 글(UI.js 의 txt·대화 상자·버튼 이름, 전투 메시지)에 자동으로 적용된다.
const JOSA = {
  // 쓰는 모양: [받침 있을 때, 받침 없을 때]
  '이(가)': ['이', '가'],
  '은(는)': ['은', '는'],
  '을(를)': ['을', '를'],
  '와(과)': ['과', '와'],
  '아(야)': ['아', '야'],
  '(으)로': ['으로', '로'], // ㄹ 받침도 '로' (길로, 가시덩굴로)
};
// 한글 한 글자(가~힣) + 위 모양 중 하나
const JOSA_RE = new RegExp(`([가-힣])(${Object.keys(JOSA).map(k => k.replace(/[()]/g, '\\$&')).join('|')})`, 'g');

export function josa(text) {
  if (typeof text !== 'string') return text;
  return text.replace(JOSA_RE, (m, ch, form) => {
    const jong = (ch.charCodeAt(0) - 0xAC00) % 28; // 받침 번호: 0 = 받침 없음, 8 = ㄹ
    const noBatchim = jong === 0 || (jong === 8 && form === '(으)로');
    return ch + JOSA[form][noBatchim ? 1 : 0];
  });
}

// anim_tweaks.json 의 손질 값을 자동 파일(anim.json) 위에 덮어쓴다.
// 배열(각도·손 위치)은 { "프레임 번호": 값 } 으로 그 칸만, 객체(손잡이)는 키별로, 나머지는 통째로 바꾼다.
function mergeTweaks(anim, tweaks) {
  const out = { ...anim };
  for (const [sec, tv] of Object.entries(tweaks || {})) {
    const base = out[sec];
    if (!base || typeof base !== 'object' || Array.isArray(base) || typeof tv !== 'object' || Array.isArray(tv)) { out[sec] = tv; continue; }
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
