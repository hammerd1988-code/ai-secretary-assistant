import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { config } from "./config.js";
import { store } from "./store.js";
import { processMessage } from "./pipeline/process.js";
import { buildStyleProfile, recordEditFeedback } from "./style/styleEngine.js";
import { VoiceBridge, twimlForIncomingCall } from "./voice/gateway.js";
import { isValidTwilioSignature } from "./voice/twilio.js";
import type { Persona } from "./types.js";

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });
await app.register(websocket);

app.get("/health", async () => ({ ok: true }));

// ── Text secretary (core module) ────────────────────────────────────────────

const inboundSchema = z.object({
  userId: z.string(),
  from: z.string(),
  contactName: z.string().optional(),
  body: z.string(),
  receivedAt: z.string().optional(),
  channel: z.enum(["sms", "virtual"]).default("sms"),
});

app.post("/messages/inbound", async (request, reply) => {
  const parsed = inboundSchema.parse(request.body);
  const result = await processMessage({
    id: randomUUID(),
    userId: parsed.userId,
    from: parsed.from,
    contactName: parsed.contactName,
    body: parsed.body,
    receivedAt: parsed.receivedAt ?? new Date().toISOString(),
    channel: parsed.channel,
  });
  return reply.send(result);
});

app.get("/messages", async (request) => {
  const { userId } = z.object({ userId: z.string() }).parse(request.query);
  return store.listMessages(userId);
});

app.get("/drafts", async (request) => {
  const { userId } = z.object({ userId: z.string() }).parse(request.query);
  return store.listDrafts(userId);
});

const draftActionSchema = z.object({
  action: z.enum(["approve", "dismiss", "edit"]),
  editedBody: z.string().optional(),
  inboundBody: z.string().optional(),
  userId: z.string(),
});

app.post("/drafts/:id", async (request, reply) => {
  const { id } = z.object({ id: z.string() }).parse(request.params);
  const parsed = draftActionSchema.parse(request.body);
  const draft = await store.getDraft(id);
  if (!draft) return reply.code(404).send({ error: "draft not found" });

  if (parsed.action === "dismiss") {
    return store.updateDraft(id, { status: "dismissed" });
  }
  const finalBody =
    parsed.action === "edit" && parsed.editedBody
      ? parsed.editedBody
      : draft.body;
  if (parsed.action === "edit" && parsed.editedBody && parsed.inboundBody) {
    await recordEditFeedback(parsed.userId, parsed.inboundBody, parsed.editedBody);
  }
  // Prototype: the mobile app performs the actual SMS send on-device;
  // marking as sent releases it to the app's outbox.
  return store.updateDraft(id, { status: "sent", body: finalBody });
});

app.get("/events", async (request) => {
  const { userId } = z.object({ userId: z.string() }).parse(request.query);
  return store.listEvents(userId);
});

app.post("/events/:id/confirm", async (request, reply) => {
  const { id } = z.object({ id: z.string() }).parse(request.params);
  const updated = await store.updateEvent(id, { status: "confirmed" });
  if (!updated) return reply.code(404).send({ error: "event not found" });
  return updated;
});

app.post("/events/:id/cancel", async (request, reply) => {
  const { id } = z.object({ id: z.string() }).parse(request.params);
  const updated = await store.updateEvent(id, { status: "cancelled" });
  if (!updated) return reply.code(404).send({ error: "event not found" });
  return updated;
});

// ── Style engine ─────────────────────────────────────────────────────────────

const historySchema = z.object({
  userId: z.string(),
  sentMessages: z.array(
    z.object({ inbound: z.string().optional(), reply: z.string() }),
  ),
});

app.post("/style/ingest", async (request) => {
  const parsed = historySchema.parse(request.body);
  return buildStyleProfile(parsed.userId, parsed.sentMessages);
});

app.get("/style/profile", async (request, reply) => {
  const { userId } = z.object({ userId: z.string() }).parse(request.query);
  const profile = await store.getStyleProfile(userId);
  if (!profile) return reply.code(404).send({ error: "no profile yet" });
  return profile;
});

// ── Settings & persona ───────────────────────────────────────────────────────

app.get("/settings", async (request) => {
  const { userId } = z.object({ userId: z.string() }).parse(request.query);
  return store.getSettings(userId);
});

const settingsSchema = z.object({
  userId: z.string(),
  autonomy: z.enum(["suggest", "auto_review", "full_auto"]),
  fullAutoContacts: z.array(z.string()).default([]),
  voiceEnabled: z.boolean().default(false),
  busyMode: z.boolean().default(false),
  personaId: z.string().optional(),
});

app.put("/settings", async (request) => {
  const parsed = settingsSchema.parse(request.body);
  await store.saveSettings(parsed);
  return parsed;
});

const personaSchema = z.object({
  userId: z.string(),
  name: z.string(),
  voice: z.string().default("alloy"),
  greeting: z.string(),
  instructions: z.string().default(""),
});

app.put("/persona", async (request) => {
  const parsed = personaSchema.parse(request.body);
  const persona: Persona = { id: randomUUID(), ...parsed };
  await store.savePersona(persona);
  return persona;
});

// ── Voice receptionist (optional module) ─────────────────────────────────────

app.post("/voice/incoming/:userId", async (request, reply) => {
  const { userId } = z.object({ userId: z.string() }).parse(request.params);
  if (config.twilioAuthToken) {
    const signature = request.headers["x-twilio-signature"] as
      | string
      | undefined;
    const url = `${config.publicBaseUrl}${request.raw.url}`;
    const params = (request.body ?? {}) as Record<string, string>;
    if (!isValidTwilioSignature(signature, url, params)) {
      return reply.code(403).send({ error: "invalid Twilio signature" });
    }
  }
  const settings = await store.getSettings(userId);
  if (!settings.voiceEnabled) {
    return reply
      .type("text/xml")
      .send(`<?xml version="1.0" encoding="UTF-8"?><Response><Reject/></Response>`);
  }
  return reply.type("text/xml").send(twimlForIncomingCall(userId));
});

app.get("/voice/stream/:userId", { websocket: true }, async (socket, request) => {
  const { userId } = z.object({ userId: z.string() }).parse(request.params);
  if (config.twilioAuthToken) {
    const signature = request.headers["x-twilio-signature"] as
      | string
      | undefined;
    const url = `${config.publicBaseUrl}${request.raw.url}`;
    if (!isValidTwilioSignature(signature, url)) {
      socket.close(1008, "invalid Twilio signature");
      return;
    }
  }
  const persona: Persona = (await store.getPersona(userId)) ?? {
    id: "default",
    userId,
    name: "Alex",
    voice: "alloy",
    greeting: "Hi, this is Alex, the assistant. How can I help you today?",
    instructions: "",
  };
  const settings = await store.getSettings(userId);
  new VoiceBridge(socket, userId, "unknown", persona, {
    busyMode: settings.busyMode,
  });
});

app.get("/calls", async (request) => {
  const { userId } = z.object({ userId: z.string() }).parse(request.query);
  return store.listCallSummaries(userId);
});

// ─────────────────────────────────────────────────────────────────────────────

app
  .listen({ port: config.port, host: config.host })
  .then(() => app.log.info(`Envoy server on :${config.port}`))
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
