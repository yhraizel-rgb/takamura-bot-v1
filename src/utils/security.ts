import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import type { Role } from "../domain/types.js";

export const permissions: Record<Role, string[]> = {
  Owner: ["*"],
  Admin: ["dashboard:read", "sessions:read", "sessions:create", "sessions:update", "sessions:delete", "commands:read", "commands:write", "logs:read"],
  Moderator: ["dashboard:read", "sessions:read", "commands:read", "commands:write", "logs:read"],
  User: ["dashboard:read", "sessions:read"]
};
export function can(role: Role, permission: string): boolean { return permissions[role].includes("*") || permissions[role].includes(permission); }
export function normalizePhone(value: string): string { const normalized = value.replace(/\D/g, "").replace(/^0+/, ""); if (normalized.length < 8 || normalized.length > 15) throw new Error("INVALID_PHONE"); return normalized; }
export async function hashPassword(value: string): Promise<string> { return bcrypt.hash(value, 12); }
export async function verifyPassword(value: string, hash: string): Promise<boolean> { return bcrypt.compare(value, hash); }
export function signAccessToken(userId: string, role: Role): string { return jwt.sign({ sub: userId, role, type: "access" }, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as any }); }
export function verifyAccessToken(token: string): { sub: string; role: Role } { const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & { role?: Role; type?: string }; if (payload.type !== "access" || typeof payload.sub !== "string" || !payload.role) throw new Error("INVALID_TOKEN"); return { sub: payload.sub, role: payload.role }; }
export function randomToken(): string { return crypto.randomBytes(32).toString("hex"); }
