// Visual preferences applied to <html>: felt colour, card back, dealer visibility, text size.
export function applyLook(s = {}) {
  const h = document.documentElement;
  h.classList.toggle('lg', !!s.largeText);
  h.classList.toggle('nodealer', s.showDealer === false);
  h.dataset.felt = s.felt || 'green';
  h.dataset.back = s.cardBack || 'red';
}

// A small felt-grain tile drawn once on a canvas (a plain image layer is far cheaper to paint than an SVG filter).
export function feltGrain() {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d'), img = g.createImageData(96, 96);
    for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() < 0.5 ? 0 : 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = Math.random() * 16; }
    g.putImageData(img, 0, 0);
    document.documentElement.style.setProperty('--noise', `url(${c.toDataURL('image/png')})`);
  } catch { /* no canvas: plain felt */ }
}
