document.addEventListener('DOMContentLoaded', () => {
  const loginView = document.getElementById('login-view');
  const scannerView = document.getElementById('scanner-view');
  const passwordInput = document.getElementById('password-input');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');

  const video = document.getElementById('camera-feed');
  const canvas = document.getElementById('scan-canvas');
  const ctx = canvas.getContext('2d');
  const resultEl = document.getElementById('scan-result');
  const manualToken = document.getElementById('manual-token');
  const manualBtn = document.getElementById('manual-btn');

  let adminPassword = sessionStorage.getItem('loopline_admin_password') || '';
  let scanning = false;
  let paused = false;

  async function submitCheckin(token) {
    if (!token) return;
    paused = true;

    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (res.ok && data.ok) {
        resultEl.textContent = `✅ Valid — welcome, ${data.name}!`;
        resultEl.className = 'scan-result scan-result-ok';
      } else if (data.error === 'already_used') {
        resultEl.textContent = `❌ Already used (${data.name})`;
        resultEl.className = 'scan-result scan-result-bad';
      } else {
        resultEl.textContent = '❌ Ticket not found';
        resultEl.className = 'scan-result scan-result-bad';
      }
    } catch (err) {
      resultEl.textContent = 'Network error — try again';
      resultEl.className = 'scan-result scan-result-bad';
    }

    setTimeout(() => {
      resultEl.textContent = 'Point the camera at a QR code.';
      resultEl.className = 'scan-result';
      paused = false;
    }, 2500);
  }

  function tick() {
    if (!scanning) return;

    if (!paused && video.readyState === video.HAVE_ENOUGH_DATA) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = window.jsQR(frame.data, frame.width, frame.height);
      if (code && code.data) {
        submitCheckin(code.data);
      }
    }

    requestAnimationFrame(tick);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      video.srcObject = stream;
      await video.play();
      scanning = true;
      requestAnimationFrame(tick);
    } catch (err) {
      resultEl.textContent = 'Camera unavailable — use manual entry below.';
      resultEl.className = 'scan-result scan-result-bad';
    }
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
    scannerView.hidden = false;
    startCamera();
  }

  loginBtn.addEventListener('click', tryLogin);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryLogin();
  });

  manualBtn.addEventListener('click', () => {
    submitCheckin(manualToken.value.trim());
    manualToken.value = '';
  });

  if (adminPassword) {
    loginView.hidden = true;
    scannerView.hidden = false;
    startCamera();
  }
});
