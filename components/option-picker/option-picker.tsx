"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOBILE_MEDIA_QUERY } from "@/lib/constants/breakpoints";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { OptionList, type PickerOption } from "./option-list";
import { CHIP_CLS, CHIP_EMOJI_CLS, CHIP_TONES, ISLAND_SHADOW, type ChipTone } from "./chip-styles";
import { useOptionIcons } from "./option-icons";

const SHEET_EXIT_MS = 180;

interface OptionPickerProps<T extends string> {
  /** Heading of the sheet; also names the chip for screen readers */
  title: string;
  options: readonly PickerOption<T>[];
  value: T;
  onChange: (value: T) => void;
  tone: ChipTone;
  testId: string;
}

/**
 * A chip showing the current choice. Opens a popover above it on desktop and a
 * bottom sheet on mobile; the sheet hides the keyboard and returns the focus
 * within the closing tap, which is what lets iOS bring the keyboard back.
 */
export function OptionPicker<T extends string>({
  title, options, value, onChange, tone, testId,
}: OptionPickerProps<T>) {
  const showIcons = useOptionIcons().chips;
  const [open, setOpen] = useState(false);
  const [asSheet, setAsSheet] = useState(false);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const refocusRef = useRef<HTMLElement | null>(null);
  const current = options.find((o) => o.id === value) ?? options[0];

  const close = useCallback(() => {
    if (closingRef.current) return;
    refocusRef.current?.focus();
    refocusRef.current = null;
    if (!asSheet) {
      setOpen(false);
      return;
    }
    closingRef.current = true;
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
      closingRef.current = false;
    }, SHEET_EXIT_MS);
  }, [asSheet]);

  const show = () => {
    const mobile = window.matchMedia(MOBILE_MEDIA_QUERY).matches;
    if (mobile) {
      const active = document.activeElement;
      refocusRef.current = active instanceof HTMLTextAreaElement ? active : null;
      refocusRef.current?.blur();
    }
    setAsSheet(mobile);
    setOpen(true);
  };

  useEffect(() => {
    if (!open || asSheet) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, asSheet, close]);

  const choose = (id: T) => {
    onChange(id);
    close();
  };

  const list = <OptionList options={options} value={value} onSelect={choose} testId={testId} />;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={open ? close : show}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${title}: ${current.label}`}
        title={current.hint}
        className={cn(CHIP_CLS, CHIP_TONES[tone].chip)}
        data-testid={testId}
      >
        {showIcons && current.icon && <span aria-hidden className={CHIP_EMOJI_CLS}>{current.icon}</span>}
        <span>{current.label}</span>
        <ChevronDown
          strokeWidth={2.5}
          className={cn("h-3 w-3 shrink-0 transition-transform md:h-3.5 md:w-3.5", CHIP_TONES[tone].icon, open && "rotate-180")}
        />
      </button>

      {open && !asSheet && (
        <div
          className={cn(
            "animate-popover-up-in absolute bottom-full left-0 z-50 mb-2 w-[298px] rounded-[10px] border border-th-border bg-th-panel px-4 py-2.5",
            ISLAND_SHADOW,
          )}
          data-testid={`${testId}-popover`}
        >
          <div className="px-[15px] pb-1.5 pt-1 text-xs font-semibold leading-[1.4] text-th-fg">{title}</div>
          {list}
        </div>
      )}

      {open && asSheet && (
        <BottomSheet
          title={title}
          closing={closing}
          onClose={close}
          testId={`${testId}-sheet`}
          overlayTestId={`${testId}-sheet-overlay`}
        >
          <div className="px-4 pb-4">{list}</div>
        </BottomSheet>
      )}
    </div>
  );
}
