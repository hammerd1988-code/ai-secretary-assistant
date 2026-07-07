# Envoy — AI Secretary

A mobile AI secretary that reads your texts, replies in your voice, and schedules
your calendar automatically — with an optional voice module where a lifelike AI
persona answers your phone calls.

**The text secretary is the core product.** The voice receptionist is a fully
optional, opt-in add-on: users who only want text triage and style-matched
replies get a complete product without ever touching voice.

See [`docs/PLAN.md`](docs/PLAN.md) for the full product & architecture plan.

## Structure

| Path | Description |
|------|-------------|
| `server/` | Node.js/TypeScript backend (Fastify): message pipeline, style engine, voice gateway |
| `app/` | Expo / React Native mobile app: inbox, approval queue, call summaries, settings |
| `supabase/migrations/` | Database schema for a dedicated Supabase project |

## Backend (`server/`)

```bash
cd server
cp .env.example .env   # set OPENAI_API_KEY (Supabase/Twilio optional)
npm install
npm run dev            # http://localhost:8787
```

Key endpoints:
- `POST /messages/inbound` — run a text through the pipeline (classify → extract event → draft styled reply)
- `GET /drafts` / `POST /drafts/:id` — approval queue (approve / edit / dismiss)
- `GET /events`, `POST /events/:id/confirm|cancel` — proposed calendar events
- `POST /style/ingest` — build a style profile from the user's sent-message history
- `PUT /settings` — autonomy level (`suggest` / `auto_review` / `full_auto`), voice on/off
- `POST /voice/incoming/:userId` — Twilio webhook (returns TwiML `<Connect><Stream>`)
- `GET /voice/stream/:userId` — WebSocket bridging Twilio Media Streams ⇄ OpenAI Realtime

Try the pipeline:

```bash
curl -X POST localhost:8787/messages/inbound \
  -H "Content-Type: application/json" \
  -d '{"userId":"demo-user","from":"+15551234567","contactName":"Sam","body":"Hey! Want to grab lunch tomorrow at noon at Blue Bottle?"}'
```

## Mobile app (`app/`)

```bash
cd app
npm install
npm start              # Expo dev server; press "a" for Android emulator
```

`EXPO_PUBLIC_API_URL` points the app at the backend (defaults to
`http://10.0.2.2:8787` — the Android emulator's host loopback).

The Android SMS role integration (default-SMS-app / native Kotlin module) is the
next milestone; the current prototype exercises the full pipeline via the
`POST /messages/inbound` endpoint.

## Supabase

Create a **dedicated Supabase project** for this app (separate from other
projects), then apply `supabase/migrations/0001_init.sql`. The backend uses
Supabase when `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are set and falls
back to an in-memory store for local development.

## Voice module (optional)

1. Buy a Twilio number; set its Voice webhook to `POST {PUBLIC_BASE_URL}/voice/incoming/{userId}`.
2. User enables conditional call forwarding (busy/no-answer) from their real number to the Twilio number.
3. Calls stream via Twilio Media Streams to the OpenAI Realtime API (speech-to-speech, G.711 u-law) with barge-in support; a post-call summary lands in the app's Calls tab.
