"use client";

import { useState, type ReactNode } from "react";
import { LogIn } from "lucide-react";
import { FormError } from "./form-error";
import { fieldCls, fieldLabelCls, submitCls, titleCls } from "./styles";

interface PasswordStepProps {
  busy: boolean;
  error: string;
  onSubmit: (login: string, password: string) => void;
  /** Links under the button */
  children?: ReactNode;
}

export function PasswordStep({ busy, error, onSubmit, children }: PasswordStepProps) {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(login, password);
      }}
      className="flex flex-col gap-4"
    >
      <h1 className={titleCls}>Вход по паролю</h1>
      <div>
        <label htmlFor="login" className={fieldLabelCls}>
          Имя или email
        </label>
        <input
          id="login"
          type="text"
          autoComplete="username"
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          className={fieldCls}
          placeholder="Имя или email"
          autoFocus
          required
        />
      </div>
      <div>
        <label htmlFor="password" className={fieldLabelCls}>
          Пароль
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={fieldCls}
          placeholder="••••••••"
          required
        />
      </div>
      <FormError message={error} />
      <button type="submit" disabled={busy} className={submitCls}>
        <LogIn className="h-4 w-4" />
        {busy ? "Вход…" : "Войти"}
      </button>
      {children}
    </form>
  );
}
