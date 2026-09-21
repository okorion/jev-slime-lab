import type { IncomingMessage, ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { ApiError, evaluate } from "../server/jev.js";
import {
  legalActions,
  modelState,
  LABELS,
  SIZE,
  type World,
} from "../src/game.js";
export function validWorld(value: unknown): value is World {
  if (!value || typeof value !== "object") return false;
  const w = value as World;
  return (
    Number.isInteger(w.seed) &&
    w.seed >= 0 &&
    w.seed <= 4294967295 &&
    Number.isInteger(w.turn) &&
    w.turn >= 0 &&
    w.turn < 100 &&
    Number.isInteger(w.x) &&
    w.x >= 0 &&
    w.x < SIZE &&
    Number.isInteger(w.y) &&
    w.y >= 0 &&
    w.y < SIZE &&
    Number.isFinite(w.hp) &&
    w.hp > 0 &&
    w.hp <= 100 &&
    Number.isFinite(w.energy) &&
    w.energy >= 0 &&
    w.energy <= 100 &&
    Array.isArray(w.tiles) &&
    w.tiles.length === 81 &&
    w.tiles.every((t) =>
      ["grass", "food", "hazard", "shelter", "rock"].includes(t),
    ) &&
    Array.isArray(w.path) &&
    w.path.length <= 101 &&
    w.path.every((p) => Number.isInteger(p) && p >= 0 && p < 81) &&
    w.ended === false
  );
}
export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  const send = (status: number, data: unknown) => {
    res.statusCode = status;
    res.end(JSON.stringify(data));
  };
  const key = process.env.TYPESAFE_API_KEY,
    code = process.env.JEV_ACCESS_CODE;
  if (req.method === "GET")
    return send(200, { available: Boolean(key && code), requiresCode: true });
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return send(405, { error: "지원하지 않는 요청입니다." });
  }
  if (!key || !code)
    return send(503, {
      error:
        "실제 Jev 연결이 준비되지 않았습니다. 무료 규칙 모드를 이용해 주세요.",
    });
  const supplied = req.headers["x-experiment-code"];
  if (
    typeof supplied !== "string" ||
    Buffer.byteLength(supplied) !== Buffer.byteLength(code) ||
    !timingSafeEqual(Buffer.from(supplied), Buffer.from(code))
  )
    return send(401, { error: "실험 코드가 올바르지 않습니다." });
  try {
    if (!req.headers["content-type"]?.startsWith("application/json"))
      throw new ApiError(415, "JSON 요청만 지원합니다.");
    let body = req.body;
    if (body === undefined) {
      let text = "";
      for await (const chunk of req) {
        text += chunk.toString();
        if (Buffer.byteLength(text) > 16_000)
          throw new ApiError(413, "요청이 너무 큽니다.");
      }
      try {
        body = JSON.parse(text);
      } catch {
        throw new ApiError(400, "요청을 읽지 못했습니다.");
      }
    }
    if (JSON.stringify(body).length > 16_000)
      throw new ApiError(413, "요청이 너무 큽니다.");
    const b = body as { world?: unknown; instruction?: unknown };
    if (
      !b ||
      !validWorld(b.world) ||
      typeof b.instruction !== "string" ||
      !b.instruction.trim() ||
      b.instruction.length > 300
    )
      throw new ApiError(400, "상태 또는 행동 지침이 올바르지 않습니다.");
    const allowed = legalActions(b.world);
    const criteria = Object.fromEntries(allowed.map((a) => [a, LABELS[a]]));
    const decision = await evaluate(
      modelState(b.world, b.instruction),
      criteria,
      "Choose the next single legal action for this slime to survive, considering its current state and the player instruction. The map is rows from north to south, columns west to east. Return only one of the provided actions.",
      key,
    );
    return send(200, decision);
  } catch (e) {
    return send(e instanceof ApiError ? e.status : 500, {
      error:
        e instanceof ApiError ? e.message : "요청 처리 중 오류가 발생했습니다.",
    });
  }
}
