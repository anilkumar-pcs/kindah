import { apiFetch, API_BASE_URL, refreshAccessToken } from "@/lib/api/client";
import { CSRF_COOKIE, readCookie } from "@/lib/auth/cookies";
import { notifySessionChanged } from "@/lib/auth/events";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth/token-store";

export type UserStatus =
  "ACTIVE" | "RESTRICTED" | "SUSPENDED" | "BANNED" | "DELETION_PENDING" | "DELETED";

export type UserProfile = {
  id: string;
  displayName: string | null;
  avatar: string | null;
  city: string | null;
  status: UserStatus;
  role?: "USER" | "MODERATOR" | "ADMIN";
  onboardingRequired: boolean;
  karma: number;
  streak: number;
  cooldownUntil: string | null;
  ageConfirmedAt: string | null;
  termsAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
  guidelinesAcceptedAt: string | null;
};

export type SessionResponse = {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: UserProfile;
};

export type OtpRequestResponse = {
  message: string;
  expiresInSeconds: number;
};

export type ConsentInput = {
  ageConfirmed: boolean;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  guidelinesAccepted: boolean;
};

export type ProfileUpdateInput = {
  displayName?: string;
  avatar?: string;
  city?: string;
};

export async function requestOtp(phone: string): Promise<OtpRequestResponse> {
  return apiFetch<OtpRequestResponse>(
    "/api/v1/auth/otp/request",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    },
    { retryOn401: false },
  );
}

export async function verifyOtp(phone: string, code: string): Promise<SessionResponse> {
  const session = await apiFetch<SessionResponse>(
    "/api/v1/auth/otp/verify",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    },
    { retryOn401: false },
  );
  setAccessToken(session.accessToken);
  notifySessionChanged(session.user);
  return session;
}

export async function fetchMe(): Promise<UserProfile> {
  return apiFetch<UserProfile>("/api/v1/me");
}

export async function restoreSession(): Promise<UserProfile | null> {
  if (getAccessToken()) {
    try {
      return await fetchMe();
    } catch {
      clearAccessToken();
    }
  }

  // Without the CSRF cookie there is no refresh session to restore. Avoid a
  // guaranteed 401 on first visits, which would surface as a console error.
  if (!readCookie(CSRF_COOKIE)) {
    return null;
  }
  const refreshed = await refreshAccessToken();
  if (!refreshed) {
    return null;
  }
  try {
    return await fetchMe();
  } catch {
    clearAccessToken();
    return null;
  }
}

export async function saveConsent(input: ConsentInput): Promise<UserProfile> {
  const user = await apiFetch<UserProfile>("/api/v1/me/consent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  notifySessionChanged(user);
  return user;
}

export async function updateProfile(input: ProfileUpdateInput): Promise<UserProfile> {
  const user = await apiFetch<UserProfile>("/api/v1/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  notifySessionChanged(user);
  return user;
}

export async function logout(): Promise<void> {
  const csrf = readCookie(CSRF_COOKIE);
  if (csrf) {
    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: "POST",
        credentials: "include",
        headers: { "X-CSRF-Token": csrf },
      });
    } catch {
      // Clearing the local token is still the right user-facing outcome.
    }
  }
  clearAccessToken();
  notifySessionChanged(null);
}
