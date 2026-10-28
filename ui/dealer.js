// The dealers: three illustrated characters drawn as SVG with shaded skin, hair, eyes that blink, a
// breathing torso, a dealing arm and moods (surprised when the dealer busts, grinning on blackjack).
// Palette per character; the practice room swaps the name tag to COACH and the tie to teal.

export const DEALERS = {
  marcus: { name: 'Marcus', skin1: '#b27a52', skin2: '#7c4c2c', hair: '#15110e', vest: '#1b1d24', vest2: '#2b2e38', tie: '#c2303f', iris: '#3a2416' },
  elena: { name: 'Elena', skin1: '#fadcbd', skin2: '#e0ad86', hair: '#8c3b1c', vest: '#2e1630', vest2: '#4a2a4e', tie: '#e0b13c', iris: '#2f6a4a' },
  kai: { name: 'Kai', skin1: '#e6b88a', skin2: '#c08a5a', hair: '#17120e', vest: '#1a2638', vest2: '#2c405c', tie: '#2fbf9a', iris: '#2a1c12' },
};

function hairFor(id, d) {
  if (id === 'elena') {
    return { back: `<circle cx="70" cy="14" r="11" fill="${d.hair}"/><path d="M48 52C44 30 54 16 70 16s26 14 22 36c-2-12-8-22-22-22S50 40 48 52z" fill="${d.hair}"/>`,
      front: `<path d="M51 44C52 30 60 24 70 24c10 0 18 6 19 20-4-9-10-14-19-14-8 0-14 5-19 14z" fill="${d.hair}"/><path d="M62 28q8 6 24 14" fill="none" stroke="#a8532a" stroke-width="1.5" opacity=".6"/>` };
  }
  if (id === 'kai') {
    return { back: '', front: `<path d="M51 42C48 24 58 14 72 15c12 1 20 10 17 28-2-8-6-12-14-13-10-1-18 3-24 12z" fill="${d.hair}"/><path d="M56 24q12-8 26-2" fill="none" stroke="#3a2c20" stroke-width="2" opacity=".7"/>` };
  }
  return { back: '', front: `<path d="M51 42C50 26 58 18 70 18s20 8 19 24c-3-9-9-13-19-13s-16 4-19 13z" fill="${d.hair}"/>` };
}

function extrasFor(id, d) {
  if (id === 'marcus') return `<path d="M54 60q0 14 16 17 16-3 16-17-6 8-16 8t-16-8z" fill="#15110e" opacity=".45"/><path d="M59 63q11-6 22 0q-11 3-22 0z" fill="#15110e"/>`;
  if (id === 'kai') return `<g fill="none" stroke="#1a1a20" stroke-width="2"><circle cx="61" cy="46" r="8.4"/><circle cx="79" cy="46" r="8.4"/><path d="M69.4 45.4q.6-1.2 1.2 0M52.6 45.4l-4-1.6M87.4 45.4l4-1.6"/></g><g fill="#fff" opacity=".18"><circle cx="61" cy="46" r="8"/><circle cx="79" cy="46" r="8"/></g>`;
  return `<g fill="#e0b13c" stroke="#8a6a12" stroke-width=".6"><circle cx="49.6" cy="60" r="2.1"/><circle cx="90.4" cy="60" r="2.1"/></g>`;
}

export function dealerSVG(id, { practice = false } = {}) {
  const d = DEALERS[id] || DEALERS.marcus;
  const k = DEALERS[id] ? id : 'marcus';
  const tie = practice ? '#2fbf9a' : d.tie;
  const label = practice ? 'COACH' : d.name.toUpperCase();
  const hair = hairFor(k, d);
  const lip = k === 'elena' ? '#b5304a' : '#8a4a3a';
  const longTie = k === 'elena';
  const uid = `d${k}`;
  return `<svg class="dealer-fig" viewBox="0 0 140 120" aria-hidden="true">
    <defs>
      <radialGradient id="${uid}s" cx=".42" cy=".38" r=".85"><stop offset="0" stop-color="${d.skin1}"/><stop offset="1" stop-color="${d.skin2}"/></radialGradient>
      <linearGradient id="${uid}v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${d.vest2}"/><stop offset="1" stop-color="${d.vest}"/></linearGradient>
      <linearGradient id="${uid}w" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#d9dbe3"/><stop offset=".5" stop-color="#fff"/><stop offset="1" stop-color="#cfd2dc"/></linearGradient>
    </defs>
    <ellipse cx="70" cy="119" rx="56" ry="5" fill="#000" opacity=".25"/>
    ${hair.back}
    <g class="torso">
      <path d="M12 122C12 96 34 82 70 82s58 14 58 40z" fill="url(#${uid}v)" stroke="#000" stroke-opacity=".5" stroke-width="1"/>
      <path d="M50 82 70 120 90 82z" fill="url(#${uid}w)"/>
      <path d="M50 82 70 120M90 82 70 120" stroke="#000" stroke-opacity=".35" stroke-width="1.4" fill="none"/>
      <path d="M50 82 40 112M90 82 100 112" stroke="${d.vest2}" stroke-width="1.2" fill="none" opacity=".7"/>
      <path d="M58 76 70 94 61 98 49 84zM82 76 70 94 79 98 91 84z" fill="#fff" stroke="#9a9caa" stroke-width=".8"/>
      ${longTie ? `<path d="M70 92l-5 4 3 20 2 3 2-3 3-20z" fill="${tie}" stroke="#000" stroke-opacity=".4" stroke-width=".8"/><path d="M65 96l5-4 5 4-5 4z" fill="${tie}" stroke="#000" stroke-opacity=".4" stroke-width=".8"/>`
        : `<path d="M70 95 55 87v16zM70 95l15-8v16z" fill="${tie}" stroke="#000" stroke-opacity=".45" stroke-width=".9"/><rect x="66.5" y="91" width="7" height="8" rx="2.4" fill="${tie}" stroke="#000" stroke-opacity=".45" stroke-width=".9"/>`}
      <g fill="#c9a24a" stroke="#6a4f12" stroke-width=".5"><circle cx="70" cy="106" r="1.7"/><circle cx="70" cy="114" r="1.7"/></g>
      <rect x="90" y="98" width="28" height="10" rx="2" fill="#f4f1e6" stroke="#8a8a8a" stroke-width=".5"/><text x="104" y="105.2" text-anchor="middle" font-size="4.9" font-weight="800" fill="#222" font-family="system-ui,sans-serif" letter-spacing=".3">${label}</text>
    </g>
    <rect x="61" y="66" width="18" height="20" rx="6" fill="url(#${uid}s)"/><path d="M61 78q9 7 18 0v-5q-9 6-18 0z" fill="#000" opacity=".25"/>
    <g class="head">
      <circle cx="50.4" cy="52" r="5.4" fill="url(#${uid}s)" stroke="#000" stroke-opacity=".25" stroke-width=".6"/><circle cx="89.6" cy="52" r="5.4" fill="url(#${uid}s)" stroke="#000" stroke-opacity=".25" stroke-width=".6"/>
      <path d="M52 40C52 28 60 22 70 22s18 6 18 18v14c0 14-8 22-18 22S52 68 52 54z" fill="url(#${uid}s)" stroke="#000" stroke-opacity=".28" stroke-width=".8"/>
      <ellipse cx="70" cy="76" rx="10" ry="3" fill="#000" opacity=".12"/>
      <ellipse cx="60.5" cy="46" rx="4.6" ry="3.5" fill="#fff"/><ellipse cx="79.5" cy="46" rx="4.6" ry="3.5" fill="#fff"/>
      <g class="eyes"><circle cx="60.9" cy="46.2" r="2.7" fill="${d.iris}"/><circle cx="79.1" cy="46.2" r="2.7" fill="${d.iris}"/><circle cx="60.9" cy="46.2" r="1.3" fill="#0a0a0a"/><circle cx="79.1" cy="46.2" r="1.3" fill="#0a0a0a"/><circle cx="61.8" cy="45.2" r=".8" fill="#fff"/><circle cx="80" cy="45.2" r=".8" fill="#fff"/></g>
      <g class="lids" fill="url(#${uid}s)"><ellipse cx="60.5" cy="46" rx="5" ry="3.9"/><ellipse cx="79.5" cy="46" rx="5" ry="3.9"/></g>
      <g class="brows" fill="none" stroke="${d.hair}" stroke-width="2.2" stroke-linecap="round"><path d="M55 39.5q5-3 10-.6"/><path d="M75 38.9q5-2.4 10 .6"/></g>
      <path d="M70 47v9q-3 3-1.5 4h6" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.3" stroke-linecap="round"/><path d="M66 60.2q4 1.8 8 0" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="57.5" cy="56" r="4" fill="#e08a7a" opacity=".22"/><circle cx="82.5" cy="56" r="4" fill="#e08a7a" opacity=".22"/>
      <path class="m-smile" d="M62 65q8 7 16 0" fill="none" stroke="${lip}" stroke-width="2.2" stroke-linecap="round"/>
      <path class="m-grin" d="M60.5 64.5q9.5 11 19 0q-9.5 2.5-19 0z" fill="#3a1a18" stroke="${lip}" stroke-width="1.4" stroke-linejoin="round"/><path class="m-grin" d="M63 65.4q7 2 14 0" fill="none" stroke="#fff" stroke-width="1.8"/>
      <ellipse class="m-o" cx="70" cy="67" rx="3.6" ry="4.6" fill="#3a1a18" stroke="${lip}" stroke-width="1.3"/>
      ${extrasFor(k, d)}
      ${hair.front}
    </g>
    <g class="arm">
      <path d="M103 90C117 86 128 97 129 113l-15 2C113 105 109 98 103 97z" fill="url(#${uid}w)" stroke="#9a9caa" stroke-width=".8"/>
      <path d="M106 94c4 1 7 4 8 9" fill="none" stroke="#9a9caa" stroke-width=".7" opacity=".7"/>
      <path d="M113.6 113.4 129.4 111.6 130 117 114.2 119z" fill="#e9eaf0" stroke="#9a9caa" stroke-width=".8"/><circle cx="121" cy="115.3" r="1.1" fill="#c9a24a"/>
      <g fill="url(#${uid}s)" stroke="#000" stroke-opacity=".3" stroke-width=".6"><rect x="114.5" y="118" width="15" height="9.5" rx="4.6"/><path d="M129 120q5 0 4 4.6t-5 2z"/></g>
    </g>
  </svg>`;
}
