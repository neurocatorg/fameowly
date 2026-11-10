"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const MAX_HEIGHT = 200;
/** Share of the visible viewport the text may take; ~30% keeps header, chips and some feed above a phone keyboard */
const VIEWPORT_SHARE = 0.3;
const CARET_ROOM = 2;

/** Marks the elements that share the compact row with the text */
export const PROMPT_CONTROL_ATTR = "data-prompt-control";

function outerWidth(el: HTMLElement): number {
  if (el.offsetWidth === 0) return 0;
  const s = getComputedStyle(el);
  return el.offsetWidth + parseFloat(s.marginLeft) + parseFloat(s.marginRight);
}

/**
 * Picks the one-row or the two-row prompt layout and sizes the textarea.
 * The choice comes from a hidden one-line copy of the text measured against the
 * compact text width, so it never depends on the current layout and cannot flip
 * back and forth.
 */
export function usePromptLayout(value: string, viewportHeight: number | null) {
  const formRef = useRef<HTMLFormElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLSpanElement>(null);
  const [expanded, setExpanded] = useState(false);
  const maxHeight = viewportHeight
    ? Math.min(MAX_HEIGHT, Math.round(viewportHeight * VIEWPORT_SHARE))
    : MAX_HEIGHT;
  const maxHeightRef = useRef(maxHeight);

  const fitHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const full = ta.scrollHeight;
    ta.style.height = `${Math.min(full, maxHeightRef.current)}px`;
    ta.style.overflowY = full > maxHeightRef.current ? "auto" : "hidden";
  }, []);

  const measure = useCallback(() => {
    const form = formRef.current;
    const mirror = mirrorRef.current;
    if (!form || !mirror) return;
    const text = mirror.textContent ?? "";
    if (!text) return setExpanded(false);
    if (text.includes("\n")) return setExpanded(true);
    const s = getComputedStyle(form);
    let room = form.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    form.querySelectorAll<HTMLElement>(`:scope > [${PROMPT_CONTROL_ATTR}]`).forEach((el) => {
      room -= outerWidth(el);
    });
    setExpanded(mirror.offsetWidth + CARET_ROOM > room);
  }, []);

  // Layout depends on a DOM measurement, which is what a layout effect with setState is for
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useLayoutEffect(measure, [value, measure]);

  useLayoutEffect(() => {
    maxHeightRef.current = maxHeight;
    fitHeight();
  }, [value, expanded, maxHeight, fitHeight]);

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const observer = new ResizeObserver(() => {
      measure();
      fitHeight();
    });
    observer.observe(form);
    form.querySelectorAll(`:scope > [${PROMPT_CONTROL_ATTR}]`).forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [measure, fitHeight]);

  return { formRef, textareaRef, mirrorRef, expanded, maxHeight };
}
