import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { env, product } from "./config/env.js";
import { store } from "./database/store.js";
import { loadCommandRegistry } from "./modules/commands/registry.js";
import { SessionManager } from "./modules/whatsapp/session-manager.js";
import { hashPassword, signAccessToken, verifyPassword, randomToken } from "./utils/security.js";
import { requestId, requireAuth, requirePermission, csrf } from "./middleware/security.js";
import { logger } from "./utils/logger.js";

export async function createApp() {
  await store.load();
  if (env.AUTH_MODE === "test" && !store.value.users.some((user) => user.id === "demo-owner")) {
    store.value.users.push({ id: "demo-owner", email: "demo@takamura.local", passwordHash: await hashPassword("test-only-demo"), role: "Owner", createdAt: new Date().toISOString() });
    await store.save();
  }
  const commands = await loadCommandRegistry(); const sessions = new SessionManager();
  const app = express(); app.disable("x-powered-by"); app.use(requestId); app.use(helmet({ contentSecurityPolicy: { directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"] } } })); app.use(cors({ origin: env.corsOrigins, credentials: true })); app.use(express.json({ limit: "64kb" })); app.use(cookieParser()); app.use(rateLimit({ windowMs: 60_000, limit: 100, standardHeaders: true }));
  app.get("/live", (_req, res) => res.json({ status: "ok", product: product.name })); app.get("/ready", (_req, res) => res.json({ status: "ready", database: "ok" }));
  app.get("/api/v1/csrf", (_req, res) => { const token = crypto.randomBytes(24).toString("hex"); res.cookie("csrf", token, { httpOnly: false, sameSite: "strict", secure: env.NODE_ENV === "production" }); res.json({ csrfToken: token }); });
  app.get("/api/v1/auth/demo", (_req, res) => { if (!["test", "public"].includes(env.AUTH_MODE)) return res.status(404).json({ error: "NOT_FOUND" }); res.json({ accessToken: signAccessToken("demo-owner", "Owner"), user: { id: "demo-owner", email: "demo@takamura.local", role: "Owner" }, mode: env.AUTH_MODE }); });
  app.post("/api/v1/auth/login", async (req, res) => { const email = String(req.body?.email ?? "").toLowerCase(); const user = store.value.users.find((x) => x.email === email); if (!user || !(await verifyPassword(String(req.body?.password ?? ""), user.passwordHash))) return res.status(401).json({ error: "INVALID_CREDENTIALS" }); const accessToken = signAccessToken(user.id, user.role); const refresh = randomToken(); store.value.refreshTokens.push({ hash: refresh, userId: user.id, expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000).toISOString() }); await store.save(); res.cookie("refresh_token", refresh, { httpOnly: true, sameSite: "strict", secure: env.NODE_ENV === "production" }); res.json({ accessToken, user: { id: user.id, email: user.email, role: user.role } }); });
  app.post("/api/v1/auth/refresh", (req, res) => { const token = req.cookies?.refresh_token; const item = store.value.refreshTokens.find((x) => x.hash === token && !x.revokedAt && x.expiresAt > new Date().toISOString()); if (!item) return res.status(401).json({ error: "INVALID_REFRESH" }); const user = store.value.users.find((x) => x.id === item.userId); if (!user) return res.status(401).json({ error: "INVALID_REFRESH" }); item.revokedAt = new Date().toISOString(); const next = randomToken(); store.value.refreshTokens.push({ hash: next, userId: user.id, expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 86400000).toISOString() }); void store.save(); res.cookie("refresh_token", next, { httpOnly: true, sameSite: "strict", secure: env.NODE_ENV === "production" }); res.json({ accessToken: signAccessToken(user.id, user.role) }); });
  app.post("/api/v1/auth/logout", requireAuth, csrf, (req, res) => { const token = req.cookies?.refresh_token; const item = store.value.refreshTokens.find((x) => x.hash === token); if (item) item.revokedAt = new Date().toISOString(); void store.save(); res.clearCookie("refresh_token"); res.status(204).end(); });
  app.get("/api/v1/auth/me", requireAuth, (req, res) => { const user = store.value.users.find((x) => x.id === req.user?.id); res.json(user ? { id: user.id, email: user.email, role: user.role } : null); });
  app.get("/api/v1/sessions", requireAuth, requirePermission("sessions:read"), (_req, res) => res.json({ data: sessions.list() }));
  app.post("/api/v1/sessions", requireAuth, requirePermission("sessions:create"), csrf, async (req, res) => { try { const session = await sessions.create(String(req.body?.phoneNumber ?? ""), req.user!.id); const pairing = await sessions.pair(session.id); res.status(201).json({ data: { session: { ...session, phoneNumber: `***${session.phoneNumber.slice(-4)}` }, pairing } }); } catch (error) { logger.warn({ error, requestId: req.requestId }, "session.create.rejected"); res.status(400).json({ error: "INVALID_SESSION_REQUEST" }); } });
  app.post("/api/v1/sessions/:id/pair", requireAuth, requirePermission("sessions:create"), csrf, async (req, res) => { try { res.json({ data: await sessions.pair(String(req.params.id)) }); } catch { res.status(404).json({ error: "SESSION_NOT_FOUND" }); } });
  app.post("/api/v1/sessions/:id/disable", requireAuth, requirePermission("sessions:update"), csrf, async (req, res) => { try { res.json({ data: await sessions.disable(String(req.params.id)) }); } catch { res.status(404).json({ error: "SESSION_NOT_FOUND" }); } });
  app.delete("/api/v1/sessions/:id", requireAuth, requirePermission("sessions:delete"), csrf, async (req, res) => { await sessions.remove(String(req.params.id)); res.status(204).end(); });
  app.get("/api/v1/commands", requireAuth, requirePermission("commands:read"), (_req, res) => res.json({ data: commands }));
  app.get("/api/v1/stats", requireAuth, requirePermission("dashboard:read"), (_req, res) => { const memory = process.memoryUsage(); res.json({ data: { bots: store.value.sessions.length, connected: store.value.sessions.filter((x) => x.state === "connected").length, commands: commands.length, users: store.value.users.length, queueDepth: 0, memory: { rss: memory.rss, heapUsed: memory.heapUsed, heapTotal: memory.heapTotal } } }); });
  app.get("/api/v1/logs", requireAuth, requirePermission("logs:read"), (req, res) => { const query = String(req.query.q ?? "").toLowerCase(); const action = String(req.query.action ?? ""); const rows = store.value.logs.filter((item) => (!query || JSON.stringify(item).toLowerCase().includes(query)) && (!action || item.action === action)).slice(-100).reverse(); if (req.query.format === "ndjson") return res.type("application/x-ndjson").send(rows.map((item) => JSON.stringify(item)).join("\n")); res.json({ data: rows }); });
  app.get("/metrics", requireAuth, requirePermission("logs:read"), (_req, res) => res.type("text/plain").send(`takamura_sessions_total ${store.value.sessions.length}\ntakamura_sessions_connected ${store.value.sessions.filter((x) => x.state === "connected").length}\ntakamura_commands_registered ${commands.length}\n`));
  app.use(express.static(path.resolve("public"), { index: "index.html" }));
  return { app, sessions };
}
