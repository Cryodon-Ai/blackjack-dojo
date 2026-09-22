// Rule-set editor sheet with a live house-edge readout (exact engine values).
import { openSheet } from './sheet.js';
import { PRESETS, describeRules } from '../app/presets.js';
import { normalizeRules } from '../engine/rules.js';
import { houseEdge } from '../app/edges.js';

export function openRulesEditor(current, { title = 'Table rules', onSave } = {}) {
  let r = { ...normalizeRules(current) };
  const s = openSheet(`<h3>${title}</h3><div id="re"></div>`);
  const root = s.el.querySelector('#re');

  async function draw() {
    if (r.surrender === 'late' && r.peekOn === 'none') r.surrender = 'none';
    const edge = await houseEdge(r);
    const per100 = edge === null ? null : edge;
    root.innerHTML = `
      <div class="small dim">Presets</div>
      <div class="row wrap" style="margin:6px 0 10px">${PRESETS.map((p) => `<button class="btn small ghost" data-p="${p.id}">${p.name}${p.unverified ? ' ⚠' : ''}</button>`).join('')}</div>
      <label class="field">Decks<select id="decks">${[1, 2, 4, 6, 8].map((d) => `<option ${r.decks === d ? 'selected' : ''} value="${d}">${d}</option>`).join('')}</select></label>
      <label class="field">Blackjack pays<select id="bj"><option value="1.5" ${r.blackjackPays === 1.5 ? 'selected' : ''}>3:2</option><option value="1.2" ${r.blackjackPays === 1.2 ? 'selected' : ''}>6:5</option><option value="1" ${r.blackjackPays === 1 ? 'selected' : ''}>1:1</option></select></label>
      <label class="field">Doubling<select id="dbl"><option value="any" ${r.doubleRestriction === 'any' ? 'selected' : ''}>Any first two cards</option><option value="9-11" ${r.doubleRestriction === '9-11' ? 'selected' : ''}>Hard 9–11 only</option></select></label>
      <div class="toggle"><span>Dealer hits soft 17 (H17)</span><input type="checkbox" id="h17" ${r.dealerHitsSoft17 ? 'checked' : ''}></div>
      <div class="toggle"><span>Double after split (DAS)</span><input type="checkbox" id="das" ${r.doubleAfterSplit ? 'checked' : ''}></div>
      <div class="toggle"><span>Resplit aces</span><input type="checkbox" id="rsa" ${r.resplitAces ? 'checked' : ''}></div>
      <label class="field">Dealer checks for blackjack<select id="peek">
        <option value="both" ${r.peekOn === 'both' ? 'selected' : ''}>On Ace and Ten (standard peek)</option>
        <option value="ace" ${r.peekOn === 'ace' ? 'selected' : ''}>On Ace only (e.g. Gravity Blackjack)</option>
        <option value="none" ${r.peekOn === 'none' ? 'selected' : ''}>Never (no hole card / ENHC)</option>
      </select></label>
      <div class="toggle"><span>Late surrender ${r.peekOn === 'none' ? '<span class="dim small">(needs a peek)</span>' : ''}</span><input type="checkbox" id="ls" ${r.surrender === 'late' ? 'checked' : ''} ${r.peekOn === 'none' ? 'disabled' : ''}></div>
      <div class="card ${per100 !== null && per100 > 1 ? 'bad' : ''}" style="margin-top:12px">
        <div class="small dim">House edge with perfect basic strategy <span class="pill">computed</span></div>
        <div class="big num">${per100 === null ? '—' : per100.toFixed(2) + '%'}</div>
        <div class="small dim">${per100 === null ? 'Not in the precomputed grid.' : `You expect to lose about <b>$${per100.toFixed(2)}</b> per $100 wagered.`}</div>
      </div>
      <button class="btn primary block" id="save">Use these rules</button>`;
    root.querySelectorAll('[data-p]').forEach((b) => b.onclick = () => { r = { ...normalizeRules(PRESETS.find((p) => p.id === b.dataset.p).rules) }; r._preset = b.dataset.p; draw(); });
    const bind = (id, fn) => { root.querySelector('#' + id).onchange = (e) => { fn(e.target); r._preset = null; draw(); }; };
    bind('decks', (t) => { r.decks = Number(t.value); });
    bind('bj', (t) => { r.blackjackPays = Number(t.value); });
    bind('dbl', (t) => { r.doubleRestriction = t.value; });
    bind('h17', (t) => { r.dealerHitsSoft17 = t.checked; });
    bind('das', (t) => { r.doubleAfterSplit = t.checked; });
    bind('rsa', (t) => { r.resplitAces = t.checked; });
    bind('peek', (t) => { r.peekOn = t.value; if (r.peekOn === 'none') r.surrender = 'none'; });
    bind('ls', (t) => { r.surrender = t.checked ? 'late' : 'none'; });
    root.querySelector('#save').onclick = () => { const { _preset, ...rules } = r; s.close(); onSave && onSave(normalizeRules(rules), _preset || null); };
  }
  draw();
  return s;
}
export { describeRules };
