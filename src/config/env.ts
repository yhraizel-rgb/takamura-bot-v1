import path from "node:path";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  PUBLIC_ORIGIN: z.string().url().default("http://localhost:8080"),
  JWT_SECRET: z.string().min(32).default("development-only-secret-change-me-please-123456"),
  ACCESS_TOKEN_TTL: z.string().default("10m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  RUNTIME_DIR: z.string().default("./runtime"),
  DATABASE_URL: z.string().default("sqlite://./runtime/takamura.db"),
  FIRST_OWNER_EMAIL: z.string().email().optional(),
  FIRST_OWNER_PASSWORD: z.string().min(12).optional(),
  CORS_ORIGINS: z.string().default("http://localhost:8080"),
  METRICS_ENABLED: z.coerce.boolean().default(false),
  AUTO_JOIN_ENABLED: z.coerce.boolean().default(false),
  LOG_RETENTION_DAYS: z.coerce.number().int().min(1).max(3650).default(30)
});

export const env = (() => {
  const parsed = schema.parse(process.env);
  return { ...parsed, runtimeDir: path.resolve(parsed.RUNTIME_DIR), corsOrigins: parsed.CORS_ORIGINS.split(",").map((x) => x.trim()).filter(Boolean) };
})();

export const product = {
  name: "Takamura Bot Pro",
  slogan: "Le plan de contrôle fiable pour vos sessions WhatsApp",
  locale: "fr-FR",
  timezone: "Europe/Paris",
  theme: { accent: "#9b87f5", background: "#0d0d12", surface: "#171720" }
} as const;
