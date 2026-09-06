document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const sellView = document.getElementById('sell-view');
  const passwordInput = document.getElementById('password-input');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');

  const tapBtn = document.getElementById('tap-btn');
  const tapBtnLabel = document.getElementById('tap-btn-label');
  const buyerName = document.getElementById('buyer-name');
  const saleResult = document.getElementById('sale-result');
  const saleName = document.getElementById('sale-name');

  let adminPassword = sessionStorage.getItem('loopline_admin_password') || '';

  async function tryLogin() {
    adminPassword = passwordInput.value;
    const res = await fetch('/api/tickets', { headers: { 'x-admin-password': adminPassword } });
    if (!res.ok) {
      loginError.hidden = false;
      return;
    }
    sessionStorage.setItem('loopline_admin_password', adminPassword);
    loginError.hidden = true;
    loginView.hidden = true;
    sellView.hidden = false;
  }

  loginBtn.addEventListener('click', tryLogin);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryLogin();
  });

  tapBtn.addEventListener('click', async () => {
    tapBtn.disabled = true;
    tapBtn.classList.add('reading');
    tapBtnLabel.textContent = 'Reading…';

    // Mock "tap" delay so the flow feels like a real contactless read.
    await new Promise((r) => setTimeout(r, 900));

    try {
      const res = await fetch('/api/tickets/onsite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-password': adminPassword },
        body: JSON.stringify({ name: buyerName.value.trim() }),
      });
      if (!res.ok) throw new Error('sale failed');
      const ticket = await res.json();

      saleName.textContent = `${ticket.name} — ${ticket.eventName}`;
      saleResult.hidden = false;
      buyerName.value = '';
    } catch (err) {
      saleName.textContent = 'Something went wrong — try again.';
      saleResult.hidden = false;
    }

    tapBtn.disabled = false;
    tapBtn.classList.remove('reading');
    tapBtnLabel.textContent = 'TAP TO PAY — $12';
  });

  if (adminPassword) {
    loginView.hidden = true;
    sellView.hidden = false;
  }
});
