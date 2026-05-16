import { useState, useEffect, useCallback } from "react";
import { differenceInDays, parseISO } from "date-fns";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";
import Sidebar from "./Sidebar";
import AppHeader from "./AppHeader";
import ImpersonationBanner from "@/components/ImpersonationBanner";

interface AppLayoutProps {
  children: React.ReactNode;
  noPadding?: boolean;
}

function TrialBanner() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  if (!user) return null;
  const { subscriptionStatus, trialEndsAt } = user;
  if (subscriptionStatus !== "trial" || !trialEndsAt) return null;

  const daysLeft = differenceInDays(parseISO(trialEndsAt), new Date());
  if (daysLeft < 0) return null;

  const urgent = daysLeft <= 3;

  return (
    <div
      className="pf-trial-banner"
      style={{
        background: urgent ? "#fef2f2" : "#eff6ff",
        borderColor: urgent ? "#fecaca" : "#bfdbfe",
        color: urgent ? "#991b1b" : "#1e40af",
      }}
    >
      <span>
        {daysLeft === 0
          ? "Your free trial expires today — choose a plan to keep access."
          : urgent
          ? `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining in your free trial.`
          : `${daysLeft} day${daysLeft === 1 ? "" : "s"} remaining in your 14-day free trial. Full access to all features.`}
      </span>
      <button
        onClick={() => navigate("/billing")}
        style={{ fontWeight: 700, textDecoration: "underline", textUnderlineOffset: 2, background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: 12, flexShrink: 0, padding: 0 }}
      >
        Choose a plan →
      </button>
    </div>
  );
}

export default function AppLayout({ children, noPadding = false }: AppLayoutProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { return localStorage.getItem("pf_sidebar_collapsed") !== "false"; } catch { return true; }
  });

  const toggleSidebar = useCallback(() => {
    setCollapsed((v) => {
      const next = !v;
      try { localStorage.setItem("pf_sidebar_collapsed", String(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleSidebar]);

  return (
    <div className="pf-shell">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
      <div className="pf-main">
        <AppHeader collapsed={collapsed} onToggle={toggleSidebar} />
        <TrialBanner />
        <ImpersonationBanner />
        <main style={{ flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}>
          {noPadding ? children : (
            <div className="pf-content pf-animate-in">{children}</div>
          )}
        </main>
      </div>
    </div>
  );
}
