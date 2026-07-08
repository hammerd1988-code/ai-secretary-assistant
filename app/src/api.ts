const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8787";
const USER_ID = "demo-user";

export interface DraftReply {
  id: string;
  messageId: string;
  body: string;
  status: "pending" | "approved" | "sent" | "dismissed" | "edited";
  createdAt: string;
}

export interface InboundMessage {
  id: string;
  from: string;
  contactName?: string;
  body: string;
  receivedAt: string;
}

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  location?: string;
  status: "proposed" | "confirmed" | "cancelled";
}

export interface CallSummary {
  id: string;
  callerNumber: string;
  callerName?: string;
  reason?: string;
  urgency: "low" | "medium" | "high";
  callbackRequested: boolean;
  messageForUser?: string;
  bookedEventId?: string;
  createdAt: string;
}

export interface UserSettings {
  userId: string;
  autonomy: "suggest" | "auto_review" | "full_auto";
  fullAutoContacts: string[];
  voiceEnabled: boolean;
  busyMode: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const api = {
  userId: USER_ID,
  listMessages: () => request<InboundMessage[]>(`/messages?userId=${USER_ID}`),
  listDrafts: () => request<DraftReply[]>(`/drafts?userId=${USER_ID}`),
  listEvents: () => request<CalendarEvent[]>(`/events?userId=${USER_ID}`),
  listCalls: () => request<CallSummary[]>(`/calls?userId=${USER_ID}`),
  getSettings: () => request<UserSettings>(`/settings?userId=${USER_ID}`),
  saveSettings: (settings: UserSettings) =>
    request<UserSettings>(`/settings`, {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
  actOnDraft: (
    id: string,
    action: "approve" | "dismiss" | "edit",
    editedBody?: string,
    inboundBody?: string,
  ) =>
    request<DraftReply>(`/drafts/${id}`, {
      method: "POST",
      body: JSON.stringify({ action, editedBody, inboundBody, userId: USER_ID }),
    }),
  confirmEvent: (id: string) =>
    request<CalendarEvent>(`/events/${id}/confirm`, {
      method: "POST",
      body: JSON.stringify({ userId: USER_ID }),
    }),
  cancelEvent: (id: string) =>
    request<CalendarEvent>(`/events/${id}/cancel`, {
      method: "POST",
      body: JSON.stringify({ userId: USER_ID }),
    }),
  savePersona: (persona: {
    name: string;
    voice: string;
    greeting: string;
    instructions: string;
  }) =>
    request(`/persona`, {
      method: "PUT",
      body: JSON.stringify({ userId: USER_ID, ...persona }),
    }),
  ingestStyle: (sentMessages: Array<{ inbound?: string; reply: string }>) =>
    request(`/style/ingest`, {
      method: "POST",
      body: JSON.stringify({ userId: USER_ID, sentMessages }),
    }),
  simulateInbound: (from: string, body: string) =>
    request(`/messages/inbound`, {
      method: "POST",
      body: JSON.stringify({ userId: USER_ID, from, body, channel: "sms" }),
    }),
};
