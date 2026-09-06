document.addEventListener('DOMContentLoaded', () => {
  const joinView = document.getElementById('join-view');
  const mainView = document.getElementById('main-view');
  const joinName = document.getElementById('join-name');
  const joinBtn = document.getElementById('join-btn');
  const locationStatus = document.getElementById('location-status');
  const panicBtn = document.getElementById('panic-btn');
  const cameraBox = document.getElementById('camera-box');
  const cameraVideo = document.getElementById('panic-camera');
  const stopCameraBtn = document.getElementById('stop-camera-btn');
  const membersList = document.getElementById('members-list');
  const alertsList = document.getElementById('alerts-list');

  let memberId = localStorage.getItem('loopline_nav_member_id');
  let lastKnownPos = null;
  let cameraStream = null;

  function timeAgo(iso) {
    if (!iso) return 'never';
    const seconds = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    return `${Math.round(minutes / 60)}h ago`;
  }

  function sendPing() {
    if (!memberId || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        lastKnownPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        try {
          const res = await fetch('/api/navigator/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memberId, ...lastKnownPos }),
          });
          const data = await res.json();
          if (data.checkedIn) {
            locationStatus.textContent = "✅ You're checked in — you're back at the bus!";
          } else if (data.busSharing) {
            locationStatus.textContent = "Sharing your location — you'll be checked in automatically once you're near the bus.";
          } else {
            locationStatus.textContent = 'Bus location sharing is off right now — check in with staff instead.';
          }
        } catch (err) {
          /* offline / spotty connection — will retry on next interval */
        }
      },
      () => {
        locationStatus.textContent = 'Location unavailable — enable location sharing so the bus can auto-check you in.';
      },
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
  }

  async function refreshStatus() {
    try {
      const res = await fetch('/api/navigator/status');
      const state = await res.json();

      membersList.innerHTML = state.members
        .map(
          (m) => `
          <div class="member-row">
            <span class="member-name">${m.name}${m.id === memberId ? ' (you)' : ''}</span>
            <span class="member-meta">${m.checkedIn ? '✅ On the bus' : `last seen ${timeAgo(m.updatedAt)}`}</span>
          </div>`
        )
        .join('') || '<p class="nav-hint">Nobody else has joined yet.</p>';

      const openAlerts = state.alerts.filter((a) => !a.resolved);
      alertsList.innerHTML = openAlerts
        .map(
          (a) => `
          <div class="alert-card">
            <strong>🚨 ${a.memberName} needs help</strong>
            <span>${timeAgo(a.createdAt)}</span>
            ${
              a.lat != null
                ? `<a class="cta-btn alert-map-link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${a.lat},${a.lng}">View on Map</a>`
                : ''
            }
            <button type="button" class="staff-btn-small resolve-btn" data-alert-id="${a.id}">I've got them — resolve</button>
          </div>`
        )
        .join('');

      alertsList.querySelectorAll('.resolve-btn').forEach((btn) => {
        btn.addEventListener('click', async () => {
          await fetch('/api/navigator/resolve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alertId: btn.dataset.alertId }),
          });
          refreshStatus();
        });
      });
    } catch (err) {
      /* spotty connection — next interval will retry */
    }
  }

  async function startCamera() {
    try {
      cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraVideo.srcObject = cameraStream;
      cameraBox.hidden = false;
    } catch (err) {
      /* camera unavailable/denied — panic alert still went out */
    }
  }

  function stopCamera() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      cameraStream = null;
    }
    cameraBox.hidden = true;
  }

  function enterMainView() {
    joinView.hidden = true;
    mainView.hidden = false;
    sendPing();
    setInterval(sendPing, 20000);
    refreshStatus();
    setInterval(refreshStatus, 8000);
  }

  joinBtn.addEventListener('click', async () => {
    const name = joinName.value.trim();
    if (!name) return;
    const res = await fetch('/api/navigator/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const data = await res.json();
    memberId = data.memberId;
    localStorage.setItem('loopline_nav_member_id', memberId);
    localStorage.setItem('loopline_nav_name', name);
    enterMainView();
  });

  panicBtn.addEventListener('click', async () => {
    await fetch('/api/navigator/panic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ memberId, ...(lastKnownPos || {}) }),
    });
    startCamera();
    refreshStatus();
  });

  stopCameraBtn.addEventListener('click', stopCamera);

  if (memberId) {
    enterMainView();
  }
});
