"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { CodeField, CODE_DIGITS } from "./code-field";
import { FormError } from "./form-error";
import { ResendLine } from "./resend-line";
import { fieldCls, fieldLabelCls, noteCls, submitCls, titleCls } from "./styles";

interface ResetStepProps {
  email: string;
  secondsLeft: number;
  busy: boolean;
  error: string;
  onSubmit: (code: string, newPassword: string) => void;
  onResend: () => void;
  onChangeEmail: () => void;
}

export function ResetStep({ email, secondsLeft, busy, error, onSubmit, onResend, onChangeEmail }: ResetStepProps) {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(code, password);
      }}
      className="flex flex-col gap-4"
    >
      <h1 className={titleCls}>Код ушёл на почту</h1>
      <p className={noteCls}>
        Если аккаунт с адресом <span className="break-all font-medium text-th-fg">{email}</span> есть,
        в письме код для смены пароля. После смены вы выйдете на других устройствах.
      </p>
      <CodeField value={code} onChange={setCode} autoFocus />
      <div>
        <label htmlFor="new-password" className={fieldLabelCls}>
          Новый пароль
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldCls}
          placeholder="Не короче 6 символов"
          minLength={6}
          required
        />
      </div>
      <FormError message={error} />
      <button type="submit" disabled={busy || code.length !== CODE_DIGITS} className={submitCls}>
        <KeyRound className="h-4 w-4" />
        {busy ? "Сохраняем…" : "Сохранить и войти"}
      </button>
      <ResendLine secondsLeft={secondsLeft} busy={busy} onResend={onResend} onChangeEmail={onChangeEmail} />
    </form>
  );
}
