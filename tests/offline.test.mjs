import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

test("offline navigation and question data use cached assets", async () => {
  const handlers = {};
  const assets = new Map();
  const cache = {
    async addAll(paths) { paths.forEach((path) => assets.set(path, new Response(path))); },
    async match(request) { return assets.get(typeof request === "string" ? request : new URL(request.url).pathname)?.clone(); },
    async put() {},
  };
  const context = vm.createContext({
    self: { location: { origin: "https://quiz.example" }, addEventListener: (name, fn) => { handlers[name] = fn; }, skipWaiting() {}, clients: { claim() {} } },
    caches: { open: async () => cache },
    fetch: async () => { throw new Error("Offline"); },
    URL, Response,
  });
  vm.runInContext(readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"), context);
  let ready;
  handlers.install({ waitUntil: (promise) => { ready = promise; } });
  await ready;
  for (const [path, mode, expected] of [["/", "navigate", "/offline.html"], ["/api/bank", "cors", "/api/bank"]]) {
    let response;
    handlers.fetch({ request: { url: `https://quiz.example${path}`, method: "GET", mode }, respondWith: (promise) => { response = promise; } });
    assert.equal(await (await response).text(), expected);
  }
  let intercepted = false;
  handlers.fetch({ request: { url: "https://quiz.example/_next/static/chunk.js", method: "GET", mode: "cors" }, respondWith: () => { intercepted = true; } });
  assert.equal(intercepted, false);
});
