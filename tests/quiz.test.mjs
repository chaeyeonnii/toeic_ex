import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const bank = JSON.parse(readFileSync(new URL("../public/bank.json", import.meta.url), "utf8"));
const source = readFileSync(new URL("../public/static/app.js", import.meta.url), "utf8");

async function app(storage = new Map()) {
  if (!storage.has("toeic.bank-version")) storage.set("toeic.bank-version", JSON.stringify(bank.version));
  const root = { innerHTML: "" };
  const context = vm.createContext({
    document: {
      getElementById: (id) => id === "app" ? root : null,
      addEventListener() {}, querySelectorAll: () => [],
    },
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    fetch: async () => ({ ok: true, json: async () => bank }),
    navigator: {}, window: { scrollTo() {} }, setTimeout, clearTimeout,
  });
  vm.runInContext(source.replace("load();\n})();", "globalThis.ready = load(); globalThis.quiz = { startFrom, answer, next, makeIds, home, quiz, finish, pool, prefs };\n})();"), context);
  await context.ready;
  return { quiz: context.quiz, root, storage };
}

test("all question formats render, grade correctly, and finish", async () => {
  const { quiz, root, storage } = await app();
  const selected = [...new Set(bank.questions.map((q) => q.kind))].map((kind) => bank.questions.find((q) => q.kind === kind));
  selected.push(bank.questions.find((q) => q.set !== q.id));
  quiz.startFrom(selected, "테스트", { shuffle: false, count: 0 });
  for (const q of selected) {
    assert(root.innerHTML.includes(q.set !== q.id ? 'class="passage"' : q.kind === "type" ? 'id="typed"' : 'class="opts'));
    quiz.answer(q.answer);
    assert(root.innerHTML.includes("정답이에요"));
    quiz.next();
  }
  assert(root.innerHTML.includes("정답률 100%"));
  assert.equal(JSON.parse(storage.get("toeic.session")), null);
  assert.deepEqual(JSON.parse(storage.get("toeic.wrong")), {});
});

test("incorrect answers persist across reload and disappear after correction", async () => {
  const first = await app();
  const question = bank.questions.find((q) => q.kind === "mcq" && q.set === q.id);
  first.quiz.startFrom([question], "오답", { shuffle: false, count: 0 });
  first.quiz.answer(null);
  assert(JSON.parse(first.storage.get("toeic.wrong"))[question.id]);
  const reloaded = await app(first.storage);
  reloaded.quiz.quiz();
  assert(reloaded.root.innerHTML.includes("정답 확인"));
  reloaded.quiz.next();
  reloaded.quiz.startFrom([question], "복습", { shuffle: false, count: 0 });
  reloaded.quiz.answer(question.answer);
  assert.deepEqual(JSON.parse(first.storage.get("toeic.wrong")), {});
});

test("question limits retain the full passage group", async () => {
  const { quiz } = await app();
  const grouped = bank.questions.find((q) => q.set !== q.id);
  const list = bank.questions.filter((q) => q.set === grouped.set);
  const ids = quiz.makeIds(list, true, 1);
  assert.deepEqual(Array.from(ids), list.map((q) => q.id));
});

test("old preferences retain filters and opt into memo questions", async () => {
  const storage = new Map([["toeic.prefs", JSON.stringify({ units: ["5-5"], cats: { practice: true, actual: false, example: false }, shuffle: false, count: 10 })]]);
  const { quiz, root } = await app(storage);
  assert(root.innerHTML.includes('data-cat="memo"'));
  assert.equal(quiz.prefs.cats.memo, false);
  assert(quiz.pool().every((q) => q.unitKey === "5-5" && q.cat === "practice"));
  quiz.prefs.cats.practice = false;
  quiz.prefs.cats.memo = true;
  assert(quiz.pool().length > 0);
  assert(quiz.pool().every((q) => q.unitKey === "5-5" && q.cat === "memo"));
});

test("memo and original explanations appear after submitting an answer", async () => {
  const { quiz, root } = await app();
  const memo = bank.questions.find((q) => q.cat === "memo");
  const original = bank.questions.find((q) => q.cat !== "memo" && q.exp);
  for (const q of [memo, original]) {
    quiz.startFrom([q], "해설 테스트", { shuffle: false, count: 0 });
    assert(!root.innerHTML.includes('class="exp"'));
    quiz.answer(q.answer);
    assert(root.innerHTML.includes('class="exp"'));
    assert(root.innerHTML.includes("정답이에요"));
  }
});

test("saved memo answers migrate from the earlier option labels", async () => {
  const prep = bank.questions.find((q) => q.id.endsWith(":prep") && q.prompt.startsWith("[arrive]"));
  const cls = bank.questions.find((q) => q.id.endsWith(":cls") && q.prompt.startsWith("[arrive]"));
  const session = { ids: [prep.id, cls.id], idx: 0, title: "암기", res: {
    [prep.id]: { pick: "in/at", ok: true },
    [cls.id]: { pick: "자동사 + 전치사", ok: true },
  } };
  const storage = new Map([["toeic.session", JSON.stringify(session)]]);
  const { quiz, root } = await app(storage);
  const migrated = JSON.parse(storage.get("toeic.session"));
  assert.deepEqual(migrated.res[prep.id], { pick: "in", ok: true });
  assert.deepEqual(migrated.res[cls.id], { pick: "자동사", ok: true });
  quiz.quiz();
  assert(root.innerHTML.includes("정답이에요"));
});

test("reindexed memo records follow the same question and discard removed IDs", async () => {
  const [oldId, newId] = Object.entries(bank.memoLegacyIds).find(([old, current]) => current && old !== current);
  const removedId = Object.entries(bank.memoLegacyIds).find(([, current]) => current === null)[0];
  const question = bank.questions.find((q) => q.id === newId);
  const original = bank.questions.find((q) => q.cat !== "memo");
  const result = { pick: question.answer, ok: true };
  const storage = new Map([
    ["toeic.bank-version", JSON.stringify("previous")],
    ["toeic.wrong", JSON.stringify({ [oldId]: 100, [removedId]: 200, [original.id]: 300 })],
    ["toeic.session", JSON.stringify({ ids: [oldId, removedId, original.id], idx: 1, title: "복습", res: { [oldId]: result } })],
  ]);
  await app(storage);
  const session = JSON.parse(storage.get("toeic.session"));
  assert.deepEqual(session.ids, [newId, original.id]);
  assert.equal(session.idx, 1);
  assert.deepEqual(session.res[newId], result);
  assert.deepEqual(JSON.parse(storage.get("toeic.wrong")), { [newId]: 100, [original.id]: 300 });
  assert.equal(JSON.parse(storage.get("toeic.bank-version")), bank.version);
  await app(storage);
  assert.deepEqual(JSON.parse(storage.get("toeic.session")), session);
});
