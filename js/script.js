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

  const purchaseForm = document.getElementById('purchase-form');
  const purchaseResult = document.getElementById('purchase-result');
  const purchaseError = document.getElementById('purchase-error');
  const ticketQr = document.getElementById('ticket-qr');

  if (purchaseForm) {
    purchaseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      purchaseError.hidden = true;

      const name = document.getElementById('buyer-name').value.trim();
      const email = document.getElementById('buyer-email').value.trim();
      const submitBtn = purchaseForm.querySelector('button[type="submit"]');
      submitBtn.disabled = true;

      try {
        const res = await fetch('/api/tickets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email }),
        });

        if (!res.ok) throw new Error('purchase failed');

        const ticket = await res.json();
        ticketQr.src = ticket.qrDataUrl;
        purchaseForm.hidden = true;
        purchaseResult.hidden = false;
      } catch (err) {
        purchaseError.hidden = false;
        submitBtn.disabled = false;
      }
    });
  }

  const diceBtn = document.getElementById('dice-btn');
  const diceResult = document.getElementById('dice-result');
  const dares = [
    'Take a Shot 🥃',
    'Twerk 💃',
    'Go Again 🔁',
    'Truth 🗣️',
    'Dare 😈',
    'Sing a Line of Sweet Caroline 🎤',
    'High-Five a Stranger 🙌',
  ];

  if (diceBtn && diceResult) {
    let spinning = false;
    diceBtn.addEventListener('click', () => {
      if (spinning) return;
      spinning = true;
      diceBtn.classList.add('spinning');
      diceResult.textContent = '…';

      setTimeout(() => {
        const pick = dares[Math.floor(Math.random() * dares.length)];
        diceResult.textContent = pick;
        diceBtn.classList.remove('spinning');
        spinning = false;
      }, 700);
    });
  }
});
