"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  apiClient,
  ApiError,
  setAuthToken,
} from "./api-client";
import type { LoginResponse, User, UserRole } from "./types";

const TOKEN_KEY = "vraip_token";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  register: (
    email: string,
    password: string,
    full_name: string,
    role: UserRole | string
  ) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function extractToken(resp: LoginResponse | null): string | null {
  if (!resp) return null;
  return (resp.token as string) ?? (resp.access_token as string) ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: restore token from localStorage and validate via /auth/me.
  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
    if (!stored) {
      setIsLoading(false);
      return;
    }
    setAuthToken(stored);
    setToken(stored);
    apiClient
      .get<User>("/auth/me")
      .then((res) => {
        setUser(res.data);
      })
      .catch((err) => {
        // 401 (or anything) → clear stale token.
        if (err instanceof ApiError) {
          localStorage.removeItem(TOKEN_KEY);
          setAuthToken(null);
          setToken(null);
          setUser(null);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiClient.post<LoginResponse>("/auth/login", {
      email,
      password,
    });
    const newToken = extractToken(res.data);
    if (!newToken) {
      throw new ApiError("no_token", "Login succeeded but no token returned.");
    }
    localStorage.setItem(TOKEN_KEY, newToken);
    setAuthToken(newToken);
    setToken(newToken);
    const me = await apiClient.get<User>("/auth/me");
    setUser(me.data);
  }, []);

  const register = useCallback(
    async (
      email: string,
      password: string,
      full_name: string,
      role: UserRole | string
    ) => {
      await apiClient.post("/auth/register", {
        email,
        password,
        full_name,
        role,
      });
      // Auto-login after successful registration.
      await login(email, password);
    },
    [login]
  );

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
    router.push("/login");
  }, [router]);

  return (
    <AuthContext.Provider
      value={{ user, token, isLoading, login, logout, register }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
