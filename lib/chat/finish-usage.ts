import type { TokenUsage } from "../types";

interface UsageLike {
  inputTokens: number | undefined;
  outputTokens: number | undefined;
  totalTokens: number | undefined;
}

export function toTokenUsage(usage: UsageLike): TokenUsage {
  return {
    promptTokens: usage.inputTokens ?? 0,
    completionTokens: usage.outputTokens ?? 0,
    totalTokens: usage.totalTokens ?? 0,
  };
}

/**
 * Context the chat holds after a multi-step answer: the first step's prompt
 * (history + new message) and the final answer. Tool results of intermediate
 * steps are not stored in the chat, so they are left out.
 */
export function contextUsageOf(steps: ReadonlyArray<{ usage: UsageLike }>): TokenUsage | undefined {
  if (steps.length < 2) return undefined;
  const promptTokens = steps[0].usage.inputTokens ?? 0;
  const completionTokens = steps[steps.length - 1].usage.outputTokens ?? 0;
  return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
}
