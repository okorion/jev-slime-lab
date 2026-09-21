import { describe, it, expect } from "vitest";
import {
  createWorld,
  editTile,
  legalActions,
  ruleAction,
  step,
} from "../src/game";
import { validWorld } from "../api/decide";
import { parseDecision } from "../server/jev";
describe("게임 계약", () => {
  it("동일 섬은 같은 시작 상태이며 별도 복사로 진행한다", () => {
    const a = createWorld(42),
      b = createWorld(42);
    expect(a).toEqual(b);
    const n = step(a, "north");
    expect(a.turn).toBe(0);
    expect(n.turn).toBe(1);
    expect(b.tiles).toEqual(a.tiles);
  });
  it("먹이를 먹어야 에너지가 회복되고 소비된다", () => {
    const w = step(createWorld(), "north");
    const n = step(w, "eat");
    expect(n.energy).toBe(90);
    expect(n.food).toBe(1);
    expect(n.tiles[31]).toBe("grass");
    expect(w.tiles[31]).toBe("food");
    expect(legalActions(n)).not.toContain("eat");
  });
  it("지도 밖과 바위 이동은 금지된다", () => {
    const w = createWorld();
    w.x = 0;
    w.y = 0;
    w.tiles[1] = "rock";
    expect(legalActions(w)).not.toContain("north");
    expect(legalActions(w)).not.toContain("west");
    expect(legalActions(w)).not.toContain("east");
    expect(step(w, "east")).toBe(w);
  });
  it("위험 노출과 고갈 피해 및 종료를 계산한다", () => {
    const w = createWorld();
    w.tiles[40] = "hazard";
    w.energy = 0;
    w.hp = 20;
    const n = step(w, "rest");
    expect(n.hp).toBe(0);
    expect(n.ended).toBe(true);
    expect(n.hazards).toBe(1);
    expect(step(n, "rest")).toBe(n);
  });
  it("시작 뒤 편집과 시작 쉼터 교체를 거절한다", () => {
    const w = createWorld();
    expect(editTile(w, 40, "rock")).toBe(w);
    const n = step(w, "north");
    expect(editTile(n, 3, "food")).toBe(n);
  });
  it("100개 섬에서 기준선은 유효 행동만 선택하며 100턴 안에 끝난다", () => {
    for (let seed = 0; seed < 100; seed++) {
      let w = createWorld(seed);
      for (let i = 0; i < 101 && !w.ended; i++) {
        const a = ruleAction(w);
        expect(legalActions(w)).toContain(a);
        w = step(w, a);
      }
      expect(w.ended).toBe(true);
      expect(w.turn).toBeLessThanOrEqual(100);
    }
  });
  it("불완전한 API 입력과 범위 초과 상태를 거절한다", () => {
    expect(validWorld(createWorld())).toBe(true);
    expect(validWorld(null)).toBe(false);
    expect(validWorld({ ...createWorld(), tiles: [] })).toBe(false);
    expect(validWorld({ ...createWorld(), x: 9 })).toBe(false);
    expect(validWorld({ ...createWorld(), path: [999] })).toBe(false);
  });
});
describe("Jev 응답 경계", () => {
  const fixture = {
    model: "jev-1.13.0",
    usage: { input_tokens: 500 },
    answers: {
      decision: {
        type: "choice",
        choice: "rest",
        confidence: 0.7,
        probabilities: { rest: 0.8, north: 0.2 },
      },
    },
  };
  it("모델이 반환한 확률과 confidence를 별개로 보존한다", () => {
    const d = parseDecision(fixture, ["rest", "north"], 120);
    expect(d.confidence).toBe(0.7);
    expect(d.probabilities.rest).toBe(0.8);
    expect(d.estimatedUsd).toBe(0.000021);
  });
  it("불법 선택과 잘못된 분포는 게임에 적용하지 않는다", () => {
    expect(() => parseDecision(fixture, ["east"], 0)).toThrow();
    expect(() =>
      parseDecision(
        {
          ...fixture,
          answers: {
            decision: {
              ...fixture.answers.decision,
              probabilities: { rest: 1, north: 1 },
            },
          },
        },
        ["rest", "north"],
        0,
      ),
    ).toThrow();
    expect(() =>
      parseDecision(
        { ...fixture, usage: { input_tokens: NaN } },
        ["rest", "north"],
        0,
      ),
    ).toThrow();
  });
});
