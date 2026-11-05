"use client";

import type { ReactNode } from "react";
import { Mail } from "lucide-react";
import { FormError } from "./form-error";
import { fieldCls, submitCls, titleCls } from "./styles";

interface EmailStepProps {
  title: string;
  email: string;
  onEmailChange: (email: string) => void;
  onSubmit: () => void;
  busy: boolean;
  error: string;
  /** Notes and links under the button */
  children?: ReactNode;
}

export function EmailStep({ title, email, onEmailChange, onSubmit, busy, error, children }: EmailStepProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="flex flex-col gap-4"
    >
      <h1 className={titleCls}>{title}</h1>
      <input
        type="email"
        inputMode="email"
        autoComplete="email"
        aria-label="Email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        className={fieldCls}
        autoFocus
        required
      />
      <FormError message={error} />
      <button type="submit" disabled={busy} className={submitCls}>
        <Mail className="h-4 w-4" />
        {busy ? "Отправляем…" : "Прислать код"}
      </button>
      {children}
    </form>
  );
}
