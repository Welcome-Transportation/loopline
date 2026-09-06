document.addEventListener('DOMContentLoaded', async () => {
  const list = document.getElementById('events-list');

  function formatDate(isoDate) {
    const d = new Date(isoDate + 'T00:00:00');
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  try {
    const res = await fetch('/api/events');
    const events = await res.json();

    if (!events.length) {
      list.innerHTML = '<p class="events-loading">No upcoming parties posted yet — check back soon.</p>';
      return;
    }

    list.innerHTML = events
      .map(
        (e) => `
        <div class="event-card">
          <div class="event-date">${formatDate(e.date)}</div>
          <div class="event-name">${e.name}</div>
          <div class="event-venue">@ ${e.venue}</div>
          <a class="cta-btn event-cta" href="index.html?event=${encodeURIComponent(e.id)}#purchase">
            Get Tickets — $${e.price}
          </a>
        </div>`
      )
      .join('');
  } catch (err) {
    list.innerHTML = '<p class="events-loading">Couldn\'t load parties — try refreshing.</p>';
  }
});
