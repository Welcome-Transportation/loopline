document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const ticketsView = document.getElementById('tickets-view');
  const passwordInput = document.getElementById('password-input');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');
  const refreshBtn = document.getElementById('refresh-btn');
  const ticketsBody = document.getElementById('tickets-body');
  const ticketsSummary = document.getElementById('tickets-summary');

  let adminPassword = sessionStorage.getItem('loopline_admin_password') || '';

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleString();
  }

  async function loadTickets() {
    const res = await fetch('/api/tickets', {
      headers: { 'x-admin-password': adminPassword },
    });

    if (res.status === 401) {
      sessionStorage.removeItem('loopline_admin_password');
      loginView.hidden = false;
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
    ticketsView.hidden = false;
    loadTickets();
  }

  loginBtn.addEventListener('click', tryLogin);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryLogin();
  });
  refreshBtn.addEventListener('click', loadTickets);

  if (adminPassword) {
    loginView.hidden = true;
    ticketsView.hidden = false;
    loadTickets();
  }
});
