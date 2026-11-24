"use client";

import { useEffect, useState } from "react";

import { SESSION_CHANGED_EVENT } from "@/lib/auth/events";
import { restoreSession, type UserProfile } from "@/lib/auth/session";

export type SessionUser = UserProfile | null | undefined;

export function useSessionUser(): {
  user: SessionUser;
  setUser: (user: SessionUser) => void;
} {
  const [user, setUser] = useState<SessionUser>(undefined);

  useEffect(() => {
    let active = true;

    const sync = () => {
      restoreSession()
        .then((restored) => {
          if (active) {
            setUser(restored);
          }
        })
        .catch(() => {
          if (active) {
            setUser(null);
          }
        });
    };

    sync();

    const handleSessionChange = (event: Event) => {
      const detail = (event as CustomEvent<UserProfile | null>).detail;
      if (detail !== undefined) {
        setUser(detail);
        return;
      }
      sync();
    };

    window.addEventListener(SESSION_CHANGED_EVENT, handleSessionChange);
    return () => {
      active = false;
      window.removeEventListener(SESSION_CHANGED_EVENT, handleSessionChange);
    };
  }, []);

  return { user, setUser };
}
