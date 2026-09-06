# Loopline — the Real Party Bus

Ticketing app/site for Mister Hennessy's "Happy Tuesdays" party bus event
(Disney College Program crowd, $12/ticket, pickup at Flamingo Crossing,
party at Rum Jungle). Umbrella brand: **Red Rum Design**. Feeds exposure
back to the parent company, Welcome Transportation.

## Status: Checkpoint 6 — crowdfunded event proposals + a real calendar grid

What's here:

- `index.html` / `css/style.css` / `js/script.js` — single-page landing
  site with the real brand graphics (hero poster, flags, Mister Hennessy's
  photo), a ticket purchase form, the dare dice mini-feature, and a joke
  complaints section. **No background audio / no Party in the USA
  snippet — descoped per Antonio.** A calendar icon (top-left, always
  visible) opens `events.html` from every page.
- `events.html` / `js/events.js` / `css/calendar.css` — a real month-grid
  calendar (prev/next month, click a day to see that event and buy) plus
  the **crowdfunded proposal system**:
  - Anyone can **propose an event** (name, venue, price, how many pledges
    needed — default/minimum enforced server-side).
  - "Voting" is a real (mock) purchase — a **pledge** — not just a click.
    Progress bar shows pledges vs. threshold live.
  - Reaching the threshold does **not** auto-activate it — it flips to
    "reached" and waits for Antonio to activate from admin, so he keeps
    control over what actually gets scheduled.
  - Once activated, every pledge becomes a real ticket (with its own QR)
    automatically; pledgers retrieve theirs on this page via a token kept
    in their browser (no login).
  - The **proposer** can set the event's date once activated (also shown
    on this page, `localStorage`-authenticated by their own proposer
    token) — Antonio can also set/override it from admin, since he owns
    the actual bus schedule.
  - Cancelling before activation is allowed by the proposer or admin.
  - Verified the full lifecycle end-to-end: propose → pledge to threshold
    → blocked from normal purchase pre-activation → admin activates
    (tested via a real button click, not just the API) → pledges become
    tickets → pledger retrieves their QR → proposer sets the date →
    ticket records backfill that date → event shows correctly on the
    calendar grid.
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
  `/api/events/propose` + `/api/events/:id/{pledge,activate,set-date,
  cancel,my-ticket}`, `/api/navigator/*` (join, ping, panic, resolve,
  status), and `/api/bus-location/*` (start, stop, ping, status).
- `admin.html` — password-gated: ticket list (which event, online vs.
  walk-up, check-in status), a "Proposed & Pending Events" panel
  (activate/cancel/set-date), AND the bus-location toggle/tracker above.
- `checkin.html` — password-gated door-staff QR scanner (camera via
  jsQR, manual fallback).
- Data: `data/tickets.json` and `data/navigator.json` (now also holds
  live bus location) are gitignored — real names/emails/live locations
  shouldn't be committed. `data/events.json` **is** committed — it's
  just the schedule.

Not built yet:

- Real Stripe charge for pre-purchase, walk-up sale, AND pledges
  (currently all mock/auto-approved) — needs Antonio to create a Stripe
  account and get a test key first. A pledge should eventually be a real
  **authorize-now-capture-later** charge (Stripe supports this natively)
  so it's genuinely held in escrow until activation, not just recorded.
- Real card-present "tap" hardware/SDK integration (e.g. Stripe Terminal
  Tap to Pay) for the walk-up page — right now "tap" is a mocked pause,
  not an actual NFC read.
- Panic-button video isn't saved anywhere — it's a live local preview
  only. Recording + upload would need real storage and consent handling.
- Expected-back-by reminder banner (e.g. "bus is loading, you're not
  checked in yet") — the data (`checkedIn` per member) exists, but no
  countdown/reminder UI is built on top of it yet.
- No refund path if a proposal is cancelled after pledges came in — fine
  now since pledges aren't real charges yet, but needs real handling once
  Stripe is wired (void/cancel the authorization).
- Flip-cup mini-game — **descoped per Antonio, not needed.**

## Running it locally

```bash
npm install
npm start
```

Then open `http://localhost:5190`. Calendar: `/events.html`. Party
Navigator: `/navigator.html`. Admin: `/admin.html`. Check-in:
`/checkin.html`. Walk-up sale: `/sell.html`. **Staff password**: set
`ADMIN_PASSWORD` in `.env` (copy `.env.example` first) for a password
that stays the same across restarts — if you skip this, a random one is
generated each time you run `npm start` and printed to the terminal.

## Next checkpoints (not yet built, in rough order)

1. Real Stripe Checkout, real escrow-style pledges (authorize/capture),
   and real tap-to-pay hardware integration (swap in for mock mode — see
   `server.js` comments; requires Antonio to create a Stripe account and
   get a test key first).
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
