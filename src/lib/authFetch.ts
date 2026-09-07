export function withAuthHeaders(initial: HeadersInit | undefined, token: string) {
  const headers = new Headers(initial);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

export function authFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const token = localStorage.getItem('tangolab_auth_token') || '';
  return fetch(input, { ...init, headers: withAuthHeaders(init.headers, token) });
}
