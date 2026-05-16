/**
 * fetchWithAuth — drop-in fetch wrapper that:
 *  1. Automatically attaches the stored auth token
 *  2. On 401 (with redirectOnUnauthorized=true): clears token and redirects to login
 *  3. On other non-OK responses: throws ApiError with status + server error message + field errors
 */

type FetchWithAuthOptions = RequestInit & {
  redirectOnUnauthorized?: boolean;
};

function getToken(): string | null {
  return localStorage.getItem("pf_token");
}

export class ApiError extends Error {
  status: number;
  fields?: Record<string, string[]>;

  constructor(message: string, status: number, fields?: Record<string, string[]>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

async function readErrorBody(response: Response): Promise<{
  message: string;
  fields?: Record<string, string[]>;
}> {
  try {
    const body = await response.json();
    return {
      message:
        body?.error ||
        body?.message ||
        body?.detail ||
        `Request failed (${response.status})`,
      fields: body?.fields,
    };
  } catch {
    try {
      const text = await response.text();
      return { message: text || `Request failed (${response.status})` };
    } catch {
      return { message: `Request failed (${response.status})` };
    }
  }
}

export async function fetchWithAuth(
  input: RequestInfo | URL,
  init: FetchWithAuthOptions = {}
): Promise<Response> {
  const token = getToken();
  const headers = new Headers(init.headers ?? {});

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const { redirectOnUnauthorized = true, ...fetchInit } = init;

  const response = await fetch(input, { ...fetchInit, headers });

  if (response.status === 401 && redirectOnUnauthorized) {
    localStorage.removeItem("pf_token");
    localStorage.removeItem("pf_auth");
    localStorage.removeItem("pf_user");
    const redirectUrl = new URL("/app/login", window.location.origin);
    redirectUrl.searchParams.set("reason", "session_expired");
    window.location.replace(redirectUrl.toString());
    await new Promise(() => {});
  }

  return response;
}

export async function fetchWithAuthJson<T = unknown>(
  input: RequestInfo | URL,
  init: FetchWithAuthOptions = {}
): Promise<T> {
  const response = await fetchWithAuth(input, {
    ...init,
    redirectOnUnauthorized: init.redirectOnUnauthorized ?? false,
  });

  if (!response.ok) {
    const { message, fields } = await readErrorBody(response);

    if (response.status === 401) {
      localStorage.removeItem("pf_token");
      localStorage.removeItem("pf_auth");
      localStorage.removeItem("pf_user");
    }

    throw new ApiError(message, response.status, fields);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
