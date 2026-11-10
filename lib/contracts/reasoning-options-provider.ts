/**
 * Contract: provider-native reasoning options.
 *
 * Splits two independent concerns:
 *  - visibility  — always ask the provider to return its reasoning, where it can;
 *  - control     — the «Сколько думать» picker, which only some providers can honour.
 */

import type { BaseProvider, ReasoningLevel } from "../types";

export interface ReasoningOptionsRequest {
  baseProvider: BaseProvider;
  modelId: string;
  /**
   * @deprecated read `reasoningLevel`. Kept in sync with it: `false` for "off",
   * `true` for any other level, undefined when the model exposes no control.
   */
  reasoningEnabled?: boolean;
  /** The picked level, already one the model offers. Undefined when it exposes no control. */
  reasoningLevel?: ReasoningLevel;
}

export interface ReasoningOptionsProvider {
  /**
   * Build the `providerOptions` object passed to `streamText()`.
   * @returns undefined when the provider needs no options.
   */
  resolve(request: ReasoningOptionsRequest): Record<string, unknown> | undefined;
}
