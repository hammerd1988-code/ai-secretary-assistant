import "dotenv/config";

export interface Config {
  port: number;
  host: string;
  openaiApiKey: string;
  openaiModel: string;
  openaiRealtimeModel: string;
  supabaseUrl: string | undefined;
  supabaseServiceRoleKey: string | undefined;
  twilioAuthToken: string | undefined;
  publicBaseUrl: string;
}

export const config: Config = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  openaiRealtimeModel:
    process.env.OPENAI_REALTIME_MODEL ?? "gpt-4o-realtime-preview",
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN,
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? "http://localhost:8787",
};
