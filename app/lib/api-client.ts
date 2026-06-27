// Thin typed fetch wrapper around the VRAIP gateway.
// Unwraps the backend envelope and throws ApiError on failure.

const BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8080";

export interface ResponseMeta {
  request_id?: string;
  timestamp?: string;
  page?: number;
  page_size?: number;
  total?: number;
  [key: string]: unknown;
}

export interface Unwrapped<T> {
  data: T;
  meta: ResponseMeta;
}

export class ApiError extends Error {
  code: string;
  details: Record<string, unknown>;
  status: number;

  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
    status = 0
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.details = details;
    this.status = status;
  }
}

// Module-level JWT token. Set by the auth context after login.
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

function buildHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  if (authToken) {
    headers.set("Authorization", `Bearer ${authToken}`);
  }
  return headers;
}

interface BackendEnvelope<T> {
  data?: T;
  meta?: ResponseMeta;
  error?: {
    code?: string;
    message?: string;
    details?: Record<string, unknown>;
  };
}

async function handle<T>(res: Response): Promise<Unwrapped<T>> {
  let body: BackendEnvelope<T> | null = null;
  // Some endpoints (exports) may not return JSON; guard the parse.
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text) as BackendEnvelope<T>;
    } catch {
      body = null;
    }
  }

  if (!res.ok || (body && body.error)) {
    const err = body?.error;
    throw new ApiError(
      err?.code ?? `http_${res.status}`,
      err?.message ?? res.statusText ?? "Request failed",
      err?.details ?? {},
      res.status
    );
  }

  return {
    data: (body?.data ?? null) as T,
    meta: body?.meta ?? {},
  };
}

async function request<T>(
  method: string,
  path: string,
  jsonBody?: unknown
): Promise<Unwrapped<T>> {
  let res: Response;
  try {
    const headers = buildHeaders();
    if (jsonBody !== undefined) {
      headers.set("Content-Type", "application/json");
    }
    res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: jsonBody !== undefined ? JSON.stringify(jsonBody) : undefined,
    });
  } catch (e) {
    throw new ApiError(
      "network_error",
      e instanceof Error ? e.message : "Network request failed"
    );
  }
  return handle<T>(res);
}

export const apiClient = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, body),
  delete: <T>(path: string) => request<T>("DELETE", path),

  // Fetch a binary/blob response (exports). Throws ApiError on failure.
  getBlob: async (path: string): Promise<Blob> => {
    let res: Response;
    try {
      res = await fetch(`${BASE_URL}${path}`, {
        method: "GET",
        headers: buildHeaders(),
      });
    } catch (e) {
      throw new ApiError(
        "network_error",
        e instanceof Error ? e.message : "Network request failed"
      );
    }
    if (!res.ok) {
      throw new ApiError(`http_${res.status}`, res.statusText || "Download failed", {}, res.status);
    }
    return res.blob();
  },

  postFormData: async <T>(
    path: string,
    formData: FormData
  ): Promise<Unwrapped<T>> => {
    let res: Response;
    try {
      // Do NOT set Content-Type: the browser sets the multipart boundary.
      res = await fetch(`${BASE_URL}${path}`, {
        method: "POST",
        headers: buildHeaders(),
        body: formData,
      });
    } catch (e) {
      throw new ApiError(
        "network_error",
        e instanceof Error ? e.message : "Network request failed"
      );
    }
    return handle<T>(res);
  },
};
