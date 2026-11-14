// 상태 메뉴: 그레이스 / 장비 / 가방 / 친구 네 쪽을 탭으로 넘겨 본다. 마을·왕궁·숲 어디서나 같은 창.
// openStatusMenu(scene, { fixed, depth, onClose }) — fixed 는 카메라가 움직이는 장면(숲)에서 true.
import { W, H, COLORS, PX, FIX_X, FIX_Y } from '../config.js';
import Data from './Data.js';
import GameState from './GameState.js';
import Audio from './Audio.js';
import { txt, Button, panel, UIGroup, bar, icon, iconRow, slice9, fix, DEPTH, ROLE_ICON } from './UI.js';
import { makeCharacter } from './Assets.js';

const TABS = [['hero', '그레이스'], ['equip', '장비'], ['bag', '가방'], ['friends', '친구']];
const SLOT_NAME = { weapon: '무기', armor: '옷', bracelet: '팔찌' };
const ITEM_ICON = { potion_s: 'item_heal_potion', potion_l: 'item_heal_potion', medicine: 'item_bandage', berry: 'item_herb', pebble: 'item_gem', snack: 'item_seed' };
const INK = '#3b251b';

export function openStatusMenu(scene, opts = {}) {
  const fixed = !!opts.fixed, D = opts.depth ?? DEPTH.MODAL, s = GameState.s;
  const g = new UIGroup(); let page = new UIGroup(), tab = opts.tab || 'hero', sel = null, pg = 0;
  const F = (o) => (fixed && o ? fix(o) : o);
  const T = (x, y, str, o = {}) => txt(scene, x, y, str, { size: 11, depth: D + 2, fixed, ...o });
  const I = (x, y, key, o = {}) => icon(scene, x, y, key, { depth: D + 2, fixed, ...o });
  // 나무 칸 + 안에 그림(16픽셀 안에 맞춤) 또는 글자
  const slot = (grp, x, y, key, letter) => {
    const sl = I(x, y, 'ui_slot') || F(scene.add.rectangle(x, y, 22, 22, 0x3d4066).setStrokeStyle(1, COLORS.border).setDepth(D + 2));
    grp.add(sl);
    if (key && scene.textures.exists(key)) {
      const im = F(scene.add.image(x, y, key).setDepth(D + 3)); im.setScale(16 / Math.max(im.width, im.height)); grp.add(im);
    } else if (letter) grp.add(T(x, y, letter, { origin: 0.5, color: INK, stroke: false, depth: D + 3 }));
    return sl;
  };
  const tapZone = (grp, x, y, w, h, fn) => {
    const z = F(scene.add.rectangle(x, y, w, h, 0xffffff, 0.001).setDepth(D + 4).setInteractive({ useHandCursor: true }));
    z.on('pointerup', (p) => { if (p.getDistance() <= 10 * PX) fn(); }); grp.add(z); return z;
  };

  g.add(F(scene.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setDepth(D - 1).setInteractive()));
  g.add(panel(scene, 8, 8, W - 16, H - 16, { depth: D, fixed }));
  g.add(T(W / 2, 13, '메뉴', { size: 14, origin: [0.5, 0], color: COLORS.yellow }));
  const close = () => { page.destroy(); tabs.destroy(); g.destroy(); GameState.save(); if (opts.onClose) opts.onClose(); };
  g.add(new Button(scene, W - 70, H - 36, 58, 24, '닫기', close, { depth: D + 2, fixed, color: 0x555577 }));
  const money = g.add(T(16, H - 30, `★${s.stardust}   ◆${s.shards}`, { color: '#b8c0e0' }));

  // ---- 탭 ----
  const tabs = new UIGroup();
  const drawTabs = () => {
    tabs.destroy();
    TABS.forEach(([id, label], i) => {
      const x = 16 + i * 72, y = 31, w = 68, h = 18, on = id === tab, key = on ? 'ui_tab_on' : 'ui_tab_off';
      let bg = null;
      if (scene.textures.exists(key) && scene.game.renderer.type === Phaser.WEBGL) bg = scene.add.nineslice(x, y, key, undefined, Math.round(w / 1.5 * PX), 12 * PX, 4 * PX, 4 * PX, 0, 0).setOrigin(0, 0).setScale(1.5 / PX).setDepth(D + 1);
      else bg = scene.add.rectangle(x, y, w, h, on ? 0xf4e3c0 : 0x9a9a80).setOrigin(0, 0).setDepth(D + 1);
      tabs.add(F(bg));
      tabs.add(T(x + w / 2, y + h / 2 + (on ? 0 : 1), label, { origin: 0.5, color: INK, stroke: false }));
      tapZone(tabs, x + w / 2, y + h / 2, w, h + 6, () => { if (tab === id) return; Audio.sfx('tap'); tab = id; sel = null; pg = 0; drawTabs(); render(); });
    });
  };
  const pager = (count, per) => {
    const pages = Math.max(1, Math.ceil(count / per)); pg = Math.min(pg, pages - 1);
    if (pages > 1) {
      page.add(new Button(scene, 120, H - 36, 32, 24, '◀', () => { pg = (pg + pages - 1) % pages; render(); }, { depth: D + 2, fixed }));
      page.add(T(170, H - 24, `${pg + 1}/${pages}`, { origin: 0.5 }));
      page.add(new Button(scene, 188, H - 36, 32, 24, '▶', () => { pg = (pg + 1) % pages; render(); }, { depth: D + 2, fixed }));
    }
  };

  // ---- 쪽마다 ----
  const pages = {
    hero() {
      const p = s.player, st = GameState.playerStats();
      const c = makeCharacter(scene, 56, 150, p.look).setScale(2.6).setDepth(D + 2); page.add(c);
      if (fixed) { c.setScrollFactor(0, 0, true); c.x += FIX_X; c.y += FIX_Y; }
      page.add(T(56, 156, p.name, { origin: [0.5, 0], color: COLORS.yellow }));
      const x = 112; let y = 58;
      page.add(T(x, y, `레벨 ${p.level}`, { size: 14 }));
      page.add(T(x + 70, y + 3, `다음 레벨까지 ${Math.max(0, GameState.expToNext(p.level) - p.exp)}`, { color: '#b8c0e0' }));
      y += 25;
      const line = (label, cur, max, kind, low) => {
        page.add(T(x, y, label, { origin: [0, 0.5] }));
        const b = bar(scene, x + 22, y, 96, 6, kind === 'hp' ? COLORS.hp : COLORS.mp, { depth: D + 2, fixed, frame: kind, lowAt: 0.3 }); b.set(max ? cur / max : 0, low); page.add(b);
        page.add(T(x + 124, y, `${cur}/${max}`, { origin: [0, 0.5] }));
        y += 14;
      };
      line('HP', p.hp, st.hp, 'hp', COLORS.hpLow); line('MP', p.mp, st.mp, 'mp');
      y += 2;
      [['role_attack', '공격', st.atk], ['role_tank', '방어', st.def], [null, '빠르기', st.spd]].forEach(([ik, label, v], i) => {
        const cx = x + i * 62; const ic = ik ? I(cx + 5, y + 1, ik, { scale: 0.8 }) : null; if (ic) page.add(ic);
        page.add(T(cx + (ic ? 12 : 0), y, `${label} ${v}`, { origin: [0, 0.5] }));
      });
      y += 14;
      page.add(T(x, y, `정화: 적 HP ${Math.round(GameState.purifyThreshold() * 100)}% 아래`, { origin: [0, 0.5], color: '#ffb3ec' }));
      y += 16;
      page.add(T(x, y, '스킬', { origin: [0, 0.5], color: COLORS.yellow })); y += 13;
      for (const sk of Data.player.skills) {
        const d = Data.skill(sk); if (!d) continue;
        page.add(T(x, y, `${d.name} Lv${GameState.skillLevel('player', sk)}`, { origin: [0, 0.5] }));
        page.add(T(x + 186, y, `MP ${d.mp}`, { origin: [1, 0.5], color: '#9ecbff' }));
        y += 13;
      }
    },
    equip() {
      const eq = s.player.equip; let y = 66;
      for (const sl of ['weapon', 'armor', 'bracelet']) {
        const e = Data.equip(eq[sl]);
        slot(page, 30, y, e && (e.sprite || (sl === 'bracelet' ? 'item_bracelet' : null)), SLOT_NAME[sl][0]);
        page.add(T(48, y - 6, `${SLOT_NAME[sl]}: ${e ? e.name : '없음'}`, { origin: [0, 0.5] }));
        page.add(T(48, y + 7, e ? e.desc : '', { origin: [0, 0.5], color: '#b8c0e0', strokeThickness: 1 }));
        y += 28;
      }
      // 가지고 있지만 끼지 않은 장비: 탭하면 바꿔 낀다
      const spare = s.ownedEquip.filter(id => Data.equip(id) && eq[Data.equip(id).slot] !== id);
      page.add(T(170, 56, spare.length ? '바꿔 끼기' : '다른 장비는\n대장간에서 사요', { color: COLORS.yellow, lineSpacing: 3 }));
      spare.slice(pg * 4, pg * 4 + 4).forEach((id, i) => {
        const e = Data.equip(id);
        page.add(new Button(scene, 170, 70 + i * 28, 132, 24, `${e.name} (${e.desc})`, () => { eq[e.slot] = id; Audio.sfx('chest'); render(); }, { depth: D + 2, fixed, size: 11, color: COLORS.ok }));
      });
      if (spare.length > 4) pager(spare.length, 4);
    },
    bag() {
      const items = GameState.itemList(), per = 20;
      if (!items.length) { page.add(T(W / 2, 110, '가방이 비었어요.', { origin: 0.5 })); return; }
      if (!sel || !items.find(it => it.id === sel)) sel = items[pg * per] ? items[pg * per].id : items[0].id;
      items.slice(pg * per, pg * per + per).forEach((it, i) => {
        const x = 30 + (i % 10) * 28, y = 68 + Math.floor(i / 10) * 30;
        slot(page, x, y, ITEM_ICON[it.id], it.name[0]);
        if (it.id === sel) { const m = I(x, y, 'ui_slot_selected', { depth: D + 4 }); if (m) page.add(m); }
        page.add(T(x + 11, y + 11, String(it.n), { origin: [1, 1], depth: D + 5 }));
        tapZone(page, x, y, 26, 28, () => { Audio.sfx('tap'); sel = it.id; render(); });
      });
      const it = items.find(i => i.id === sel);
      page.add(panel(scene, 16, 134, W - 32, 58, { depth: D + 1, fixed, color: 0x000000, alpha: 0.35, border: false }));
      page.add(T(24, 140, `${it.name}  ×${it.n}`, { color: COLORS.yellow }));
      page.add(T(24, 156, it.desc || '', { wrap: W - 52, lineSpacing: 3 }));
      page.add(T(24, 178, ['heal', 'mp', 'heal_all', 'revive'].includes(it.type) ? '전투나 숲의 메뉴에서 쓸 수 있어요.' : it.type === 'material' ? '제작대에서 가구 재료로 써요.' : '동물 쉼터에서 써요.', { color: '#b8c0e0', strokeThickness: 1 }));
      pager(items.length, per);
    },
    friends() {
      const ids = Object.keys(s.animals), per = 4;
      if (!ids.length) { page.add(T(W / 2, 110, '아직 친구가 없어요.\n오염된 동물을 정화해 보세요!', { origin: 0.5, align: 'center', lineSpacing: 3 })); return; }
      page.add(T(18, 15, `함께 ${s.party.length}/3`, { color: '#b8c0e0' }));
      pager(ids.length, per);
      ids.slice(pg * per, pg * per + per).forEach((id, i) => {
        const a = Data.animal(id), rec = s.animals[id], st = GameState.animalStatus(id), stats = GameState.animalStats(id), y = 68 + i * 33, inParty = s.party.includes(id);
        page.add(panel(scene, 16, y - 15, W - 32, 31, { depth: D + 1, fixed, color: inParty ? 0x2e5a3a : 0x000000, alpha: inParty ? 0.7 : 0.3, border: false }));
        slot(page, 32, y, GameState.animalSprite(id), a.name[0]);
        const nm = page.add(T(50, y - 7, `${GameState.animalName(id)} Lv${rec.level}`, { origin: [0, 0.5] }));
        page.add(iconRow(scene, 50 + nm.width + 6, y - 7, GameState.hearts(id), 5, 'ui_heart_full', 'ui_heart_empty', { depth: D + 2, fixed }));
        const ri = I(55, y + 7, ROLE_ICON[a.role], { scale: 0.75 }); if (ri) page.add(ri);
        page.add(T(ri ? 62 : 50, y + 7, `${a.role}  HP ${rec.hp}/${stats.hp}`, { origin: [0, 0.5], color: '#b8c0e0', strokeThickness: 1 }));
        const si = I(178, y + 7, st.icon, { scale: 0.75 }); if (si) page.add(si);
        page.add(T(si ? 185 : 172, y + 7, st.text, { origin: [0, 0.5], color: st.color, strokeThickness: 1 }));
        page.add(T(W - 22, y - 7, inParty ? '함께 가요' : '쉬는 중', { origin: [1, 0.5], color: inParty ? '#7ee081' : '#b8c0e0' }));
      });
    },
  };
  const render = () => { page.destroy(); page = new UIGroup(); money.setText(`★${s.stardust}   ◆${s.shards}`); pages[tab](); };
  drawTabs(); render();
  return { close, group: g };
}
