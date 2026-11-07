import { SAVE_KEY, SETTINGS_KEY } from '../config.js';

// localStorage 저장 1슬롯. 사파리 비공개 모드 등에서 실패해도 게임은 계속되게 try/catch.
const Save = {
  has() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } },
  load() {
    try { const raw = localStorage.getItem(SAVE_KEY); return raw ? JSON.parse(raw) : null; }
    catch (e) { console.warn('load failed', e); return null; }
  },
  write(state) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); return true; }
    catch (e) { console.warn('save failed', e); return false; }
  },
  clear() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* ignore */ } },

  loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); } catch (e) { return {}; }
  },
  writeSettings(s) { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ } },
};
export default Save;
