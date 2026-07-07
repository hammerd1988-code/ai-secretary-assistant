# AI Secretary — Product & Architecture Plan

**Working name:** "Envoy" (placeholder — easy to rebrand)
**One-liner:** A mobile AI secretary that reads your texts, replies in your voice, and schedules your calendar automatically — with an optional add-on where a lifelike AI persona answers your phone calls.

**Product framing:** The **text secretary is the core product** — every user gets full value from text triage, style-matched replies, and calendar automation alone. The **voice answering service is a fully optional module**: it's off by default, enabled per-user, and priced as an add-on/higher tier. A user who never touches voice still gets a complete product.

---

## 1. Product Overview

### Core Features (v1)

**Core module — Text Secretary (every user):**
| # | Feature | Platform | How |
|---|---------|----------|-----|
| 1 | Read & evaluate incoming SMS | Android-native | Android SMS APIs (default-SMS-app or SMS role) |
| 2 | Style-learned auto-replies ("sounds like me") | Android-native (SMS) + both (virtual number) | Style profile built from user's sent-message history, few-shot + fine-tune |
| 3 | Autonomous calendar scheduling from message content | Both | LLM extraction → Google Calendar API (Android) / EventKit (iOS later) |
| 4 | Secretarial actions (reminders, follow-ups, contact notes) | Both | Agent tool-calling on backend |
| 5 | Smart triage & prioritization (urgent / needs-reply / spam / FYI) | Android-native | LLM classifier + per-contact rules |

**Optional module — Voice Receptionist (opt-in add-on):**
| # | Feature | Platform | How |
|---|---------|----------|-----|
| 6 | AI persona answers phone calls in real time | Both | Conditional call forwarding → Twilio number → realtime voice AI |
| 7 | Caller info capture & summaries | Both | Post-call structured extraction → notification + inbox card |

Onboarding asks which modules the user wants; voice setup (forwarding, persona voice) is only shown if enabled and can be added later from settings.

### User Flow (happy path)
1. Onboard → sign in → grant SMS/contacts/calendar permissions (Android) → set autonomy level → (optionally) enable Voice Receptionist and pick a persona voice & name.
2. If voice is enabled: app walks user through dialing the carrier forwarding code (e.g. `*61*<twilio-number>#` for forward-on-no-answer) — one tap. Text-only users skip this entirely.
3. Incoming text → on-device app forwards to backend → LLM classifies intent (scheduling / needs-reply / spam / FYI) → takes action per autonomy settings.
4. (Voice users only) Missed/declined call → forwards to Twilio → AI persona answers, converses, gathers name/reason/callback info → user gets an instant summary card + optional calendar event.
5. Daily digest: everything the secretary did, with undo.

### Autonomy Levels (key trust feature)
- **Suggest** — drafts replies/events, user approves with one tap (default).
- **Auto with review window** — sends after N minutes unless cancelled.
- **Full auto** — per-contact allowlist (e.g. full auto for family, suggest-only for unknown numbers).

---

## 2. Platform Strategy (as chosen: hybrid)

### Android-native SMS path
- App requests the **SMS Role / default-SMS-app** status to read + send SMS.
- **Google Play policy**: SMS permissions are restricted; approved use cases include "device automation" and assistant-type apps. We apply via the Play Console permissions declaration. Fallback if rejected: Notification Listener API (read-only) + share-sheet reply, or distribute the full version outside Play (direct APK / alternative stores) while the Play build uses the notification-listener mode.
- All SMS processing consented + user-initiated; data encrypted in transit and at rest.

### Virtual-number path (both platforms, and all calls)
- Each user gets (or ports texting to) a **Twilio number**.
- Calls: user enables **conditional call forwarding** (busy/no-answer/unreachable) from their real number to the Twilio number → zero missed calls, AI answers everything the user doesn't.
- iOS users can also give out the virtual number directly as their "work/public" line; the app becomes a full softphone (Twilio Voice SDK) so they can take over a live AI call ("barge-in").

---

## 3. Architecture

```
┌─────────────── Mobile App (React Native / Expo) ───────────────┐
│ Onboarding · Inbox (unified SMS+call cards) · Approval queue   │
│ Persona picker · Autonomy settings · Softphone (Twilio SDK)    │
│ Android module: SmsReceiver / SmsSender (Kotlin native module) │
└───────────────────────────┬────────────────────────────────────┘
                            │ HTTPS / WebSocket
┌───────────────────────────▼────────────────────────────────────┐
│                    Backend (Node.js/TS)                        │
│  ├─ Message Pipeline: classify → extract → act → notify        │
│  ├─ Style Engine: per-user style profile (embeddings +         │
│  │   few-shot exemplars; optional fine-tune at scale)          │
│  ├─ Agent tools: calendar.create, reply.send, contact.note,    │
│  │   reminder.set, event.reschedule                            │
│  ├─ Voice Gateway: Twilio Media Streams ⇄ OpenAI Realtime API  │
│  │   (speech-to-speech, ~300–600 ms latency, natural voice)    │
│  └─ Billing: Stripe / RevenueCat subscriptions + usage caps    │
├────────────────────────────────────────────────────────────────┤
│  Supabase (Postgres + Auth + Realtime): users, style profiles, │
│  message log, call transcripts, events, usage metering, RLS    │
└────────────────────────────────────────────────────────────────┘
```

### Real-time voice call flow (latency-critical)
1. Twilio receives forwarded call → webhook → `<Connect><Stream>` opens a bidirectional Media Stream (WebSocket) to our Voice Gateway.
2. Gateway bridges audio to **OpenAI Realtime API** (speech-to-speech model, `gpt-4o-realtime` class) — single-model S2S avoids the STT→LLM→TTS pipeline and keeps round-trip ~300–600 ms, i.e. human-like turn-taking. Supports barge-in natively.
3. Persona = system prompt (name, tone, what to disclose) + selected voice. The AI is instructed to identify itself honestly if asked, gather: caller name, reason, urgency, callback preference.
4. During the call the model can call tools live: check the user's calendar availability, book a tentative slot, take a message.
5. Call ends → transcript → structured summary → push notification + inbox card; optional auto-created calendar event.
6. Fallback vendors if needed: Deepgram (STT) + ElevenLabs Flash (TTS) pipeline, or LiveKit Agents framework.

### Style-learning engine
1. With consent, ingest user's sent SMS history (Android) → build a **style profile**: tone markers, greeting/sign-off habits, emoji/punctuation frequency, typical message length, per-contact register (formal vs. casual).
2. Reply generation = base LLM + style profile summary + top-k retrieved past replies to similar messages (embedding search) as few-shot exemplars.
3. Every user edit of a suggested reply is a training signal → profile continuously improves.
4. At scale: optional per-user LoRA/fine-tune tier ("Pro" differentiator).

### Calendar/secretarial pipeline
- Intent classifier on each inbound message → if scheduling-related, extract (title, time, place, attendees) → check conflicts via Google Calendar API → create/propose event → confirm back to sender in user's style ("works for me, see you at 2").
- Also handles: reschedules, reminders, "send me that address" type fetches, follow-up nudges.

---

## 4. Monetization

| Tier | Price (suggested) | Includes |
|------|-------------------|----------|
| Free trial | 14 days | Full features, capped (30 AI replies, 15 min call time) |
| **Text** | $6.99/mo | Unlimited text triage, style-matched replies, calendar automation — no voice |
| **Text + Voice** | $14.99/mo | Everything in Text + 60 AI call min/mo |
| **Pro** | $24.99/mo | 300 call min, custom voice clone persona, priority latency, fine-tuned style model |
| Overage | $0.15/call-min | Beyond plan minutes |

The text-only tier is expected to be the volume plan; voice is the upsell — pricing and onboarding are structured so text-only users never feel like they bought half a product.

- Unit economics: OpenAI Realtime ≈ $0.06–0.10/min + Twilio ≈ $0.01–0.02/min → healthy margin at $0.15+/min effective.
- Billing via RevenueCat (handles Play/App Store subscriptions + Stripe for web).
- Later: B2B tier (small businesses: AI receptionist) — same infra, higher ARPU.

## 5. Compliance & Trust (must-haves)
- **Call recording/AI disclosure**: two-party-consent states (CA, etc.) require disclosure — persona opens with a natural line like "Hi, this is Alex, Dan's assistant — I can take a message or help you schedule." Configurable disclosure per jurisdiction; transcripts encrypted.
- **Google Play SMS policy**: permissions declaration + privacy policy + in-app prominent disclosure.
- **Data**: E2E TLS, at-rest encryption, per-user RLS in Supabase, delete-my-data flow, no training on user data across accounts.
- AI never impersonates the user deceptively on calls by default (persona is an "assistant"); text replies in the user's voice are user-configured behavior.

## 6. Tech Stack Summary
- **Mobile**: React Native (Expo, dev-client) + Kotlin native module for SMS role; Twilio Voice SDK for softphone/barge-in.
- **Backend**: Node.js/TypeScript (Fastify), WebSockets for the voice gateway; deploy on Fly.io/Railway (low-latency regions).
- **AI**: OpenAI Realtime API (voice), GPT-4o class for triage/replies, embeddings for style retrieval. Fallbacks: Deepgram + ElevenLabs.
- **Data/Auth**: Supabase.
- **Telephony**: Twilio (numbers, forwarding, media streams).
- **Billing**: RevenueCat + Stripe.

## 7. Roadmap

**Phase 1 — MVP (target ~3–4 weeks of build)**
- **Text secretary first (weeks 1–2):** Android app with SMS read/send, unified inbox, approval queue, Google auth + Calendar; backend message pipeline (classify → schedule/draft reply) and style profile (few-shot). This alone is a shippable, sellable product.
- **Voice module second (weeks 3–4):** Twilio number + forwarding setup flow + OpenAI Realtime persona answering, post-call summary — built as an opt-in module on top.
- Billing scaffold (trial gate, text vs. text+voice tiers).

**Phase 2 — Style depth + iOS**
- Style engine v2 (edit-feedback loop, per-contact register), iOS app (virtual-number mode, softphone, calendar), voice persona library + custom voice clone (Pro).

**Phase 3 — Monetize & scale**
- Play Store SMS policy approval, RevenueCat tiers live, B2B receptionist mode, analytics/digest, multi-language.

## 8. Key Risks
1. **Play Store SMS approval** — mitigation: notification-listener fallback build + direct-APK distribution of full version.
2. **Voice latency at scale** — mitigation: regional gateway deployment, vendor fallback, latency budget monitoring.
3. **Carrier forwarding UX friction** — mitigation: auto-generate the exact `*61*` dial string per carrier, in-app verification call.
4. **LLM misfires (wrong event, bad reply)** — mitigation: default "Suggest" autonomy, review window, per-contact allowlists, one-tap undo.

---

**Decision needed to start the MVP:** approve this plan (or request changes), and confirm: new dedicated repo (suggested: `ai-secretary` or a name you pick) vs. inside BSC-V3. I'd also need a Twilio account/key when we reach the voice phase (OpenAI + Supabase keys you already have on file can be reused or new ones created for this product).
