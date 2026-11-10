"use client";

import { useMemo, useState } from "react";
import type { ModelOption, ReasoningLevel } from "@/lib/types";
import { closestReasoningLevel, reasoningLevelsOf } from "@/lib/reasoning-levels";

/** Format, quality, thinking depth and web search for the next image */
export function useImageOptions(model: ModelOption) {
  const [aspectRatio, setAspectRatio] = useState("4:3");
  const [resolution, setResolution] = useState("1K");
  // Images default to the fastest level; deeper thinking is opt-in
  const [wantedLevel, setReasoningLevel] = useState<ReasoningLevel>("off");
  const [webSearchWanted, setWebSearchWanted] = useState(false);

  const reasoningLevels = useMemo(() => reasoningLevelsOf(model), [model]);
  const reasoningLevel = reasoningLevels.length > 1
    ? closestReasoningLevel(wantedLevel, reasoningLevels)
    : undefined;
  const supportsWebSearch = model.supportsWebSearch ?? false;
  const webSearchEnabled = supportsWebSearch && webSearchWanted;

  const requestBody = useMemo(
    () => ({ aspectRatio, resolution, reasoningLevel, webSearch: webSearchEnabled }),
    [aspectRatio, resolution, reasoningLevel, webSearchEnabled],
  );

  return {
    aspectRatio, setAspectRatio,
    resolution, setResolution,
    reasoningLevels, reasoningLevel, setReasoningLevel,
    supportsWebSearch, webSearchEnabled,
    toggleWebSearch: () => setWebSearchWanted((on) => !on),
    requestBody,
  };
}

export type ImageOptions = ReturnType<typeof useImageOptions>;
