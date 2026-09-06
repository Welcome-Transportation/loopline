document.addEventListener('DOMContentLoaded', () => {
  const calGrid = document.getElementById('calendar-grid');
  const calLabel = document.getElementById('cal-month-label');
  const calPrev = document.getElementById('cal-prev');
  const calNext = document.getElementById('cal-next');
  const detailPanel = document.getElementById('event-detail');

  const showProposeBtn = document.getElementById('show-propose-form-btn');
  const proposeForm = document.getElementById('propose-form');
  const proposeError = document.getElementById('propose-error');
  const proposalsList = document.getElementById('proposals-list');
  const undatedSection = document.getElementById('undated-section');
  const undatedList = document.getElementById('undated-list');

  let allEvents = [];
  let viewYear, viewMonth; // 0-indexed month

  function pledgeKey(eventId) {
    return `loopline_pledge_${eventId}`;
  }

  async function loadEvents() {
    const res = await fetch('/api/events');
    allEvents = await res.json();
    renderCalendar();
    renderProposals();
    renderUndated();
  }

  function renderUndated() {
    const undated = allEvents.filter((e) => e.status === 'confirmed' && !e.date);
    if (!undated.length) {
      undatedSection.hidden = true;
      return;
    }
    undatedSection.hidden = false;

    undatedList.innerHTML = undated
      .map((e) => {
        const proposerToken = localStorage.getItem(`loopline_proposer_${e.id}`);
        return `
        <div class="proposal-card" data-event-id="${e.id}">
          <div class="event-name">${e.name}</div>
          <div class="event-venue">@ ${e.venue} — $${e.price}/ticket</div>
          <p class="nav-hint">${e.pledgeCount} people already pledged and got their ticket.</p>
          ${
            proposerToken
              ? `<form class="set-date-form">
                  <input type="date" class="set-date-input" required />
                  <button type="submit" class="cta-btn">Set the Date</button>
                </form>`
              : ''
          }
        </div>`;
      })
      .join('');

    undatedList.querySelectorAll('.set-date-form').forEach((form) => {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const eventId = form.closest('.proposal-card').dataset.eventId;
        const proposerToken = localStorage.getItem(`loopline_proposer_${eventId}`);
        const date = form.querySelector('.set-date-input').value;
        await fetch(`/api/events/${eventId}/set-date`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date, proposerToken }),
        });
        loadEvents();
      });
    });
  }

  // --- Calendar grid ---

  function renderCalendar() {
    const confirmed = allEvents.filter((e) => e.status === 'confirmed' && e.date);
    const byDate = {};
    confirmed.forEach((e) => {
      (byDate[e.date] = byDate[e.date] || []).push(e);
    });

    const first = new Date(viewYear, viewMonth, 1);
    const startWeekday = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    calLabel.textContent = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

    let html = '';
    for (let i = 0; i < startWeekday; i++) {
      html += '<div class="cal-cell cal-cell-empty"></div>';
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayEvents = byDate[iso] || [];
      const hasEvent = dayEvents.length > 0;
      html += `
        <div class="cal-cell ${hasEvent ? 'cal-cell-has-event' : ''}" data-date="${iso}">
          <span class="cal-daynum">${day}</span>
          ${hasEvent ? `<span class="cal-dot" title="${dayEvents[0].name}"></span>` : ''}
        </div>`;
    }
    calGrid.innerHTML = html;

    calGrid.querySelectorAll('.cal-cell-has-event').forEach((cell) => {
      cell.addEventListener('click', () => showDayDetail(cell.dataset.date, byDate[cell.dataset.date]));
    });
  }

  function showDayDetail(date, events) {
    detailPanel.hidden = false;
    detailPanel.innerHTML = events
      .map(
        (e) => `
        <div class="event-detail-card">
          <div class="event-detail-date">${new Date(date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <div class="event-detail-name">${e.name}</div>
          <div class="event-detail-venue">@ ${e.venue}</div>
          <a class="cta-btn" href="index.html?event=${encodeURIComponent(e.id)}#purchase">Get Tickets — $${e.price}</a>
        </div>`
      )
      .join('');
    detailPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  calPrev.addEventListener('click', () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    renderCalendar();
  });
  calNext.addEventListener('click', () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    renderCalendar();
  });

  // --- Proposals: propose, pledge, retrieve ticket once activated ---

  showProposeBtn.addEventListener('click', () => {
    proposeForm.hidden = !proposeForm.hidden;
  });

  proposeForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    proposeError.hidden = true;

    const body = {
      name: document.getElementById('propose-name').value.trim(),
      venue: document.getElementById('propose-venue').value.trim(),
      price: document.getElementById('propose-price').value,
      threshold: document.getElementById('propose-threshold').value,
      proposerName: document.getElementById('propose-proposer-name').value.trim(),
      proposerEmail: document.getElementById('propose-proposer-email').value.trim(),
    };

    try {
      const res = await fetch('/api/events/propose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('propose failed');
      const data = await res.json();
      localStorage.setItem(`loopline_proposer_${data.id}`, data.proposerToken);
      proposeForm.reset();
      proposeForm.hidden = true;
      loadEvents();
    } catch (err) {
      proposeError.hidden = false;
    }
  });

  async function pledge(eventId, formEl) {
    const name = formEl.querySelector('.pledge-name').value.trim();
    const email = formEl.querySelector('.pledge-email').value.trim();
    if (!name || !email) return;

    const res = await fetch(`/api/events/${eventId}/pledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    });
    if (!res.ok) return;
    const data = await res.json();
    localStorage.setItem(pledgeKey(eventId), data.pledgerToken);
    loadEvents();
  }

  async function checkMyTicket(eventId, container) {
    const token = localStorage.getItem(pledgeKey(eventId));
    if (!token) return;

    const res = await fetch(`/api/events/${eventId}/my-ticket?pledgerToken=${encodeURIComponent(token)}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.ready) {
      container.innerHTML = `
        <div class="ticket-mock">
          <div class="ticket-mock-header">${data.eventName}</div>
          <img class="ticket-qr-img" src="${data.qrDataUrl}" alt="Your ticket QR code" />
          <p class="ticket-mock-footer">you filthy animals.</p>
        </div>`;
    }
  }

  function renderProposals() {
    const proposals = allEvents.filter((e) => e.status === 'proposed' || e.status === 'reached');

    if (!proposals.length) {
      proposalsList.innerHTML = '<p class="nav-hint">No proposals right now — be the first.</p>';
      return;
    }

    proposalsList.innerHTML = proposals
      .map((e) => {
        const pct = Math.min(100, Math.round((e.pledgeCount / e.threshold) * 100));
        const myToken = localStorage.getItem(pledgeKey(e.id));
        return `
        <div class="proposal-card" data-event-id="${e.id}">
          <div class="event-name">${e.name}</div>
          <div class="event-venue">@ ${e.venue} — $${e.price}/ticket</div>
          <div class="proposal-progress-track"><div class="proposal-progress-fill" style="width:${pct}%"></div></div>
          <p class="nav-hint">${e.pledgeCount} of ${e.threshold} pledges${e.status === 'reached' ? ' — threshold reached, awaiting activation!' : ''}</p>
          ${
            myToken
              ? `<div class="my-ticket-slot"><p class="nav-hint">You've pledged — checking for your ticket…</p></div>`
              : `<form class="pledge-form">
                  <input type="text" class="pledge-name" placeholder="Your name" required />
                  <input type="email" class="pledge-email" placeholder="Your email" required />
                  <button type="submit" class="cta-btn">Pledge $${e.price}</button>
                </form>`
          }
        </div>`;
      })
      .join('');

    proposalsList.querySelectorAll('.pledge-form').forEach((form) => {
      form.addEventListener('submit', (ev) => {
        ev.preventDefault();
        pledge(form.closest('.proposal-card').dataset.eventId, form);
      });
    });

    proposalsList.querySelectorAll('.my-ticket-slot').forEach((slot) => {
      const eventId = slot.closest('.proposal-card').dataset.eventId;
      checkMyTicket(eventId, slot);
    });
  }

  const now = new Date();
  viewYear = now.getFullYear();
  viewMonth = now.getMonth();
  loadEvents();
});
