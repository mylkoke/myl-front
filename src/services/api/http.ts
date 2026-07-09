const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3210';

let accessToken: string | null = null;
let refreshHandler: (() => Promise<string | null>) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getApiUrl(): string {
  return API_URL;
}

/** Registered by authStore: called on 401 to try a token refresh once. */
export function setRefreshHandler(handler: (() => Promise<string | null>) | null) {
  refreshHandler = handler;
}

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  retryOn401?: boolean;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, retryOn401 = true } = options;

  // FormData se envía tal cual (el navegador pone el Content-Type multipart con boundary)
  const isFormData = body instanceof FormData;
  const res = await fetch(`${API_URL}${path}`, {
    method,
    credentials: 'include', // refresh cookie
    headers: {
      ...(body !== undefined && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: isFormData ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && retryOn401 && refreshHandler) {
    const newToken = await refreshHandler();
    if (newToken) {
      return apiFetch<T>(path, { ...options, retryOn401: false });
    }
  }

  const json = (await res.json().catch(() => null)) as
    | { success?: boolean; data?: T; message?: string | string[] }
    | null;

  if (!res.ok) {
    const msg = Array.isArray(json?.message)
      ? json.message.join('. ')
      : (json?.message ?? `Error ${res.status}`);
    throw new ApiError(res.status, msg);
  }

  return (json?.data ?? json) as T;
}
