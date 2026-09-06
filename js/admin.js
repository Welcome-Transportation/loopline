document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const busView = document.getElementById('bus-view');
  const proposalsView = document.getElementById('proposals-view');
  const adminProposalsList = document.getElementById('admin-proposals-list');
  const proposalsRefreshBtn = document.getElementById('proposals-refresh-btn');
  const ticketsView = document.getElementById('tickets-view');
  const passwordInput = document.getElementById('password-input');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');
  const refreshBtn = document.getElementById('refresh-btn');
  const ticketsBody = document.getElementById('tickets-body');
  const ticketsSummary = document.getElementById('tickets-summary');

  const busStatus = document.getElementById('bus-status');
  const busToggleBtn = document.getElementById('bus-toggle-btn');
  const busMapLink = document.getElementById('bus-map-link');

  let adminPassword = sessionStorage.getItem('loopline_admin_password') || '';
  let watchId = null;
  let busActive = false;

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }

  function timeAgo(iso) {
    if (!iso) return 'never';
    const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    return `${Math.round(seconds / 60)}m ago`;
  }

  async function loadTickets() {
    const res = await fetch('/api/tickets', {
      headers: { 'x-admin-password': adminPassword },
    });

    if (res.status === 401) {
      sessionStorage.removeItem('loopline_admin_password');
      loginView.hidden = false;
      busView.hidden = true;
      proposalsView.hidden = true;
      ticketsView.hidden = true;
      loginError.hidden = false;
      return;
    }

    const tickets = await res.json();
    const checkedIn = tickets.filter((t) => t.checkedIn).length;
    ticketsSummary.textContent = `${tickets.length} sold — ${checkedIn} checked in`;

    ticketsBody.innerHTML = tickets
      .map(
        (t) => `
        <tr>
          <td>${t.name}</td>
          <td>${t.email || (t.source === 'onsite' ? 'walk-up' : '—')}</td>
          <td>${t.eventName || '—'}${t.eventDate ? ` (${t.eventDate})` : ''}</td>
          <td>${formatDate(t.createdAt)}</td>
          <td>${t.checkedIn ? `Checked in @ ${formatDate(t.checkedInAt)}` : 'Valid'}</td>
        </tr>`
      )
      .join('');
  }

  async function loadProposals() {
    const res = await fetch('/api/events');
    const events = await res.json();
    const proposals = events.filter((e) => e.status === 'proposed' || e.status === 'reached');
    const undated = events.filter((e) => e.status === 'confirmed' && !e.date);

    if (!proposals.length && !undated.length) {
      adminProposalsList.innerHTML = '<p class="nav-hint">Nothing pending right now.</p>';
      return;
    }

    adminProposalsList.innerHTML = [...proposals, ...undated]
      .map((e) => {
        const pct = e.threshold ? Math.min(100, Math.round((e.pledgeCount / e.threshold) * 100)) : 100;
        return `
        <div class="proposal-card" data-event-id="${e.id}">
          <div class="event-name">${e.name}</div>
          <div class="event-venue">@ ${e.venue} — $${e.price}/ticket — ${e.status}</div>
          ${
            e.threshold
              ? `<div class="proposal-progress-track"><div class="proposal-progress-fill" style="width:${pct}%"></div></div>
                 <p class="nav-hint">${e.pledgeCount} of ${e.threshold} pledges</p>`
              : ''
          }
          <div class="admin-proposal-actions">
            ${
              e.status !== 'confirmed'
                ? `<button type="button" class="staff-btn-small activate-btn">Activate</button>
                   <button type="button" class="staff-btn-small cancel-btn">Cancel</button>`
                : `<form class="set-date-form">
                     <input type="date" class="set-date-input" required />
                     <button type="submit" class="staff-btn-small">Set Date</button>
                   </form>`
            }
          </div>
        </div>`;
      })
      .join('');

    adminProposalsList.querySelectorAll('.activate-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const eventId = btn.closest('.proposal-card').dataset.eventId;
        await fetch(`/api/events/${eventId}/activate`, {
          method: 'POST',
          headers: { 'x-admin-password': adminPassword },
        });
        loadProposals();
      });
    });

    adminProposalsList.querySelectorAll('.cancel-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const eventId = btn.closest('.proposal-card').dataset.eventId;
        await fetch(`/api/events/${eventId}/cancel`, {
          method: 'POST',
          headers: { 'x-admin-password': adminPassword },
        });
        loadProposals();
      });
    });

    adminProposalsList.querySelectorAll('.set-date-form').forEach((form) => {
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const eventId = form.closest('.proposal-card').dataset.eventId;
        const date = form.querySelector('.set-date-input').value;
        await fetch(`/api/events/${eventId}/set-date`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
          body: JSON.stringify({ date }),
        });
        loadProposals();
      });
    });
  }

  async function refreshBusStatus() {
    const res = await fetch('/api/bus-location');
    const bus = await res.json();
    busActive = bus.active;

    if (bus.active && bus.lat != null) {
      busStatus.textContent = `🚍 Sharing — last updated ${timeAgo(bus.updatedAt)}`;
      busMapLink.href = `https://www.google.com/maps?q=${bus.lat},${bus.lng}`;
      busMapLink.hidden = false;
    } else if (bus.active) {
      busStatus.textContent = '🚍 Sharing is on — waiting for the first location update…';
      busMapLink.hidden = true;
    } else {
      busStatus.textContent = 'Bus location sharing is off.';
      busMapLink.hidden = true;
    }

    busToggleBtn.textContent = bus.active
      ? 'Stop Sharing Bus Location'
      : 'Start Sharing My Location as the Bus';
  }

  function startWatchingThisDevice() {
    if (!navigator.geolocation) return;
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        fetch('/api/bus-location/ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
          body: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        }).catch(() => {});
      },
      () => {
        busStatus.textContent = 'Location unavailable on this device — sharing turned on, but no fix yet.';
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }

  function stopWatchingThisDevice() {
    if (watchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  busToggleBtn.addEventListener('click', async () => {
    if (busActive) {
      await fetch('/api/bus-location/stop', {
        method: 'POST',
        headers: { 'x-admin-password': adminPassword },
      });
      stopWatchingThisDevice();
    } else {
      await fetch('/api/bus-location/start', {
        method: 'POST',
        headers: { 'x-admin-password': adminPassword },
      });
      startWatchingThisDevice();
    }
    refreshBusStatus();
  });

  async function tryLogin() {
    adminPassword = passwordInput.value;
    const res = await fetch('/api/tickets', {
      headers: { 'x-admin-password': adminPassword },
    });

    if (!res.ok) {
      loginError.hidden = false;
      return;
    }

    sessionStorage.setItem('loopline_admin_password', adminPassword);
    loginError.hidden = true;
    loginView.hidden = true;
    busView.hidden = false;
    proposalsView.hidden = false;
    ticketsView.hidden = false;
    loadTickets();
    loadProposals();
    refreshBusStatus();
    setInterval(refreshBusStatus, 5000);
  }

  loginBtn.addEventListener('click', tryLogin);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryLogin();
  });
  refreshBtn.addEventListener('click', loadTickets);
  proposalsRefreshBtn.addEventListener('click', loadProposals);

  if (adminPassword) {
    loginView.hidden = true;
    busView.hidden = false;
    proposalsView.hidden = false;
    ticketsView.hidden = false;
    loadTickets();
    loadProposals();
    refreshBusStatus();
    setInterval(refreshBusStatus, 5000);
  }
});
