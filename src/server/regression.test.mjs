import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openStore } from "./store.mjs";
import { createApp } from "./app.mjs";

function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "hutong-regression-")),
    store = openStore(":memory:");
  store.ensureRoster(join(directory, "codes.txt"));
  const codes = Object.fromEntries(
    readFileSync(join(directory, "codes.txt"), "utf8")
      .trim()
      .split(/\r?\n/)
      .map((line) => {
        const [n, c] = line.split("\t");
        return [n.toLowerCase(), c];
      }),
  );
  t.after(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });
  const register = (name) =>
    store.register({
      name,
      claimCode: codes[name],
      password: "test-password-123",
    });
  return { store, register };
}
test("fixed names, duplicate claims, reset expiration, one-time use and session revocation", (t) => {
  const { store, register } = fixture(t);
  assert.throws(
    () =>
      store.register({
        name: "Unknown",
        claimCode: "anything",
        password: "test-password-123",
      }),
    /英文名/,
  );
  const session = register("suki");
  assert.throws(() => register("suki"), /已注册/);
  const expired = store.issueReset("suki", Date.now() - 16 * 60000);
  assert.throws(
    () =>
      store.resetPassword({
        name: "suki",
        code: expired,
        password: "new-password-123",
      }),
    /过期/,
  );
  const code = store.issueReset("suki");
  store.resetPassword({ name: "SUKI ", code, password: "new-password-123" });
  assert.equal(store.session(session.token), null);
  assert.throws(
    () =>
      store.resetPassword({ name: "suki", code, password: "another-password" }),
    /无效/,
  );
  assert.throws(
    () => store.login({ name: "suki", password: "test-password-123" }),
    /不正确/,
  );
  assert.equal(
    store.login({ name: "suki", password: "new-password-123" }).member.id,
    "suki",
  );
  assert.throws(() => register("suki"), /已注册/);
});
test("history returns the newest 100 messages in stable chronological order", (t) => {
  const { store } = fixture(t);
  for (let i = 0; i < 105; i++)
    store.addMessage({
      thread: "franco:suki",
      senderId: "suki",
      body: String(i),
      source: "human",
    });
  const messages = store.messages("franco:suki");
  assert.equal(messages.length, 100);
  assert.equal(messages[0].body, "5");
  assert.equal(messages.at(-1).body, "104");
});
test("HTTP assets, origin checks, auth throttling and takeover during generation", async (t) => {
  const { store, register } = fixture(t),
    suki = register("suki"),
    franco = register("franco");
  store.setMode("franco", "auto");
  let resolveReply, started;
  const reached = new Promise((resolve) => {
    started = resolve;
  });
  const server = createApp({
    store,
    llm: { configured: true },
    clientDir: fileURLToPath(new URL("../client/", import.meta.url)),
    characterDir: fileURLToPath(new URL("../../characters/", import.meta.url)),
    complete: () => {
      started();
      return new Promise((resolve) => {
        resolveReply = resolve;
      });
    },
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const root = "http://127.0.0.1:" + server.address().port;
  const post = (path, body, token = suki.token, extra = {}) =>
    fetch(root + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: "hutong=" + token,
        ...extra,
      },
      body: JSON.stringify(body),
    });
  assert.equal((await fetch(root + "/style.css")).status, 200);
  assert.equal((await fetch(root + "/characters/f01.png")).status, 200);
  assert.equal((await fetch(root + "/characters/f09.png")).status, 404);
  const reply = post("/api/chats/franco/messages", { text: "在吗" });
  await reached;
  assert.equal(store.messages("franco:suki")[0].body, "在吗");
  await post("/api/me/mode", { mode: "manual" }, franco.token);
  resolveReply("过时的回复");
  const result = await (await reply).json();
  assert.equal(result.messages.length, 1);
  assert.equal(
    store.messages("franco:suki").some((m) => m.source === "llm"),
    false,
  );
  assert.equal(
    (
      await post("/api/me/mode", { mode: "auto" }, suki.token, {
        Origin: "https://evil.example",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await post("/api/me/mode", { mode: "auto" }, suki.token, {
        Origin: "null",
      })
    ).status,
    403,
  );
  for (let i = 0; i < 15; i++)
    await post("/api/auth/login", {
      name: "nobody",
      password: "wrong-password",
    });
  assert.equal(
    (
      await post("/api/auth/login", {
        name: "nobody",
        password: "wrong-password",
      })
    ).status,
    429,
  );
});
