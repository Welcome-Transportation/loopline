// Loopline — main landing page: ticket purchase form + dare dice.

document.addEventListener('DOMContentLoaded', () => {
  const purchaseForm = document.getElementById('purchase-form');
  const purchaseResult = document.getElementById('purchase-result');
  const purchaseError = document.getElementById('purchase-error');
  const ticketQr = document.getElementById('ticket-qr');
  const eventLabel = document.getElementById('purchase-event-label');

  const eventId = new URLSearchParams(window.location.search).get('event');

  function formatDate(isoDate) {
    if (!isoDate) return '';
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  if (eventLabel) {
    fetch('/api/events')
      .then((res) => res.json())
      .then((events) => {
        const match = eventId ? events.find((e) => e.id === eventId) : events[0];
        if (match) {
          eventLabel.textContent = `${match.name} — ${formatDate(match.date)} @ ${match.venue}`;
          eventLabel.hidden = false;
        }
      })
      .catch(() => {});
  }

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
          body: JSON.stringify({ name, email, eventId }),
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
