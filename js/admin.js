document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const busView = document.getElementById('bus-view');
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
    ticketsView.hidden = false;
    loadTickets();
    refreshBusStatus();
    setInterval(refreshBusStatus, 5000);
  }

  loginBtn.addEventListener('click', tryLogin);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryLogin();
  });
  refreshBtn.addEventListener('click', loadTickets);

  if (adminPassword) {
    loginView.hidden = true;
    busView.hidden = false;
    ticketsView.hidden = false;
    loadTickets();
    refreshBusStatus();
    setInterval(refreshBusStatus, 5000);
  }
});
