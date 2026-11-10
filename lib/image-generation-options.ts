import type { ModelOption, ReasoningLevel } from "./models";
import { reasoningLevelsOf, requestedReasoningLevel } from "./reasoning-levels";

/** Gemini image models take thinking levels, not budgets; "off" is their lightest level */
const THINKING_LEVEL: Record<ReasoningLevel, string> = {
  off: "MINIMAL",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
};

export interface ImageRequestExtras {
  reasoningLevel?: ReasoningLevel;
  webSearch: boolean;
  /** Goes into `generationConfig` */
  thinkingConfig?: { thinkingLevel: string };
  /** Top-level `tools` of the Gemini request */
  tools?: Array<Record<string, unknown>>;
}

/**
 * Thinking depth and Google Search for a Gemini image request, limited to what
 * the admin enabled for the model. Without a picker (fewer than two levels) the
 * model keeps its own default — gemini-3-pro-image ignores the level anyway.
 */
export function imageRequestExtras(
  body: { reasoningLevel?: unknown; webSearch?: unknown },
  model: ModelOption,
): ImageRequestExtras {
  const reasoningLevel = reasoningLevelsOf(model).length > 1
    ? requestedReasoningLevel(body, model)
    : undefined;
  const webSearch = body.webSearch === true && model.supportsWebSearch === true;
  return {
    reasoningLevel,
    webSearch,
    thinkingConfig: reasoningLevel ? { thinkingLevel: THINKING_LEVEL[reasoningLevel] } : undefined,
    tools: webSearch ? [{ googleSearch: {} }] : undefined,
  };
}
