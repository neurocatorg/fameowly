/** Answer-option chips above the input, sized to the Figma mock on desktop and tighter on phones */
export const CHIP_CLS =
  "flex h-[30px] items-center gap-1 whitespace-nowrap rounded-full border pl-1.5 pr-2 text-xs leading-none transition md:gap-[5px] md:pl-[10px] md:pr-[14px]";

export const CHIP_EMOJI_CLS = "text-[15px] leading-none md:text-[18px]";

export const CHIP_TONES = {
  /** A picked value that is the point of the chip (answer style) */
  accent: { chip: "border-th-option-border bg-th-option-accent-bg text-th-accent", icon: "text-th-info-blue" },
  /** A switched-on option (web search) */
  on: { chip: "border-th-option-border bg-th-option-accent-bg text-th-option-fg", icon: "text-th-info-blue" },
  /** Model thinks before answering */
  purple: { chip: "border-th-option-border bg-th-option-purple-bg text-th-option-fg", icon: "text-th-info-purple" },
  none: { chip: "border-transparent text-th-option-fg hover:bg-th-subtle", icon: "text-th-fg-m" },
} as const;

export type ChipTone = keyof typeof CHIP_TONES;

export const ISLAND_SHADOW = "shadow-[0_0_4px_0_rgba(0,0,0,0.04),0_8px_16px_0_rgba(0,0,0,0.08)]";
