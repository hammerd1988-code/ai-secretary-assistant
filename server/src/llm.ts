import OpenAI from "openai";
import { config } from "./config.js";

let client: OpenAI | undefined;

export function getOpenAI(): OpenAI {
  if (!client) {
    if (!config.openaiApiKey) {
      throw new Error("OPENAI_API_KEY is not configured");
    }
    client = new OpenAI({ apiKey: config.openaiApiKey });
  }
  return client;
}

export async function completeJSON<T>(params: {
  system: string;
  user: string;
  schemaName: string;
}): Promise<T> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: config.openaiModel,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    response_format: { type: "json_object" },
    temperature: 0.2,
  });
  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error(`Empty completion for ${params.schemaName}`);
  }
  return JSON.parse(content) as T;
}

export async function completeText(params: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<string> {
  const openai = getOpenAI();
  const response = await openai.chat.completions.create({
    model: config.openaiModel,
    messages: [
      { role: "system", content: params.system },
      { role: "user", content: params.user },
    ],
    temperature: params.temperature ?? 0.7,
  });
  return response.choices[0]?.message.content?.trim() ?? "";
}
