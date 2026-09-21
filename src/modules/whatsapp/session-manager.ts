import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import makeWASocket, { Browsers, fetchLatestBaileysVersion, makeCacheableSignalKeyStore, useMultiFileAuthState } from "@whiskeysockets/baileys";
import type { WASocket } from "@whiskeysockets/baileys";
import pino from "pino";
import { normalizePhone } from "../../utils/security.js";
import { env } from "../../config/env.js";
import { logger } from "../../utils/logger.js";
import { store } from "../../database/store.js";
import type { Session, SessionState } from "../../domain/types.js";

type CommandModule = { name: string; execute: (sock: WASocket, message: Record<string, unknown>, args: string[]) => Promise<unknown> };
type RuntimeBot = { sock: WASocket; number: string; config: { prefix: string; owners: string[]; sudoList: string[] }; features: Record<string, boolean>; commands: Map<string, CommandModule> };

const commandFiles = ["add", "demote", "demoteall", "gpp", "img", "kick", "kickall", "left", "link", "menu", "mute", "owner", "photo", "ping", "pp", "promote", "promoteall", "purge", "resetlink", "save", "setpp", "sticker", "tag", "tagadmin", "tagall", "take", "unmute", "url", "vv"];
const runtimeBots = new Map<string, RuntimeBot>();
(globalThis as Record<string, unknown>).bots = runtimeBots;

function bare(value: string): string { return (value.split("@")[0] ?? "").replace(/[^0-9]/g, "").replace(/^0+/, ""); }
function sessionDir(number: string): string { return path.resolve(env.RUNTIME_DIR, "sessions", number); }
function mask(value: string): string { return `***${value.slice(-4)}`; }
function extractText(message: any): string { return message?.conversation || message?.extendedTextMessage?.text || message?.imageMessage?.caption || message?.videoMessage?.caption || message?.documentMessage?.caption || ""; }

export class SessionManager {
  private locks = new Set<string>();
  private reconnectTimers = new Map<string, NodeJS.Timeout>();

  async restore(): Promise<void> {
    await store.load();
    for (const session of store.value.sessions.filter((item) => item.desired === "enabled")) {
      const hasCreds = await fs.access(path.join(sessionDir(session.phoneNumber), "creds.json")).then(() => true).catch(() => false);
      if (hasCreds) void this.start(session.id, false);
      else await this.transition(session.id, "pairing");
    }
  }

  list(): Session[] { return store.value.sessions.map((item) => ({ ...item, phoneNumber: mask(item.phoneNumber) })); }
  get(id: string): Session | undefined { return store.value.sessions.find((item) => item.id === id); }

  async create(phone: string, ownerUserId: string): Promise<Session> {
    const phoneNumber = normalizePhone(phone);
    if (phoneNumber.length < 8) throw new Error("INVALID_PHONE");
    const existing = store.value.sessions.find((item) => item.phoneNumber === phoneNumber);
    if (existing) return existing;
    const session: Session = { id: randomUUID(), phoneNumber, ownerUserId, desired: "enabled", state: "pairing", features: { autoread: false, autoreact: false, autotyping: false, autorecording: false, welcome: false, bye: false, antilink: false }, updatedAt: new Date().toISOString() };
    store.value.sessions.push(session);
    await store.save();
    return session;
  }

  async pair(id: string): Promise<{ status: string; code?: string }> {
    const session = this.get(id);
    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (this.locks.has(id)) return { status: "in_progress" };
    this.locks.add(id);
    try {
      const existing = runtimeBots.get(id);
      if (existing) return { status: "connected" };
      const bot = await this.start(id, true);
      if (!bot) return { status: "failed" };
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const code = await bot.sock.requestPairingCode(session.phoneNumber);
      await this.transition(id, "pairing");
      return { status: "pairing", code };
    } finally { this.locks.delete(id); }
  }

  async disable(id: string): Promise<Session> { const session = this.get(id); if (!session) throw new Error("SESSION_NOT_FOUND"); session.desired = "disabled"; await this.transition(id, "disabled"); const bot = runtimeBots.get(id); bot?.sock.end(undefined); runtimeBots.delete(id); return session; }
  async remove(id: string): Promise<void> { const session = this.get(id); if (!session) return; runtimeBots.get(id)?.sock.end(undefined); runtimeBots.delete(id); await fs.rm(sessionDir(session.phoneNumber), { recursive: true, force: true }); store.value.sessions = store.value.sessions.filter((item) => item.id !== id); await store.save(); }
  async shutdown(): Promise<void> { for (const timer of this.reconnectTimers.values()) clearTimeout(timer); for (const bot of runtimeBots.values()) bot.sock.end(undefined); runtimeBots.clear(); for (const session of store.value.sessions.filter((item) => item.state !== "disabled")) session.state = "disabled"; await store.save(); }

  private async transition(id: string, state: SessionState, lastError?: string): Promise<Session> { const session = this.get(id); if (!session) throw new Error("SESSION_NOT_FOUND"); session.state = state; if (lastError) session.lastError = lastError; else delete session.lastError; session.updatedAt = new Date().toISOString(); await store.save(); logger.info({ sessionId: id, state, lastError }, "session.transition"); return session; }

  private async loadCommands(): Promise<Map<string, CommandModule>> {
    const result = new Map<string, CommandModule>();
    for (const name of commandFiles) {
      const module = (await import(`../../../commands/${name}.js`)).default as CommandModule;
      if (module?.name && typeof module.execute === "function") result.set(module.name.toLowerCase(), module);
    }
    return result;
  }

  private async start(id: string, fresh: boolean): Promise<RuntimeBot | undefined> {
    const session = this.get(id); if (!session) return undefined;
    const current = runtimeBots.get(id); if (current) return current;
    await this.transition(id, fresh ? "pairing" : "restoring");
    await fs.mkdir(sessionDir(session.phoneNumber), { recursive: true });
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir(session.phoneNumber));
    const { version } = await fetchLatestBaileysVersion();
    const sock = makeWASocket({ version, auth: { creds: state.creds, keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) }, logger: pino({ level: "silent" }), browser: Browsers.windows("Chrome"), printQRInTerminal: false, markOnlineOnConnect: false });
    const bot: RuntimeBot = { sock, number: session.phoneNumber, config: { prefix: ".", owners: [session.phoneNumber], sudoList: [] }, features: session.features, commands: await this.loadCommands() };
    runtimeBots.set(id, bot);
    sock.ev.on("creds.update", saveCreds);
    sock.ev.on("connection.update", (update: any) => void this.onConnection(id, update));
    sock.ev.on("messages.upsert", (event: any) => void this.onMessages(id, event));
    sock.ev.on("group-participants.update", (event: any) => void this.onGroupUpdate(id, event));
    return bot;
  }

  private async onConnection(id: string, update: any): Promise<void> {
    const session = this.get(id); if (!session) return;
    if (update.connection === "open") { await this.transition(id, "connected"); return; }
    if (update.connection !== "close") return;
    runtimeBots.delete(id);
    const status = update.lastDisconnect?.error?.output?.statusCode;
    if ([401, 403, 405, 428, 440].includes(status)) { await this.transition(id, "invalid", `whatsapp_disconnect_${status}`); return; }
    await this.transition(id, "backoff", "connection_closed");
    if (session.desired === "enabled" && !this.reconnectTimers.has(id)) {
      const timer = setTimeout(() => { this.reconnectTimers.delete(id); void this.start(id, false); }, 3000);
      this.reconnectTimers.set(id, timer);
    }
  }

  private async onMessages(id: string, event: any): Promise<void> {
    const bot = runtimeBots.get(id); const session = this.get(id); if (!bot || !session) return;
    for (const message of event.messages ?? []) {
      try {
        if (!message?.message || message.key?.remoteJid === "status@broadcast") continue;
        const remoteJid = message.key.remoteJid as string;
        const text = extractText(message.message).trim();
        if (bot.features.autoread && !message.key.fromMe) await bot.sock.readMessages([message.key]);
        if (!text.startsWith(bot.config.prefix)) continue;
        const sender = bare(String(message.key.participant || remoteJid));
        if (!message.key.fromMe && sender !== session.phoneNumber && !bot.config.owners.includes(sender)) continue;
        const parts = text.slice(bot.config.prefix.length).trim().split(/\s+/); const name = (parts.shift() || "").toLowerCase();
        const command = bot.commands.get(name); if (!command) continue;
        (globalThis as Record<string, unknown>).owners = bot.config.owners;
        process.env.NUMBER = session.phoneNumber;
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage || null;
        await command.execute(bot.sock, { raw: message, from: remoteJid, sender, isGroup: remoteJid.endsWith("@g.us"), quoted, bots: runtimeBots, reply: (text: string) => bot.sock.sendMessage(remoteJid, { text: `*_${text}_*` }) }, parts);
        await bot.sock.sendMessage(remoteJid, { react: { text: "🐉", key: message.key } });
      } catch (error) { logger.warn({ error, sessionId: id }, "whatsapp.message_failed"); }
    }
  }

  private async onGroupUpdate(id: string, event: any): Promise<void> {
    const bot = runtimeBots.get(id); if (!bot) return;
    if (event.action !== "add" || !bot.features.welcome) return;
    for (const participant of event.participants ?? []) { const jid = typeof participant === "string" ? participant : participant?.id; if (jid) await bot.sock.sendMessage(event.id, { text: `Bienvenue @${jid.split("@")[0]} dans le groupe.`, mentions: [jid] }).catch(() => undefined); }
  }
}
