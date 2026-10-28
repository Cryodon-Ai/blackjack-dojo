// Visual preferences applied to <html>: felt colour, card back, dealer visibility, text size.
export function applyLook(s = {}) {
  const h = document.documentElement;
  h.classList.toggle('lg', !!s.largeText);
  h.classList.toggle('nodealer', s.showDealer === false);
  h.dataset.felt = s.felt || 'green';
  h.dataset.back = s.cardBack || 'red';
}
