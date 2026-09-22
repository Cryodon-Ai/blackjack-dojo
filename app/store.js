// Storage layer: IndexedDB with localStorage fallback. All progress is exportable as one JSON file.

import { DEFAULT_RULES } from '../engine/rules.js';

const DB_NAME = 'blackjack-dojo';
const DB_VER = 1;
const SCHEMA = 1;
const LS = 'dojo:';

export const defaultProfile = () => ({
  activeRuleSet: { ...DEFAULT_RULES, decks: 6, surrender: 'late' },   // reference game
  activePresetId: 'reference',
  tierUnlocked: 0,
  tierProgress: {},          // tier -> { streak, best, passed, attempts }
  guided: {},                // tier -> guided-hands completed
  lessonSeen: {},            // tier -> true
  settings: {
    lossLimit: 100, hapticsOn: true, flashSeconds: 2.0, reveal: false,
    coach: false, mode: 'off', bankroll: 500, unit: 5,   // mode: 'off' | 'coach' | 'rewind'
  },
  bests: {},                 // game -> personal best
  createdAt: Date.now(),
});

let db = null;
let useLS = false;

function lsGet(k, d) { try { const v = localStorage.getItem(LS + k); return v == null ? d : JSON.parse(v); } catch { return d; } }
function lsSet(k, v) { try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch { /* quota */ } }

function openDB() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in self)) return reject(new Error('no indexedDB'));
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const d = req.result;
      d.createObjectStore('profile');
      d.createObjectStore('cells', { keyPath: 'key' });
      d.createObjectStore('sessions', { autoIncrement: true });
      d.createObjectStore('certs', { autoIncrement: true });
      d.createObjectStore('cache');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('blocked'));
  });
}

const wrap = (req) => new Promise((res, rej) => { req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error); });
const tx = (name, mode = 'readonly') => db.transaction(name, mode).objectStore(name);

export const store = {
  get usingFallback() { return useLS; },

  async init() {
    try {
      db = await openDB();
      // A quick write/read proves IDB actually works (Safari private mode can open but fail).
      await wrap(tx('cache', 'readwrite').put(1, '__probe'));
      await wrap(tx('cache').get('__probe'));
    } catch { db = null; useLS = true; }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch { /* ignore */ }
    return this;
  },

  async getProfile() {
    const base = defaultProfile();
    const p = useLS ? lsGet('profile', null) : await wrap(tx('profile').get('main'));
    if (!p) return base;
    return { ...base, ...p, settings: { ...base.settings, ...(p.settings || {}) } };
  },
  async saveProfile(p) { if (useLS) lsSet('profile', p); else await wrap(tx('profile', 'readwrite').put(p, 'main')); },

  async getCell(key) { return useLS ? (lsGet('cells', {})[key] || null) : (await wrap(tx('cells').get(key))) || null; },
  async putCell(cell) {
    if (useLS) { const all = lsGet('cells', {}); all[cell.key] = cell; lsSet('cells', all); }
    else await wrap(tx('cells', 'readwrite').put(cell));
  },
  async allCells() { return useLS ? Object.values(lsGet('cells', {})) : wrap(tx('cells').getAll()); },

  async addSession(s) {
    if (useLS) { const a = lsGet('sessions', []); a.push(s); lsSet('sessions', a); }
    else await wrap(tx('sessions', 'readwrite').add(s));
  },
  async allSessions() { return useLS ? lsGet('sessions', []) : wrap(tx('sessions').getAll()); },
  async addCert(c) {
    if (useLS) { const a = lsGet('certs', []); a.push(c); lsSet('certs', a); }
    else await wrap(tx('certs', 'readwrite').add(c));
  },
  async allCerts() { return useLS ? lsGet('certs', []) : wrap(tx('certs').getAll()); },

  // Engine result cache (not exported; always re-derivable).
  async cacheGet(k) { if (useLS) return undefined; try { return await wrap(tx('cache').get(k)); } catch { return undefined; } },
  async cacheSet(k, v) { if (useLS) return; try { await wrap(tx('cache', 'readwrite').put(v, k)); } catch { /* ignore */ } },
  async cacheClear() { if (!useLS) await wrap(tx('cache', 'readwrite').clear()); },

  async exportAll() {
    return {
      app: 'blackjack-dojo', schema: SCHEMA, exportedAt: new Date().toISOString(),
      profile: await this.getProfile(), cells: await this.allCells(),
      sessions: await this.allSessions(), certificates: await this.allCerts(),
    };
  },

  async importAll(obj) {
    if (!obj || obj.app !== 'blackjack-dojo' || !obj.profile || !Array.isArray(obj.cells)) throw new Error('Not a Blackjack Dojo export file.');
    if (obj.schema > SCHEMA) throw new Error('Export is from a newer app version.');
    await this.wipe();
    await this.saveProfile(obj.profile);
    for (const c of obj.cells) await this.putCell(c);
    for (const s of obj.sessions || []) await this.addSession(s);
    for (const c of obj.certificates || []) await this.addCert(c);
  },

  async wipe() {
    if (useLS) { for (const k of ['profile', 'cells', 'sessions', 'certs']) localStorage.removeItem(LS + k); return; }
    for (const n of ['profile', 'cells', 'sessions', 'certs']) await wrap(tx(n, 'readwrite').clear());
  },
};
