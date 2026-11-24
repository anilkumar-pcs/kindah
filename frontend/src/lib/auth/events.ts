import type { UserProfile } from "@/lib/auth/session";

export const SESSION_CHANGED_EVENT = "kindly:session-changed";

export function notifySessionChanged(user: UserProfile | null): void {
  if (typeof window === "undefined") {
    return;
  }
  window.dispatchEvent(
    new CustomEvent<UserProfile | null>(SESSION_CHANGED_EVENT, { detail: user }),
  );
}
