"use client";

import { ASPECT_RATIOS, RESOLUTIONS } from "@/lib/constants/image-options";
import { REASONING_ICONS, REASONING_LEVEL_TEXT } from "@/lib/reasoning-levels";
import type { ReasoningLevel } from "@/lib/types";
import type { ImageOptions } from "@/hooks/use-image-options";
import { OptionPicker } from "@/components/option-picker/option-picker";
import { OptionPanel } from "@/components/option-picker/option-panel";
import { AspectRatioIcon } from "@/components/option-picker/aspect-ratio-icon";
import { WebSearchToggle } from "@/components/option-picker/web-search-toggle";
import type { PickerOption } from "@/components/option-picker/option-list";

const FORMAT_HINTS: Record<string, string> = {
  "16:9": "Широкий кадр — для экрана, обложек и презентаций",
  "4:3": "Классический горизонтальный кадр",
  "3:2": "Горизонтальный, как снимок фотоаппарата",
  "1:1": "Квадрат — для аватарок и постов",
  "2:3": "Вертикальный — для постеров и печати",
  "3:4": "Вертикальный, как фото с телефона",
  "9:16": "Во весь экран телефона — для сторис и обоев",
};

const FORMAT_OPTIONS: PickerOption<string>[] = ASPECT_RATIOS.map((ar) => ({
  id: ar.id,
  label: ar.label,
  hint: FORMAT_HINTS[ar.id] ?? "",
  icon: <AspectRatioIcon type={ar.iconType} active />,
}));

// ⚡ and 🔍 already mean «Сразу» and «Поиск» on the same panel
const QUALITY_HINTS: Record<string, { icon: string; hint: string }> = {
  "1K": { icon: "\u{1F4F1}", hint: "Быстрее всего — для телефона и чтобы прикинуть идею" },
  "2K": { icon: "\u{1F5A5}\uFE0F", hint: "Чётко на любом экране" },
  "4K": { icon: "\u{1F5A8}\uFE0F", hint: "Максимум деталей — для печати и крупного формата" },
};

const QUALITY_OPTIONS: PickerOption<string>[] = RESOLUTIONS.map((r) => ({
  id: r.id,
  label: r.label,
  ...QUALITY_HINTS[r.id],
}));

const IMAGE_REASONING_HINTS: Record<ReasoningLevel, string> = {
  off: "Рисует сразу — быстрее всего",
  low: "Коротко продумывает композицию",
  medium: "Продумывает композицию и детали",
  high: "Тщательно продумывает сложную сцену, надписи и мелкие детали — дольше",
};

const SEARCH_HINT =
  "Модель может свериться с интернетом: свежие события, погода, описание малоизвестного " +
  "места или персонажа. Найденные источники появятся под картинкой. Дольше.";

interface ImageOptionsPanelProps {
  compact: boolean;
  options: ImageOptions;
}

/** Floating image options above the prompt island: format, quality, thinking depth, web search */
export function ImageOptionsPanel({ compact, options }: ImageOptionsPanelProps) {
  const { reasoningLevels, reasoningLevel } = options;
  return (
    <OptionPanel isVisible compact={compact} testId="image-options-panel">
      <OptionPicker
        title="Формат"
        options={FORMAT_OPTIONS}
        value={options.aspectRatio}
        onChange={options.setAspectRatio}
        tone="accent"
        testId="aspect-picker"
      />
      <OptionPicker
        title="Качество"
        options={QUALITY_OPTIONS}
        value={options.resolution}
        onChange={options.setResolution}
        tone="accent"
        testId="resolution-picker"
      />
      {reasoningLevel && (
        <OptionPicker
          title="Сколько думать перед рисованием"
          options={reasoningLevels.map((id) => ({
            id,
            label: REASONING_LEVEL_TEXT[id].label,
            hint: IMAGE_REASONING_HINTS[id],
            icon: REASONING_ICONS[id],
          }))}
          value={reasoningLevel}
          onChange={options.setReasoningLevel}
          tone={reasoningLevel === "off" ? "none" : "purple"}
          testId="reasoning-picker"
        />
      )}
      {options.supportsWebSearch && (
        <WebSearchToggle enabled={options.webSearchEnabled} onToggle={options.toggleWebSearch} hint={SEARCH_HINT} />
      )}
    </OptionPanel>
  );
}
