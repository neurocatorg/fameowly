"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { MOBILE_MEDIA_QUERY } from "@/lib/constants/breakpoints";
import { REASONING_LEVEL_TEXT } from "@/lib/reasoning-levels";
import type { ReasoningLevel } from "@/lib/types";
import { Toast } from "@/components/toast";
import { OptionPicker } from "@/components/option-picker/option-picker";
import { ISLAND_SHADOW } from "@/components/option-picker/chip-styles";
import type { PickerOption } from "@/components/option-picker/option-list";
import { WebSearchToggle } from "./web-search-toggle";

// ─── Answer style (temperature presets) ──────────────────────────────

type StyleId = "precise" | "balanced" | "creative";

const STYLE_PRESETS: (PickerOption<StyleId> & { value: number })[] = [
  { id: "precise", label: "Точно", icon: "🎯", value: 0.2,
    hint: "Строго по делу, без фантазий — для фактов, кода и расчётов" },
  { id: "balanced", label: "Взвешенно", icon: "⚖️", value: 0.6,
    hint: "Точность и живой язык в меру — подходит для большинства вопросов" },
  { id: "creative", label: "Творчески", icon: "🎨", value: 1.0,
    hint: "Больше фантазии и неожиданных идей — для текстов, историй и мозгового штурма" },
];

function closestStyle(temperature: number) {
  return STYLE_PRESETS.reduce((closest, p) =>
    Math.abs(p.value - temperature) < Math.abs(closest.value - temperature) ? p : closest,
  );
}

const REASONING_ICONS: Record<ReasoningLevel, string> = { off: "⚡", low: "💭", medium: "🧠", high: "�" };

// ─── Props ───────────────────────────────────────────────────────────

interface ModePanelProps {
  isVisible: boolean;
  isKeyboardOpen: boolean;
  supportsTemperature: boolean;
  reasoningLevels: readonly ReasoningLevel[];
  reasoningLevel: ReasoningLevel | undefined;
  onReasoningLevelChange: (level: ReasoningLevel) => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
  supportsWebSearch: boolean;
  webSearchEnabled: boolean;
  onWebSearchToggle: () => void;
}

// ─── Component ───────────────────────────────────────────────────────

/** Floating answer options above the chat input: thinking depth, style, web search */
export function ModePanel({
  isVisible,
  isKeyboardOpen,
  supportsTemperature,
  reasoningLevels,
  reasoningLevel,
  onReasoningLevelChange,
  temperature,
  onTemperatureChange,
  supportsWebSearch,
  webSearchEnabled,
  onWebSearchToggle,
}: ModePanelProps) {
  const [toast, setToast] = useState<string | null>(null);

  const showReasoning = reasoningLevels.length > 1 && reasoningLevel !== undefined;
  if (!showReasoning && !supportsTemperature && !supportsWebSearch) return null;

  const reasoningOptions = reasoningLevels.map((id) => ({ id, icon: REASONING_ICONS[id], ...REASONING_LEVEL_TEXT[id] }));
  const style = closestStyle(temperature);

  const handleWebSearchToggle = () => {
    onWebSearchToggle();
    if (window.matchMedia(MOBILE_MEDIA_QUERY).matches) {
      setToast(webSearchEnabled ? "Поиск в интернете выключен" : "Поиск в интернете включён");
    }
  };

  const separator = <div className={cn("w-px shrink-0 bg-th-option-sep", isKeyboardOpen ? "h-5" : "h-[25px]")} />;

  return (
    <>
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <div
        className={cn(
          "absolute bottom-full left-0 right-0 z-10 flex justify-center transition-all duration-300",
          isVisible
            ? "translate-y-0 opacity-100"
            : "pointer-events-none translate-y-4 opacity-0",
        )}
        style={{ paddingBottom: isKeyboardOpen ? 4 : 8 }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div
          className={cn(
            "flex items-center gap-1 rounded-[40px] bg-th-panel md:gap-[10px] dark:ring-1 dark:ring-th-border",
            ISLAND_SHADOW,
            isKeyboardOpen ? "p-1" : "p-1.5",
          )}
        >
          {showReasoning && (
            <OptionPicker
              title="Сколько думать перед ответом"
              options={reasoningOptions}
              value={reasoningLevel}
              onChange={onReasoningLevelChange}
              tone={reasoningLevel === "off" ? "none" : "purple"}
              testId="reasoning-picker"
            />
          )}

          {showReasoning && supportsTemperature && separator}

          {supportsTemperature && (
            <OptionPicker
              title="Стиль ответа"
              options={STYLE_PRESETS}
              value={style.id}
              onChange={(id) => onTemperatureChange(STYLE_PRESETS.find((p) => p.id === id)!.value)}
              tone="accent"
              testId="style-picker"
            />
          )}

          {supportsWebSearch && (showReasoning || supportsTemperature) && separator}

          {supportsWebSearch && (
            <WebSearchToggle
              enabled={webSearchEnabled}
              onToggle={handleWebSearchToggle}
            />
          )}
        </div>
      </div>
    </>
  );
}
