# Loopline — the Real Party Bus

Ticketing app/site for Mister Hennessy's "Happy Tuesdays" party bus event
(Disney College Program crowd, $12/ticket, pickup at Flamingo Crossing,
party at Rum Jungle). Umbrella brand: **Red Rum Design**. Feeds exposure
back to the parent company, Welcome Transportation.

## Status: Checkpoint 1 — static branded shell

What's here:

- `index.html` / `css/style.css` / `js/script.js` — single-page landing
  site with the visual identity (black/white/gold, red bus-sign detail,
  flags, joke complaints section, Santa corner easter egg) and a
  **decorative, non-functional** ticket/QR preview.
- No backend, no Stripe, no real QR generation/check-in yet — the
  "Get Tickets" button just scrolls to the preview.
- No audio (Sweet Caroline / Party in the USA) wired in yet — no audio
  files exist in the repo yet to point to.
- No mini-game (flip cup) yet.

Kept deliberately simple/flat so this checkpoint is easy to review over a
spotty connection. Structure leaves room to grow into:

- A `src/` ticketing module (Stripe checkout → ticket record → QR code)
  once payments are ready to build, likely mirroring the patterns already
  proven in the sibling `welcome-transportation-hub` repo.
- A live check-in scanner page for door staff.
- A `party-navigator/` module later (buddy-system panic signal, group
  accountability/check-in reminders) — part of the broader Red Rum Design
  platform vision, not built yet.
- Real photos/videos from Antonio dropped into `assets/images` and
  `assets/videos`.

## Running it locally

```bash
npx serve . -l 5190
```

## Next checkpoints (not yet built, in rough order)

1. Antonio's real bus photo(s)/video and brand graphics (poster, Mister
   Hennessy logo, Red Rum Design wordmark, flags graphic, etc.) swapped in
   for the placeholders — pending files from Antonio.
2. Calendar of events page — lists upcoming Happy Tuesdays (and future
   events) for people to pick from before buying a ticket. This is also
   where the Party-in-the-USA snippet plays on open. Needed before
   ticketing makes sense as more than one event exists.
3. Stripe ticket purchase flow (reuse patterns from
   `welcome-transportation-hub/src/payments.js`) — pre-purchase, generates
   a QR code per ticket.
4. Door/seller side of the app for staff on-site:
   - QR scanner that checks a ticket in and invalidates the code so it
     can't be reused.
   - On-site sale flow for walk-ups who didn't pre-purchase — tap-to-pay
     (NFC) through the same device, generating a ticket/QR on the spot.
   - Basic admin view of tickets sold / checked in.
5. Background audio (Sweet Caroline) + Party-in-the-USA snippet at a
   celebratory moment, once audio assets are provided.
6. Flip-cup mini-game — pass-and-play on one phone, players take turns,
   whoever loses (fails to flip the cup) takes a shot (real-life, not
   in-app).
7. Party Navigator safety module (buddy system, accountability tracking).
