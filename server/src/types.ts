export type MessageIntent =
  | "scheduling"
  | "needs_reply"
  | "question"
  | "spam"
  | "fyi"
  | "urgent";

export type AutonomyLevel = "suggest" | "auto_review" | "full_auto";

export interface InboundMessage {
  id: string;
  userId: string;
  from: string;
  contactName?: string;
  body: string;
  receivedAt: string;
  channel: "sms" | "virtual";
}

export interface Classification {
  intent: MessageIntent;
  urgency: "low" | "medium" | "high";
  summary: string;
}

export interface ExtractedEvent {
  title: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  attendees: string[];
  notes?: string;
}

export interface DraftReply {
  id: string;
  messageId: string;
  body: string;
  status: "pending" | "approved" | "sent" | "dismissed" | "edited";
  createdAt: string;
}

export interface CalendarEvent extends ExtractedEvent {
  id: string;
  userId: string;
  sourceMessageId?: string;
  status: "proposed" | "confirmed" | "cancelled";
}

export interface StyleProfile {
  userId: string;
  toneSummary: string;
  greetings: string[];
  signoffs: string[];
  emojiFrequency: "none" | "rare" | "frequent";
  avgLength: "short" | "medium" | "long";
  exemplars: Array<{ inbound: string; reply: string }>;
}

export interface Persona {
  id: string;
  userId: string;
  name: string;
  voice: string;
  greeting: string;
  instructions: string;
}

export interface CallSummary {
  id: string;
  userId: string;
  callerNumber: string;
  callerName?: string;
  reason?: string;
  urgency: "low" | "medium" | "high";
  callbackRequested: boolean;
  transcript: string;
  createdAt: string;
}

export interface UserSettings {
  userId: string;
  autonomy: AutonomyLevel;
  fullAutoContacts: string[];
  voiceEnabled: boolean;
  personaId?: string;
}

export interface PipelineResult {
  message: InboundMessage;
  classification: Classification;
  draftReply?: DraftReply;
  proposedEvent?: CalendarEvent;
  actions: string[];
}
