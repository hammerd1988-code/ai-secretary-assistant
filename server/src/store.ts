import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "./config.js";
import type {
  CalendarEvent,
  CallSummary,
  DraftReply,
  InboundMessage,
  Persona,
  StyleProfile,
  UserSettings,
} from "./types.js";

export interface Store {
  saveMessage(msg: InboundMessage): Promise<void>;
  listMessages(userId: string): Promise<InboundMessage[]>;
  saveDraft(draft: DraftReply): Promise<void>;
  updateDraft(id: string, patch: Partial<DraftReply>): Promise<DraftReply | undefined>;
  listDrafts(userId: string): Promise<DraftReply[]>;
  getDraft(id: string): Promise<DraftReply | undefined>;
  saveEvent(event: CalendarEvent): Promise<void>;
  updateEvent(id: string, patch: Partial<CalendarEvent>): Promise<CalendarEvent | undefined>;
  listEvents(userId: string): Promise<CalendarEvent[]>;
  getStyleProfile(userId: string): Promise<StyleProfile | undefined>;
  saveStyleProfile(profile: StyleProfile): Promise<void>;
  getSettings(userId: string): Promise<UserSettings>;
  saveSettings(settings: UserSettings): Promise<void>;
  getPersona(userId: string): Promise<Persona | undefined>;
  savePersona(persona: Persona): Promise<void>;
  saveCallSummary(summary: CallSummary): Promise<void>;
  listCallSummaries(userId: string): Promise<CallSummary[]>;
}

const DEFAULT_SETTINGS = (userId: string): UserSettings => ({
  userId,
  autonomy: "suggest",
  fullAutoContacts: [],
  voiceEnabled: false,
  busyMode: false,
});

class MemoryStore implements Store {
  private messages = new Map<string, InboundMessage>();
  private drafts = new Map<string, DraftReply>();
  private events = new Map<string, CalendarEvent>();
  private styles = new Map<string, StyleProfile>();
  private settings = new Map<string, UserSettings>();
  private personas = new Map<string, Persona>();
  private calls = new Map<string, CallSummary>();
  private messageOwner = new Map<string, string>();

  async saveMessage(msg: InboundMessage): Promise<void> {
    this.messages.set(msg.id, msg);
    this.messageOwner.set(msg.id, msg.userId);
  }
  async listMessages(userId: string): Promise<InboundMessage[]> {
    return [...this.messages.values()]
      .filter((m) => m.userId === userId)
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
  }
  async saveDraft(draft: DraftReply): Promise<void> {
    this.drafts.set(draft.id, draft);
  }
  async updateDraft(id: string, patch: Partial<DraftReply>): Promise<DraftReply | undefined> {
    const existing = this.drafts.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    this.drafts.set(id, updated);
    return updated;
  }
  async listDrafts(userId: string): Promise<DraftReply[]> {
    return [...this.drafts.values()]
      .filter((d) => this.messageOwner.get(d.messageId) === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async getDraft(id: string): Promise<DraftReply | undefined> {
    return this.drafts.get(id);
  }
  async saveEvent(event: CalendarEvent): Promise<void> {
    this.events.set(event.id, event);
  }
  async updateEvent(id: string, patch: Partial<CalendarEvent>): Promise<CalendarEvent | undefined> {
    const existing = this.events.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    this.events.set(id, updated);
    return updated;
  }
  async listEvents(userId: string): Promise<CalendarEvent[]> {
    return [...this.events.values()]
      .filter((e) => e.userId === userId)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }
  async getStyleProfile(userId: string): Promise<StyleProfile | undefined> {
    return this.styles.get(userId);
  }
  async saveStyleProfile(profile: StyleProfile): Promise<void> {
    this.styles.set(profile.userId, profile);
  }
  async getSettings(userId: string): Promise<UserSettings> {
    return this.settings.get(userId) ?? DEFAULT_SETTINGS(userId);
  }
  async saveSettings(settings: UserSettings): Promise<void> {
    this.settings.set(settings.userId, settings);
  }
  async getPersona(userId: string): Promise<Persona | undefined> {
    return this.personas.get(userId);
  }
  async savePersona(persona: Persona): Promise<void> {
    this.personas.set(persona.userId, persona);
  }
  async saveCallSummary(summary: CallSummary): Promise<void> {
    this.calls.set(summary.id, summary);
  }
  async listCallSummaries(userId: string): Promise<CallSummary[]> {
    return [...this.calls.values()]
      .filter((c) => c.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

class SupabaseStore extends MemoryStore {
  // Prototype note: persists a subset of entities to Supabase while
  // delegating everything else to the in-memory implementation.
  private client: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    super();
    this.client = createClient(url, serviceRoleKey);
  }

  override async saveMessage(msg: InboundMessage): Promise<void> {
    await super.saveMessage(msg);
    await this.client.from("messages").upsert({
      id: msg.id,
      user_id: msg.userId,
      from_number: msg.from,
      contact_name: msg.contactName ?? null,
      body: msg.body,
      received_at: msg.receivedAt,
      channel: msg.channel,
    });
  }

  override async saveCallSummary(summary: CallSummary): Promise<void> {
    await super.saveCallSummary(summary);
    await this.client.from("call_summaries").upsert({
      id: summary.id,
      user_id: summary.userId,
      caller_number: summary.callerNumber,
      caller_name: summary.callerName ?? null,
      reason: summary.reason ?? null,
      urgency: summary.urgency,
      callback_requested: summary.callbackRequested,
      message_for_user: summary.messageForUser ?? null,
      booked_event_id: summary.bookedEventId ?? null,
      transcript: summary.transcript,
      created_at: summary.createdAt,
    });
  }
}

export function createStore(): Store {
  if (config.supabaseUrl && config.supabaseServiceRoleKey) {
    return new SupabaseStore(config.supabaseUrl, config.supabaseServiceRoleKey);
  }
  return new MemoryStore();
}

export const store: Store = createStore();
