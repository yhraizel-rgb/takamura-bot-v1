import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { store } from "../src/database/store.js";

describe("Takamura Bot Pro API", () => {
  beforeEach(async () => { await store.load(); store.value.users = []; store.value.sessions = []; store.value.refreshTokens = []; });
  it("exposes process liveness and readiness without secrets", async () => { const { app } = await createApp(); expect((await request(app).get("/live")).status).toBe(200); expect((await request(app).get("/ready")).body.status).toBe("ready"); expect((await request(app).get("/package.json")).status).toBe(404); expect((await request(app).get("/runtime/store.json")).status).toBe(404); });
  it("does not expose a legacy public GET pairing mutation", async () => { const { app } = await createApp(); expect((await request(app).get("/pair-api/code?number=237670123456")).status).toBe(404); });
});
