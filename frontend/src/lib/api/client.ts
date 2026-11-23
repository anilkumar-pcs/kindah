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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const headers = new Headers(init.headers);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${normalizedPath}`, {
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
