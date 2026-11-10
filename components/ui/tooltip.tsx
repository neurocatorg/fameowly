"use client";

import { useState, useRef, useEffect, type ReactNode } from "react";

interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  className?: string;
  /** Where the bubble opens relative to the trigger */
  side?: "top" | "bottom";
  /** "end" keeps a bubble near the right screen edge on screen */
  align?: "center" | "end";
  label?: string;
}

const SIDE_CLS = { top: "bottom-full mb-2", bottom: "top-full mt-2" } as const;
const ALIGN_CLS = { center: "left-1/2 -translate-x-1/2", end: "right-0" } as const;

/**
 * Lightweight tooltip: opens on hover/focus on desktop and on tap on touch
 * devices. Closes on Escape or on an outside click.
 */
export function Tooltip({
  content, children, className = "", side = "bottom", align = "center", label,
}: TooltipProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  // A tap also fires emulated hover and focus; only a real mouse should open on hover
  const pointerType = useRef("mouse");

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <span ref={wrapperRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-expanded={open}
        aria-label={label}
        onPointerDown={(e) => { pointerType.current = e.pointerType; }}
        onClick={() => setOpen((v) => pointerType.current === "mouse" || !v)}
        onPointerEnter={(e) => { if (e.pointerType === "mouse") setOpen(true); }}
        onPointerLeave={(e) => { if (e.pointerType === "mouse") setOpen(false); }}
        onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) setOpen(true); }}
        onBlur={() => setOpen(false)}
        className="inline-flex cursor-default items-center"
      >
        {children}
      </button>

      {open && (
        <span
          role="tooltip"
          className={`absolute z-50 w-max max-w-[min(18rem,80vw)] whitespace-normal rounded-[10px] border border-th-border bg-th-panel px-[15px] py-2.5 text-left text-xs font-normal leading-[1.4] text-th-fg shadow-[0_0_4px_0_rgba(0,0,0,0.04),0_8px_16px_0_rgba(0,0,0,0.08)] ${SIDE_CLS[side]} ${ALIGN_CLS[align]}`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
