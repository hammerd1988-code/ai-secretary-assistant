import { randomUUID } from "node:crypto";
import { store } from "../store.js";
import type {
  CalendarEvent,
  DraftReply,
  InboundMessage,
  PipelineResult,
} from "../types.js";
import { classifyMessage } from "./classify.js";
import { extractEvent } from "./extract.js";
import { draftStyledReply } from "../style/styleEngine.js";

export async function processMessage(
  message: InboundMessage,
): Promise<PipelineResult> {
  await store.saveMessage(message);
  const settings = await store.getSettings(message.userId);
  const classification = await classifyMessage(message);
  const actions: string[] = [`classified as ${classification.intent}`];

  let proposedEvent: CalendarEvent | undefined;
  let draftReply: DraftReply | undefined;

  if (classification.intent === "spam") {
    actions.push("archived as spam");
    return { message, classification, actions };
  }

  if (classification.intent === "scheduling") {
    const extracted = await extractEvent(message);
    if (extracted) {
      proposedEvent = {
        ...extracted,
        id: randomUUID(),
        userId: message.userId,
        sourceMessageId: message.id,
        status: settings.autonomy === "full_auto" ? "confirmed" : "proposed",
      };
      await store.saveEvent(proposedEvent);
      actions.push(
        proposedEvent.status === "confirmed"
          ? `event "${extracted.title}" added to calendar`
          : `event "${extracted.title}" proposed for approval`,
      );
    }
  }

  const needsReply =
    classification.intent === "scheduling" ||
    classification.intent === "needs_reply" ||
    classification.intent === "question" ||
    classification.intent === "urgent";

  if (needsReply) {
    const context = proposedEvent
      ? `You are confirming the event "${proposedEvent.title}" at ${proposedEvent.startsAt}.`
      : undefined;
    const body = await draftStyledReply(message, context);
    const fullAuto =
      settings.autonomy === "full_auto" &&
      settings.fullAutoContacts.includes(message.from);
    draftReply = {
      id: randomUUID(),
      messageId: message.id,
      body,
      status: fullAuto ? "sent" : "pending",
      createdAt: new Date().toISOString(),
    };
    await store.saveDraft(draftReply);
    actions.push(
      fullAuto ? "reply sent automatically" : "reply drafted for approval",
    );
  }

  return { message, classification, draftReply, proposedEvent, actions };
}
