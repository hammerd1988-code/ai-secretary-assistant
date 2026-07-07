import { z } from "zod";
import { completeJSON } from "../llm.js";
import type { Classification, InboundMessage } from "../types.js";

const classificationSchema = z.object({
  intent: z.enum([
    "scheduling",
    "needs_reply",
    "question",
    "spam",
    "fyi",
    "urgent",
  ]),
  urgency: z.enum(["low", "medium", "high"]),
  summary: z.string(),
});

const SYSTEM = `You are the triage engine of a personal AI secretary.
Classify the incoming text message. Respond with JSON:
{"intent": "scheduling"|"needs_reply"|"question"|"spam"|"fyi"|"urgent", "urgency": "low"|"medium"|"high", "summary": "<one sentence>"}
- "scheduling": proposes, changes, or asks about a meeting/appointment/event time.
- "urgent": time-sensitive matter needing immediate attention.
- "needs_reply": expects a response but is not scheduling or urgent.
- "question": asks for information the owner would need to provide.
- "spam": marketing, phishing, or robotexts.
- "fyi": informational, no response expected.`;

export async function classifyMessage(
  message: InboundMessage,
): Promise<Classification> {
  const raw = await completeJSON<unknown>({
    system: SYSTEM,
    user: `From: ${message.contactName ?? message.from}\nMessage: ${message.body}`,
    schemaName: "classification",
  });
  return classificationSchema.parse(raw);
}
