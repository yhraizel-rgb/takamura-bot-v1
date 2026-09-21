import { randomUUID } from "node:crypto";
import type { RequestHandler } from "express";
import { can, verifyAccessToken } from "../utils/security.js";
import { env } from "../config/env.js";
import type { Role } from "../domain/types.js";

declare global { namespace Express { interface Request { user?: { id: string; role: Role }; requestId: string } } }
export const requestId: RequestHandler = (req, res, next) => { req.requestId = req.header("x-request-id") || randomUUID(); res.setHeader("x-request-id", req.requestId); next(); };
export const requireAuth: RequestHandler = (req, res, next) => { if (env.AUTH_MODE === "public") { req.user = { id: "public-user", role: "Owner" }; return next(); } try { const header = req.header("authorization"); if (!header?.startsWith("Bearer ")) return res.status(401).json({ error: "UNAUTHENTICATED" }); const token = verifyAccessToken(header.slice(7)); req.user = { id: token.sub, role: token.role }; next(); } catch { return res.status(401).json({ error: "UNAUTHENTICATED" }); } };
export function requirePermission(permission: string): RequestHandler { return (req, res, next) => { if (env.AUTH_MODE === "public") return next(); if (!req.user || !can(req.user.role, permission)) return res.status(403).json({ error: "FORBIDDEN" }); next(); }; }
export const csrf: RequestHandler = (req, res, next) => { if (env.AUTH_MODE === "public") return next(); if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next(); const cookie = req.cookies?.csrf; const header = req.header("x-csrf-token"); if (!cookie || cookie !== header) return res.status(403).json({ error: "CSRF_REQUIRED" }); next(); };
