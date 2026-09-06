const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { readTickets, withTickets } = require('./ticketStore');
const { readUpcomingEvents, withEvents, findEventById } = require('./eventsStore');
const { readState: readNavState, withState: withNavState } = require('./navigatorStore');

const PORT = process.env.PORT || 5190;
// This repo is public — no fixed default password belongs in source
// control. Set ADMIN_PASSWORD in .env for a stable one; otherwise a fresh
// one is generated each run and printed to the console below.
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || crypto.randomBytes(6).toString('hex');
const TICKET_PRICE = 12;

// The bus's location isn't fixed — it's Antonio's (the driver's) own phone
// GPS, toggled on from the admin side only for the window it's needed
// (loading time), and stored as live state in navigator.json. See the
// /api/bus-location/* endpoints below.
const CHECKIN_RADIUS_METERS = 150;

function metersBetween(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

function requireAdmin(req, res, next) {
  if (req.get('x-admin-password') !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

app.get('/api/events', async (req, res) => {
  const events = await readUpcomingEvents();
  res.json(
    events.map(({ id, date, name, venue, price, status, threshold, pledges }) => ({
      id,
      date,
      name,
      venue,
      price,
      status: status || 'confirmed',
      threshold: threshold || null,
      pledgeCount: pledges ? pledges.length : null,
      // First names only — no need to expose pledger emails publicly.
      pledgerNames: pledges ? pledges.map((p) => p.name) : null,
    }))
  );
});

// MOCK MODE: no Stripe key configured yet, so purchases are marked paid
// immediately, mirroring welcome-transportation-hub's pattern. Once a real
// STRIPE_SECRET_KEY is set, replace this with a Checkout Session (create it
// here, redirect the browser to session.url, then confirm on return) —
// see that repo's src/payments.js for the proven shape.
app.post('/api/tickets', async (req, res) => {
  const { name, email, eventId } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  let event = eventId ? await findEventById(eventId) : null;
  if (event && event.status && event.status !== 'confirmed') {
    return res.status(400).json({ error: 'event_not_confirmed' });
  }
  if (!event) {
    const upcoming = await readUpcomingEvents();
    event = upcoming.find((e) => (e.status || 'confirmed') === 'confirmed') || null;
  }

  const ticket = {
    id: crypto.randomUUID(),
    token: crypto.randomBytes(16).toString('hex'),
    name,
    email,
    price: event ? event.price : TICKET_PRICE,
    eventId: event ? event.id : null,
    eventName: event ? event.name : 'Happy Tuesdays',
    eventVenue: event ? event.venue : null,
    eventDate: event ? event.date : null,
    paid: true,
    checkedIn: false,
    checkedInAt: null,
    createdAt: new Date().toISOString(),
  };
  await withTickets((tickets) => {
    tickets.push(ticket);
  });

  const qrDataUrl = await QRCode.toDataURL(ticket.token, { margin: 1, width: 260 });
  res.status(201).json({
    id: ticket.id,
    token: ticket.token,
    qrDataUrl,
    eventName: ticket.eventName,
    eventVenue: ticket.eventVenue,
    eventDate: ticket.eventDate,
  });
});

app.get('/api/tickets', requireAdmin, async (req, res) => {
  const tickets = await readTickets();
  res.json(
    tickets
      .slice()
      .reverse()
      .map(({ id, name, email, eventName, eventDate, source, paid, checkedIn, checkedInAt, createdAt }) => ({
        id, name, email, eventName, eventDate, source, paid, checkedIn, checkedInAt, createdAt,
      }))
  );
});

app.post('/api/checkin', requireAdmin, async (req, res) => {
  const { token } = req.body || {};

  const result = await withTickets((tickets) => {
    const ticket = tickets.find((t) => t.token === token);
    if (!ticket) return { status: 404, body: { ok: false, error: 'not_found' } };
    if (ticket.checkedIn) {
      return {
        status: 409,
        body: { ok: false, error: 'already_used', name: ticket.name, checkedInAt: ticket.checkedInAt },
      };
    }

    ticket.checkedIn = true;
    ticket.checkedInAt = new Date().toISOString();
    return { status: 200, body: { ok: true, name: ticket.name } };
  });

  res.status(result.status).json(result.body);
});

// Onsite walk-up sale (staff-operated "tap to pay" device). MOCK MODE like
// the pre-purchase flow above — auto-approved, no real charge, until a real
// Stripe key + Stripe Terminal / Tap to Pay integration replaces this. A
// walk-up buyer is entering right now, so the ticket is checked in
// immediately rather than requiring a separate scan.
app.post('/api/tickets/onsite', requireAdmin, async (req, res) => {
  const { name, eventId } = req.body || {};

  let event = eventId ? await findEventById(eventId) : null;
  if (!event) {
    const upcoming = await readUpcomingEvents();
    event = upcoming[0] || null;
  }

  const now = new Date().toISOString();
  const ticket = {
    id: crypto.randomUUID(),
    token: crypto.randomBytes(16).toString('hex'),
    name: name || 'Walk-up',
    email: null,
    price: event ? event.price : TICKET_PRICE,
    eventId: event ? event.id : null,
    eventName: event ? event.name : 'Happy Tuesdays',
    eventVenue: event ? event.venue : null,
    eventDate: event ? event.date : null,
    source: 'onsite',
    paid: true,
    checkedIn: true,
    checkedInAt: now,
    createdAt: now,
  };
  await withTickets((tickets) => {
    tickets.push(ticket);
  });

  res.status(201).json({ id: ticket.id, name: ticket.name, eventName: ticket.eventName });
});

// --- Crowdfunded event proposals ---
// Anyone can propose an event; it only becomes real once enough people
// actually pledge money toward it (a pledge is a real mock-charge, same as
// a normal ticket purchase — "voting" means paying, not just clicking a
// button). Reaching the threshold doesn't auto-activate it: Antonio
// reviews and activates from admin, at which point every pledge becomes a
// real ticket. Whoever proposed it can set the date once activated —
// admin can also set/override it, since he owns the actual bus schedule.
const MIN_THRESHOLD = 3;

app.post('/api/events/propose', async (req, res) => {
  const { name, venue, price, threshold, proposerName, proposerEmail } = req.body || {};
  if (!name || !proposerName) {
    return res.status(400).json({ error: 'name and proposerName are required' });
  }

  const proposerToken = crypto.randomBytes(16).toString('hex');
  const event = {
    id: crypto.randomUUID(),
    date: null,
    name,
    venue: venue || 'TBD',
    price: Number(price) > 0 ? Number(price) : TICKET_PRICE,
    status: 'proposed',
    threshold: Math.max(MIN_THRESHOLD, Number(threshold) || 20),
    pledges: [],
    proposerName,
    proposerEmail: proposerEmail || null,
    proposerToken,
    createdAt: new Date().toISOString(),
  };

  await withEvents((events) => {
    events.push(event);
  });

  res.status(201).json({ id: event.id, proposerToken });
});

app.post('/api/events/:id/pledge', async (req, res) => {
  const { name, email } = req.body || {};
  if (!name || !email) {
    return res.status(400).json({ error: 'name and email are required' });
  }

  const pledgerToken = crypto.randomBytes(16).toString('hex');
  const result = await withEvents((events) => {
    const event = events.find((e) => e.id === req.params.id);
    if (!event) return { status: 404, body: { error: 'not_found' } };
    if (event.status !== 'proposed' && event.status !== 'reached') {
      return { status: 400, body: { error: 'not_open_for_pledges' } };
    }

    event.pledges.push({ name, email, pledgerToken, ticketId: null, createdAt: new Date().toISOString() });
    if (event.pledges.length >= event.threshold) {
      event.status = 'reached';
    }

    return {
      status: 201,
      body: {
        pledgerToken,
        pledgeCount: event.pledges.length,
        threshold: event.threshold,
        status: event.status,
      },
    };
  });

  res.status(result.status).json(result.body);
});

// Admin-only: converts every pledge into a real, checkable-in ticket and
// marks the event confirmed. Allowed from 'proposed' too (not just
// 'reached') so Antonio can override and greenlight early if he wants.
app.post('/api/events/:id/activate', requireAdmin, async (req, res) => {
  const eventResult = await withEvents((events) => {
    const event = events.find((e) => e.id === req.params.id);
    if (!event) return { status: 404, body: { error: 'not_found' } };
    if (event.status === 'confirmed') return { status: 400, body: { error: 'already_activated' } };
    if (event.status === 'cancelled') return { status: 400, body: { error: 'cancelled' } };

    event.status = 'confirmed';
    return { status: 200, body: { event } };
  });

  if (eventResult.status !== 200) {
    return res.status(eventResult.status).json(eventResult.body);
  }
  const event = eventResult.body.event;

  await withTickets((tickets) => {
    for (const pledge of event.pledges) {
      const ticket = {
        id: crypto.randomUUID(),
        token: crypto.randomBytes(16).toString('hex'),
        name: pledge.name,
        email: pledge.email,
        price: event.price,
        eventId: event.id,
        eventName: event.name,
        eventVenue: event.venue,
        eventDate: event.date,
        source: 'pledge',
        paid: true,
        checkedIn: false,
        checkedInAt: null,
        createdAt: new Date().toISOString(),
      };
      tickets.push(ticket);
      pledge.ticketId = ticket.id;
    }
  });

  // Pledges now carry a ticketId — persist that link.
  await withEvents((events) => {
    const e = events.find((ev) => ev.id === event.id);
    if (e) e.pledges = event.pledges;
  });

  res.json({ ok: true, pledgesConverted: event.pledges.length });
});

app.post('/api/events/:id/set-date', async (req, res) => {
  const { date, proposerToken } = req.body || {};
  if (!date) return res.status(400).json({ error: 'date is required' });

  const isAdmin = req.get('x-admin-password') === ADMIN_PASSWORD;

  const result = await withEvents((events) => {
    const event = events.find((e) => e.id === req.params.id);
    if (!event) return { status: 404, body: { error: 'not_found' } };
    if (event.status !== 'confirmed') return { status: 400, body: { error: 'not_confirmed_yet' } };
    if (!isAdmin && event.proposerToken !== proposerToken) {
      return { status: 403, body: { error: 'not_authorized' } };
    }

    event.date = date;
    return { status: 200, body: { ok: true, date } };
  });

  if (result.status !== 200) return res.status(result.status).json(result.body);

  // Tickets already issued from pledges were created before the date was
  // known — backfill it so admin/check-in show the real date.
  await withTickets((tickets) => {
    for (const t of tickets) {
      if (t.eventId === req.params.id) t.eventDate = date;
    }
  });

  res.json(result.body);
});

app.post('/api/events/:id/cancel', async (req, res) => {
  const { proposerToken } = req.body || {};
  const isAdmin = req.get('x-admin-password') === ADMIN_PASSWORD;

  const result = await withEvents((events) => {
    const event = events.find((e) => e.id === req.params.id);
    if (!event) return { status: 404, body: { error: 'not_found' } };
    if (event.status === 'confirmed') return { status: 400, body: { error: 'already_activated' } };
    if (!isAdmin && event.proposerToken !== proposerToken) {
      return { status: 403, body: { error: 'not_authorized' } };
    }

    event.status = 'cancelled';
    return { status: 200, body: { ok: true } };
  });

  res.status(result.status).json(result.body);
});

// A pledger's browser holds only a pledgerToken (no login) — this is how
// they retrieve their real ticket/QR once the event they pledged to gets
// activated.
app.get('/api/events/:id/my-ticket', async (req, res) => {
  const { pledgerToken } = req.query;
  const event = await findEventById(req.params.id);
  if (!event) return res.status(404).json({ error: 'not_found' });

  const pledge = (event.pledges || []).find((p) => p.pledgerToken === pledgerToken);
  if (!pledge) return res.status(404).json({ error: 'not_found' });
  if (!pledge.ticketId) return res.json({ status: event.status, ready: false });

  const tickets = await readTickets();
  const ticket = tickets.find((t) => t.id === pledge.ticketId);
  if (!ticket) return res.json({ status: event.status, ready: false });

  const qrDataUrl = await QRCode.toDataURL(ticket.token, { margin: 1, width: 260 });
  res.json({
    ready: true,
    qrDataUrl,
    eventName: ticket.eventName,
    eventVenue: ticket.eventVenue,
    eventDate: ticket.eventDate,
  });
});

// --- Party Navigator (buddy system / panic / hands-free bus check-in) ---
// MVP: no real accounts — a browser generates a memberId on first join and
// keeps it in localStorage. Location updates and alerts are visible to
// anyone who has joined the group; there's no per-member access control
// beyond that, which is fine for "everyone on tonight's bus" but should not
// be treated as private beyond that group.

app.post('/api/navigator/join', async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required' });

  const member = {
    id: crypto.randomUUID(),
    name,
    lat: null,
    lng: null,
    updatedAt: null,
    checkedIn: false,
    checkedInAt: null,
    joinedAt: new Date().toISOString(),
  };
  await withNavState((state) => {
    state.members.push(member);
  });

  res.status(201).json({ memberId: member.id });
});

app.post('/api/navigator/ping', async (req, res) => {
  const { memberId, lat, lng } = req.body || {};
  if (!memberId || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'memberId, lat, and lng are required' });
  }

  const result = await withNavState((state) => {
    const member = state.members.find((m) => m.id === memberId);
    if (!member) return { status: 404, body: { error: 'not_found' } };

    member.lat = lat;
    member.lng = lng;
    member.updatedAt = new Date().toISOString();

    const bus = state.busLocation;
    let distance = null;
    let justCheckedIn = false;
    if (bus.active && bus.lat != null && bus.lng != null) {
      distance = metersBetween({ lat, lng }, bus);
      if (distance <= CHECKIN_RADIUS_METERS && !member.checkedIn) {
        member.checkedIn = true;
        member.checkedInAt = member.updatedAt;
        justCheckedIn = true;
      }
    }

    return {
      status: 200,
      body: {
        ok: true,
        busSharing: !!(bus.active && bus.lat != null),
        distanceMeters: distance == null ? null : Math.round(distance),
        checkedIn: member.checkedIn,
        justCheckedIn,
      },
    };
  });

  res.status(result.status).json(result.body);
});

app.post('/api/navigator/panic', async (req, res) => {
  const { memberId, lat, lng } = req.body || {};

  const result = await withNavState((state) => {
    const member = state.members.find((m) => m.id === memberId);
    if (!member) return { status: 404, body: { error: 'not_found' } };

    const alert = {
      id: crypto.randomUUID(),
      memberId,
      memberName: member.name,
      lat: typeof lat === 'number' ? lat : member.lat,
      lng: typeof lng === 'number' ? lng : member.lng,
      createdAt: new Date().toISOString(),
      resolved: false,
    };
    state.alerts.push(alert);
    return { status: 201, body: alert };
  });

  res.status(result.status).json(result.body);
});

app.post('/api/navigator/resolve', async (req, res) => {
  const { alertId } = req.body || {};

  const result = await withNavState((state) => {
    const alert = state.alerts.find((a) => a.id === alertId);
    if (!alert) return { status: 404, body: { error: 'not_found' } };
    alert.resolved = true;
    return { status: 200, body: { ok: true } };
  });

  res.status(result.status).json(result.body);
});

app.get('/api/navigator/status', async (req, res) => {
  const state = await readNavState();
  res.json(state);
});

// --- Live bus location (Antonio's phone GPS, toggled on/off from admin) ---
// Staff turn this on only for the window it's needed (loading time). While
// active, riders' navigator pings are checked against this live location
// for hands-free check-in, and admin can watch it move in real time.

app.post('/api/bus-location/start', requireAdmin, async (req, res) => {
  await withNavState((state) => {
    state.busLocation.active = true;
  });
  res.json({ ok: true });
});

app.post('/api/bus-location/stop', requireAdmin, async (req, res) => {
  await withNavState((state) => {
    state.busLocation.active = false;
  });
  res.json({ ok: true });
});

app.post('/api/bus-location/ping', requireAdmin, async (req, res) => {
  const { lat, lng } = req.body || {};
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'lat and lng are required' });
  }

  await withNavState((state) => {
    state.busLocation.lat = lat;
    state.busLocation.lng = lng;
    state.busLocation.updatedAt = new Date().toISOString();
  });
  res.json({ ok: true });
});

app.get('/api/bus-location', async (req, res) => {
  const state = await readNavState();
  res.json(state.busLocation);
});

app.listen(PORT, () => {
  console.log(`Loopline server running at http://localhost:${PORT}`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`No ADMIN_PASSWORD set in .env — generated for this run: ${ADMIN_PASSWORD}`);
    console.log('Set ADMIN_PASSWORD in .env (copy .env.example) for a password that stays the same across restarts.');
  }
});
