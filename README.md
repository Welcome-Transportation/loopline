# Loopline — the Real Party Bus

Ticketing app/site for Mister Hennessy's "Happy Tuesdays" party bus event
(Disney College Program crowd, $12/ticket, pickup at Flamingo Crossing,
party at Rum Jungle). Umbrella brand: **Red Rum Design**. Feeds exposure
back to the parent company, Welcome Transportation.

## Status: Checkpoint 5 — bus location comes from the driver's own phone

What's here:

- `index.html` / `css/style.css` / `js/script.js` — single-page landing
  site with the real brand graphics (hero poster, flags, Mister Hennessy's
  photo), a ticket purchase form, the dare dice mini-feature, and a joke
  complaints section. **No background audio / no Party in the USA
  snippet — descoped per Antonio.**
- `events.html` / `js/events.js` — calendar of upcoming Tuesdays, each
  with its own name + venue (edit `data/events.json` to change).
- `sell.html` / `js/sell.js` — staff-only **walk-up sale / "tap to pay"**
  page for people who didn't pre-buy. Staff hand the customer's phone or
  card to tap; in MOCK MODE this just simulates a brief "reading…" pause
  and issues the ticket immediately, marked `source: "onsite"` and
  **already checked in** (no separate scan needed — they're standing
  right there). Real contactless charging needs a Stripe key AND a card-
  present integration (Stripe Terminal Tap to Pay) — see "Not built yet."
- `navigator.html` / `js/navigator.js` / `css/navigator.css` — the
  **Party Navigator** safety module, opened via the bulldog button
  (bottom-right corner of the home and calendar pages):
  - **Join**: enter a first name once; a member id is kept in
    `localStorage` so the phone stays "you" across visits.
  - **Hands-free bus check-in**: while this page is open, the browser
    reports location every ~20s. If you're within ~150m of the **live
    bus location** (see below), the server marks you checked in
    automatically — **no QR scan, no manual input**, exactly as asked.
    (Verified via direct API calls: a ping far from the driver's location
    stays unchecked, a ping at the driver's exact location flips
    `checkedIn: true`; stopping bus-location sharing makes further
    check-ins impossible until it's turned back on.)
  - **Panic button**: sends your last known location as an alert every
    other group member can see, and opens your own camera locally so you
    can start documenting. The video is **not uploaded anywhere** — it's
    a live local preview only, nothing is recorded/stored server-side
    yet (see "Not built yet").
  - **Buddy list**: shows everyone who's joined, whether they're checked
    in, and how long since their last location update.
  - Any open panic alert shows a "View on Map" link (opens Google Maps at
    that location) and a "resolve" button once someone's got them.
  - This has **no strong per-user access control** — anyone with the
    memberId in their browser can see the group's live locations. Fine
    for "everyone physically on tonight's bus," not appropriate for
    anything more sensitive without real auth.
- **Live bus location, toggled from admin**: rather than a fixed pickup
  coordinate, the bus's location IS the driver's (Antonio's) phone GPS.
  On `admin.html`, a "Bus Location" panel has a **Start/Stop Sharing**
  toggle — turned on only for the window riders need to be found in
  (loading time). Whichever device clicks Start begins reporting its own
  GPS (`navigator.geolocation.watchPosition`) to `/api/bus-location/ping`
  every time it moves; that live point is what riders' hands-free
  check-in compares against. The same panel doubles as a **live tracker**
  for any other staff viewing admin — shows "last updated Xs ago" and a
  "View Current Location on Map" link. Turning sharing off immediately
  stops new hands-free check-ins (verified via API).
- **Reliability fix**: `ticketStore.js` and `navigatorStore.js` now
  serialize every read/write through an in-process queue. Without this,
  concurrent requests (many phones pinging at once, several purchases
  landing together) could interleave and corrupt `data/navigator.json`
  — this actually happened once during testing and crashed the server
  with `Unexpected end of JSON input`. Stress-tested afterward with 40+
  concurrent joins and a mix of pings/bus-location updates/ticket
  purchases firing at once — no crash, no lost data.
- `server.js` / `ticketStore.js` / `eventsStore.js` / `navigatorStore.js`
  — Express server (`npm start`) with the full API: `/api/events`,
  `/api/tickets` (+ `/api/tickets/onsite` for walk-ups), `/api/checkin`,
  `/api/navigator/*` (join, ping, panic, resolve, status), and
  `/api/bus-location/*` (start, stop, ping, status).
- `admin.html` — password-gated: ticket list (which event, online vs.
  walk-up, check-in status) AND the bus-location toggle/tracker above.
- `checkin.html` — password-gated door-staff QR scanner (camera via
  jsQR, manual fallback).
- Data: `data/tickets.json` and `data/navigator.json` (now also holds
  live bus location) are gitignored — real names/emails/live locations
  shouldn't be committed. `data/events.json` **is** committed — it's
  just the schedule.

Not built yet:

- Real Stripe charge for both pre-purchase and walk-up sale (currently
  mock/auto-approved) — needs Antonio to create a Stripe account and get
  a test key first.
- Real card-present "tap" hardware/SDK integration (e.g. Stripe Terminal
  Tap to Pay) for the walk-up page — right now "tap" is a mocked pause,
  not an actual NFC read.
- Panic-button video isn't saved anywhere — it's a live local preview
  only. Recording + upload would need real storage and consent handling.
- Expected-back-by reminder banner (e.g. "bus is loading, you're not
  checked in yet") — the data (`checkedIn` per member) exists, but no
  countdown/reminder UI is built on top of it yet.
- Flip-cup mini-game — **descoped per Antonio, not needed.**

## Running it locally

```bash
npm install
npm start
```

Then open `http://localhost:5190`. Calendar: `/events.html`. Party
Navigator: `/navigator.html`. Admin: `/admin.html`. Check-in:
`/checkin.html`. Walk-up sale: `/sell.html`. Default staff password:
`hennessy123` (set `ADMIN_PASSWORD` in `.env` to change it — copy
`.env.example` first).

## Next checkpoints (not yet built, in rough order)

1. Real Stripe Checkout + real tap-to-pay hardware integration (swap in
   for mock mode — see `server.js` comments; requires Antonio to create a
   Stripe account and get a test key first).
2. Expected-back-by reminder banner in the Party Navigator.
3. Party Navigator polish: notify group members even when they don't
   have the page open (would need push notifications / SMS — bigger
   lift), and a real "resolve" audit trail.
4. Flesh out the broader Red Rum Design platform vision beyond Loopline
   (per the original project brief) once Loopline itself is solid.

## Remaining brand images (not yet placed)

Saved in `C:\Users\welco\OneDrive\Documents\red rumn pics\`: the Red Rum
Design wordmark graphic still needs a home on the site — placement
wasn't obvious yet, ask Antonio where he wants it. (The bulldog is now
used as the Party Navigator button.)
