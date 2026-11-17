let hoveringCard;

function updateReveal(hero) {
  const portrait = hero.querySelector('.messi-portrait-switch');
  portrait.dataset.reveal = String(hoveringCard === hero || portrait.getAttribute('aria-pressed') === 'true');
}

function cardHover(event, entering) {
  const card = event.target.closest('.messi-award-card');
  if (!card || event.pointerType !== 'mouse' || card.contains(event.relatedTarget)) return;
  const hero = card.closest('.c.home-hero');
  hoveringCard = entering ? hero : null;
  updateReveal(hero);
}

document.addEventListener('pointerover', event => cardHover(event, true));
document.addEventListener('pointerout', event => cardHover(event, false));

document.addEventListener('click', event => {
  const control = event.target.closest('.messi-portrait-switch, .messi-award-card');
  if (!control) return;
  const hero = control.closest('.c.home-hero');
  const portrait = hero.querySelector('.messi-portrait-switch');
  const locked = portrait.getAttribute('aria-pressed') !== 'true';
  portrait.setAttribute('aria-pressed', String(locked));
  hero.querySelector('.messi-award-card').setAttribute('aria-pressed', String(locked));
  updateReveal(hero);
});

const reducePortraitMotion = matchMedia('(prefers-reduced-motion: reduce)');
let hoveredPortrait;

function clearPortraitHover() {
  if (hoveredPortrait) hoveredPortrait.dataset.hover = 'false';
  hoveredPortrait = null;
}

document.addEventListener('pointermove', event => {
  if (event.pointerType !== 'mouse' || reducePortraitMotion.matches) return;
  const portrait = event.target.closest('.messi-portrait-switch');
  if (portrait !== hoveredPortrait) clearPortraitHover();
  if (!portrait || portrait.dataset.reveal === 'true') return;

  const bounds = portrait.getBoundingClientRect();
  portrait.style.setProperty('--portrait-x', `${100 * (event.clientX - bounds.left) / bounds.width}%`);
  portrait.style.setProperty('--portrait-y', `${100 * (event.clientY - bounds.top) / bounds.height}%`);
  portrait.dataset.hover = 'true';
  hoveredPortrait = portrait;
}, { capture: true, passive: true });

document.documentElement.addEventListener('pointerleave', clearPortraitHover);
window.addEventListener('blur', clearPortraitHover);
