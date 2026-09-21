import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";

const algorithm = "aes-256-gcm";
function key(): Buffer { return crypto.createHash("sha256").update(env.JWT_SECRET).digest(); }

export async function backupStore(input = path.join(env.runtimeDir, "store.json")): Promise<string> {
  await fs.mkdir(path.join(env.runtimeDir, "backups"), { recursive: true, mode: 0o700 });
  const plaintext = await fs.readFile(input);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const target = path.join(env.runtimeDir, "backups", `store-${new Date().toISOString().replace(/[:.]/g, "-")}.bak`);
  await fs.writeFile(target, Buffer.concat([Buffer.from("TBP1"), iv, tag, encrypted]), { mode: 0o600 });
  logger.info({ target }, "store.backup.created");
  return target;
}

export async function restoreStore(backup: string, output = path.join(env.runtimeDir, "store.json")): Promise<void> {
  const payload = await fs.readFile(backup);
  if (payload.subarray(0, 4).toString() !== "TBP1") throw new Error("INVALID_BACKUP_FORMAT");
  const decipher = crypto.createDecipheriv(algorithm, key(), payload.subarray(4, 16));
  decipher.setAuthTag(payload.subarray(16, 32));
  const plaintext = Buffer.concat([decipher.update(payload.subarray(32)), decipher.final()]);
  const temporary = `${output}.restore-${process.pid}`;
  await fs.writeFile(temporary, plaintext, { mode: 0o600 });
  await fs.rename(temporary, output);
}
