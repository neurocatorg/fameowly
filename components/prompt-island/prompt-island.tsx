"use client";

import { useRef, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVisualViewport } from "@/hooks/use-visual-viewport";
import { usePromptLayout, PROMPT_CONTROL_ATTR } from "@/hooks/use-prompt-layout";
import { ISLAND_SHADOW } from "@/components/option-picker/chip-styles";
import { SubmitButton } from "./submit-button";

const FILE_ACCEPT = "image/*,.pdf,.txt,.md,.json,.csv";
const CONTROL = { [PROMPT_CONTROL_ATTR]: "" };

const AREAS_COMPACT = '"plus text est send"';
const AREAS_EXPANDED = '"text text text text" "plus . est send"';

interface PromptIslandProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  canSubmit: boolean;
  isLoading: boolean;
  onStop?: () => void;
  placeholder: string;
  disabled?: boolean;
  onAddFiles: (files: File[]) => void;
  onFocusChange?: (focused: boolean) => void;
  submitTitle: string;
  /** Cost estimate next to the send button; the slot is empty until something fills it */
  estimate?: ReactNode;
  /** Shown above the island, e.g. attachment previews */
  top?: ReactNode;
  /** Shown under the island, e.g. an error */
  bottom?: ReactNode;
  testId: string;
}

/**
 * Prompt input shared by chat and image modes. One row `[+] text [estimate] [→]`
 * while the text fits; otherwise the text takes the full width and the controls
 * move to a row below. The textarea stays the same element, so focus survives.
 */
export function PromptIsland({
  value, onChange, onSubmit, canSubmit, isLoading, onStop, placeholder, disabled,
  onAddFiles, onFocusChange, submitTitle, estimate, top, bottom, testId,
}: PromptIslandProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { viewportHeight, isCompact } = useVisualViewport();
  const { formRef, textareaRef, mirrorRef, expanded, maxHeight } = usePromptLayout(value, viewportHeight);

  return (
    <div
      className="relative px-3 pt-2 md:px-4"
      style={{ paddingBottom: isCompact ? 6 : "max(16px, env(safe-area-inset-bottom))" }}
    >
      {top}
      <form
        ref={formRef}
        onSubmit={onSubmit}
        data-testid={testId}
        data-layout={expanded ? "expanded" : "compact"}
        className={cn(
          "relative mx-auto grid w-full max-w-4xl grid-cols-[auto_minmax(0,1fr)_auto_auto] items-end gap-y-2",
          "border border-th-border bg-th-panel px-4 transition-[border-color,border-radius] focus-within:border-th-accent",
          ISLAND_SHADOW,
          isCompact ? "py-[10px]" : "py-[15px]",
          expanded ? "rounded-[24px]" : "rounded-[50px]",
        )}
        style={{ gridTemplateAreas: expanded ? AREAS_EXPANDED : AREAS_COMPACT }}
      >
        <button
          {...CONTROL}
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="mr-[10px] flex h-[30px] w-[30px] items-center justify-center text-th-accent transition [grid-area:plus] hover:opacity-70 disabled:opacity-40"
          title="Прикрепить файл"
          data-testid="prompt-attach"
        >
          <Plus className="h-6 w-6" strokeWidth={1.5} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onAddFiles(Array.from(e.target.files));
            e.target.value = "";
          }}
        />

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="min-w-0 resize-none bg-transparent py-[5px] text-base leading-[20px] text-th-fg placeholder-th-fg-f outline-none [grid-area:text] disabled:opacity-50"
          style={{ maxHeight }}
          onFocus={() => onFocusChange?.(true)}
          onBlur={() => onFocusChange?.(false)}
          data-testid="prompt-input"
        />

        <div
          {...CONTROL}
          className="ml-[10px] flex h-[30px] items-center empty:hidden [grid-area:est]"
          data-testid="prompt-estimate"
        >
          {estimate}
        </div>

        <div {...CONTROL} className="ml-[10px] [grid-area:send]">
          <SubmitButton isLoading={isLoading} onStop={onStop} disabled={!!disabled || !canSubmit} title={submitTitle} />
        </div>

        <div aria-hidden className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden">
          <span ref={mirrorRef} className="whitespace-pre text-base leading-[20px]">{value}</span>
        </div>
      </form>
      {bottom}
    </div>
  );
}
