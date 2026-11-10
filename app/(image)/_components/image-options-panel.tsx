"use client";

import { ASPECT_RATIOS, RESOLUTIONS } from "@/lib/constants/image-options";
import { OptionPicker } from "@/components/option-picker/option-picker";
import { OptionPanel } from "@/components/option-picker/option-panel";
import { AspectRatioIcon } from "@/components/option-picker/aspect-ratio-icon";
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

const QUALITY_HINTS: Record<string, { icon: string; hint: string }> = {
  "1K": { icon: "\u26A1", hint: "Быстрее всего — чтобы прикинуть идею" },
  "2K": { icon: "\u{1F5BC}\uFE0F", hint: "Чётко на любом экране" },
  "4K": { icon: "\u{1F50D}", hint: "Максимум деталей — для печати и крупного формата" },
};

const QUALITY_OPTIONS: PickerOption<string>[] = RESOLUTIONS.map((r) => ({
  id: r.id,
  label: r.label,
  ...QUALITY_HINTS[r.id],
}));

interface ImageOptionsPanelProps {
  compact: boolean;
  aspectRatio: string;
  onAspectRatioChange: (id: string) => void;
  resolution: string;
  onResolutionChange: (id: string) => void;
}

/** Floating image options above the prompt island: format and quality */
export function ImageOptionsPanel({
  compact, aspectRatio, onAspectRatioChange, resolution, onResolutionChange,
}: ImageOptionsPanelProps) {
  return (
    <OptionPanel isVisible compact={compact} testId="image-options-panel">
      <OptionPicker
        title="Формат"
        options={FORMAT_OPTIONS}
        value={aspectRatio}
        onChange={onAspectRatioChange}
        tone="accent"
        testId="aspect-picker"
      />
      <OptionPicker
        title="Качество"
        options={QUALITY_OPTIONS}
        value={resolution}
        onChange={onResolutionChange}
        tone="accent"
        testId="resolution-picker"
      />
    </OptionPanel>
  );
}
