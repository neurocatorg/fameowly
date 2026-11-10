import type { ModelOption, ReasoningLevel } from "./models";

/** From not thinking at all to the deepest */
export const REASONING_LEVELS: readonly ReasoningLevel[] = ["off", "low", "medium", "high"];

/** Shared by the chat picker and the admin model editor */
export const REASONING_LEVEL_TEXT: Record<ReasoningLevel, { label: string; hint: string }> = {
  off: { label: "Сразу", hint: "Отвечает без раздумий — быстрее и дешевле" },
  low: { label: "Быстро", hint: "Коротко обдумывает перед ответом" },
  medium: { label: "Вдумчиво", hint: "Обдумывает основательно — для непростых вопросов" },
  high: { label: "Глубоко", hint: "Думает долго — для сложных задач и расчётов. Медленнее и дороже" },
};

/** What the on/off toggle meant before levels existed */
const LEGACY_LEVELS: readonly ReasoningLevel[] = ["off", "high"];

export function isReasoningLevel(value: unknown): value is ReasoningLevel {
  return REASONING_LEVELS.includes(value as ReasoningLevel);
}

/** Levels the model offers, in order; empty when it has no control */
export function reasoningLevelsOf(
  model: Pick<ModelOption, "reasoningLevels" | "supportsReasoning">,
): ReasoningLevel[] {
  const own = model.reasoningLevels;
  if (own) return REASONING_LEVELS.filter((level) => own.includes(level));
  return model.supportsReasoning ? [...LEGACY_LEVELS] : [];
}

/** The wanted level, or the closest one offered (a tie goes to the lighter level) */
export function closestReasoningLevel(
  wanted: ReasoningLevel,
  offered: readonly ReasoningLevel[],
): ReasoningLevel | undefined {
  const rank = (level: ReasoningLevel) => REASONING_LEVELS.indexOf(level);
  const distance = (level: ReasoningLevel) => Math.abs(rank(level) - rank(wanted));
  return [...offered].sort((a, b) => distance(a) - distance(b) || rank(a) - rank(b))[0];
}

/**
 * Level for a /api/chat request body, limited to what the model offers.
 * Older clients send the on/off `reasoningEnabled` instead.
 */
export function requestedReasoningLevel(
  body: { reasoningLevel?: unknown; reasoningEnabled?: unknown },
  model: ModelOption | undefined,
): ReasoningLevel | undefined {
  const wanted = isReasoningLevel(body.reasoningLevel)
    ? body.reasoningLevel
    : typeof body.reasoningEnabled === "boolean"
      ? (body.reasoningEnabled ? "high" : "off")
      : undefined;
  return wanted && model ? closestReasoningLevel(wanted, reasoningLevelsOf(model)) : undefined;
}
