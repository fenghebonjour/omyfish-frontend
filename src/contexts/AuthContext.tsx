"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, setAuthHandlers, TokenResponse } from "@/lib/api";

interface AuthState {
  token: string | null;
  userId: string | null;
  email: string | null;
  role: string | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({ token: null, userId: null, email: null, role: null });
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const persistAuth = useCallback((resp: TokenResponse) => {
    localStorage.setItem("omyfish_token", resp.token);
    localStorage.setItem("omyfish_userId", resp.userId);
    localStorage.setItem("omyfish_email", resp.email);
    localStorage.setItem("omyfish_role", resp.role);
  }, []);

  const clearStorage = useCallback(() => {
    localStorage.removeItem("omyfish_token");
    localStorage.removeItem("omyfish_userId");
    localStorage.removeItem("omyfish_email");
    localStorage.removeItem("omyfish_role");
  }, []);

  // Lets apiFetch silently refresh an expired access token mid-session (via
  // the httpOnly refresh cookie) and keep this context's state in sync, or
  // force a logout + redirect if the refresh cookie itself is dead.
  useEffect(() => {
    setAuthHandlers({
      onTokenRefreshed: (resp) => {
        persistAuth(resp);
        setAuth({ token: resp.token, userId: resp.userId, email: resp.email, role: resp.role });
      },
      onSessionExpired: () => {
        clearStorage();
        setAuth({ token: null, userId: null, email: null, role: null });
        sessionStorage.setItem("omyfish_session_expired", "1");
        router.push("/login");
      },
    });
  }, [persistAuth, clearStorage, router]);

  useEffect(() => {
    const token = localStorage.getItem("omyfish_token");
    const userId = localStorage.getItem("omyfish_userId");
    const email = localStorage.getItem("omyfish_email");
    const role = localStorage.getItem("omyfish_role");
    if (token) {
      setAuth({ token, userId, email, role });
      setIsLoading(false);
    } else {
      // No access token in memory/localStorage — try the httpOnly refresh cookie, if any
      // (BACKLOG.md item F, WEAKNESS_AUDIT.md §1.3). A 401 here just means the user isn't
      // logged in.
      api.auth.refresh()
        .then((resp) => {
          persistAuth(resp);
          setAuth({ token: resp.token, userId: resp.userId, email: resp.email, role: resp.role });
        })
        .catch(() => clearStorage())
        .finally(() => setIsLoading(false));
    }
  }, [persistAuth, clearStorage]);

  const login = useCallback(async (email: string, password: string) => {
    const resp: TokenResponse = await api.auth.login(email, password);
    persistAuth(resp);
    setAuth({ token: resp.token, userId: resp.userId, email: resp.email, role: resp.role });
  }, [persistAuth]);

  const logout = useCallback(() => {
    clearStorage();
    setAuth({ token: null, userId: null, email: null, role: null });
    api.auth.logout().catch(() => {});
  }, [clearStorage]);

  return (
    <AuthContext.Provider value={{ ...auth, login, logout, isAuthenticated: !!auth.token, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
