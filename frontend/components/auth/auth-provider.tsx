"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api, type LoginInput, type RegisterInput, type User } from "@/lib/api";

type AuthStatus = "loading" | "authenticated" | "unauthenticated";
export type AuthTab = "login" | "register";

interface AuthContextValue {
  user: User | null;
  status: AuthStatus;
  login(input: LoginInput): Promise<User>;
  /** Creates the account, then logs in with the same credentials. */
  register(input: RegisterInput): Promise<User>;
  logout(): Promise<void>;
  /** Controls the login/register dialog in the header. */
  dialogOpen: boolean;
  dialogTab: AuthTab;
  openAuthDialog(tab?: AuthTab): void;
  setDialogOpen(open: boolean): void;
  setDialogTab(tab: AuthTab): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogTab, setDialogTab] = useState<AuthTab>("login");

  // Restore the session (if any) from the httpOnly cookie on first load.
  useEffect(() => {
    let cancelled = false;
    api
      .getMe()
      .catch(() => null)
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setStatus(me ? "authenticated" : "unauthenticated");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (input: LoginInput) => {
    const me = await api.login(input);
    setUser(me);
    setStatus("authenticated");
    return me;
  }, []);

  const register = useCallback(
    async (input: RegisterInput) => {
      await api.register(input);
      return login({ email: input.email, password: input.password });
    },
    [login],
  );

  const logout = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const openAuthDialog = useCallback((tab: AuthTab = "login") => {
    setDialogTab(tab);
    setDialogOpen(true);
  }, []);

  const value = useMemo(
    () => ({
      user,
      status,
      login,
      register,
      logout,
      dialogOpen,
      dialogTab,
      openAuthDialog,
      setDialogOpen,
      setDialogTab,
    }),
    [user, status, login, register, logout, dialogOpen, dialogTab, openAuthDialog],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
