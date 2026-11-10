"use client";

import { Children, Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ISLAND_SHADOW } from "./chip-styles";

interface OptionPanelProps {
  isVisible: boolean;
  /** Tighter paddings while the mobile keyboard is open */
  compact: boolean;
  children: ReactNode;
  testId?: string;
}

/** Floating pill of option chips above the prompt island, with separators between the chips */
export function OptionPanel({ isVisible, compact, children, testId }: OptionPanelProps) {
  const items = Children.toArray(children);
  if (items.length === 0) return null;

  return (
    <div
      className={cn(
        "absolute bottom-full left-0 right-0 z-10 flex justify-center transition-all duration-300",
        isVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
      )}
      style={{ paddingBottom: compact ? 4 : 8 }}
      // Keeps the textarea focused (and the phone keyboard up) while a chip is tapped
      onMouseDown={(e) => e.preventDefault()}
    >
      <div
        className={cn(
          "flex items-center gap-1 rounded-[40px] bg-th-panel md:gap-[10px] dark:ring-1 dark:ring-th-border",
          ISLAND_SHADOW,
          compact ? "p-1" : "p-1.5",
        )}
        data-testid={testId}
      >
        {items.map((item, i) => (
          <Fragment key={i}>
            {i > 0 && <div className={cn("w-px shrink-0 bg-th-option-sep", compact ? "h-5" : "h-[25px]")} />}
            {item}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
