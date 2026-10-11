export function withAuthHeaders(initial: HeadersInit | undefined, token: string) {
  const headers = new Headers(initial);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = localStorage.getItem('tangolab_auth_token') || '';
  const response = await fetch(input, { ...init, headers: withAuthHeaders(init.headers, token) });
  if (response.status === 401 && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tangolab:unauthorized'));
  }
  return response;
}
