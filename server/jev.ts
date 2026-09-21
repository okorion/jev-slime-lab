export type Decision = {
  choice: string;
  probabilities: Record<string, number>;
  confidence: number;
  model: string;
  inputTokens: number;
  latencyMs: number;
  estimatedUsd: number;
};
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function parseDecision(
  data: unknown,
  allowed: string[],
  latencyMs: number,
): Decision {
  if (!data || typeof data !== "object")
    throw new ApiError(502, "Jev 응답 형식이 올바르지 않습니다.");
  const d = data as {
    model?: unknown;
    answers?: {
      decision?: {
        type?: unknown;
        choice?: unknown;
        probabilities?: unknown;
        confidence?: unknown;
      };
    };
    usage?: { input_tokens?: unknown };
  };
  const a = d.answers?.decision;
  const p = a?.probabilities;
  if (
    !a ||
    a.type !== "choice" ||
    typeof a.choice !== "string" ||
    !allowed.includes(a.choice) ||
    typeof a.confidence !== "number" ||
    !Number.isFinite(a.confidence) ||
    a.confidence < 0 ||
    a.confidence > 1 ||
    !p ||
    typeof p !== "object" ||
    Array.isArray(p)
  )
    throw new ApiError(502, "Jev 판단을 검증하지 못했습니다.");
  const probs = p as Record<string, number>;
  const values = Object.values(probs);
  if (
    Object.keys(probs).length !== allowed.length ||
    allowed.some(
      (k) =>
        typeof probs[k] !== "number" ||
        !Number.isFinite(probs[k]) ||
        probs[k] < 0 ||
        probs[k] > 1,
    ) ||
    Math.abs(values.reduce((x, y) => x + y, 0) - 1) > 0.02 ||
    probs[a.choice] + 0.0001 < Math.max(...values)
  )
    throw new ApiError(502, "Jev 확률 분포를 검증하지 못했습니다.");
  const tokens = d.usage?.input_tokens;
  if (
    typeof tokens !== "number" ||
    !Number.isInteger(tokens) ||
    tokens < 0 ||
    typeof d.model !== "string" ||
    !d.model.startsWith("jev-")
  )
    throw new ApiError(502, "Jev 모델 또는 사용량을 검증하지 못했습니다.");
  return {
    choice: a.choice,
    probabilities: probs,
    confidence: a.confidence,
    model: d.model,
    inputTokens: tokens,
    latencyMs,
    estimatedUsd: (tokens * 0.042) / 1_000_000,
  };
}
export async function evaluate(
  state: unknown,
  criteria: Record<string, string>,
  instructions: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<Decision> {
  const started = performance.now();
  let response: Response;
  try {
    response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "jev-latest",
        state,
        questions: { decision: { type: "choice", instructions, criteria } },
      }),
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15_000)])
        : AbortSignal.timeout(15_000),
    });
  } catch {
    throw new ApiError(
      504,
      "Jev에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  }
  if (!response.ok)
    throw new ApiError(
      response.status === 429 ? 429 : 502,
      response.status === 429
        ? "Jev 호출 한도에 도달했습니다. 잠시 후 다시 시도해 주세요."
        : "Jev 요청에 실패했습니다. 서버의 키와 크레딧 상태를 확인해 주세요.",
    );
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(502, "Jev 응답을 읽지 못했습니다.");
  }
  return parseDecision(
    data,
    Object.keys(criteria),
    Math.round(performance.now() - started),
  );
}
