const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { readTickets, writeTickets } = require('./ticketStore');
const { readUpcomingEvents, findEventById } = require('./eventsStore');
const { readState: readNavState, writeState: writeNavState } = require('./navigatorStore');

const PORT = process.env.PORT || 5190;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'hennessy123';
const TICKET_PRICE = 12;

// PLACEHOLDER: approximate downtown Winter Garden, FL. Replace with the
// exact pickup spot (Domino's, Herzog Road near Western Way) — right-click
// the spot on Google Maps and copy the lat/lng shown there.
const BUS_LOCATION = { lat: 28.5647, lng: -81.5862 };
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
  res.json(events);
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
  if (!event) {
    const upcoming = await readUpcomingEvents();
    event = upcoming[0] || null;
  }

  const tickets = await readTickets();
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
  tickets.push(ticket);
  await writeTickets(tickets);

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
  const tickets = await readTickets();
  const ticket = tickets.find((t) => t.token === token);

  if (!ticket) {
    return res.status(404).json({ ok: false, error: 'not_found' });
  }
  if (ticket.checkedIn) {
    return res.status(409).json({
      ok: false,
      error: 'already_used',
      name: ticket.name,
      checkedInAt: ticket.checkedInAt,
    });
  }

  ticket.checkedIn = true;
  ticket.checkedInAt = new Date().toISOString();
  await writeTickets(tickets);
  res.json({ ok: true, name: ticket.name });
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

  const tickets = await readTickets();
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
  tickets.push(ticket);
  await writeTickets(tickets);

  res.status(201).json({ id: ticket.id, name: ticket.name, eventName: ticket.eventName });
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

  const state = await readNavState();
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
  state.members.push(member);
  await writeNavState(state);

  res.status(201).json({ memberId: member.id });
});

app.post('/api/navigator/ping', async (req, res) => {
  const { memberId, lat, lng } = req.body || {};
  if (!memberId || typeof lat !== 'number' || typeof lng !== 'number') {
    return res.status(400).json({ error: 'memberId, lat, and lng are required' });
  }

  const state = await readNavState();
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return res.status(404).json({ error: 'not_found' });

  member.lat = lat;
  member.lng = lng;
  member.updatedAt = new Date().toISOString();

  const distance = metersBetween({ lat, lng }, BUS_LOCATION);
  const nowNearBus = distance <= CHECKIN_RADIUS_METERS;
  let justCheckedIn = false;
  if (nowNearBus && !member.checkedIn) {
    member.checkedIn = true;
    member.checkedInAt = member.updatedAt;
    justCheckedIn = true;
  }

  await writeNavState(state);
  res.json({ ok: true, distanceMeters: Math.round(distance), checkedIn: member.checkedIn, justCheckedIn });
});

app.post('/api/navigator/panic', async (req, res) => {
  const { memberId, lat, lng } = req.body || {};
  const state = await readNavState();
  const member = state.members.find((m) => m.id === memberId);
  if (!member) return res.status(404).json({ error: 'not_found' });

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
  await writeNavState(state);

  res.status(201).json(alert);
});

app.post('/api/navigator/resolve', async (req, res) => {
  const { alertId } = req.body || {};
  const state = await readNavState();
  const alert = state.alerts.find((a) => a.id === alertId);
  if (!alert) return res.status(404).json({ error: 'not_found' });

  alert.resolved = true;
  await writeNavState(state);
  res.json({ ok: true });
});

app.get('/api/navigator/status', async (req, res) => {
  const state = await readNavState();
  res.json(state);
});

app.listen(PORT, () => {
  console.log(`Loopline server running at http://localhost:${PORT}`);
});
