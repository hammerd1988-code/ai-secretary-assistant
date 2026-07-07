import { NativeEventEmitter, NativeModules, Platform } from "react-native";
import { api } from "./api";

/**
 * Bridge to the Android SMS native module (see docs/ANDROID_SMS.md).
 * The module is only present in a dev-client/standalone Android build that
 * includes the EnvoySms Kotlin module; in Expo Go or on iOS these calls
 * no-op so the rest of the app (and the simulator on the Style tab) still work.
 */

interface EnvoySmsModule {
  requestSmsRole(): Promise<boolean>;
  sendSms(to: string, body: string): Promise<void>;
  readSentHistory(limit: number): Promise<Array<{ address: string; body: string }>>;
}

function getModule(): EnvoySmsModule | undefined {
  if (Platform.OS !== "android") return undefined;
  return (NativeModules as { EnvoySms?: EnvoySmsModule }).EnvoySms;
}

export const smsAvailable = (): boolean => Boolean(getModule());

export async function requestSmsRole(): Promise<boolean> {
  const mod = getModule();
  return mod ? mod.requestSmsRole() : false;
}

export async function sendSms(to: string, body: string): Promise<void> {
  const mod = getModule();
  if (mod) await mod.sendSms(to, body);
}

/** Feed the user's sent-message history into the style engine. */
export async function ingestSentHistory(limit = 500): Promise<number> {
  const mod = getModule();
  if (!mod) return 0;
  const history = await mod.readSentHistory(limit);
  if (history.length === 0) return 0;
  await api.ingestStyle(history.map((h) => ({ reply: h.body })));
  return history.length;
}

/** Forward incoming SMS broadcasts to the backend pipeline. */
export function startInboundListener(): () => void {
  const mod = getModule();
  if (!mod) return () => undefined;
  const emitter = new NativeEventEmitter(NativeModules.EnvoySms);
  const sub = emitter.addListener(
    "envoy_sms_received",
    (event: { from: string; body: string }) => {
      api.simulateInbound(event.from, event.body).catch((e) => {
        console.warn("Failed to forward inbound SMS to backend:", e);
      });
    },
  );
  return () => sub.remove();
}
