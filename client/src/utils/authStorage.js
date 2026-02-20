/**
 * Jedno miejsce na wszystkie operacje na storage związanym z auth.
 * Używane przy logowaniu, wylogowaniu i przy 401.
 * Dzięki temu nic nie zostaje w localStorage/sessionStorage po wylogowaniu.
 */

const TOKEN_KEY = 'token';
const USER_KEY = 'user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export function getUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

/**
 * Pełne wylogowanie: usuwa token i użytkownika z localStorage
 * oraz czyści cały sessionStorage (żeby nic z sesji nie zostało).
 * Wywołuj z: przycisku Wyloguj, przy 401, przy błędzie /auth/me, w innej karcie (storage event).
 */
export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.clear();
}
