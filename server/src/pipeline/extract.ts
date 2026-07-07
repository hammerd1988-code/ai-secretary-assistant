import { z } from "zod";
import { completeJSON } from "../llm.js";
import type { ExtractedEvent, InboundMessage } from "../types.js";

const eventSchema = z.object({
  found: z.boolean(),
  title: z.string().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  location: z.string().optional(),
  attendees: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

const SYSTEM = `You extract calendar events from text messages for a personal AI secretary.
Today's date/time and the sender are provided. Resolve relative dates ("tomorrow at 2") to ISO 8601.
Respond with JSON: {"found": bool, "title": string, "startsAt": ISO8601, "endsAt": ISO8601 (optional), "location": string (optional), "attendees": [names], "notes": string (optional)}.
If no concrete event can be extracted, respond {"found": false}.`;

export async function extractEvent(
  message: InboundMessage,
  now: Date = new Date(),
): Promise<ExtractedEvent | undefined> {
  const raw = await completeJSON<unknown>({
    system: SYSTEM,
    user: `Now: ${now.toISOString()}\nFrom: ${message.contactName ?? message.from}\nMessage: ${message.body}`,
    schemaName: "event-extraction",
  });
  const parsed = eventSchema.parse(raw);
  if (!parsed.found || !parsed.title || !parsed.startsAt) return undefined;
  return {
    title: parsed.title,
    startsAt: parsed.startsAt,
    endsAt: parsed.endsAt,
    location: parsed.location,
    attendees: parsed.attendees ?? [message.contactName ?? message.from],
    notes: parsed.notes,
  };
}
