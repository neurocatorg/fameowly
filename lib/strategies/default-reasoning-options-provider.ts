/**
 * Strategy: reasoning options for the OSS providers.
 *
 * Measured behaviour (2026-09-23, live fleet):
 *  - Google returns thought summaries only with `includeThoughts`; without it the
 *    thinking tokens are still generated and billed, just never shown.
 *  - `thinkingBudget: 0` genuinely stops thinking (~2.7x faster, ~4.8x fewer output tokens).
 *  - OpenRouter: `reasoning.enabled: false` zeroes reasoning tokens and keeps the answer
 *    intact; `effort: "low"` only shrinks it, and `exclude: true` returns an empty answer.
 *  - llama.cpp ignores `chat_template_kwargs` unless the server runs with `--jinja`;
 *    the option is wired anyway so it starts working the day that flag appears.
 *  - Vertex, 2026-11-10: gemini-3.8-flash and gemini-3.1-pro accept `thinkingLevel`
 *    low/medium/high and reject "minimal"; `thinkingBudget: 0` stops 3.1-pro but NOT 3.8-flash.
 *  - The Qwen3.8 template takes `reasoning_effort` low/medium/xhigh (default xhigh) and
 *    answers HTTP 500 to "high", so "high" sends nothing and keeps the template default.
 */

import type { ReasoningLevel } from "../types";
import type { ReasoningOptionsProvider, ReasoningOptionsRequest } from "../contracts";

/** Older strategies' callers may still fill only the on/off flag */
function levelOf(request: ReasoningOptionsRequest): ReasoningLevel | undefined {
  return request.reasoningLevel ?? (request.reasoningEnabled === false ? "off" : undefined);
}

export class DefaultReasoningOptionsProvider implements ReasoningOptionsProvider {
  resolve(request: ReasoningOptionsRequest): Record<string, unknown> | undefined {
    const level = levelOf(request);

    switch (request.baseProvider) {
      case "google":
      case "google-vertex":
        // Vertex reads provider options under the "google" key as well.
        return {
          google: {
            thinkingConfig: level === "off"
              ? { thinkingBudget: 0 }
              : { includeThoughts: true, ...(level && { thinkingLevel: level }) },
          },
        };

      case "openrouter":
        if (!level) return undefined;
        return {
          openrouter: { reasoning: level === "off" ? { enabled: false } : { effort: level } },
        };

      case "local":
        if (level === "off") return { local: { chat_template_kwargs: { enable_thinking: false } } };
        if (level === "low" || level === "medium") {
          return { local: { chat_template_kwargs: { enable_thinking: true, reasoning_effort: level } } };
        }
        return undefined;
    }
  }
}
