# Loopline — the Real Party Bus

Ticketing app/site for Mister Hennessy's "Happy Tuesdays" party bus event
(Disney College Program crowd, $12/ticket, pickup at Flamingo Crossing,
party at Rum Jungle). Umbrella brand: **Red Rum Design**. Feeds exposure
back to the parent company, Welcome Transportation.

## Status: Checkpoint 3 — calendar of events

What's here:

- `index.html` / `css/style.css` / `js/script.js` — single-page landing
  site with the real brand graphics (hero poster, flags, Mister Hennessy's
  photo), a ticket purchase form, the dare dice mini-feature, and a joke
  complaints section.
- `events.html` / `js/events.js` — calendar page listing upcoming Tuesdays
  from `data/events.json`. Each entry has its own **name + venue**, not
  just a date, so a given week can be "Happy Tuesdays @ Rum Jungle" one
  week and something else (e.g. "Water Wars", "Tailgate") another —
  edit `data/events.json` directly to rename/add/remove dates. Clicking
  "Get Tickets" on a card goes to `index.html?event=<id>#purchase`, which
  shows that specific event's name/date/venue above the purchase form and
  tags the resulting ticket with it. If no event is specified (e.g. the
  homepage's own "Get Tickets" button), it defaults to the soonest
  upcoming one.
- `server.js` / `ticketStore.js` / `eventsStore.js` — a small Express
  server (`npm start`) that serves the site AND a real ticketing API:
  - `GET /api/events` — upcoming events (today or later), soonest first.
  - `POST /api/tickets` — buys a ticket (name + email + optional
    eventId), generates a unique token + QR code, and snapshots which
    event it's for. **MOCK MODE**: no `STRIPE_SECRET_KEY` is set yet, so
    purchases are auto-approved with no real charge, mirroring the
    sibling `welcome-transportation-hub` repo's pattern exactly. Once a
    real Stripe test key is added, swap this for a Checkout Session using
    that repo's `src/payments.js` as the template — no other code needs
    to change.
  - `POST /api/checkin` — marks a ticket used by token; a second scan of
    the same token gets rejected (409), so a QR can't be reused. Tested.
  - `GET /api/tickets` — lists all tickets sold + which event + check-in
    status.
  - The last two require an `x-admin-password` header (see
    `.env.example` — default is `hennessy123`, change it before going
    live).
- `admin.html` — password-gated table of tickets sold, which event, and
  check-in status.
- `checkin.html` — password-gated door-staff page. Uses the phone/laptop
  camera (via jsQR) to scan a ticket's QR and check it in live; falls back
  to manual code entry if the camera isn't available/allowed.
- Data lives in `data/tickets.json` (gitignored — real names/emails
  shouldn't be committed) and `data/events.json` (committed — it's just
  the party schedule, edit it directly to change upcoming dates/themes).

Not built yet:

- Real Stripe charge (currently mock/auto-approved — see above).
- On-site walk-up sale + tap-to-pay for people without a pre-bought
  ticket.
- Audio (Sweet Caroline / Party in the USA — the calendar page is where
  the USA snippet should play on open) — no audio files provided yet.
- Flip-cup mini-game — **descoped per Antonio, not needed.**
- Party Navigator safety module (future Red Rum Design platform feature).

## Running it locally

```bash
npm install
npm start
```

Then open `http://localhost:5190`. Calendar: `/events.html`. Admin:
`/admin.html`. Check-in: `/checkin.html`. Default password:
`hennessy123` (set `ADMIN_PASSWORD` in `.env` to change it — copy
`.env.example` first).

## Next checkpoints (not yet built, in rough order)

1. Real Stripe Checkout (swap in for mock mode — see `server.js` comment;
   requires Antonio to create a Stripe account and get a test key first).
2. On-site walk-up sale + tap-to-pay (NFC) through the check-in device for
   people who didn't pre-buy, generating a ticket/QR on the spot.
3. Party-in-the-USA snippet playing when the calendar (`events.html`)
   opens.
4. Background audio (Sweet Caroline), once an audio file is provided.
5. Party Navigator safety module (buddy system, accountability tracking)
   — part of the broader Red Rum Design platform vision.

## Remaining brand images (not yet placed)

Saved in `C:\Users\welco\OneDrive\Documents\red rumn pics\`: the bulldog
mascot and the Red Rum Design wordmark graphic still need a home on the
site — placement wasn't obvious yet, ask Antonio where he wants them.
