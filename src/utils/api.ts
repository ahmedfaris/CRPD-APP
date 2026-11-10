/**
 * Secure API helper that automatically includes:
 * - credentials: 'include' (for Secure HttpOnly cookies)
 * - Authorization: Bearer <token>
 * - Intercepts 401 Session Invalidation / Concurrent Login / Timeout responses
 */

export interface SessionInvalidationEventDetail {
  code: string;
  error?: string;
  errorAr?: string;
  requiresRelogin?: boolean;
}

export interface ApiFetchInit extends RequestInit {
  skipSessionInvalidationEvent?: boolean;
}

export async function apiFetch(input: RequestInfo | URL, init: ApiFetchInit = {}): Promise<Response> {
  const token = localStorage.getItem('auth_token');
  const headers = new Headers(init.headers || {});

  if (!headers.has('Authorization') && token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, {
    ...init,
    credentials: 'include', // Ensures HttpOnly Secure session cookies are always transmitted
    headers
  });

  // Intercept 401 Unauthorized (unless the caller explicitly opted out or there is no stored token)
  if (response.status === 401 && !init.skipSessionInvalidationEvent) {
    const hasStoredToken = Boolean(localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token'));
    if (!hasStoredToken) {
      return response;
    }

    try {
      const cloned = response.clone();
      const data = await cloned.json();
      if (data && (data.requiresRelogin || data.code)) {
        window.dispatchEvent(
          new CustomEvent<SessionInvalidationEventDetail>('auth:session_invalidated', {
            detail: {
              code: data.code || 'SESSION_INVALIDATED',
              error: data.error,
              errorAr: data.errorAr,
              requiresRelogin: true
            }
          })
        );
      }
    } catch (_) {
      // Non-JSON 401 response
    }
  }

  return response;
}

/**
 * Safely parse JSON from a response, handling non-JSON (like HTML error pages, 502/504 gateways) gracefully
 */
export async function safeParseJson<T = any>(response: Response): Promise<{ ok: boolean; status: number; data: T }> {
  try {
    const text = await response.text();
    if (!text || text.trim() === '') {
      return { ok: response.ok, status: response.status, data: {} as T };
    }

    const trimmed = text.trim();
    if (trimmed.startsWith('<') || trimmed.toLowerCase().startsWith('<!doctype')) {
      const isGatewayIssue = response.status >= 500 || response.status === 404;
      return {
        ok: false,
        status: response.status,
        data: {
          error: isGatewayIssue
            ? 'The backend server is currently starting or temporarily unavailable. Please retry in a moment.'
            : `Server returned unexpected response (status ${response.status}).`
        } as T
      };
    }

    const parsed = JSON.parse(text);
    return { ok: response.ok, status: response.status, data: parsed };
  } catch (err: any) {
    return {
      ok: false,
      status: response.status,
      data: {
        error: 'Unable to parse server response. Please try again.'
      } as T
    };
  }
}

