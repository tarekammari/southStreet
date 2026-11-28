// Storefront: product gallery thumbnails (everything else works without JS).
document.querySelectorAll('[data-gal]').forEach((g) => {
  const main = g.querySelector('.gal-main img');
  g.querySelectorAll('.gal-th button').forEach((b) => b.addEventListener('click', () => {
    main.src = b.dataset.src;
    g.querySelectorAll('.gal-th button').forEach((x) => x.classList.toggle('on', x === b));
  }));
});
document.querySelectorAll('form.order').forEach((f) => f.addEventListener('submit', () => {
  const b = f.querySelector('button'); b.disabled = true; b.style.opacity = '.6';
}));
