// Anonymous shoppers get a random cart token instead of an account id, persisted in
// localStorage so the same cart survives a reload — sent as X-Cart-Token and merged into the
// account cart right after login/register (see AuthContext.login).
const STORAGE_KEY = "omyfish_guest_cart_token";

export function getOrCreateGuestCartToken(): string {
  let token = localStorage.getItem(STORAGE_KEY);
  if (!token) {
    token = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, token);
  }
  return token;
}

export function peekGuestCartToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}

export function clearGuestCartToken() {
  localStorage.removeItem(STORAGE_KEY);
}
