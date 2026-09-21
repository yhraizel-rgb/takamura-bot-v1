import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import type { AuditLog, Session, User } from "../domain/types.js";

export interface StoreData { users: User[]; sessions: Session[]; logs: AuditLog[]; refreshTokens: Array<{ hash: string; userId: string; expiresAt: string; revokedAt?: string }>; commandSettings: Record<string, { enabled: boolean; permissions: string[] }>; }
const empty = (): StoreData => ({ users: [], sessions: [], logs: [], refreshTokens: [], commandSettings: {} });
export class Store {
  private data: StoreData = empty();
  private loaded = false;
  private file = path.join(env.runtimeDir, "store.json");
  async load(): Promise<void> { if (this.loaded) return; await fs.mkdir(env.runtimeDir, { recursive: true, mode: 0o700 }); try { this.data = { ...empty(), ...(JSON.parse(await fs.readFile(this.file, "utf8")) as Partial<StoreData>) }; } catch { this.data = empty(); } this.loaded = true; }
  get value(): StoreData { if (!this.loaded) throw new Error("STORE_NOT_LOADED"); return this.data; }
  async save(): Promise<void> { const temporary = `${this.file}.tmp-${process.pid}`; await fs.writeFile(temporary, JSON.stringify(this.data, null, 2), { mode: 0o600 }); await fs.rename(temporary, this.file); }
}
export const store = new Store();
