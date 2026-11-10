"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubmitButtonProps {
  isLoading: boolean;
  /** When given, a running request can be stopped; otherwise the button shows a spinner */
  onStop?: () => void;
  disabled: boolean;
  title: string;
}

/** Round send button of the prompt island: send, stop or busy */
export function SubmitButton({ isLoading, onStop, disabled, title }: SubmitButtonProps) {
  if (isLoading && onStop) {
    return (
      <button
        type="button"
        onClick={onStop}
        className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-th-red text-white transition hover:opacity-80"
        title="Остановить генерацию"
        data-testid="prompt-stop"
      >
        <div className="h-2.5 w-2.5 rounded-[2px] bg-white" />
      </button>
    );
  }

  return (
    <button
      type="submit"
      disabled={disabled || isLoading}
      className={cn(
        "flex h-[30px] w-[30px] items-center justify-center rounded-full bg-th-accent text-white transition",
        "hover:bg-th-accent-muted disabled:cursor-not-allowed disabled:opacity-40",
      )}
      title={title}
      data-testid="prompt-submit"
    >
      {isLoading
        ? <Loader2 className="h-[18px] w-[18px] animate-spin" />
        : <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2} />}
    </button>
  );
}
