import AppLayout from "@/components/layout/AppLayout";
import MCPAccessPanel from "@/components/mcp/MCPAccessPanel";
import { Network, Sparkles, Info } from "lucide-react";

export default function AIAutomationSettings() {
  return (
    <AppLayout>
      <div className="pf-page-head">
        <div>
          <h1 className="pf-page-title">AI & Automation Settings</h1>
          <p className="pf-page-desc">Configure AI-powered features with complete control over data access and processing.</p>
        </div>
      </div>

      {/* ─── AI Access section ─────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--pf-muted)" }}>AI Access</span>
          <div style={{ flex: 1, height: 1, background: "var(--pf-border)" }} />
        </div>
        <MCPAccessPanel />
      </div>

      {/* ─── AI Features section ────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <span style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".06em", color: "var(--pf-muted)" }}>AI Features</span>
          <div style={{ flex: 1, height: 1, background: "var(--pf-border)" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            {
              icon: Sparkles,
              title: "Enable AI Features",
              description: "AI features are enabled for your organisation.",
              badge: "Active",
              badgeColor: "#059669",
              badgeBg: "#ECFDF5",
            },
            {
              icon: Network,
              title: "AI Dashboard Summaries",
              description: "Automatically generate executive summaries and insights from your data.",
              badge: null,
              badgeColor: null,
              badgeBg: null,
            },
          ].map(({ icon: Icon, title, description, badge, badgeColor, badgeBg }) => (
            <div
              key={title}
              style={{
                background: "#FFFFFF",
                border: "1px solid #E6EBF2",
                borderRadius: 10,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", border: "1px solid #DBEAFE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Icon style={{ width: 17, height: 17, color: "#2563EB" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{title}</span>
                  {badge && (
                    <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: badgeBg!, color: badgeColor! }}>{badge}</span>
                  )}
                  <Info style={{ width: 13, height: 13, color: "#D1D5DB" }} />
                </div>
                <p style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0" }}>{description}</p>
              </div>
              <div
                style={{
                  width: 44, height: 24, borderRadius: 12, background: "#2563EB", position: "relative", flexShrink: 0,
                }}
              >
                <span style={{ position: "absolute", top: 2, left: 22, width: 20, height: 20, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.25)" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
