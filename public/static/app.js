(() => {
"use strict";
const $app = document.getElementById("app");
const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* Storage can be unavailable in private browsing. */ } },
};
const CAT = { practice: "연습", actual: "실전", example: "예제", memo: "암기" };
let bank = null, byId = {}, partInfo = {}, unitInfo = {};
let prefs = Object.assign(
  { units: null, cats: { practice: true, actual: true, example: false, memo: false }, shuffle: true, count: 0 },
  LS.get("toeic.prefs", {})
);
prefs.cats = Object.assign({ practice: true, actual: true, example: false, memo: false }, prefs.cats);
let wrong = LS.get("toeic.wrong", {});           // {questionId: timestamp}
let S = LS.get("toeic.session", null);            // 진행 중인 퀴즈
let openParts = new Set(["5"]);
let lastResult = null;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const savePrefs = () => LS.set("toeic.prefs", prefs);
const saveWrong = () => LS.set("toeic.wrong", wrong);
const saveSession = () => LS.set("toeic.session", S);
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 1800);
}
const shuffleArr = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ---------- 데이터 ---------- */
async function load() {
  $app.innerHTML = '<p class="sub" style="margin-top:40vh;text-align:center">문제를 불러오는 중…</p>';
  try {
    const r = await fetch("/api/bank");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    bank = await r.json();
  } catch {
    $app.innerHTML = '<p class="sub" style="margin-top:30vh;text-align:center">문제를 불러오지 못했어요.<br>인터넷에 한 번 연결한 뒤 다시 열어 주세요.</p>';
    return;
  }
  bank.questions.forEach((q) => (byId[q.id] = q));
  bank.parts.forEach((p) => { partInfo[p.key] = p; p.units.forEach((u) => (unitInfo[u.key] = u)); });
  if (LS.get("toeic.bank-version", null) !== bank.version) {
    const mapId = (id) => Object.hasOwn(bank.memoLegacyIds || {}, id) ? bank.memoLegacyIds[id] : id;
    const migratedWrong = {};
    for (const [id, timestamp] of Object.entries(wrong)) {
      const mapped = mapId(id);
      if (mapped && byId[mapped]) migratedWrong[mapped] = timestamp;
    }
    wrong = migratedWrong;
    saveWrong();
    if (S) {
      const ids = S.ids.map(mapId).filter((id) => id && byId[id]);
      const idx = S.ids.slice(0, S.idx).map(mapId).filter((id) => id && byId[id]).length;
      const res = {};
      for (const [id, result] of Object.entries(S.res)) {
        const mapped = mapId(id);
        if (mapped && byId[mapped]) res[mapped] = result;
      }
      S = ids.length ? { ...S, ids, idx: Math.min(idx, ids.length - 1), res } : null;
      saveSession();
    }
    LS.set("toeic.bank-version", bank.version);
  }
  if (!prefs.units) prefs.units = bank.questions.map((q) => q.unitKey).filter((v, i, a) => a.indexOf(v) === i);
  // 삭제된 문제 정리
  if (S && S.ids.some((id) => !byId[id])) { S = null; saveSession(); }
  // Keep answers from the earlier memo format when option labels have changed.
  if (S) {
    let migrated = false;
    for (const [id, result] of Object.entries(S.res)) {
      const q = byId[id];
      if (!q || q.cat !== "memo" || result.pick === null || q.options.some((o) => o.k === result.pick)) continue;
      let pick = result.pick;
      if (id.endsWith(":cls")) {
        if (["자동사 + 전치사", "완전자동사 (전치사·목적어 없음)"].includes(pick)) pick = "자동사";
        else if (pick === "타동사 (바로 목적어)") pick = "타동사";
      } else if (id.endsWith(":prep")) pick = String(pick).trim().split(/[/\s]+/)[0];
      if (q.options.some((o) => o.k === pick)) {
        result.pick = pick;
        result.ok = pick === q.answer;
        migrated = true;
      }
    }
    if (migrated) saveSession();
  }
  home();
}

const pool = () => bank.questions.filter((q) => prefs.units.includes(q.unitKey) && prefs.cats[q.cat]);
function unitCount(key) { return bank.questions.filter((q) => q.unitKey === key && prefs.cats[q.cat]).length; }

function makeIds(list, shuffle, count) {
  const sets = [], idx = {};
  list.forEach((q) => { if (!(q.set in idx)) { idx[q.set] = sets.length; sets.push([]); } sets[idx[q.set]].push(q.id); });
  const order = shuffle ? shuffleArr(sets) : sets;
  const ids = [];
  for (const s of order) { if (count && ids.length >= count) break; ids.push(...s); }
  return ids;
}

/* ---------- 홈 ---------- */
function home() {
  const total = pool().length;
  const wrongIds = Object.keys(wrong).filter((id) => byId[id]);
  const answered = S ? Object.keys(S.res).length : 0;
  let h = `<h1>토익 퀴즈</h1><p class="sub">파트·유닛을 골라 풀거나, 섞어서 풀 수 있어요.</p>`;
  if (S && answered < S.ids.length) {
    h += `<div class="card row"><div class="grow"><h2>풀던 퀴즈 이어 풀기</h2><div class="muted">${esc(S.title)} · ${answered}/${S.ids.length} 완료</div></div>
      <button class="btn" style="width:auto" data-a="resume">이어서</button></div>`;
  }
  h += `<div class="row" style="margin:14px 0 4px"><h2 class="grow">범위 선택</h2>
    <button class="chip" data-a="all">전체 선택</button><button class="chip" data-a="none">해제</button></div>`;
  bank.parts.forEach((p) => {
    const keys = p.units.map((u) => u.key);
    const on = keys.filter((k) => prefs.units.includes(k)).length;
    const cnt = keys.reduce((s, k) => s + unitCount(k), 0);
    h += `<details class="part" data-part="${p.key}" ${openParts.has(p.key) ? "open" : ""}>
      <summary><input type="checkbox" data-part-cb="${p.key}" ${on === keys.length ? "checked" : ""} data-ind="${on > 0 && on < keys.length ? 1 : 0}">
        <div class="grow"><h2>${esc(p.label)}</h2><div class="muted">${esc(p.sub)} · ${cnt}문항</div></div></summary>`;
    p.units.forEach((u) => {
      h += `<label class="unit"><input type="checkbox" data-unit="${u.key}" ${prefs.units.includes(u.key) ? "checked" : ""}>
        <div class="t"><b>${esc(u.num)}</b> ${esc(u.short)}<small>${unitCount(u.key)}문항</small></div></label>`;
    });
    h += `</details>`;
  });
  h += `<div class="card"><h2>문제 유형</h2><div class="chips" style="margin-top:10px">
    ${Object.keys(CAT).map((c) => `<button class="chip ${prefs.cats[c] ? "on" : ""}" data-cat="${c}">${CAT[c]}</button>`).join("")}</div>
    <div class="muted" style="margin-top:8px">연습=감성 갖추기 · 실전=실전 체험하기 · 예제=본책 풀이 예시 · 암기=[암기 필수] 박스 퀴즈</div></div>
    <div class="card"><h2>문제 수</h2><div class="chips" style="margin-top:10px">
    ${[0, 10, 20, 30, 50].map((n) => `<button class="chip ${prefs.count === n ? "on" : ""}" data-count="${n}">${n ? n + "문항" : "전체"}</button>`).join("")}</div>
    <label class="sw" style="margin-top:10px"><span><b>문제 순서 섞기</b><div class="muted">끄면 책 순서대로 나와요</div></span>
    <span class="switch"><input type="checkbox" data-shuffle ${prefs.shuffle ? "checked" : ""}><i></i></span></label></div>`;
  const n = prefs.count ? Math.min(prefs.count, total) : total;
  h += `<div class="sticky"><div class="in">
    ${wrongIds.length ? `<button class="btn sec" data-a="wrong" style="flex:.8">오답 노트 ${wrongIds.length}</button>` : ""}
    <button class="btn" data-a="start" ${total ? "" : "disabled"}>${total ? `시작하기 (${n}문항)` : "범위를 선택하세요"}</button></div></div>`;
  $app.innerHTML = h;
  document.querySelectorAll("[data-ind='1']").forEach((el) => (el.indeterminate = true));
}

function startFrom(list, title, o = {}) {
  const shuffle = o.shuffle !== undefined ? o.shuffle : prefs.shuffle;
  const count = o.count !== undefined ? o.count : prefs.count;
  const ids = makeIds(list, shuffle, count);
  if (!ids.length) return toast("풀 문제가 없어요");
  S = { ids, idx: 0, res: {}, title };
  saveSession(); quiz(); window.scrollTo(0, 0);
}

document.addEventListener("click", (e) => {
  const el = e.target.closest("[data-a],[data-cat],[data-count],[data-opt],[data-pick]");
  if (!el) return;
  if (el.dataset.cat) {
    const c = el.dataset.cat;
    if (prefs.cats[c] && Object.values(prefs.cats).filter(Boolean).length === 1) return toast("하나는 선택해야 해요");
    prefs.cats[c] = !prefs.cats[c]; savePrefs(); return home();
  }
  if (el.dataset.count !== undefined) { prefs.count = +el.dataset.count; savePrefs(); return home(); }
  if (el.dataset.pick !== undefined) return answer(el.dataset.pick);
  switch (el.dataset.a) {
    case "all": prefs.units = Object.keys(unitInfo); savePrefs(); home(); break;
    case "none": prefs.units = []; savePrefs(); home(); break;
    case "start": startFrom(pool(), titleOf()); break;
    case "wrong": startFrom(Object.keys(wrong).filter((id) => byId[id]).map((id) => byId[id]), "오답 노트"); break;
    case "resume": quiz(); break;
    case "exit": home(); window.scrollTo(0, 0); break;
    case "reshuffle": reshuffle(); break;
    case "next": next(); break;
    case "giveup": answer(null); break;
    case "submit": submitTyped(); break;
    case "retry-wrong": {
      const ids = lastResult.wrongIds.map((id) => byId[id]);
      startFrom(ids, "틀린 문제 다시 풀기", { count: 0 }); break;
    }
    case "retry-all": {
      const ids = lastResult.ids.map((id) => byId[id]);
      startFrom(ids, lastResult.title, { count: 0, shuffle: true }); break;
    }
  }
});
document.addEventListener("change", (e) => {
  const t = e.target;
  if (t.dataset.unit) {
    const s = new Set(prefs.units);
    if (t.checked) s.add(t.dataset.unit); else s.delete(t.dataset.unit);
    prefs.units = [...s]; savePrefs(); home();
  } else if (t.dataset.partCb) {
    const keys = partInfo[t.dataset.partCb].units.map((u) => u.key);
    const s = new Set(prefs.units); keys.forEach((k) => (t.checked ? s.add(k) : s.delete(k)));
    prefs.units = [...s]; savePrefs(); home();
  } else if (t.hasAttribute("data-shuffle")) { prefs.shuffle = t.checked; savePrefs(); }
});
document.addEventListener("click", (e) => {      // 체크박스를 눌러도 details가 접히지 않게
  if (e.target.matches("summary input")) e.stopPropagation();
}, true);
document.addEventListener("toggle", (e) => {
  const d = e.target;
  if (d.dataset && d.dataset.part) {
    if (d.open) openParts.add(d.dataset.part); else openParts.delete(d.dataset.part);
  }
}, true);
document.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.id === "typed") submitTyped(); });

function titleOf() {
  const us = prefs.units;
  const all = Object.keys(unitInfo).length;
  if (us.length === all) return "전체 섞어 풀기";
  const parts = bank.parts.filter((p) => p.units.every((u) => us.includes(u.key)));
  if (parts.length && parts.reduce((s, p) => s + p.units.length, 0) === us.length) return parts.map((p) => p.label).join(" + ");
  if (us.length === 1) return `${partInfo[unitInfo[us[0]].part].label} ${unitInfo[us[0]].num}`;
  return `선택한 ${us.length}개 유닛`;
}

/* ---------- 퀴즈 ---------- */
const curQ = () => byId[S.ids[S.idx]];
const normalize = (s) => String(s).toLowerCase().replace(/[~.,!?]/g, "").replace(/\s+/g, " ").trim();

function reshuffle() {
  let end = S.idx; const set = curQ().set;
  while (end < S.ids.length && byId[S.ids[end]].set === set) end++;
  const tail = S.ids.slice(end).filter((id) => !S.res[id]);
  if (tail.length < 2) return toast("섞을 남은 문제가 없어요");
  const sets = [], idx = {};
  tail.forEach((id) => { const k = byId[id].set; if (!(k in idx)) { idx[k] = sets.length; sets.push([]); } sets[idx[k]].push(id); });
  S.ids = S.ids.slice(0, end).concat(...shuffleArr(sets));
  saveSession(); toast("남은 문제 순서를 섞었어요"); quiz();
}

function answer(pick) {
  const q = curQ(); if (S.res[q.id]) return;
  let ok = false;
  if (pick !== null) ok = q.kind === "type" ? normalize(pick) === normalize(q.answer) : pick === q.answer;
  S.res[q.id] = { pick, ok };
  if (ok) delete wrong[q.id]; else wrong[q.id] = Date.now();
  saveWrong(); saveSession(); quiz(true);
}
function submitTyped() {
  const el = document.getElementById("typed"); if (!el || !el.value.trim()) return toast("정답을 입력하세요");
  answer(el.value);
}
function next() {
  if (S.idx + 1 >= S.ids.length) return finish();
  S.idx++; saveSession(); quiz(); window.scrollTo(0, 0);
}

function label(q, k) { const o = (q.options || []).find((o) => o.k === k); return o ? o.label : k; }

function passageHTML(text, q) {
  const docs = text.split("\n---\n");
  const title = docs[0].split("\n")[0];
  const cur = q.kind === "mcq" && !q.prompt ? String(q.no) : null;
  const body = docs.map((d, i) => {
    let lines = d.split("\n"); if (i === 0) lines = lines.slice(1);
    let out = "", tbl = [];
    const flush = () => { if (tbl.length) { out += "<table>" + tbl.map((r) => "<tr>" + r.split(" | ").map((c) => `<td>${fmt(c)}</td>`).join("") + "</tr>").join("") + "</table>"; tbl = []; } };
    lines.forEach((ln) => { if (ln.includes(" | ")) tbl.push(ln); else { flush(); out += `<p>${fmt(ln)}</p>`; } });
    flush();
    return out;
  }).join("<hr>");
  function fmt(s) {
    return esc(s).replace(/\[(\d+)\]/g, (m, n) => `<span class="${n === cur ? "cur" : "blank"}">[${n}]</span>`);
  }
  return `<details class="passage" open><summary>📄 ${esc(title)}</summary><div class="body" id="pbody">${body}</div></details>`;
}

function quiz(keepScroll) {
  if (!S) return home();
  const q = curQ(), r = S.res[q.id], total = S.ids.length;
  const oldP = document.getElementById("pbody"), oldTop = oldP ? oldP.scrollTop : 0;
  const ps = partInfo[q.part];
  let h = `<div class="top"><button class="icon" data-a="exit" aria-label="홈">✕</button>
    <div class="bar"><b style="width:${(Object.keys(S.res).length / total) * 100}%"></b></div>
    <span class="cnt">${S.idx + 1} / ${total}</span>
    <button class="icon" data-a="reshuffle" aria-label="남은 문제 섞기" title="남은 문제 섞기">🔀</button></div>
    <div class="meta"><span class="tag">${esc(ps.label)}</span><span class="tag">${esc(unitInfo[q.unitKey].num)}</span>
    <span class="tag">${CAT[q.cat]}</span><span class="tag">${q.no}번</span></div>`;
  if (q.set !== q.id) h += passageHTML(bank.passages[q.set], q);
  else if (q.instr && q.kind !== "mcq") h += `<p class="instr">${esc(q.instr)}</p>`;
  const prompt = q.kind === "mcq" && !q.prompt ? `빈칸 [${q.no}]에 들어갈 가장 알맞은 것을 고르세요.` : q.prompt;
  const promptHTML = esc(prompt).replace(/\[([^\]\d][^\]]*)\]/g, '<span class="em">$1</span>');
  h += `<div class="prompt">${promptHTML}</div>`;
  if (q.kind === "type") {
    h += `<div class="typed"><input id="typed" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false"
      placeholder="정답 입력" ${r ? "disabled" : ""} value="${r && r.pick ? esc(r.pick) : ""}"><button class="btn" data-a="submit" ${r ? "disabled" : ""}>확인</button></div>`;
  } else {
    const n = q.options.length, short = q.options.every((o) => o.label.length <= 8);
    const cls = n === 2 && short ? "two" : n > 5 ? "chipgrid" : "";
    h += `<div class="opts ${cls}">` + q.options.map((o) => {
      let c = "opt";
      if (r) { if (o.k === q.answer) c += " ok"; else if (o.k === r.pick) c += " bad"; else c += " dim"; }
      const key = q.kind === "mcq" ? `<span class="k">(${esc(o.k)})</span>` : "";
      return `<button class="${c}" data-pick="${esc(o.k)}" ${r ? "disabled" : ""}>${key}<span>${esc(o.label)}</span></button>`;
    }).join("") + `</div>`;
  }
  if (r) {
    const ans = q.kind === "mcq" ? `(${q.answer}) ${label(q, q.answer)}` : label(q, q.answer);
    h += r.ok ? `<div class="fb ok">정답이에요! 🎉</div>`
      : `<div class="fb bad">${r.pick === null ? "정답 확인" : "오답"}<small>정답: ${esc(ans)}</small></div>`;
    if (q.exp) h += `<div class="exp">📌 ${esc(q.exp)}</div>`;
  }
  const last = S.idx + 1 >= total;
  h += `<div class="sticky"><div class="in">${r
    ? `<button class="btn" data-a="next">${last ? "결과 보기" : "다음 문제 →"}</button>`
    : `<button class="btn ghost" data-a="giveup">모르겠어요 · 정답 보기</button>`}</div></div>`;
  $app.innerHTML = h;
  const pb = document.getElementById("pbody");
  if (pb) {
    const cur = pb.querySelector(".cur");
    if (keepScroll === true) pb.scrollTop = oldTop;
    else if (cur) pb.scrollTop = Math.max(0, cur.offsetTop - pb.clientHeight / 2);
  }
  const ti = document.getElementById("typed"); if (ti && !r) ti.focus({ preventScroll: true });
}

/* ---------- 결과 ---------- */
function finish() {
  const ids = S.ids, res = S.res;
  const wrongIds = ids.filter((id) => !res[id] || !res[id].ok);
  const okN = ids.length - wrongIds.length;
  lastResult = { ids, wrongIds, title: S.title };
  const by = {};
  ids.forEach((id) => { const q = byId[id]; const k = q.unitKey; by[k] = by[k] || [0, 0]; by[k][1]++; if (res[id] && res[id].ok) by[k][0]++; });
  const pct = Math.round((okN / ids.length) * 100);
  let h = `<h1>결과</h1><p class="sub">${esc(S.title)}</p>
    <div class="card"><div class="score">${okN} / ${ids.length}</div><p class="sub" style="text-align:center;margin:0">정답률 ${pct}%</p></div>`;
  h += `<div class="card"><h2>유닛별</h2>` + Object.keys(by).map((k) => {
    const u = unitInfo[k]; return `<div class="row" style="padding:6px 0"><span class="grow">${esc(partInfo[u.part].label)} · ${esc(u.num)}</span><b>${by[k][0]}/${by[k][1]}</b></div>`;
  }).join("") + `</div>`;
  if (wrongIds.length) {
    h += `<div class="card"><h2>틀린 문제 ${wrongIds.length}개</h2>` + wrongIds.map((id) => {
      const q = byId[id], r = res[id];
      const mine = r && r.pick !== null ? label(q, r.pick) : "(모름)";
      const ans = q.kind === "mcq" ? `(${q.answer}) ${label(q, q.answer)}` : label(q, q.answer);
      const p = q.prompt || `빈칸 [${q.no}]`;
      return `<div class="wrong-item"><div class="muted">${esc(partInfo[q.part].label)} · ${esc(unitInfo[q.unitKey].num)} · ${q.no}번</div>
        <div>${esc(p.length > 110 ? p.slice(0, 110) + "…" : p)}</div>
        <div class="muted">내 답: ${esc(mine)} → 정답 <b>${esc(ans)}</b></div></div>`;
    }).join("") + `</div>`;
  }
  h += `<div class="card" style="display:grid;gap:10px">
    ${wrongIds.length ? `<button class="btn" data-a="retry-wrong">틀린 문제만 다시 풀기</button>` : ""}
    <button class="btn sec" data-a="retry-all">같은 문제 다시 풀기 (섞기)</button>
    <button class="btn ghost" data-a="exit">홈으로</button></div>`;
  S = null; saveSession();
  $app.innerHTML = h; window.scrollTo(0, 0);
}

if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
load();
})();
