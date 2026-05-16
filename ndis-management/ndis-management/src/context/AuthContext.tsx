import React, { createContext, useContext, useState, useEffect } from "react";
import { useLocation } from "wouter";
import { setAuthTokenGetter } from "@workspace/api-client-react";

interface UserInfo {
  email: string;
  fullName: string;
  company?: string;
  abn?: string;
  plan: string;
  subscriptionStatus: string;
  trialEndsAt: string | null;
  userId?: string;
  token?: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  user: UserInfo | null;
  isTrialExpired: boolean;
  loginWithUserInfo: (info: UserInfo) => void;
  logout: () => void;
  refreshUser: (info: Partial<UserInfo>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function isExpired(trialEndsAt: string | null, status: string): boolean {
  if (status === "active" || status === "lifetime") return false;
  if (!trialEndsAt) return false;
  return new Date(trialEndsAt) < new Date();
}

setAuthTokenGetter(() => localStorage.getItem("pf_token"));

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem("pf_auth") === "true";
  });
  const [user, setUser] = useState<UserInfo | null>(() => {
    const raw = localStorage.getItem("pf_user");
    if (raw) {
      try { return JSON.parse(raw); } catch { return null; }
    }
    return null;
  });
  const [, navigate] = useLocation();

  const isTrialExpired = user
    ? isExpired(user.trialEndsAt, user.subscriptionStatus)
    : false;

  const loginWithUserInfo = (info: UserInfo) => {
    localStorage.setItem("pf_auth", "true");
    localStorage.setItem("pf_user", JSON.stringify(info));
    if (info.token) {
      localStorage.setItem("pf_token", info.token);
    }
    setIsAuthenticated(true);
    setUser(info);
  };

  const refreshUser = (info: Partial<UserInfo>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...info };
      localStorage.setItem("pf_user", JSON.stringify(updated));
      return updated;
    });
  };

  const logout = () => {
    localStorage.removeItem("pf_auth");
    localStorage.removeItem("pf_user");
    localStorage.removeItem("pf_token");
    setIsAuthenticated(false);
    setUser(null);
    navigate("/login");
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, isTrialExpired, loginWithUserInfo, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
