import { normaliseNigerianPhone } from "./nigeria";

/**
 * Accepts any country's number in international form (+44 7700 900123, 0044…),
 * plus Nigerian local form (0803 123 4567) for existing users.
 * Returns E.164 (+447700900123) or null if it isn't a plausible number.
 */
export function normalisePhone(input: string): string | null {
  const nigerian = normaliseNigerianPhone(input);
  if (nigerian) return nigerian;
  const compact = input.replace(/[\s\-().]/g, "").replace(/^00/, "+");
  // E.164: a country code that doesn't start with 0, then up to 15 digits in total.
  return /^\+[1-9]\d{7,14}$/.test(compact) ? compact : null;
}
