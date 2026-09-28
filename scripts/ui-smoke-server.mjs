// Isolated browser-test fixture. No access to production accounts, database or API keys.
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { openStore } from "../src/server/store.mjs";
import { createApp } from "../src/server/app.mjs";
const root = fileURLToPath(new URL("../", import.meta.url));
const directory = mkdtempSync(join(tmpdir(), "hutong-ui-")),
  store = openStore(":memory:");
store.ensureRoster(join(directory, "codes.txt"));
for (const line of readFileSync(join(directory, "codes.txt"), "utf8")
  .trim()
  .split(/\r?\n/)) {
  const [name, claimCode] = line.split("\t");
  store.register({ name, claimCode, password: "ui-test-only-123" });
}
const server = createApp({
  store,
  llm: { configured: true },
  clientDir: join(root, "src/client"),
  characterDir: join(root, "characters"),
  loginBackground: join(root, "examples/login/login-office-background.png"),
  complete: async () => "我在，怎么啦？",
});
server.listen(8798, "127.0.0.1", () =>
  console.log("Isolated UI fixture http://127.0.0.1:8798"),
);
function stop() {
  server.closeAllConnections();
  server.close();
  store.close();
  rmSync(directory, { recursive: true, force: true });
}
process.on("SIGINT", () => {
  stop();
  process.exit();
});
process.on("SIGTERM", () => {
  stop();
  process.exit();
});
