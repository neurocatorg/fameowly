"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useOptionIcons } from "./option-icons";

export interface PickerOption<T extends string> {
  id: T;
  label: string;
  hint: string;
  /** Shown on the chip and in the list when option icons are enabled */
  icon?: ReactNode;
}

interface OptionListProps<T extends string> {
  options: readonly PickerOption<T>[];
  value: T;
  onSelect: (value: T) => void;
  testId: string;
}

/** Choices with an explanation each, styled after the mock; shared by the popover and the sheet */
export function OptionList<T extends string>({ options, value, onSelect, testId }: OptionListProps<T>) {
  const showIcons = useOptionIcons().list;
  return (
    <div role="listbox" className="flex flex-col gap-[3px]">
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="option"
            aria-selected={selected}
            onClick={() => onSelect(option.id)}
            className={cn(
              "flex w-full items-start gap-2.5 rounded-[10px] px-[15px] py-2.5 text-left text-th-fg transition",
              selected ? "bg-th-accent-bg" : "hover:bg-th-subtle",
            )}
            data-testid={`${testId}-option-${option.id}`}
          >
            {showIcons && option.icon && (
              <span aria-hidden className="text-[18px] leading-[17px]">{option.icon}</span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold leading-[17px]">{option.label}</span>
              <span className="mt-[5px] block text-xs leading-[1.4]">{option.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
