export type Role = "Owner" | "Admin" | "Moderator" | "User";
export type SessionState = "disabled" | "pairing" | "restoring" | "connecting" | "connected" | "backoff" | "failed" | "invalid";
export type Risk = "low" | "medium" | "high" | "critical";

export interface User { id: string; email: string; passwordHash: string; role: Role; createdAt: string; }
export interface Session { id: string; phoneNumber: string; desired: "enabled" | "disabled"; state: SessionState; ownerUserId: string; features: Record<string, boolean>; lastError?: string; updatedAt: string; }
export interface CommandDefinition { name: string; description: string; aliases: string[]; category: string; permissions: string[]; cooldownMs: number; enabled: boolean; risk: Risk; }
export interface AuditLog { id: string; action: string; actorUserId?: string; sessionId?: string; requestId: string; createdAt: string; metadata: Record<string, unknown>; }
