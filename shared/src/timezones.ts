// IANA time zones from the runtime itself (Intl), so there is no list to maintain.

/** True for a real IANA zone such as "Europe/London" or "Africa/Lagos". */
export function isTimeZone(tz: string): boolean {
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+-]+)*$/.test(tz)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Every zone the runtime knows, as { value, label } with the current UTC offset. */
export function timeZoneOptions(): Array<{ value: string; label: string }> {
  const zones: string[] =
    typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC", "Africa/Lagos"];
  const now = new Date();
  return zones.map((tz) => {
    let offset = "";
    try {
      offset =
        new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "shortOffset" })
          .formatToParts(now)
          .find((p) => p.type === "timeZoneName")?.value ?? "";
    } catch {
      // keep the bare name
    }
    return { value: tz, label: `${tz.replace(/_/g, " ")}${offset ? ` (${offset})` : ""}` };
  });
}

/** The visitor's own zone, used to pre-fill forms. */
export function guessTimeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}
