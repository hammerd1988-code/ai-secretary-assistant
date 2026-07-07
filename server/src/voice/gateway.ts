import { randomUUID } from "node:crypto";
import WebSocket from "ws";
import { config } from "../config.js";
import { store } from "../store.js";
import { completeJSON } from "../llm.js";
import { z } from "zod";
import type { CalendarEvent, Persona } from "../types.js";

/**
 * Bridges a Twilio Media Stream (G.711 u-law, 8kHz) to the OpenAI Realtime
 * API for speech-to-speech conversation. One instance per live call.
 */
export interface VoiceBridgeOptions {
  busyMode?: boolean;
}

export class VoiceBridge {
  private twilio: WebSocket;
  private openai?: WebSocket;
  private streamSid?: string;
  private transcript: string[] = [];
  private userId: string;
  private callerNumber: string;
  private persona: Persona;
  private busyMode: boolean;
  private bookedEventIds: string[] = [];

  constructor(
    twilioSocket: WebSocket,
    userId: string,
    callerNumber: string,
    persona: Persona,
    options: VoiceBridgeOptions = {},
  ) {
    this.twilio = twilioSocket;
    this.userId = userId;
    this.callerNumber = callerNumber;
    this.persona = persona;
    this.busyMode = options.busyMode ?? false;
    this.twilio.on("message", (data) => this.onTwilioMessage(data));
    this.twilio.on("close", () => this.teardown());
  }

  private connectOpenAI(): void {
    this.openai = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${config.openaiRealtimeModel}`,
      {
        headers: {
          Authorization: `Bearer ${config.openaiApiKey}`,
          "OpenAI-Beta": "realtime=v1",
        },
      },
    );

    this.openai.on("open", () => {
      this.openai?.send(
        JSON.stringify({
          type: "session.update",
          session: {
            modalities: ["audio", "text"],
            voice: this.persona.voice,
            input_audio_format: "g711_ulaw",
            output_audio_format: "g711_ulaw",
            input_audio_transcription: { model: "whisper-1" },
            turn_detection: { type: "server_vad" },
            instructions: this.buildInstructions(),
            tools: [
              {
                type: "function",
                name: "book_appointment",
                description:
                  "Add an appointment to the user's calendar once the caller has agreed on what it's for and when. Use ISO 8601 date-times.",
                parameters: {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    startsAt: {
                      type: "string",
                      description: "ISO 8601 start date-time",
                    },
                    endsAt: {
                      type: "string",
                      description: "ISO 8601 end date-time (optional)",
                    },
                    location: { type: "string" },
                    notes: { type: "string" },
                  },
                  required: ["title", "startsAt"],
                },
              },
            ],
            tool_choice: "auto",
          },
        }),
      );
      this.openai?.send(
        JSON.stringify({
          type: "response.create",
          response: {
            instructions: `Greet the caller: "${this.persona.greeting}"`,
          },
        }),
      );
    });

    this.openai.on("message", (data) => this.onOpenAIMessage(data));
    this.openai.on("close", () => this.teardown());
    this.openai.on("error", () => this.teardown());
  }

  private buildInstructions(): string {
    const busyBlock = this.busyMode
      ? `\nThe user is busy right now and can't take the call. Early in the
conversation, casually let the caller know ("they're tied up at the moment,
but I can help") — don't apologize repeatedly. Focus on capturing anything
important they'd like passed along.`
      : "";
    return `${this.persona.instructions}
You are ${this.persona.name}, a phone assistant answering on behalf of the user.${busyBlock}
Sound like a real, down-to-earth person on the phone — never like a bot:
- Talk casually and warmly, the way a friendly coworker would. Use natural
  spoken rhythm: short sentences, contractions ("I'll", "he's"), and the
  occasional filler ("sure thing", "oh gotcha", "hmm, let me see").
- React to what the caller says ("oh no, sorry to hear that") instead of
  marching through a script. One question at a time; keep turns brief so the
  caller can jump in.
- Never use corporate or robotic phrasing ("your call is important",
  "I am processing your request"). No lists, no monologues.
Goals:
- Learn the caller's name, the reason for the call, its urgency, and whether
  they want a callback.
- If the caller wants to set up an appointment or meeting, casually pin down
  what it's for and when, then call the book_appointment tool and confirm out
  loud ("cool, I've got you down for Friday at 2").
- Before wrapping up, ask if there's anything they'd like passed along to the
  user, and make sure you've captured it.
Today's date-time is ${new Date().toISOString()}.
If asked whether you are an AI, answer honestly and casually. Do not share the
user's private information.`;
  }

  private onTwilioMessage(data: WebSocket.RawData): void {
    const msg = JSON.parse(data.toString()) as {
      event: string;
      start?: { streamSid: string };
      media?: { payload: string };
    };
    switch (msg.event) {
      case "start":
        this.streamSid = msg.start?.streamSid;
        this.connectOpenAI();
        break;
      case "media":
        if (this.openai?.readyState === WebSocket.OPEN && msg.media) {
          this.openai.send(
            JSON.stringify({
              type: "input_audio_buffer.append",
              audio: msg.media.payload,
            }),
          );
        }
        break;
      case "stop":
        this.teardown();
        break;
    }
  }

  private onOpenAIMessage(data: WebSocket.RawData): void {
    const event = JSON.parse(data.toString()) as {
      type: string;
      delta?: string;
      transcript?: string;
      name?: string;
      call_id?: string;
      arguments?: string;
    };
    switch (event.type) {
      case "response.audio.delta":
        if (this.twilio.readyState === WebSocket.OPEN && event.delta) {
          this.twilio.send(
            JSON.stringify({
              event: "media",
              streamSid: this.streamSid,
              media: { payload: event.delta },
            }),
          );
        }
        break;
      case "conversation.item.input_audio_transcription.completed":
        if (event.transcript) this.transcript.push(`Caller: ${event.transcript}`);
        break;
      case "response.audio_transcript.done":
        if (event.transcript)
          this.transcript.push(`${this.persona.name}: ${event.transcript}`);
        break;
      case "response.function_call_arguments.done":
        if (event.name === "book_appointment" && event.call_id) {
          void this.onBookAppointment(event.call_id, event.arguments ?? "{}");
        }
        break;
      case "input_audio_buffer.speech_started":
        // Barge-in: caller started talking — clear queued assistant audio.
        this.twilio.send(
          JSON.stringify({ event: "clear", streamSid: this.streamSid }),
        );
        break;
    }
  }

  private async onBookAppointment(callId: string, args: string): Promise<void> {
    const schema = z.object({
      title: z.string(),
      startsAt: z.string(),
      endsAt: z.string().optional(),
      location: z.string().optional(),
      notes: z.string().optional(),
    });
    let output: string;
    try {
      const parsed = schema.parse(JSON.parse(args));
      const calEvent: CalendarEvent = {
        id: randomUUID(),
        userId: this.userId,
        title: parsed.title,
        startsAt: parsed.startsAt,
        endsAt: parsed.endsAt,
        location: parsed.location,
        notes: parsed.notes,
        attendees: [],
        status: "proposed",
      };
      await store.saveEvent(calEvent);
      this.bookedEventIds.push(calEvent.id);
      this.transcript.push(
        `[system] Appointment penciled in: ${parsed.title} at ${parsed.startsAt}`,
      );
      output = JSON.stringify({
        ok: true,
        note: "Appointment penciled in; the user will see it for confirmation.",
      });
    } catch {
      output = JSON.stringify({
        ok: false,
        note: "Couldn't book it — confirm the date and time with the caller and try again.",
      });
    }
    this.openai?.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: { type: "function_call_output", call_id: callId, output },
      }),
    );
    this.openai?.send(JSON.stringify({ type: "response.create" }));
  }

  private closed = false;

  private teardown(): void {
    if (this.closed) return;
    this.closed = true;
    this.openai?.close();
    if (this.twilio.readyState === WebSocket.OPEN) this.twilio.close();
    void this.summarize();
  }

  private async summarize(): Promise<void> {
    const transcript = this.transcript.join("\n");
    if (!transcript) return;
    const schema = z.object({
      callerName: z.string().optional(),
      reason: z.string().optional(),
      urgency: z.enum(["low", "medium", "high"]),
      callbackRequested: z.boolean(),
      messageForUser: z.string().optional(),
    });
    try {
      const raw = await completeJSON<unknown>({
        system: `Summarize this phone call transcript. Respond with JSON:
{"callerName": string (optional), "reason": string, "urgency": "low"|"medium"|"high", "callbackRequested": bool, "messageForUser": string (optional — anything the caller asked to pass along to the user, in the caller's words)}`,
        user: transcript,
        schemaName: "call-summary",
      });
      const parsed = schema.parse(raw);
      await store.saveCallSummary({
        id: randomUUID(),
        userId: this.userId,
        callerNumber: this.callerNumber,
        callerName: parsed.callerName,
        reason: parsed.reason,
        urgency: parsed.urgency,
        callbackRequested: parsed.callbackRequested,
        messageForUser: parsed.messageForUser,
        bookedEventId: this.bookedEventIds[0],
        transcript,
        createdAt: new Date().toISOString(),
      });
    } catch {
      await store.saveCallSummary({
        id: randomUUID(),
        userId: this.userId,
        callerNumber: this.callerNumber,
        urgency: "medium",
        callbackRequested: false,
        bookedEventId: this.bookedEventIds[0],
        transcript,
        createdAt: new Date().toISOString(),
      });
    }
  }
}

export function twimlForIncomingCall(userId: string): string {
  const wsUrl = `${config.publicBaseUrl.replace(/^http/, "ws")}/voice/stream/${userId}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${wsUrl}" />
  </Connect>
</Response>`;
}
