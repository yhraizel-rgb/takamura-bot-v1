import { describe, expect, it } from "vitest";
import { can, normalizePhone, hashPassword, verifyPassword } from "../src/utils/security.js";
import { loadCommandRegistry } from "../src/modules/commands/registry.js";

describe("security primitives", () => {
  it("normalizes and validates international phone numbers", () => { expect(normalizePhone("+237 6 70 12 34 56")).toBe("237670123456"); expect(() => normalizePhone("12")).toThrow("INVALID_PHONE"); });
  it("enforces explicit RBAC permissions", () => { expect(can("Owner", "anything")).toBe(true); expect(can("User", "sessions:create")).toBe(false); expect(can("Admin", "sessions:create")).toBe(true); });
  it("hashes passwords and verifies only the original", async () => { const hash = await hashPassword("a-strong-password"); expect(hash).not.toContain("a-strong-password"); expect(await verifyPassword("a-strong-password", hash)).toBe(true); expect(await verifyPassword("wrong", hash)).toBe(false); });
});
describe("command registry", () => { it("keeps all 29 V1 commands and detects protected defaults", async () => { const commands = await loadCommandRegistry(); expect(commands).toHaveLength(29); expect(commands.find((x) => x.name === "tagadmin")?.aliases).toContain("admins"); expect(commands.find((x) => x.name === "purge")?.enabled).toBe(false); }); });
