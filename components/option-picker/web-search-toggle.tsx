"use client";

import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { InfoFillIcon } from "@/components/icons/info-fill-icon";
import { CHIP_CLS, CHIP_EMOJI_CLS, CHIP_TONES } from "@/components/option-picker/chip-styles";
import { useOptionIcons } from "@/components/option-picker/option-icons";

const CHAT_HINT =
  "Модель ищет свежие данные в интернете и даёт ссылки на источники. " +
  "Выключите, если ответ не зависит от новостей, цен или расписаний — так быстрее.";

interface WebSearchToggleProps {
  enabled: boolean;
  onToggle: () => void;
  /** What searching gives in this mode; the chat wording by default */
  hint?: string;
}

/** On/off chip with an ⓘ hint: tap the label to switch, tap ⓘ to read what it does */
export function WebSearchToggle({ enabled, onToggle, hint = CHAT_HINT }: WebSearchToggleProps) {
  const tone = CHIP_TONES[enabled ? "on" : "none"];
  const showIcons = useOptionIcons().chips;
  return (
    <div className={cn(CHIP_CLS, "pr-0 md:pr-0", tone.chip)}>
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        className="flex h-full items-center gap-1 md:gap-[5px]"
        data-testid="web-search-pill"
      >
        {showIcons && <span aria-hidden className={CHIP_EMOJI_CLS}>🔍</span>}
        <span>Поиск</span>
      </button>
      <Tooltip content={hint} side="top" align="end" label="Что делает поиск">
        <span
          className="flex h-[28px] items-center pl-1 pr-2 md:pl-[5px] md:pr-[14px]"
          data-testid="web-search-hint"
        >
          <InfoFillIcon className={cn("h-4 w-4 md:h-[18px] md:w-[18px]", tone.icon)} />
        </span>
      </Tooltip>
    </div>
  );
}
