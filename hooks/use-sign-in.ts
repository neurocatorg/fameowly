"use client";

import { useCallback } from "react";
import { useJsonPost } from "./use-json-post";

export type CodePurpose = "login" | "reset_password";

export interface CodeSent {
  next: "code" | "request-access";
  resendIn?: number;
  noAccountHint?: boolean;
}

/** Sign-in API calls with a shared busy flag and error message */
export function useSignIn() {
  const { busy, error, setError, post } = useJsonPost();

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
