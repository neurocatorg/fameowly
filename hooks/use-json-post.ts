"use client";

import { useCallback, useState } from "react";

export type PostResult<T> = { ok: true; data: T } | { ok: false; retryAfter?: number };

/** JSON requests with a shared busy flag and the server's error message */
export function useJsonPost() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const post = useCallback(async <T,>(url: string, body: object, method = "POST"): Promise<PostResult<T>> => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(url, {
        method,
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

  return { busy, error, setError, post };
}
