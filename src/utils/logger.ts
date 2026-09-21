import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: { paths: ["req.headers.authorization", "password", "token", "refreshToken", "credentials", "phoneNumber"], censor: "[REDACTED]" },
  base: null,
  timestamp: pino.stdTimeFunctions.isoTime
});

export function maskPhone(value: string): string { return value.length < 4 ? "***" : `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`; }
