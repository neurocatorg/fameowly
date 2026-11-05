"use client";

import { fieldCls } from "./styles";

const DIGITS = 8;

/** "12345678" → "1234 5678" while typing; the value passed up is digits only */
function display(digits: string): string {
  return digits.length > DIGITS / 2 ? `${digits.slice(0, DIGITS / 2)} ${digits.slice(DIGITS / 2)}` : digits;
}

interface CodeFieldProps {
  value: string;
  onChange: (digits: string) => void;
  autoFocus?: boolean;
}

export function CodeField({ value, onChange, autoFocus }: CodeFieldProps) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      aria-label="Код из письма"
      placeholder="1234 5678"
      value={display(value)}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, DIGITS))}
      className={`${fieldCls} text-center font-mono text-xl tracking-[0.2em]`}
      autoFocus={autoFocus}
      required
    />
  );
}

export const CODE_DIGITS = DIGITS;
