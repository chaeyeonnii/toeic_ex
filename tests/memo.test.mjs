import { test } from "node:test";
import assert from "node:assert/strict";
import { buildMemo } from "../scripts/build-memo.mjs";

test("memo bank is stable and has valid answers for all generated formats", () => {
  const questions = buildMemo();
  assert.equal(questions.length, 589);
  assert.deepEqual(buildMemo(), questions);
  assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
  assert.deepEqual([...new Set(questions.map((q) => q.id.split(":").at(-1)))].sort(), ["cat", "cls", "fill", "mean", "np", "prep", "vt"]);
  for (const q of questions) {
    assert(q.exp);
    assert(q.options.some((o) => o.k === q.answer));
    assert.equal(new Set(q.options.map((o) => o.k)).size, q.options.length);
  }
});

test("preposition choices avoid alternative correct answers", () => {
  const questions = buildMemo();
  const arrive = questions.find((q) => q.id.endsWith(":prep") && q.prompt.startsWith("[arrive]"));
  assert.equal(arrive.answer, "in");
  assert(!arrive.prompt.includes("뜻:"));
  assert(!arrive.options.some((o) => o.k === "at"));
  for (const q of questions.filter((q) => q.id.endsWith(":prep") && q.instr === "알맞은 전치사를 고르세요")) {
    assert.equal(q.options.length, 4);
    assert(q.options.every((o) => !o.k.includes("/")));
  }
  const result = questions.filter((q) => q.id.endsWith(":prep") && q.prompt.startsWith("[result]"));
  assert.equal(result.length, 2);
  for (const q of result) {
    assert(q.prompt.includes("뜻:"));
    assert(q.options.every((o) => o.k === q.answer || !["in", "from"].includes(o.k)));
  }
});

test("verb classification offers only intransitive and transitive labels", () => {
  const questions = buildMemo().filter((q) => q.id.endsWith(":cls"));
  assert(questions.length > 0);
  for (const q of questions) assert.deepEqual(q.options.map((o) => o.k), ["자동사", "타동사"]);
  const arrive = questions.find((q) => q.prompt.startsWith("[arrive]"));
  assert.equal(arrive.answer, "자동사");
  assert(arrive.exp.includes("전치사를 붙여 씀"));
});

test("new formats conceal hints and offer relevant distractors", () => {
  const questions = buildMemo();
  const pair = questions.find((q) => q.prompt === "[dependable]");
  assert(pair.options.some((o) => o.label === "의존하는"));
  assert(pair.exp.includes("dependent"));
  const noun = questions.find((q) => q.prompt === "[organization]");
  assert.equal(noun.answer, "명사");
  assert(noun.exp.includes("어미 -tion"));
  for (const q of questions.filter((q) => q.id.endsWith(":fill"))) {
    assert(q.prompt.includes("( ______ )"));
    assert.equal(q.options.length, 4);
  }
  const noPrep = questions.find((q) => q.id.endsWith(":np") && q.prompt === "[rise]");
  const prep = questions.find((q) => q.id.endsWith(":np") && q.prompt === "[arrive]");
  assert.equal(noPrep.answer, "전치사 필요 없음");
  assert.equal(prep.answer, "전치사 필요");
});
