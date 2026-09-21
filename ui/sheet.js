// Bottom sheet helper.
export function openSheet(html, { onClose } = {}) {
  const root = document.getElementById('sheet-root');
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  scrim.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
  root.appendChild(scrim);
  const close = () => { scrim.remove(); if (onClose) onClose(); };
  scrim.addEventListener('click', (e) => { if (e.target === scrim) close(); });
  return { el: scrim.querySelector('.sheet'), close };
}

export function confirmSheet(title, body, { ok = 'Confirm', cancel = 'Cancel', danger = false } = {}) {
  return new Promise((resolve) => {
    const s = openSheet(`<h3>${title}</h3><p class="dim">${body}</p><div class="gap"></div>
      <button class="btn block ${danger ? 'danger' : 'primary'}" id="ok">${ok}</button><div class="gap"></div>
      <button class="btn block ghost" id="no">${cancel}</button>`, { onClose: () => resolve(false) });
    s.el.querySelector('#ok').onclick = () => { s.close = s.close; resolve(true); s.el.closest('.scrim').remove(); };
    s.el.querySelector('#no').onclick = () => { s.el.closest('.scrim').remove(); resolve(false); };
  });
}
