import { z } from "zod";
import { completeJSON, completeText } from "../llm.js";
import { store } from "../store.js";
import type { InboundMessage, StyleProfile } from "../types.js";

const profileSchema = z.object({
  toneSummary: z.string(),
  greetings: z.array(z.string()),
  signoffs: z.array(z.string()),
  emojiFrequency: z.enum(["none", "rare", "frequent"]),
  avgLength: z.enum(["short", "medium", "long"]),
});

const PROFILE_SYSTEM = `You analyze a user's sent text messages and produce a writing-style profile.
Respond with JSON: {"toneSummary": "<2-3 sentences describing tone, vocabulary, punctuation habits>",
"greetings": [common openers], "signoffs": [common closers],
"emojiFrequency": "none"|"rare"|"frequent", "avgLength": "short"|"medium"|"long"}`;

export async function buildStyleProfile(
  userId: string,
  sentMessages: Array<{ inbound?: string; reply: string }>,
): Promise<StyleProfile> {
  const sample = sentMessages
    .slice(0, 200)
    .map((m) => m.reply)
    .join("\n---\n");
  const raw = await completeJSON<unknown>({
    system: PROFILE_SYSTEM,
    user: sample,
    schemaName: "style-profile",
  });
  const parsed = profileSchema.parse(raw);
  const exemplars = sentMessages
    .filter((m): m is { inbound: string; reply: string } => Boolean(m.inbound))
    .slice(0, 20);
  const profile: StyleProfile = { userId, ...parsed, exemplars };
  await store.saveStyleProfile(profile);
  return profile;
}

function fallbackProfile(userId: string): StyleProfile {
  return {
    userId,
    toneSummary:
      "Casual and friendly; concise sentences with light punctuation.",
    greetings: ["hey", "hi"],
    signoffs: [],
    emojiFrequency: "rare",
    avgLength: "short",
    exemplars: [],
  };
}

export async function draftStyledReply(
  message: InboundMessage,
  context?: string,
): Promise<string> {
  const profile =
    (await store.getStyleProfile(message.userId)) ??
    fallbackProfile(message.userId);

  const exemplarBlock = profile.exemplars
    .slice(0, 8)
    .map((e) => `Them: ${e.inbound}\nUser replied: ${e.reply}`)
    .join("\n\n");

  const system = `You draft text-message replies on behalf of a user, matching their personal writing style exactly.
Style profile: ${profile.toneSummary}
Typical greetings: ${profile.greetings.join(", ") || "(none)"}
Typical signoffs: ${profile.signoffs.join(", ") || "(none)"}
Emoji usage: ${profile.emojiFrequency}. Typical message length: ${profile.avgLength}.
${exemplarBlock ? `Examples of how the user replies:\n${exemplarBlock}` : ""}
Write ONLY the reply text, nothing else. Sound exactly like the user would.`;

  const user = `Incoming message from ${message.contactName ?? message.from}: "${message.body}"${
    context ? `\nContext: ${context}` : ""
  }`;

  return completeText({ system, user });
}

export async function recordEditFeedback(
  userId: string,
  inbound: string,
  finalReply: string,
): Promise<void> {
  const profile = (await store.getStyleProfile(userId)) ?? fallbackProfile(userId);
  profile.exemplars.unshift({ inbound, reply: finalReply });
  profile.exemplars = profile.exemplars.slice(0, 50);
  await store.saveStyleProfile(profile);
}
