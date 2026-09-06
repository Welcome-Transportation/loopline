# Loopline — the Real Party Bus

Ticketing app/site for Mister Hennessy's "Happy Tuesdays" party bus event
(Disney College Program crowd, $12/ticket, pickup at Flamingo Crossing,
party at Rum Jungle). Umbrella brand: **Red Rum Design**. Feeds exposure
back to the parent company, Welcome Transportation.

## Status: Checkpoint 2 — real ticket purchasing + admin/check-in

What's here:

- `index.html` / `css/style.css` / `js/script.js` — single-page landing
  site with the real brand graphics (hero poster, flags, Mister Hennessy's
  photo), the dare dice mini-feature, and a joke complaints section.
- `server.js` / `ticketStore.js` — a small Express server (`npm start`)
  that serves the site AND a real ticketing API:
  - `POST /api/tickets` — buys a ticket (name + email), generates a unique
    token + QR code. **MOCK MODE**: no `STRIPE_SECRET_KEY` is set yet, so
    purchases are auto-approved with no real charge, mirroring the
    sibling `welcome-transportation-hub` repo's pattern exactly. Once a
    real Stripe test key is added, swap this for a Checkout Session using
    that repo's `src/payments.js` as the template — no other code needs
    to change.
  - `POST /api/checkin` — marks a ticket used by token; a second scan of
    the same token gets rejected (409), so a QR can't be reused. Tested.
  - `GET /api/tickets` — lists all tickets sold + check-in status.
  - Both admin endpoints require an `x-admin-password` header (see
    `.env.example` — default is `hennessy123`, change it before going
    live).
- `admin.html` — password-gated table of tickets sold / checked in.
- `checkin.html` — password-gated door-staff page. Uses the phone/laptop
  camera (via jsQR) to scan a ticket's QR and check it in live; falls back
  to manual code entry if the camera isn't available/allowed.
- Data is stored in `data/tickets.json` (gitignored — real ticket data
  shouldn't be committed).

Not built yet:

- Real Stripe charge (currently mock/auto-approved — see above).
- On-site walk-up sale + tap-to-pay for people without a pre-bought
  ticket.
- Calendar of events page (see below).
- Audio (Sweet Caroline / Party in the USA) — no audio files provided yet.
- Flip-cup mini-game — **descoped per Antonio, not needed.**
- Party Navigator safety module (future Red Rum Design platform feature).

## Running it locally

```bash
npm install
npm start
```

Then open `http://localhost:5190`. Admin: `http://localhost:5190/admin.html`.
Check-in: `http://localhost:5190/checkin.html`. Default password:
`hennessy123` (set `ADMIN_PASSWORD` in `.env` to change it — copy
`.env.example` first).

## Next checkpoints (not yet built, in rough order)

1. Real Stripe Checkout (swap in for mock mode — see `server.js` comment).
2. On-site walk-up sale + tap-to-pay (NFC) through the check-in device for
   people who didn't pre-buy, generating a ticket/QR on the spot.
3. Calendar of events page — lists upcoming parties for people to pick
   from before buying. Each date can have its own theme/venue name (not
   always "Rum Jungle" — e.g. "Water Wars", "Tailgate"), so the calendar
   needs a name + date per event, not just a date. This is also where the
   Party-in-the-USA snippet plays on open.
4. Background audio (Sweet Caroline) + Party-in-the-USA snippet, once
   audio assets are provided.
5. Party Navigator safety module (buddy system, accountability tracking)
   — part of the broader Red Rum Design platform vision.

## Remaining brand images (not yet placed)

Saved in `C:\Users\welco\OneDrive\Documents\red rumn pics\`: the bulldog
mascot and the Red Rum Design wordmark graphic still need a home on the
site — placement wasn't obvious yet, ask Antonio where he wants them.
