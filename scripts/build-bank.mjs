import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { buildMemo } from "./build-memo.mjs";

const raw = JSON.parse(readFileSync(new URL("../data/questions_raw.json", import.meta.url), "utf8"));
const questions = [], passages = {}, units = [];
const labels = { "-": "해당 없음", "형,부": "형·부 둘 다" };
const option = (k) => ({ k, label: labels[k] ?? k });
const overrides = { "5V-0": "VOCA 실전 체험하기 1~5회", "6-14": "장문 빈칸 채우기", "7-15": "독해 (단일·이중·삼중 지문)" };
for (const u of raw) {
  const uid = `${u.part}-${u.unit}`;
  units.push({ key: uid, part: u.part, unit: u.unit, title: u.title, short: overrides[uid] ?? u.title.split(", ").at(-1), num: +u.unit ? `Unit ${+u.unit}` : "종합" });
  for (const s of u.sections) {
    const box = s.instruction.match(/\s*\(박스:\s*([^)]*)\)/);
    const boxOptions = box ? box[1].split(",").map((v) => v.trim()) : null;
    const base = { unitKey: uid, part: u.part, unit: +u.unit, cat: s.name.startsWith("actual") ? "actual" : s.name.startsWith("example") ? "example" : "practice", sec: s.name, instr: s.instruction.replace(/\s*\(박스:\s*([^)]*)\)/g, "").trim() };
    const distinct = [...new Set(s.items.map((i) => i.answer))];
    const add = (i, n, extra) => {
      const id = `${uid}:${s.name}:${n}`;
      questions.push({ ...base, id, set: id, no: n, answer: i.answer, ...extra });
    };
    if (s.type === "mcq") {
      for (const p of s.passages) {
        const pid = `${uid}:${s.name}:${p.id}`;
        passages[pid] = p.text;
        for (const q of p.qs) questions.push({ ...base, id: `${pid}:${q.no}`, set: pid, kind: "mcq", no: q.no, prompt: q.stem, options: [..."ABCD"].map((k) => ({ k, label: q.choices[k] })), answer: q.answer });
      }
      for (const q of s.items) add(q, q.no, { kind: "mcq", prompt: q.stem, options: [..."ABCD"].map((k) => ({ k, label: q.choices[k] })) });
    } else if (s.type === "word") {
      s.items.forEach((i, n) => add(i, n + 1, { kind: "choice", prompt: i.term, options: distinct.map(option) }));
    } else if (s.type === "ox") {
      for (const i of s.items) add(i, i.no, { kind: "choice", prompt: i.prompt, options: [option("O"), option("X")], answer: i.answer.trim().toUpperCase() });
    } else if (s.type === "choice") {
      for (const i of s.items) {
        const regex = /\(\s*([^()]*?\s\/\s[^()]*?)\s*\)/g;
        const matches = [...i.prompt.matchAll(regex)];
        const inline = matches.length === 1 ? matches[0][1].split("/").map((v) => v.trim()) : null;
        if (inline?.includes(i.answer)) add(i, i.no, { kind: "choice", prompt: i.prompt.replace(regex, "( ______ )"), options: inline.map(option) });
        else if (boxOptions) add(i, i.no, { kind: "choice", prompt: i.prompt, options: boxOptions.map(option) });
        else if (distinct.length <= 6 && distinct.length < s.items.length) add(i, i.no, { kind: "choice", prompt: i.prompt, options: distinct.map(option) });
        else add(i, i.no, { kind: "type", prompt: i.prompt, options: null });
      }
    } else if (s.type === "para") {
      for (const i of s.items) {
        const answer = [...s.bank].sort((a, b) => b.length - a.length).find((b) => i.answer.toLowerCase().includes(b.toLowerCase()));
        assert(answer, `Missing paraphrase answer: ${uid}:${s.name}:${i.no}`);
        add(i, i.no, { kind: "choice", prompt: `${i.sentence}\n→ 「${i.phrase}」을(를) 바꿔 쓰면?`, options: s.bank.map(option), answer });
      }
    } else throw new Error(`Unknown question type: ${s.type}`);
  }
}
assert.equal(questions.length, 787);
questions.push(...buildMemo());
const byId = new Map(questions.map((q) => [q.id, q]));
const explanationsDir = new URL("../data/exp/", import.meta.url);
for (const filename of readdirSync(explanationsDir).filter((name) => name.endsWith(".txt")).sort()) {
  for (const line of readFileSync(new URL(filename, explanationsDir), "utf8").split(/\r?\n/)) {
    if (!line.trim() || line.startsWith("#") || !line.includes("|")) continue;
    const divider = line.indexOf("|");
    const question = byId.get(line.slice(0, divider));
    if (question && !question.exp) question.exp = line.slice(divider + 1).trim().replaceAll("\\n", "\n");
  }
}
assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
for (const q of questions) {
  assert(units.some((u) => u.key === q.unitKey), `Missing unit: ${q.id}`);
  if (q.options) assert(q.options.some((o) => o.k === q.answer), `Invalid answer: ${q.id}`);
  if (q.set !== q.id) assert(passages[q.set], `Missing passage: ${q.id}`);
}
const info = [["5", "Part 5", "문법 (Unit 1~10)"], ["5V", "Part 5 VOCA", "빈출 어휘 (Unit 11~13)"], ["6", "Part 6", "장문 빈칸 (Unit 14)"], ["7", "Part 7", "독해 (Unit 15)"]];
const parts = info.map(([key, label, sub]) => ({ key, label, sub, units: units.filter((u) => u.part === key).sort((a, b) => (+a.unit || 99) - (+b.unit || 99)) }));
const memoLegacyIds = JSON.parse(readFileSync(new URL("../data/memo_legacy_ids.json", import.meta.url), "utf8"));
writeFileSync(new URL("../public/bank.json", import.meta.url), JSON.stringify({ version: "memo-v4", memoLegacyIds, parts, questions, passages }));
console.log(`Validated ${questions.length} questions, ${Object.keys(passages).length} passages, ${units.length} units.`);
