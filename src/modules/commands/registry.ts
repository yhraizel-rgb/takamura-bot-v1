import fs from "node:fs/promises";
import path from "node:path";
import type { CommandDefinition } from "../../domain/types.js";

const names = ["add","demote","demoteall","gpp","img","kick","kickall","left","link","menu","mute","owner","photo","ping","pp","promote","promoteall","purge","resetlink","save","setpp","sticker","tag","tagadmin","tagall","take","unmute","url","vv"] as const;
const aliases: Record<string, string[]> = { gpp: ["grouppp", "groupicon", "groupavatar"], tagadmin: ["admins", "admin", "tagadmins"] };
const risk: Record<string, CommandDefinition["risk"]> = { kickall: "critical", purge: "critical", promoteall: "high", demoteall: "high", resetlink: "high", vv: "high", url: "high", save: "medium" };
export async function loadCommandRegistry(): Promise<CommandDefinition[]> {
  const dir = path.resolve("commands"); const files = new Set((await fs.readdir(dir)).filter((x) => x.endsWith(".js")));
  const missing = names.filter((name) => !files.has(`${name}.js`)); if (missing.length) throw new Error(`COMMANDS_MISSING:${missing.join(",")}`);
  const definitions = names.map((name) => ({ name, description: `Commande ${name} compatible V1`, aliases: aliases[name] ?? [], category: ["kickall","purge","promoteall","demoteall","resetlink"].includes(name) ? "group-risk" : "general", permissions: ["whatsapp:command"], cooldownMs: risk[name] === "critical" ? 5000 : 1000, enabled: !["purge","kickall","promoteall","demoteall"].includes(name), risk: risk[name] ?? "low" }));
  const seen = new Set<string>(); for (const item of definitions) for (const key of [item.name, ...item.aliases]) { if (seen.has(key)) throw new Error(`COMMAND_COLLISION:${key}`); seen.add(key); }
  return definitions;
}
