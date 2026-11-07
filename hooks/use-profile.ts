"use client";

import { useCallback, useEffect, useState } from "react";
import type { UserInfo } from "@/lib/types";

/** The signed-in account for the profile page; `reload` after every change */
export function useProfile() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me")
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setUser(data.user);
        } else if (res.status === 401) {
          window.location.href = "/login";
        }
      })
      .catch(() => { /* keep the last value */ });
    return () => { cancelled = true; };
  }, [version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { user, reload };
}
