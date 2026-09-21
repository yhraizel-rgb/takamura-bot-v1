import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

const { app, sessions } = await createApp();
await sessions.restore();
const server = app.listen(env.PORT, "0.0.0.0", () => logger.info({ port: env.PORT }, "takamura.bot.pro.ready"));
let stopping = false;
async function shutdown(signal: string) { if (stopping) return; stopping = true; logger.info({ signal }, "shutdown.start"); await sessions.shutdown(); await new Promise<void>((resolve) => server.close(() => resolve())); logger.info("shutdown.complete"); process.exit(0); }
process.on("SIGTERM", () => void shutdown("SIGTERM")); process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("uncaughtException", (error) => logger.error({ error }, "process.uncaught_exception"));
process.on("unhandledRejection", (error) => logger.error({ error }, "process.unhandled_rejection"));
