// Loopline — static branded shell (checkpoint 1)
// Ticketing, QR check-in, audio, and the mini-game are intentionally not
// wired up yet. This file exists so later checkpoints have a place to grow
// without restructuring the page.

document.addEventListener('DOMContentLoaded', () => {
  const cta = document.querySelector('.cta-btn');
  if (cta) {
    cta.addEventListener('click', (e) => {
      e.preventDefault();
      document.querySelector('#tickets').scrollIntoView({ behavior: 'smooth' });
    });
  }
});
