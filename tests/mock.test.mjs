import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const bank = JSON.parse(readFileSync(new URL("../public/bank.json", import.meta.url), "utf8"));

test("mock tests split into 30 rounds of Part 5 60, Part 6 16, Part 7 24", () => {
  const mock = bank.questions.filter((q) => q.part === "M");
  assert.equal(mock.length, 3000);
  assert.equal(bank.parts.find((p) => p.key === "M").units.length, 30);
  for (let r = 1; r <= 30; r++) {
    const round = mock.filter((q) => q.unitKey === `M-${r}`);
    assert.deepEqual(["part5", "part6", "part7"].map((s) => round.filter((q) => q.sec === s).length), [60, 16, 24]);
  }
  for (const q of mock) {
    assert.equal(q.options.length, 4);
    if (q.sec === "part5") assert(q.prompt.includes("_____") && q.set === q.id);
    if (q.sec === "part6") assert(!q.prompt && bank.passages[q.set].includes(`[${q.no}]`));
    if (q.sec === "part7") assert(q.prompt && bank.passages[q.set]);
  }
});
