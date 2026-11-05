// Structured logger that keeps personal data out of logs (NDPA 2023).
// Any key that looks like PII is redacted, recursively.

const PII_KEYS = /(email|phone|name|password|token|secret|address|dob|birth|cv|bio|ip|cookie|authorization)/i;

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

export function redact(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[depth]";
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value)) {
      out[key] = PII_KEYS.test(key) ? "[redacted]" : redact(v, depth + 1);
    }
    return out;
  }
  return value;
}

function write(level: LogLevel, message: string, context?: LogContext) {
  if (process.env.NODE_ENV === "test" && level !== "error") return;
  const line = JSON.stringify({
    level,
    message,
    time: new Date().toISOString(),
    ...(context ? { context: redact(context) } : {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

/** Error details without the message, which may embed user input. */
export function describeError(err: unknown): LogContext {
  if (err instanceof Error) {
    return { errorName: err.name, stack: err.stack?.split("\n").slice(0, 6).join("\n") };
  }
  return { errorName: typeof err };
}

export const logger = {
  debug: (message: string, context?: LogContext) => write("debug", message, context),
  info: (message: string, context?: LogContext) => write("info", message, context),
  warn: (message: string, context?: LogContext) => write("warn", message, context),
  error: (message: string, context?: LogContext) => write("error", message, context),
};
