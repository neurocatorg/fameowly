"use client";

import { useCallback, useState } from "react";

export type CodePurpose = "login" | "reset_password";

export interface CodeSent {
  next: "code" | "request-access";
  resendIn?: number;
  noAccountHint?: boolean;
}

type Result<T> = { ok: true; data: T } | { ok: false; retryAfter?: number };

/** Sign-in API calls with a shared busy flag and error message */
export function useSignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const post = useCallback(async <T,>(url: string, body: object): Promise<Result<T>> => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return { ok: true, data: data as T };
      setError(data.error || "Что-то пошло не так");
      return { ok: false, retryAfter: data.retryAfter };
    } catch {
      setError("Ошибка сети");
      return { ok: false };
    } finally {
      setBusy(false);
    }
  }, []);

  const requestCode = useCallback(
    (email: string, purpose: CodePurpose) => post<CodeSent>("/api/auth/email/start", { email, purpose }),
    [post],
  );
  const verifyCode = useCallback(
    (email: string, code: string) => post("/api/auth/email/verify", { email, code }),
    [post],
  );
  const resetPassword = useCallback(
    (email: string, code: string, newPassword: string) =>
      post("/api/auth/password/reset", { email, code, newPassword }),
    [post],
  );
  const passwordLogin = useCallback(
    (name: string, password: string) => post("/api/auth/login", { name, password }),
    [post],
  );

  return { busy, error, setError, requestCode, verifyCode, resetPassword, passwordLogin };
}
