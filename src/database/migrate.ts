import { randomUUID } from "node:crypto";
import { store } from "./store.js";
import { env } from "../config/env.js";
import { hashPassword } from "../utils/security.js";
await store.load();
if (store.value.users.length === 0 && env.FIRST_OWNER_EMAIL && env.FIRST_OWNER_PASSWORD) { store.value.users.push({ id: randomUUID(), email: env.FIRST_OWNER_EMAIL, passwordHash: await hashPassword(env.FIRST_OWNER_PASSWORD), role: "Owner", createdAt: new Date().toISOString() }); await store.save(); console.log("Owner initialisé"); } else { await store.save(); console.log("Migration idempotente terminée"); }
