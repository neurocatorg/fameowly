"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";
import { CodeField, CODE_DIGITS } from "./code-field";
import { FormError } from "./form-error";
import { ResendLine } from "./resend-line";
import { noteCls, submitCls, titleCls } from "./styles";

interface CodeStepProps {
  email: string;
  noAccountHint: boolean;
  secondsLeft: number;
  busy: boolean;
  error: string;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onChangeEmail: () => void;
}

export function CodeStep({
  email,
  noAccountHint,
  secondsLeft,
  busy,
  error,
  onSubmit,
  onResend,
  onChangeEmail,
}: CodeStepProps) {
  const [code, setCode] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(code);
      }}
      className="flex flex-col gap-4"
    >
      <h1 className={titleCls}>Код ушёл на почту</h1>
      <p className={noteCls}>
        {noAccountHint ? (
          <>
            Если аккаунт с адресом <span className="break-all font-medium text-th-fg">{email}</span> есть,
            код уже в письме. Нет аккаунта — обратитесь к администратору.
          </>
        ) : (
          <>
            Отправили на <span className="break-all font-medium text-th-fg">{email}</span>.
          </>
        )}
      </p>
      <CodeField value={code} onChange={setCode} autoFocus />
      <FormError message={error} />
      <button type="submit" disabled={busy || code.length !== CODE_DIGITS} className={submitCls}>
        <LogIn className="h-4 w-4" />
        {busy ? "Входим…" : "Войти"}
      </button>
      <ResendLine secondsLeft={secondsLeft} busy={busy} onResend={onResend} onChangeEmail={onChangeEmail} />
    </form>
  );
}
