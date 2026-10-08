import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const PREP = "자동사";
const COMPL = "자동사";
const TRANS = "타동사";
const INT = "자동사", TR = "타동사";
const PREPS = ["with", "of", "for", "on", "in", "to", "at", "from", "about", "into", "by", "as"];

// Stable choices across builds; the original question IDs stay unchanged.
function random(seed) {
  let state = 2166136261;
  for (const ch of seed) state = Math.imul(state ^ ch.charCodeAt(0), 16777619);
  return () => {
    state |= 0;
    state = state + 0x6d2b79f5 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function buildMemo() {
  const lists = [];
  let current;
  for (const line of readFileSync(new URL("../data/memo_src.txt", import.meta.url), "utf8").split(/\r?\n/)) {
    const ln = line.trimEnd();
    if (!ln || ln.startsWith("#")) continue;
    if (ln.startsWith("@list")) {
      const [unit, title, kind, ...opts] = ln.slice(5).trim().split("|");
      current = { unit, title, kind, opts, rows: [] };
      lists.push(current);
    } else if (current) current.rows.push(ln.split("|"));
  }
  const out = [], classify = [];
  for (const list of lists) {
    for (const row of list.rows) {
      if (list.kind === "vprep" && !["call", "put"].includes(row[0])) classify.push([row[0], PREP, row[2], list.unit]);
      else if (list.kind === "compl") classify.push([row[0], COMPL, row[1], list.unit]);
      else if (list.kind === "trans") classify.push([row[0], TRANS, row[1], list.unit]);
    }
  }
  const add = (list, li, n, kind, prompt, options, answer, exp, instr) => {
    const id = `${list.unit}:memo:${li}:${n}:${kind}`;
    assert(options.includes(answer), `Missing answer: ${id}`);
    assert.equal(new Set(options).size, options.length, `Duplicate options: ${id}`);
    const [part, unit] = list.unit.split("-");
    out.push({ unitKey: list.unit, part, unit: +unit, cat: "memo", sec: list.title, instr, id, set: id, kind: "choice", no: n, prompt, options: options.map((k) => ({ k, label: k })), answer, exp });
  };
  lists.forEach((list, li) => {
    const rng = random(`${list.unit}${li}`);
    const shuffled = (values) => {
      const result = [...values];
      for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
      }
      return result;
    };
    const pick = (values, excluded, count = 3) => shuffled([...new Set(values)].filter((v) => !excluded.includes(v))).slice(0, count);
    const tokens = (value) => value.trim().split(/[/\s]+/);
    const means = list.rows.map((r) => r[list.kind === "compl" || list.kind === "mean" ? 1 : 2]);
    list.rows.forEach((r, index) => {
      const n = index + 1;
      const put = (...args) => add(list, li, n, ...args);
      if (["vprep", "adjprep", "vgroup"].includes(list.kind)) {
        const [word, prep, meaning] = r;
        const adjective = list.kind === "adjprep";
        const grouped = list.kind === "vgroup";
        const group = list.rows.filter((row) => row[0] === word);
        const expression = `${adjective ? "be " : ""}${word} ${prep}`;
        const exp = `${expression} : ${meaning}`;
        if (grouped) {
          put("prep", `[${word}] ( ______ )\n뜻: ${meaning}`, shuffled(group.map((row) => row[1])), prep, exp, "전치사에 따라 뜻이 달라져요. 뜻에 맞는 전치사를 고르세요");
        } else {
          const valid = new Set(group.flatMap((row) => tokens(row[1])));
          const answer = tokens(prep)[0];
          const options = [answer, ...pick(PREPS.filter((p) => !valid.has(p)), [])];
          const prompt = `${adjective ? "be " : ""}[${word}] ( ______ )${group.length > 1 ? `\n뜻: ${meaning}` : ""}`;
          put("prep", prompt, shuffled(options), answer, exp, "알맞은 전치사를 고르세요");
        }
        if (grouped) put("mean", expression, shuffled(group.map((row) => row[2])), meaning, exp, "알맞은 뜻을 고르세요");
      } else if (list.kind === "compl") {
        const [word, meaning] = r;
        put("np", `[${word}]`, ["전치사 필요 없음", "전치사 필요"], "전치사 필요 없음", `${word} : ${meaning} → 완전자동사, 전치사 없이 쓴다`, "이 동사 뒤에 전치사가 필요할까요?");
        if (index === list.rows.length - 1) {
          const need = lists.filter((l) => l.kind === "vprep").flatMap((l) => l.rows.filter((row) => !["call", "put"].includes(row[0]) && l.rows.filter((x) => x[0] === row[0]).length === 1).map((row) => row[0]));
          need.forEach((v, i) => {
            const m = lists.filter((l) => l.kind === "vprep").flatMap((l) => l.rows).find((row) => row[0] === v)[2];
            add(list, li, i + 100, "np", `[${v}]`, ["전치사 필요 없음", "전치사 필요"], "전치사 필요", `${v} + 전치사 : ${m}`, "이 동사 뒤에 전치사가 필요할까요?");
          });
        }
      } else if (list.kind === "both") {
        const [expression, kind, meaning] = r;
        put("vt", `[${expression}]\n뜻: ${meaning}`, [INT, TR], kind === "자" ? INT : TR, `${expression} → ${kind}동사 용법 : ${meaning}`, "자동사(전치사 필요)일까, 타동사(바로 목적어)일까?");
      } else if (list.kind === "cat") {
        const [item, label, meaning] = r;
        const labels = list.opts[1].split(";").map((v) => v.trim());
        if (label.includes("/") && !labels.includes(label) && label.split("/").every((v) => labels.includes(v.trim()))) return;
        const match = item.match(/^(.*?)\s*\((-[^)]*)\)$/);
        const shown = match ? match[1] : item;
        const hint = match ? ` (어미 ${match[2]})` : "";
        put("cat", `[${shown}]`, labels, label, `${shown} → ${label}${hint} : ${meaning}`, list.opts[0]);
      } else if (list.kind === "mean") {
        const [item, meaning] = r;
        const exp = `${item} : ${meaning}`;
        put("mean", `[${item}]`, shuffled([meaning, ...pick(means, [meaning])]), meaning, exp, "알맞은 뜻을 고르세요");
        if (means.filter((m) => m === meaning).length === 1 && list.rows.length >= 8) {
          const items = list.rows.filter((row) => row[1] !== meaning).map((row) => row[0]);
          put("rev", `뜻: [${meaning}]`, shuffled([item, ...pick(items, [])]), item, exp, "알맞은 표현을 고르세요");
        }
      } else if (list.kind === "pair") {
        const [word, meaning] = r;
        const partner = list.rows[index + (index % 2 === 0 ? 1 : -1)];
        assert(partner, `Missing adjective pair: ${word}`);
        const distractors = pick(list.rows.map((row) => row[1]), [meaning, partner[1]], 2);
        put("mean", `[${word}]`, shuffled([meaning, partner[1], ...distractors]), meaning, `${word} : ${meaning}  ↔  ${partner[0]} : ${partner[1]}`, "비슷하게 생긴 형용사! 알맞은 뜻을 고르세요");
      } else if (list.kind === "fill") {
        const [sentence, answer, distractors, exp] = r;
        put("fill", sentence.replaceAll("( ___ )", "( ______ )"), shuffled([answer, ...distractors.split(";")]), answer, exp, list.opts[0]);
      } else if (list.kind !== "trans") throw new Error(`Unknown memo kind: ${list.kind}`);
    });
  });
  const seen = new Set();
  const needPrep = new Set(lists.filter((list) => list.kind === "vprep").flatMap((list) => list.rows.map((row) => row[0])));
  let n = 0;
  for (const [word, label, meaning, unit] of classify) {
    if (seen.has(word)) continue;
    seen.add(word);
    add({ unit, title: "자동사 vs 타동사 구분하기" }, 900, ++n, "cls", `[${word}]\n(${meaning})`, [INT, TR], label, `${word} → ${label} (${meaning})${label === INT && needPrep.has(word) ? " : 전치사를 붙여 씀" : ""}`, "자동사일까요, 타동사일까요?");
  }
  return out;
}
