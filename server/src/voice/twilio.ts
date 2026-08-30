import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

/**
 * Validates the X-Twilio-Signature header on incoming Twilio requests.
 * See https://www.twilio.com/docs/usage/security#validating-requests
 */
export function isValidTwilioSignature(
  signature: string | undefined,
  url: string,
  params: Record<string, string> = {},
): boolean {
  const authToken = config.twilioAuthToken;
  if (!authToken || !signature) return false;

  const data =
    url +
    Object.keys(params)
      .sort()
      .map((key) => key + params[key])
      .join("");
  const expected = createHmac("sha1", authToken)
    .update(Buffer.from(data, "utf-8"))
    .digest("base64");

  const a = Buffer.from(expected, "base64");
  const b = Buffer.from(signature, "base64");
  return a.length === b.length && timingSafeEqual(a, b);
}
