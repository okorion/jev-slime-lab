/* global process, console, document, setTimeout, innerWidth */
import { chromium } from "@playwright/test";
import { loadEnvFile } from "node:process";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
loadEnvFile(".env.local");
const slimeUrl = process.argv[2] || "http://127.0.0.1:4182";
const feedbackUrl = process.argv[3];
const evidence = process.argv[4] || "docs/evidence";
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const code = process.env.JEV_ACCESS_CODE;
const checkLayout = async () =>
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "horizontal overflow",
  );
try {
  await page.goto(slimeUrl);
  await page
    .locator("#mode option[value=jev]:not([disabled])")
    .waitFor({ state: "attached" });
  await page.locator("#step").click();
  await page.locator("#turn").filter({ hasText: "TURN 01" }).waitFor();
  assert.match(await page.locator("#decision-sub").innerText(), /AI 추론 아님/);
  await page.locator("#reset").click();
  await page.locator(".map-editor summary").click();
  await page.locator("#brush").selectOption("hazard");
  await page.locator('#board [data-index="0"]').click();
  assert.match(
    await page
      .locator('#baseline-board [data-index="0"]')
      .getAttribute("class"),
    /hazard/,
  );
  await page.locator("#mode").selectOption("jev");
  await page.locator(".instruction-panel details summary").click();
  await page.locator("#access-code").fill(code);
  for (let i = 1; i <= 5; i++) {
    await page.locator("#step").click();
    await page
      .locator("#turn")
      .filter({ hasText: `TURN ${String(i).padStart(2, "0")}` })
      .waitFor({ timeout: 25000 });
  }
  assert.ok((await page.locator(".prob-row").count()) > 0);
  assert.match(await page.locator("#decision-sub").innerText(), /jev-/);
  await page.locator(".map-editor summary").click();
  await page.locator(".instruction-panel details summary").click();
  await checkLayout();
  await page.screenshot({
    path: `${evidence}/slime-desktop.png`,
    fullPage: true,
  });
  const downloadWait = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadWait;
  await download.saveAs(`${evidence}/slime-live-record.json`);
  // 명시적 네트워크 실패: 실제 모델 결과로 표시하지 않으며 턴을 보존한다.
  await page.route("**/api/decide", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({ error: "검증용 API 오류" }),
    }),
  );
  await page.locator("#step").click();
  await page
    .locator("#status")
    .filter({ hasText: "검증용 API 오류" })
    .waitFor();
  assert.equal(await page.locator("#turn").innerText(), "TURN 05");
  await page.unroute("**/api/decide");
  // 중단과 초기화 이후의 응답은 새 실험에 반영하지 않는다.
  await page.route("**/api/decide", async (route) => {
    await new Promise((r) => setTimeout(r, 500));
    await route
      .fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          choice: "rest",
          probabilities: { rest: 1 },
          confidence: 1,
          model: "jev-test-fixture",
          inputTokens: 1,
          latencyMs: 500,
          estimatedUsd: 0,
        }),
      })
      .catch(() => {});
  });
  await page.locator("#step").click();
  await page.locator("#reset").click();
  await page.waitForTimeout(700);
  assert.equal(await page.locator("#turn").innerText(), "TURN 00");
  await page.unroute("**/api/decide");
  await page.locator("#mode").selectOption("rule");
  await page.locator("#run").click();
  await page.locator("#turn").filter({ hasText: "TURN 01" }).waitFor();
  await page.locator("#run").click();
  const paused = await page.locator("#turn").innerText();
  await page.waitForTimeout(1400);
  assert.equal(await page.locator("#turn").innerText(), paused);
  await page.setViewportSize({ width: 390, height: 844 });
  await checkLayout();
  await page.screenshot({
    path: `${evidence}/slime-mobile.png`,
    fullPage: true,
  });
  console.log(
    "슬라임: 실제 Jev 5턴, 규칙, 맵 편집, 실패 보존, 중단/재시작, 내보내기, 모바일 통과",
  );
  if (feedbackUrl) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${feedbackUrl}/`);
    await page.screenshot({
      path: `${evidence}/home-after.png`,
      fullPage: true,
    });
    await page.goto(`${feedbackUrl}/feedback`);
    await page
      .locator(
        'select[aria-label="판단 방식"] option[value=jev]:not([disabled])',
      )
      .waitFor({ state: "attached" });
    await page.getByRole("button", { name: "피드백 분류하기 →" }).click();
    await page.getByRole("status").filter({ hasText: "분류가 완료" }).waitFor();
    assert.equal(await page.locator(".ff-card").count(), 6);
    assert.match(await page.locator(".ff-metrics").innerText(), /100%/);
    await page.getByLabel("판단 방식").selectOption("jev");
    await page.locator(".ff-connection summary").click();
    await page.getByLabel("개인 실험 코드").fill(code);
    await page.getByRole("button", { name: "피드백 분류하기 →" }).click();
    await page
      .getByRole("status")
      .filter({ hasText: "분류가 완료" })
      .waitFor({ timeout: 90000 });
    assert.equal(await page.locator(".ff-card").count(), 6);
    assert.ok(await page.locator(".ff-probs progress").count());
    await page.locator(".ff-connection summary").click();
    await checkLayout();
    await page.screenshot({
      path: `${evidence}/feedback-desktop.png`,
      fullPage: true,
    });
    await page.getByLabel("최종 분류 직접 수정").selectOption("bug");
    assert.match(
      await page.locator(".ff-inspect").innerText(),
      /수정 결과: 버그 제보/,
    );
    await page.locator("#threshold").fill("1");
    assert.match(
      await page.locator(".ff-inspect").innerText(),
      /수정 결과: 버그 제보/,
    );
    await page
      .locator("#feedback-text")
      .fill("정렬 순서를 저장할 수 있으면 좋겠습니다.");
    await page.getByRole("button", { name: "대기함에 추가 +" }).click();
    assert.equal(await page.locator(".ff-card").count(), 7);
    const feedbackDownload = page.waitForEvent("download");
    await page.getByRole("button", { name: "기록 ↓" }).click();
    await (
      await feedbackDownload
    ).saveAs(`${evidence}/feedback-live-record.json`);
    await page.setViewportSize({ width: 390, height: 844 });
    await checkLayout();
    await page.screenshot({
      path: `${evidence}/feedback-mobile.png`,
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    console.log(
      "피드백: 규칙 6건, 실제 Jev 6건, 수정, 임계값, 입력 추가, 내보내기, 모바일, 브라우저 오류 없음",
    );
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
