import "./style.css";
import {
  createWorld,
  editTile,
  legalActions,
  LABELS,
  ruleAction,
  step,
  SIZE,
  type Action,
  type Tile,
  type World,
} from "./game";
import type { Decision } from "../server/jev";

const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;
const slime = (blue = false) =>
  `<svg viewBox="0 0 60 58" aria-hidden="true"><ellipse cx="30" cy="49" rx="23" ry="5" fill="#203329" opacity=".12"/><path d="M7 39C7 3 53 3 53 39Q56 50 42 48Q30 53 20 48Q4 51 7 39" fill="${blue ? "#83afc6" : "#a8cc54"}" stroke="${blue ? "#4e7f98" : "#638a39"}" stroke-width="2"/><ellipse cx="21" cy="21" rx="8" ry="4" fill="white" opacity=".38" transform="rotate(-30 21 21)"/><g fill="#294333"><ellipse cx="23" cy="33" rx="2.4" ry="3.6"/><ellipse cx="39" cy="33" rx="2.4" ry="3.6"/><path d="M28 39Q31 42 34 39" fill="none" stroke="#294333" stroke-width="1.8" stroke-linecap="round"/></g><ellipse cx="17" cy="38" rx="4" ry="2" fill="#e2987d" opacity=".7"/><ellipse cx="44" cy="38" rx="4" ry="2" fill="#e2987d" opacity=".7"/></svg>`;
const icons: Record<Tile, string> = {
  grass: "",
  food: '<span class="berry"><i></i><i></i><i></i></span>',
  hazard: '<span class="hazard-icon">✦</span>',
  shelter: '<span class="home-icon">⌂</span>',
  rock: '<span class="rock-icon"></span>',
};
const tileNames: Record<Tile, string> = {
  grass: "풀밭",
  food: "먹이",
  hazard: "위험 구역",
  shelter: "쉼터",
  rock: "바위",
};
$("#app").innerHTML = `
<header class="topbar"><a href="/" class="brand"><span class="brand-slime">${slime()}</span>slime<span class="brand-light">lab</span><span class="brand-divider"></span><span class="brand-sub">작은 선택의 실험실</span></a><a class="source-link" href="https://github.com/okorion/jev-slime-lab" target="_blank" rel="noreferrer">GitHub ↗</a></header>
<main><section class="intro"><div><div class="eyebrow"><span class="live-dot"></span> A LITTLE WORLD, A LOT OF DECISIONS</div><h1>이 작은 친구는<br>어떤 선택을 할까요<span class="green">?</span></h1><p>먹이를 찾고, 위험을 피하고, 잠깐 쉬어 가고.<br>Jev의 선택을 관찰하며 나만의 생존 실험을 해보세요.</p></div><div class="intro-note"><span class="note-number">01 / 100</span><div class="note-slime">${slime()}</div><span>작은 선택이 모여<br>하나의 여정이 됩니다.</span></div></section>
<section class="experiment-bar" aria-label="실험 설정"><div class="mode-control"><label for="mode">판단 방식</label><select id="mode"><option value="rule">무료 규칙 모드</option><option value="jev" disabled>Jev · 연결 확인 중</option></select></div><span id="connection" class="connection">연결 확인 중</span><div class="seed-control"><label for="seed">섬 번호</label><input id="seed" type="number" value="42" min="0" max="4294967295"/><button id="new-map" class="small-button" aria-label="다른 섬 만들기">↻ 다른 섬</button></div></section>
<div class="workspace"><section class="habitat panel"><div class="panel-heading"><div><span class="eyebrow">THE HABITAT</span><h2>슬라임의 작은 섬</h2></div><span class="pill" id="turn">TURN 00</span></div><div class="board-wrap"><div id="board" class="board" aria-label="실험 슬라임 지도"></div><div class="board-label"><span class="live-dot"></span><span id="agent-label">규칙 슬라임</span><span class="board-weather">✳ 맑음 · 고정 환경</span></div></div><div class="legend"><span><b class="legend-food"></b>먹이</span><span><b class="legend-home"></b>쉼터</span><span><b class="legend-hazard"></b>위험</span><span><b class="legend-rock"></b>바위</span><span class="legend-path">점선: 지나온 길</span></div><div class="vitals" id="vitals"></div><div class="playback"><button id="run" class="primary">▶ 20턴 관찰하기</button><button id="step" class="secondary">한 턴씩 →</button><button id="reset" class="reset" aria-label="같은 섬에서 다시 시작">↺</button></div><p id="status" class="status" role="status">한 턴씩 움직여 보세요. 시작 전에는 섬을 편집할 수 있어요.</p><details class="map-editor"><summary>내 손으로 섬 바꾸기 <span>시작 전 사용</span></summary><label for="brush">지도에 놓을 것</label><select id="brush"><option value="food">먹이</option><option value="hazard">위험 구역</option><option value="rock">바위</option><option value="grass">풀밭</option></select><p>타일을 클릭하세요. 두 슬라임에게 같은 섬이 적용됩니다.</p></details></section>
<aside class="inspector"><section class="panel decision-panel"><div class="panel-heading"><div><span class="eyebrow">INSIDE THE DECISION</span><h2>선택을 들여다보기</h2></div><span class="tiny-star">✳</span></div><div class="decision-title" id="decision-title">아직, 첫 선택 전</div><p id="decision-sub" class="muted">한 턴을 실행하면 이곳에 판단 결과가 나타나요.</p><div id="probabilities" class="probabilities"><div class="empty-bars"><i></i><i></i><i></i><i></i></div><p class="muted">실제 Jev 모드에서는<br>행동별 확률을 볼 수 있어요.</p></div><div class="decision-stats"><div><span>confidence</span><strong id="confidence">—</strong></div><div><span>API 왕복 시간</span><strong id="latency">—</strong></div></div><p class="fine">확률과 confidence는 모델의 판단입니다.<br>생존 성적이나 정답률을 의미하지 않아요.</p></section>
<section class="panel instruction-panel"><span class="eyebrow">A NOTE FOR YOUR SLIME</span><h2>슬라임에게 한마디</h2><label class="sr-only" for="instruction">Jev 행동 지침</label><textarea id="instruction" maxlength="300" rows="3">위험을 피하면서 먹이를 찾아. 체력이 낮아지면 안전한 곳에서 쉬어.</textarea><div class="presets"><button data-preset="위험을 최대한 피하고 안전하게 오래 살아남아.">조심조심</button><button data-preset="먹이를 적극적으로 찾아. 약간의 위험은 감수해도 좋아.">먹이 탐험가</button><button data-preset="체력이 낮으면 쉼터에서 쉬고, 에너지가 부족하면 먹이를 찾아.">쉬엄쉬엄</button></div><p class="fine">지침은 Jev 모드에만 적용됩니다. 다음 턴부터 반영돼요.</p><details><summary>실제 Jev 연결</summary><p class="fine" id="setup-text">운영자가 연결한 Jev를 개인 실험 코드로 사용합니다. 입력한 지침과 게임 상태가 TypeSafe로 전송됩니다.</p><label for="access-code">개인 실험 코드</label><input id="access-code" type="password" autocomplete="off" placeholder="코드는 현재 탭에서만 사용"/></details></section></aside></div>
<section class="comparison panel"><div class="panel-heading"><div><span class="eyebrow">SAME ISLAND, DIFFERENT CHOICES</span><h2>규칙 슬라임과 나란히</h2></div><span class="pill pale">같은 시작 조건</span></div><div class="comparison-grid"><div><div id="baseline-board" class="board mini-board" aria-label="비교 기준 슬라임 지도"></div><p class="baseline-label"><span class="blue-dot"></span>규칙 슬라임 · 안전한 최단 경로</p></div><div class="comparison-data"><div id="scoreboard"></div><div class="chart-heading"><span>체력의 흐름</span><span><b class="green-dot"></b>실험 <b class="blue-dot"></b>기준선</span></div><svg id="chart" viewBox="0 0 600 125" role="img" aria-label="턴별 실험 슬라임과 규칙 슬라임의 체력 비교"></svg><p class="fine">규칙 모드에서는 두 슬라임이 같은 정책으로 움직입니다. Jev 성능 평가는 실제 모드의 여러 섬에서 비교해 주세요.</p></div></div></section>
<section class="observations"><div><span class="eyebrow">FIELD NOTES</span><h2>관찰 기록</h2></div><button id="export" class="small-button">기록 내려받기 ↓</button></section><div class="panel logs"><div class="log-head"><span>턴</span><span>선택한 행동</span><span>체력 / 에너지</span><span>판단 출처</span></div><div id="logs"><p class="empty-log">첫 발자국을 기다리고 있어요.</p></div></div><div class="usage"><span id="usage">실제 Jev 호출 0회 · 입력 0토큰 · 추정 $0.000000</span><span>단가: 입력 100만 토큰당 $0.042 · 2026-09-21 기준</span></div>
<footer><span>slimelab <span class="footer-dot">·</span> 작게 실험하고, 직접 관찰하기.</span><a href="https://docs.typesafe.ai/introduction" target="_blank" rel="noreferrer">Jev는 어떻게 동작하나요? ↗</a></footer></main>`;

let initial = createWorld();
let world = structuredClone(initial),
  baseline = structuredClone(initial);
let mode: "rule" | "jev" = "rule",
  busy = false,
  running = false,
  epoch = 0,
  controller: AbortController | undefined;
let history: {
  turn: number;
  action: Action;
  hp: number;
  energy: number;
  baselineHp: number;
  source: string;
  decision?: Decision;
  instruction?: string;
}[] = [];
let last: Decision | undefined;
let calls = 0,
  totalTokens = 0,
  totalUsd = 0;
function board(w: World, element: HTMLElement, blue = false) {
  const visits = new Set(w.path.slice(0, -1));
  element.innerHTML = w.tiles
    .map(
      (t, i) =>
        `<button class="tile ${t} ${visits.has(i) ? "visited" : ""}" data-index="${i}" ${blue ? 'tabindex="-1"' : ""} aria-label="${(i % SIZE) + 1}열 ${Math.floor(i / SIZE) + 1}행 ${tileNames[t]}${i === w.y * SIZE + w.x ? " 슬라임 위치" : ""}">${icons[t]}${i === w.y * SIZE + w.x ? `<span class="slime ${w.ended ? "sleepy" : ""}">${slime(blue)}</span>` : ""}</button>`,
    )
    .join("");
}
function render() {
  board(world, $("#board"));
  board(baseline, $("#baseline-board"), true);
  $("#turn").textContent = `TURN ${String(world.turn).padStart(2, "0")}`;
  $("#agent-label").textContent = mode === "jev" ? "Jev 슬라임" : "규칙 슬라임";
  $(".note-number").textContent =
    `${String(world.turn).padStart(2, "0")} / 100`;
  $("#vitals").innerHTML =
    `<div><span>♥ 체력 <strong>${world.hp}</strong></span><progress value="${world.hp}" max="100" aria-label="체력"></progress></div><div><span>ϟ 에너지 <strong>${world.energy}</strong></span><progress class="energy" value="${world.energy}" max="100" aria-label="에너지"></progress></div><div class="food-total"><span>모은 먹이</span><strong>${world.food}<small>개</small></strong></div>`;
  $("#run").textContent = running ? "Ⅱ 관찰 멈추기" : "▶ 20턴 관찰하기";
  $<HTMLButtonElement>("#step").disabled = busy || running || world.ended;
  $<HTMLButtonElement>("#run").disabled = world.ended || (!running && busy);
  $<HTMLSelectElement>("#mode").disabled = busy || running;
  $<HTMLInputElement>("#seed").disabled = world.turn > 0 || busy;
  $<HTMLSelectElement>("#brush").disabled = world.turn > 0 || busy;
  $("#scoreboard").innerHTML =
    `<table><thead><tr><th>이번 실험</th><th>${mode === "jev" ? "Jev" : "규칙"} 슬라임</th><th>규칙 기준선</th></tr></thead><tbody><tr><td>생존 턴</td><td>${world.turn}</td><td>${baseline.turn}</td></tr><tr><td>모은 먹이</td><td>${world.food}개</td><td>${baseline.food}개</td></tr><tr><td>위험 노출</td><td>${world.hazards}턴</td><td>${baseline.hazards}턴</td></tr></tbody></table>`;
  const records = [{ hp: 100, baselineHp: 100 }, ...history];
  const points = (key: "hp" | "baselineHp") =>
    records
      .map(
        (h, i) =>
          `${(i / Math.max(20, history.length)) * 590 + 5},${115 - h[key]}`,
      )
      .join(" ");
  $("#chart").innerHTML =
    `<path d="M5 15H595M5 65H595M5 115H595" stroke="#e5e8dd" stroke-dasharray="3 5"/><polyline points="${points("baselineHp")}" fill="none" stroke="#83afc6" stroke-width="4" stroke-dasharray="7 5"/><polyline points="${points("hp")}" fill="none" stroke="#6b913d" stroke-width="2.5"/>`;
  if (history.length) {
    const h = history.at(-1)!;
    $("#decision-title").textContent = LABELS[h.action];
    $("#decision-sub").textContent =
      mode === "jev"
        ? `TURN ${h.turn} · ${last?.model ?? "Jev"}`
        : "규칙이 고른 행동 · AI 추론 아님";
  } else {
    $("#decision-title").textContent = "아직, 첫 선택 전";
    $("#decision-sub").textContent =
      "한 턴을 실행하면 이곳에 판단 결과가 나타나요.";
  }
  if (last) {
    $("#probabilities").innerHTML = Object.entries(last.probabilities)
      .sort((a, b) => b[1] - a[1])
      .map(
        ([a, p]) =>
          `<div class="prob-row ${a === last!.choice ? "selected" : ""}"><div><span>${LABELS[a as Action]}</span><strong>${(p * 100).toFixed(1)}%</strong></div><div class="track"><i style="width:${p * 100}%"></i></div></div>`,
      )
      .join("");
    $("#confidence").textContent = last.confidence.toFixed(3);
    $("#latency").textContent = `${last.latencyMs} ms`;
  } else {
    $("#probabilities").innerHTML =
      `<div class="empty-bars"><i></i><i></i><i></i><i></i></div><p class="muted">${history.length ? "규칙은 확률을 반환하지 않아요.<br>실제 Jev 모드에서 분포를 확인하세요." : "실제 Jev 모드에서는<br>행동별 확률을 볼 수 있어요."}</p>`;
    $("#confidence").textContent = "—";
    $("#latency").textContent = "—";
  }
  $("#logs").innerHTML = history.length
    ? history
        .slice(-8)
        .reverse()
        .map(
          (h) =>
            `<div class="log-row"><span>${String(h.turn).padStart(2, "0")}</span><strong>${LABELS[h.action]}</strong><span>${h.hp} / ${h.energy}</span><span class="log-source">${h.source}</span></div>`,
        )
        .join("")
    : '<p class="empty-log">첫 발자국을 기다리고 있어요.</p>';
  $("#usage").textContent =
    `실제 Jev 호출 ${calls}회 · 입력 ${totalTokens.toLocaleString()}토큰 · 추정 $${totalUsd.toFixed(6)}`;
}
function status(message: string) {
  $("#status").textContent = message;
}
function stop() {
  running = false;
  epoch++;
  controller?.abort();
  busy = false;
  render();
}
function reset() {
  stop();
  world = structuredClone(initial);
  baseline = structuredClone(initial);
  history = [];
  last = undefined;
  render();
  status("같은 섬에서 새 실험을 시작합니다.");
}
async function nextTurn() {
  if (busy || world.ended) return false;
  const currentEpoch = epoch;
  busy = true;
  render();
  const instruction = $<HTMLTextAreaElement>("#instruction").value.trim();
  try {
    let action: Action;
    let decision: Decision | undefined;
    if (mode === "jev") {
      const code = $<HTMLInputElement>("#access-code").value.trim();
      if (!code)
        throw new Error("실제 Jev 연결에서 개인 실험 코드를 입력해 주세요.");
      if (!instruction) throw new Error("슬라임의 행동 지침을 입력해 주세요.");
      controller = new AbortController();
      status("Jev가 다음 행동을 고르고 있어요…");
      const response = await fetch("/api/decide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-experiment-code": code,
        },
        body: JSON.stringify({ world, instruction }),
        signal: AbortSignal.any([
          controller.signal,
          AbortSignal.timeout(20_000),
        ]),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Jev 요청에 실패했습니다.");
      decision = data as Decision;
      calls++;
      totalTokens += decision.inputTokens;
      totalUsd += decision.estimatedUsd;
      if (currentEpoch !== epoch) {
        render();
        return false;
      }
      action = decision.choice as Action;
      if (!legalActions(world).includes(action))
        throw new Error("현재 상태에서 실행할 수 없는 행동입니다.");
    } else action = ruleAction(world);
    if (currentEpoch !== epoch) return false;
    world = step(world, action);
    if (!baseline.ended) baseline = step(baseline, ruleAction(baseline));
    last = decision;
    history.push({
      turn: world.turn,
      action,
      hp: world.hp,
      energy: world.energy,
      baselineHp: baseline.hp,
      source: mode === "jev" ? "Jev 실측" : "규칙",
      ...(decision ? { decision, instruction } : {}),
    });
    status(
      world.ended
        ? world.hp === 0
          ? "실험 종료 · 슬라임이 지쳤어요. 지침이나 섬을 바꿔 다시 도전해 보세요."
          : "100턴 실험 완료! 기록을 내려받아 비교해 보세요."
        : `${world.turn}턴 · ${LABELS[action]}. ${mode === "rule" ? "무료 규칙 모드로 관찰 중입니다." : "실제 Jev 판단을 적용했습니다."}`,
    );
    return true;
  } catch (e) {
    if (currentEpoch === epoch) {
      running = false;
      status(e instanceof Error ? e.message : "판단을 가져오지 못했습니다.");
    }
    return false;
  } finally {
    if (currentEpoch === epoch) {
      busy = false;
      render();
    }
  }
}
$("#step").addEventListener("click", () => void nextTurn());
$("#run").addEventListener("click", async () => {
  if (running) {
    stop();
    status("관찰을 멈췄어요. 중단 직전 서버 요청은 과금될 수 있습니다.");
    return;
  }
  running = true;
  const runEpoch = epoch;
  render();
  for (
    let i = 0;
    i < 20 && running && runEpoch === epoch && !world.ended;
    i++
  ) {
    if (!(await nextTurn())) break;
    await new Promise((r) => setTimeout(r, 1200));
  }
  if (runEpoch === epoch) {
    running = false;
    render();
  }
});
$("#reset").addEventListener("click", reset);
$("#new-map").addEventListener("click", () => {
  const seed = crypto.getRandomValues(new Uint32Array(1))[0];
  $<HTMLInputElement>("#seed").value = String(seed);
  initial = createWorld(seed);
  reset();
});
$("#seed").addEventListener("change", () => {
  const seed = Number($<HTMLInputElement>("#seed").value);
  if (!Number.isInteger(seed) || seed < 0 || seed > 4294967295) {
    $<HTMLInputElement>("#seed").value = String(initial.seed);
    status("섬 번호는 0부터 4294967295까지의 정수입니다.");
    return;
  }
  initial = createWorld(seed);
  reset();
});
$("#mode").addEventListener("change", () => {
  mode = $<HTMLSelectElement>("#mode").value as "rule" | "jev";
  reset();
});
$("#board").addEventListener("click", (e) => {
  const target = (e.target as HTMLElement).closest<HTMLButtonElement>(
    "[data-index]",
  );
  if (
    !target ||
    world.turn > 0 ||
    busy ||
    running ||
    !$<HTMLDetailsElement>(".map-editor").open
  )
    return;
  initial = editTile(
    initial,
    Number(target.dataset.index),
    $<HTMLSelectElement>("#brush").value as Tile,
  );
  world = structuredClone(initial);
  baseline = structuredClone(initial);
  render();
});
document.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((b) =>
  b.addEventListener("click", () => {
    $<HTMLTextAreaElement>("#instruction").value = b.dataset.preset!;
  }),
);
$("#export").addEventListener("click", () => {
  const data = {
    version: 1,
    mode,
    initial,
    history,
    sessionUsage: { calls, inputTokens: totalTokens, estimatedUsd: totalUsd },
    price: { usdPerMillionInputTokens: 0.042, checked: "2026-09-21" },
    notes:
      "confidence는 정확도가 아닙니다. 중단/실패 요청 비용은 세션 합계에 포함되지 않을 수 있습니다.",
  };
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `slime-lab-${initial.seed}-${mode}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && (running || busy)) {
    stop();
    status("탭이 숨겨져 관찰을 멈췄어요.");
  }
});
render();
fetch("/api/decide")
  .then((r) => {
    if (!r.ok) throw new Error();
    return r.json();
  })
  .then((data) => {
    const option = $<HTMLOptionElement>('#mode option[value="jev"]');
    option.disabled = !data.available;
    option.textContent = data.available
      ? "Jev · 실제 모델"
      : "Jev · 연결 준비 중";
    $("#connection").textContent = data.available
      ? "Jev 연결 가능 · 개인 코드 필요"
      : "무료 규칙 체험 · API 비용 없음";
  })
  .catch(() => {
    $("#connection").textContent = "무료 규칙 체험 · 연결 상태 확인 불가";
    $<HTMLOptionElement>('#mode option[value="jev"]').textContent =
      "Jev · 연결 확인 실패";
  });
