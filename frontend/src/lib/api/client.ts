import { CSRF_COOKIE, readCookie } from "@/lib/auth/cookies";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/lib/auth/token-store";

export type ProblemFieldError = {
  field: string;
  message: string;
  type: string;
};

export type ProblemDetails = {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string | null;
  requestId?: string;
  errors?: ProblemFieldError[];
  [key: string]: unknown;
};

export type ApiFetchOptions = {
  retryOn401?: boolean;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly problem?: ProblemDetails;

  constructor(message: string, status: number, code: string, problem?: ProblemDetails) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.problem = problem;
  }
}

const configuredBase = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();
export const API_BASE_URL = (
  configuredBase && configuredBase.length > 0 ? configuredBase : "http://localhost:8000"
).replace(/\/+$/, "");

let refreshPromise: Promise<boolean> | null = null;

async function performRefresh(): Promise<boolean> {
  const csrf = readCookie(CSRF_COOKIE);
  if (!csrf) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "X-CSRF-Token": csrf,
      },
    });
    if (!response.ok) {
      clearAccessToken();
      return false;
    }
    const session = (await response.json()) as { accessToken?: string };
    if (!session.accessToken) {
      clearAccessToken();
      return false;
    }
    setAccessToken(session.accessToken);
    return true;
  } catch {
    clearAccessToken();
    return false;
  }
}

export async function refreshAccessToken(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = performRefresh().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function requestWithAuth(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }
  const token = getAccessToken();
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: "include",
      headers,
    });
  } catch {
    throw new ApiError(
      "Could not reach the Kindly service. Check your connection and try again.",
      0,
      "NETWORK_ERROR",
    );
  }
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
  options: ApiFetchOptions = {},
): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  let response = await requestWithAuth(normalizedPath, init);

  if (response.status === 401 && options.retryOn401 !== false && readCookie(CSRF_COOKIE)) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      response = await requestWithAuth(normalizedPath, init);
    }
  }

  if (!response.ok) {
    let problem: ProblemDetails | undefined;
    try {
      problem = (await response.json()) as ProblemDetails;
    } catch {
      problem = undefined;
    }
    throw new ApiError(
      problem?.detail ?? problem?.title ?? "The request could not be completed.",
      response.status,
      problem?.code ?? "HTTP_ERROR",
      problem,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
