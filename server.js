const express = require('express');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { readTickets, writeTickets } = require('./ticketStore');
const { readUpcomingEvents, findEventById } = require('./eventsStore');

const PORT = process.env.PORT || 5190;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'hennessy123';
const TICKET_PRICE = 12;

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
      .map(({ id, name, email, eventName, eventDate, paid, checkedIn, checkedInAt, createdAt }) => ({
        id, name, email, eventName, eventDate, paid, checkedIn, checkedInAt, createdAt,
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

app.listen(PORT, () => {
  console.log(`Loopline server running at http://localhost:${PORT}`);
});
