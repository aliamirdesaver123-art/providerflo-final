import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import AIActionsReadyNowPanel from "../components/AIActionsReadyNowPanel";
import MCPAccessPanel from "@/components/mcp/MCPAccessPanel";
import { ShieldCheck, Sparkles, Network, Info } from "lucide-react";
import { getAIAutomationSettings, updateAIAutomationSettings } from "@/lib/api/aiActionsReadyNow";

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
      <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--pf-muted)" }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "var(--pf-border)" }} />
    </div>
  );
}

function FeatureToggle({
  icon: Icon,
  title,
  description,
  badge,
  checked,
  onChange,
  loading,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  badge?: string;
  checked: boolean;
  onChange: () => void;
  loading?: boolean;
}) {
  return (
    <div style={{
      background: "#FFFFFF", border: "1px solid #E6EBF2", borderRadius: 10,
      padding: "16px 20px", display: "flex", alignItems: "center", gap: 14,
    }}>
      <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", border: "1px solid #DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon style={{ width: 17, height: 17, color: "#2563EB" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{title}</span>
          {badge && (
            <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#ECFDF5", color: "#065F46", border: "1px solid #BBF7D0" }}>{badge}</span>
          )}
          <Info style={{ width: 13, height: 13, color: "#D1D5DB" }} />
        </div>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0" }}>{description}</p>
      </div>
      <button
        onClick={onChange}
        disabled={loading}
        aria-label={checked ? `Disable ${title}` : `Enable ${title}`}
        style={{
          width: 44, height: 24, borderRadius: 12, border: "none",
          cursor: loading ? "not-allowed" : "pointer",
          background: checked ? "#2563EB" : "#D1D5DB",
          position: "relative", transition: "background 180ms", flexShrink: 0,
        }}
      >
        <span style={{
          position: "absolute", top: 2, left: checked ? 22 : 2,
          width: 20, height: 20, borderRadius: "50%",
          background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.25)",
          transition: "left 180ms",
        }} />
      </button>
    </div>
  );
}

export default function AIActions() {
  const [aiEnabled, setAiEnabled] = useState(true);
  const [summariesEnabled, setSummariesEnabled] = useState(true);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [togglingAi, setTogglingAi] = useState(false);
  const [togglingSummaries, setTogglingSummaries] = useState(false);

  useEffect(() => {
    getAIAutomationSettings()
      .then(s => {
        setAiEnabled(s.aiFeaturesEnabled ?? true);
        setSummariesEnabled(s.aiPoweredActionsEnabled ?? true);
      })
      .catch(() => {})
      .finally(() => setSettingsLoading(false));
  }, []);

  async function toggleAi() {
    setTogglingAi(true);
    try {
      const next = !aiEnabled;
      setAiEnabled(next);
      await updateAIAutomationSettings({ aiFeaturesEnabled: next, aiPoweredActionsEnabled: summariesEnabled });
    } catch { setAiEnabled(v => !v); }
    finally { setTogglingAi(false); }
  }

  async function toggleSummaries() {
    setTogglingSummaries(true);
    try {
      const next = !summariesEnabled;
      setSummariesEnabled(next);
      await updateAIAutomationSettings({ aiFeaturesEnabled: aiEnabled, aiPoweredActionsEnabled: next });
    } catch { setSummariesEnabled(v => !v); }
    finally { setTogglingSummaries(false); }
  }

  return (
    <AppLayout>
      <div className="pf-page-head">
        <div>
          <h1 className="pf-page-title">AI Actions</h1>
          <p className="pf-page-desc">Configure AI access, features, and review AI-generated draft outputs.</p>
        </div>
      </div>

      {/* ── AI ACCESS ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel label="AI Access" />
        <MCPAccessPanel />
      </div>

      {/* ── AI FEATURES ────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <SectionLabel label="AI Features" />
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <FeatureToggle
            icon={Sparkles}
            title="Enable AI Features"
            description="AI features are enabled for your organisation."
            badge={aiEnabled ? "Active" : undefined}
            checked={aiEnabled}
            onChange={toggleAi}
            loading={settingsLoading || togglingAi}
          />
          <FeatureToggle
            icon={Network}
            title="AI Dashboard Summaries"
            description="Automatically generate executive summaries and insights from your data."
            checked={summariesEnabled}
            onChange={toggleSummaries}
            loading={settingsLoading || togglingSummaries}
          />
        </div>
      </div>

      {/* ── AI ACTIONS ─────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        <SectionLabel label="AI Actions" />
        <AIActionsReadyNowPanel />
      </div>

      <div className="pf-card" style={{ marginTop: 14 }}>
        <div className="pf-card-body" style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div className="pf-metric-icon" style={{ flexShrink: 0 }}>
            <ShieldCheck style={{ width: 18, height: 18, color: "var(--pf-primary)", strokeWidth: 1.8 }} />
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)", marginBottom: 4 }}>
              Human approval required before live changes
            </p>
            <p style={{ fontSize: 13, color: "var(--pf-muted)", lineHeight: 1.6 }}>
              AI generates draft outputs only. Approving a draft records your decision and marks it for
              implementation — it does not automatically modify rosters, send documents, or change operational
              data. Your team reviews and applies approved outputs manually, keeping you in full control.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
