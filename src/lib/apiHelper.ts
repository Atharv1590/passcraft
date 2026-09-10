/**
 * Safe API request helper to prevent JSON parsing crashes when servers return HTML error pages
 */

export interface ApiResponse<T = any> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

export async function safeFetchJson<T = any>(
  url: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    
    if (contentType.includes('application/json')) {
      try {
        const json = await res.json();
        if (!res.ok) {
          return {
            ok: false,
            status: res.status,
            error: json.error || json.message || `Request failed with status ${res.status}`,
            data: json,
          };
        }
        return {
          ok: true,
          status: res.status,
          data: json,
        };
      } catch (jsonParseErr) {
        return {
          ok: false,
          status: res.status,
          error: `Failed to parse server response as JSON (${res.status})`,
        };
      }
    }

    // Response is not JSON (e.g. HTML 500/404 error page, Vite dev fallback, or proxy error)
    const text = await res.text();
    let errorMessage = `Server error (${res.status})`;

    if (res.status === 404) {
      errorMessage = `API endpoint ${url} not found (404).`;
    } else if (res.status === 502 || res.status === 503 || res.status === 504) {
      errorMessage = `Backend server is temporarily starting up or unavailable (${res.status}). Please try again in a moment.`;
    } else if (text && text.length < 200 && !text.includes('<!DOCTYPE') && !text.includes('<html') && !text.includes('<body')) {
      errorMessage = text.trim();
    } else {
      errorMessage = `Server returned status ${res.status}: ${res.statusText || 'Unexpected response'}`;
    }

    return {
      ok: false,
      status: res.status,
      error: errorMessage,
    };
  } catch (err: any) {
    console.error(`Network fetch failure for ${url}:`, err);
    return {
      ok: false,
      status: 0,
      error: err.message || 'Network connection failed. Please check your connection and server status.',
    };
  }
}
