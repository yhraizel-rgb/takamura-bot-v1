import { randomUUID } from "node:crypto";
import { normalizePhone } from "../../utils/security.js";
import { logger } from "../../utils/logger.js";
import { store } from "../../database/store.js";
import type { Session, SessionState } from "../../domain/types.js";

export class SessionManager {
  private locks = new Set<string>();
  private timers = new Map<string, NodeJS.Timeout>();
  async restore(): Promise<void> { await store.load(); for (const session of store.value.sessions.filter((s) => s.desired === "enabled")) { await this.transition(session.id, "restoring"); } }
  list(): Session[] { return store.value.sessions.map((s) => ({ ...s, phoneNumber: `***${s.phoneNumber.slice(-4)}` })); }
  get(id: string): Session | undefined { return store.value.sessions.find((s) => s.id === id); }
  async create(phone: string, ownerUserId: string): Promise<Session> { const phoneNumber = normalizePhone(phone); const existing = store.value.sessions.find((s) => s.phoneNumber === phoneNumber); if (existing) return existing; const session: Session = { id: randomUUID(), phoneNumber, ownerUserId, desired: "enabled", state: "pairing", features: { autoread: false, autoreact: false, autotyping: false, autorecording: false, welcome: false, bye: false, antilink: false }, updatedAt: new Date().toISOString() }; store.value.sessions.push(session); await store.save(); return session; }
  async transition(id: string, state: SessionState, lastError?: string): Promise<Session> { const session = this.get(id); if (!session) throw new Error("SESSION_NOT_FOUND"); session.state = state; if (lastError) session.lastError = lastError; else delete session.lastError; session.updatedAt = new Date().toISOString(); await store.save(); logger.info({ sessionId: id, state }, "session.transition"); return session; }
  async pair(id: string): Promise<{ status: string; code?: string }> { const session = this.get(id); if (!session) throw new Error("SESSION_NOT_FOUND"); if (this.locks.has(id)) return { status: "in_progress" }; this.locks.add(id); try { await this.transition(id, "pairing"); return { status: "queued" }; } finally { this.locks.delete(id); } }
  async disable(id: string): Promise<Session> { const session = this.get(id); if (!session) throw new Error("SESSION_NOT_FOUND"); session.desired = "disabled"; await this.transition(id, "disabled"); return session; }
  async remove(id: string): Promise<void> { if (this.timers.has(id)) clearTimeout(this.timers.get(id)); store.value.sessions = store.value.sessions.filter((s) => s.id !== id); await store.save(); }
  async shutdown(): Promise<void> { for (const timer of this.timers.values()) clearTimeout(timer); this.timers.clear(); for (const s of store.value.sessions.filter((x) => x.state !== "disabled")) { s.state = "disabled"; } await store.save(); }
}
