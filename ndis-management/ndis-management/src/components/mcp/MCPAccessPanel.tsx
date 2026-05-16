import { useState, useEffect, useRef } from "react";
import {
  Network, Copy, Check, ExternalLink, Trash2, Plus,
  AlertTriangle, RefreshCw, Shield, Key, Info, X,
  Eye, EyeOff, ChevronDown, ChevronUp, Clock,
} from "lucide-react";
import { fetchWithAuth, fetchWithAuthJson } from "@/lib/fetchWithAuth";

const MCP_ENDPOINT = "https://mcp.providerflo.com.au/mcp";

type Connection = {
  id: number;
  clientName: string;
  scopes: string;
  status: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};
type AuditLog = {
  id: number;
  clientName: string | null;
  eventType: string;
  toolName: string | null;
  resultCount: number | null;
  status: string;
  errorMessage: string | null;
  createdAt: string;
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <button
      onClick={copy}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5,
        padding: "0 14px", height: 38, borderRadius: 7,
        border: "1px solid #E6EBF2", background: "#FFFFFF",
        color: "#374151", fontSize: 12, fontWeight: 600, cursor: "pointer",
        flexShrink: 0, whiteSpace: "nowrap",
      }}
    >
      {copied
        ? <><Check style={{ width: 12, height: 12, color: "#059669" }} /> Copied</>
        : <><Copy style={{ width: 12, height: 12 }} /> Copy</>}
    </button>
  );
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(d: string | null) {
  if (!d) return "Never";
  return new Date(d).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function ProviderIcon({ type }: { type: "claude" | "openai" }) {
  const base = (import.meta.env.BASE_URL ?? "/app/").replace(/\/$/, "");
  const src = type === "claude" ? `${base}/claude-logo.svg` : `${base}/openai-logo.png`;
  return (
    <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", background: "#F8FAFC", border: "1px solid #E6EBF2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <img
        src={src}
        alt={type === "claude" ? "Claude" : "OpenAI"}
        style={{ width: 26, height: 26, objectFit: "contain" }}
        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
      />
    </div>
  );
}

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      aria-label={checked ? "Disable MCP" : "Enable MCP"}
      style={{
        width: 46, height: 26, borderRadius: 13, border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        background: checked ? "#2563EB" : "#D1D5DB",
        position: "relative", transition: "background 180ms", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 23 : 3,
        width: 20, height: 20, borderRadius: "50%",
        background: "#FFFFFF", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        transition: "left 180ms",
      }} />
    </button>
  );
}

export default function MCPAccessPanel() {
  const [mcpEnabled, setMcpEnabled] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [toggleLoading, setToggleLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newToken, setNewToken] = useState<{ token: string; clientName: string } | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [auditLoading, setAuditLoading] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createDays, setCreateDays] = useState("365");
  const [createLoading, setCreateLoading] = useState(false);
  const [revokeId, setRevokeId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [tokenVisible, setTokenVisible] = useState(false);
  const tokenRef = useRef<HTMLInputElement>(null);

  async function load() {
    try {
      const data = await fetchWithAuthJson<any>("/api/mcp/status");
      setMcpEnabled(data.mcpEnabled ?? false);
      setConnections(data.connections ?? []);
      setForbidden(false);
    } catch (e: any) {
      if (e?.status === 403) setForbidden(true);
    } finally {
      setLoading(false);
    }
  }

  async function loadAudit() {
    setAuditLoading(true);
    try {
      const logs = await fetchWithAuthJson<AuditLog[]>("/api/mcp/audit-logs");
      setAuditLogs(logs);
    } catch {}
    finally { setAuditLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => { if (showAudit) void loadAudit(); }, [showAudit]);

  async function toggleEnabled() {
    setToggleLoading(true);
    setError("");
    try {
      await fetchWithAuthJson("/api/mcp/enabled", { method: "PUT", body: JSON.stringify({ enabled: !mcpEnabled }) });
      setMcpEnabled(v => !v);
    } catch { setError("Failed to update MCP status."); }
    finally { setToggleLoading(false); }
  }

  async function createConnection() {
    if (!createName.trim()) return;
    setCreateLoading(true);
    setError("");
    try {
      const data = await fetchWithAuthJson<any>("/api/mcp/connections", {
        method: "POST",
        body: JSON.stringify({ clientName: createName.trim(), expiryDays: createDays ? Number(createDays) : undefined }),
      });
      setNewToken({ token: data.token, clientName: data.clientName });
      setShowCreate(false);
      setCreateName("");
      void load();
    } catch { setError("Failed to create connection. Try again."); }
    finally { setCreateLoading(false); }
  }

  async function revokeConnection(id: number) {
    setRevokeId(id);
    setError("");
    try {
      await fetchWithAuth(`/api/mcp/connections/${id}`, { method: "DELETE" });
      setConnections(cs => cs.filter(c => c.id !== id));
    } catch { setError("Failed to revoke connection."); }
    finally { setRevokeId(null); }
  }

  if (loading) {
    return (
      <div style={{ padding: "28px 24px", display: "flex", alignItems: "center", gap: 8, color: "#9CA3AF", fontSize: 13, background: "#FFFFFF", border: "1px solid #E6EBF2", borderRadius: 10 }}>
        <RefreshCw style={{ width: 14, height: 14 }} className="animate-spin" />
        Loading MCP settings…
      </div>
    );
  }

  if (forbidden) {
    return (
      <div style={{
        padding: "16px 20px", border: "1px solid #FDE68A", borderRadius: 10,
        background: "#FFFBEB", display: "flex", alignItems: "center", gap: 10,
        fontSize: 13, color: "#92400E",
      }}>
        <Shield style={{ width: 16, height: 16, flexShrink: 0, color: "#D97706" }} />
        <span><b>Admin only.</b> MCP configuration requires organisation administrator permission.</span>
      </div>
    );
  }

  return (
    <>
      {/* ── One-time token modal ─────────────────────────────────────────── */}
      {newToken && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.46)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#FFFFFF", border: "1px solid #E6EBF2", borderRadius: 12, padding: 28, maxWidth: 500, width: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.16)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: "#EFF6FF", border: "1px solid #DBEAFE", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Key style={{ width: 15, height: 15, color: "#2563EB" }} />
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 }}>Token Created — Save It Now</h3>
              <button onClick={() => setNewToken(null)} style={{ marginLeft: "auto", background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", padding: 4 }}>
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "#FFF7ED", border: "1px solid #FED7AA", borderRadius: 7, marginBottom: 14, fontSize: 12, color: "#92400E", fontWeight: 600 }}>
              <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0 }} />
              This token is shown only once. Copy and store it securely before closing.
            </div>

            <div style={{ background: "#F8FAFC", border: "1px solid #E6EBF2", borderRadius: 8, padding: "10px 14px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".04em" }}>MCP Token — {newToken.clientName}</span>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setTokenVisible(v => !v)} style={{ background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", padding: 2 }}>
                    {tokenVisible ? <EyeOff style={{ width: 13, height: 13 }} /> : <Eye style={{ width: 13, height: 13 }} />}
                  </button>
                  <CopyButton text={newToken.token} />
                </div>
              </div>
              <input
                ref={tokenRef}
                readOnly
                type={tokenVisible ? "text" : "password"}
                value={newToken.token}
                style={{ width: "100%", fontFamily: "monospace", fontSize: 11, background: "transparent", border: "none", outline: "none", color: "#111827", wordBreak: "break-all", boxSizing: "border-box" }}
              />
            </div>

            <button
              onClick={() => setNewToken(null)}
              style={{ width: "100%", height: 40, background: "#0B1736", color: "#FFFFFF", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              I've saved this token
            </button>
          </div>
        </div>
      )}

      {/* ── Main MCP card ─────────────────────────────────────────────────── */}
      <div style={{
        background: "#FFFFFF",
        border: "1px solid #E6EBF2",
        borderLeft: "3px solid #2563EB",
        borderRadius: 10,
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(15,23,42,0.05)",
      }}>

        {/* Header */}
        <div style={{ padding: "18px 20px 0", display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 9,
            background: "#EFF6FF", border: "1px solid #DBEAFE",
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1,
          }}>
            <Network style={{ width: 18, height: 18, color: "#2563EB" }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 7, marginBottom: 4 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>MCP — External AI Model Access</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#EFF6FF", color: "#2563EB", border: "1px solid #DBEAFE" }}>Beta</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#ECFDF5", color: "#065F46", border: "1px solid #BBF7D0" }}>New</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999, background: "#FEF9C3", color: "#713F12", border: "1px solid #FDE68A" }}>Read-only</span>
              <Info style={{ width: 13, height: 13, color: "#CBD5E1" }} />
            </div>
            <p style={{ fontSize: 12.5, color: "#6B7280", margin: 0, lineHeight: 1.5 }}>
              Connect ProviderFlo to an external AI model via MCP. Recommended for advanced users and operations leads.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0, paddingTop: 2 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#9CA3AF" }}>
              <Shield style={{ width: 11, height: 11 }} /> Admin only
            </span>
            <Toggle checked={mcpEnabled} onChange={toggleEnabled} disabled={toggleLoading} />
          </div>
        </div>

        {/* Info strip */}
        <div style={{ margin: "16px 20px 0", padding: "11px 14px", background: "#F0F7FF", border: "1px solid #D1E8FF", borderRadius: 8, display: "flex", alignItems: "flex-start", gap: 9 }}>
          <Info style={{ width: 14, height: 14, color: "#2563EB", flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: 12, color: "#374151", lineHeight: 1.55 }}>
            <b>MCP (Model Context Protocol)</b> lets authorised AI assistants securely access your ProviderFlo data — ask questions, generate reports, and get insights while respecting your existing permissions.
          </span>
        </div>

        {/* Provider cards */}
        <div style={{ margin: "14px 20px 0", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            {
              type: "claude" as const,
              name: "Claude",
              sub: "claude.ai",
              href: "https://claude.ai",
            },
            {
              type: "openai" as const,
              name: "ChatGPT",
              sub: "OpenAI",
              href: "https://platform.openai.com",
            },
          ].map(p => (
            <a
              key={p.name}
              href={p.href}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "0 14px", height: 60,
                background: "#FFFFFF", border: "1px solid #E6EBF2",
                borderRadius: 9, textDecoration: "none", color: "#111827",
              }}
            >
              <ProviderIcon type={p.type} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{p.name}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 1 }}>{p.sub}</div>
              </div>
              <ExternalLink style={{ width: 13, height: 13, color: "#D1D5DB", flexShrink: 0 }} />
            </a>
          ))}
        </div>

        {/* MCP Server URL */}
        <div style={{ margin: "14px 20px 0" }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#374151", display: "block", marginBottom: 7 }}>
            MCP Server URL
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{
              flex: 1, height: 38, border: "1px solid #E6EBF2", borderRadius: 7,
              background: "#F8FAFC", display: "flex", alignItems: "center", padding: "0 12px",
              overflow: "hidden",
            }}>
              <span style={{ fontFamily: "monospace", fontSize: 12, color: "#374151", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {MCP_ENDPOINT}
              </span>
            </div>
            <CopyButton text={MCP_ENDPOINT} />
          </div>
        </div>

        {/* Footer note */}
        <p style={{ margin: "8px 20px 0", fontSize: 11.5, color: "#9CA3AF", lineHeight: 1.5 }}>
          Connection is configured inside your AI client using your ProviderFlo MCP endpoint. Data access respects your existing ProviderFlo permissions.
        </p>

        {/* Error banner */}
        {error && (
          <div style={{ margin: "12px 20px 0", padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, fontSize: 12.5, color: "#DC2626", display: "flex", alignItems: "center", gap: 8 }}>
            <AlertTriangle style={{ width: 13, height: 13, flexShrink: 0 }} />
            {error}
            <button onClick={() => setError("")} style={{ marginLeft: "auto", background: "none", border: "none", color: "#9CA3AF", cursor: "pointer", padding: 2 }}>
              <X style={{ width: 11, height: 11 }} />
            </button>
          </div>
        )}

        {/* ── Connected clients (always visible, disabled state when MCP off) ── */}
        <div style={{ margin: "16px 20px 0", paddingTop: 14, borderTop: "1px solid #F1F5F9" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            <div>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: "#374151" }}>
                Connected Clients
              </span>
              <span style={{ marginLeft: 6, fontSize: 11, color: "#9CA3AF" }}>
                {connections.filter(c => c.status === "active").length} active
              </span>
            </div>
            <button
              onClick={() => { setShowCreate(v => !v); setError(""); }}
              disabled={!mcpEnabled}
              title={mcpEnabled ? "Create new client token" : "Enable MCP to create connections"}
              style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                height: 32, padding: "0 13px",
                border: "1px solid", borderRadius: 7, fontSize: 12, fontWeight: 600,
                cursor: mcpEnabled ? "pointer" : "not-allowed",
                borderColor: mcpEnabled ? "#2563EB" : "#E6EBF2",
                background: mcpEnabled ? "#EFF6FF" : "#F8FAFC",
                color: mcpEnabled ? "#2563EB" : "#CBD5E1",
              }}
            >
              <Plus style={{ width: 12, height: 12 }} /> New Connection
            </button>
          </div>

          {/* Create form */}
          {showCreate && (
            <div style={{ marginBottom: 12, padding: "14px 16px", background: "#F8FAFC", border: "1px solid #E6EBF2", borderRadius: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 8, marginBottom: 10 }}>
                <input
                  type="text"
                  placeholder="Client name (e.g. Claude Code)"
                  value={createName}
                  onChange={e => setCreateName(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && createConnection()}
                  autoFocus
                  style={{ height: 36, border: "1px solid #E6EBF2", borderRadius: 6, padding: "0 10px", fontSize: 13, outline: "none", background: "#FFFFFF" }}
                />
                <div style={{ position: "relative" }}>
                  <input
                    type="number" min={1} max={730}
                    placeholder="Days"
                    value={createDays}
                    onChange={e => setCreateDays(e.target.value)}
                    style={{ width: "100%", height: 36, border: "1px solid #E6EBF2", borderRadius: 6, padding: "0 32px 0 10px", fontSize: 13, outline: "none", background: "#FFFFFF", boxSizing: "border-box" }}
                  />
                  <span style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#9CA3AF", pointerEvents: "none" }}>days</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={createConnection}
                  disabled={!createName.trim() || createLoading}
                  style={{
                    height: 34, padding: "0 16px", background: "#0B1736", color: "#FFFFFF",
                    border: "none", borderRadius: 7, fontSize: 12, fontWeight: 700,
                    cursor: !createName.trim() || createLoading ? "not-allowed" : "pointer",
                    opacity: !createName.trim() || createLoading ? 0.55 : 1,
                  }}
                >
                  {createLoading ? "Creating…" : "Create Token"}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  style={{ height: 34, padding: "0 12px", background: "transparent", border: "1px solid #E6EBF2", borderRadius: 7, fontSize: 12, color: "#6B7280", cursor: "pointer" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {connections.length === 0 ? (
            <div style={{ padding: "22px 16px", textAlign: "center", border: "1px dashed #E6EBF2", borderRadius: 8, color: "#9CA3AF", fontSize: 12.5 }}>
              {mcpEnabled
                ? <>No connections yet. Click <b>New Connection</b> to generate a client token.</>
                : <>Enable MCP access above, then create a connection token for your AI client.</>}
            </div>
          ) : (
            <div style={{ border: "1px solid #E6EBF2", borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E6EBF2" }}>
                    {["Client", "Scopes", "Last Used", "Expires", "Status", ""].map(h => (
                      <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, color: "#6B7280", fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {connections.map((c, i) => (
                    <tr key={c.id} style={{ borderBottom: i < connections.length - 1 ? "1px solid #F1F5F9" : "none" }}>
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "#111827" }}>{c.clientName}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, background: "#EFF6FF", color: "#2563EB" }}>{c.scopes}</span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#6B7280" }}>{fmtTime(c.lastUsedAt)}</td>
                      <td style={{ padding: "10px 12px", color: "#6B7280" }}>{fmtDate(c.expiresAt)}</td>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          color: c.status === "active" ? "#059669" : c.status === "revoked" ? "#DC2626" : "#D97706",
                        }}>
                          {c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right" }}>
                        {c.status === "active" && (
                          <button
                            onClick={() => revokeConnection(c.id)}
                            disabled={revokeId === c.id}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "4px 10px", borderRadius: 6,
                              border: "1px solid #FECACA", background: "#FEF2F2",
                              color: "#DC2626", fontSize: 11, fontWeight: 700,
                              cursor: revokeId === c.id ? "not-allowed" : "pointer",
                              opacity: revokeId === c.id ? 0.5 : 1,
                            }}
                          >
                            <Trash2 style={{ width: 11, height: 11 }} />
                            {revokeId === c.id ? "Revoking…" : "Revoke"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Audit log (collapsible) ────────────────────────────────────────── */}
        <div style={{ margin: "14px 20px 20px", border: "1px solid #E6EBF2", borderRadius: 8, overflow: "hidden" }}>
          <button
            onClick={() => setShowAudit(v => !v)}
            style={{
              width: "100%", padding: "11px 16px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "#F8FAFC", border: "none", cursor: "pointer",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, fontWeight: 700, color: "#374151" }}>
              <Clock style={{ width: 13, height: 13, color: "#9CA3AF" }} />
              Access Audit Log
            </span>
            {showAudit
              ? <ChevronUp style={{ width: 13, height: 13, color: "#9CA3AF" }} />
              : <ChevronDown style={{ width: 13, height: 13, color: "#9CA3AF" }} />}
          </button>

          {showAudit && (
            <div style={{ borderTop: "1px solid #E6EBF2" }}>
              {auditLoading ? (
                <div style={{ padding: "20px 16px", textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>
                  <RefreshCw style={{ width: 13, height: 13, display: "inline", marginRight: 6 }} className="animate-spin" />
                  Loading…
                </div>
              ) : auditLogs.length === 0 ? (
                <div style={{ padding: "20px 16px", textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>
                  No audit events yet.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
                  <thead>
                    <tr style={{ background: "#F8FAFC", borderBottom: "1px solid #E6EBF2" }}>
                      {["Time", "Client", "Event", "Tool", "Status"].map(h => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 700, color: "#6B7280", fontSize: 11 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.slice(0, 50).map((log, i) => (
                      <tr key={log.id} style={{ borderBottom: i < Math.min(auditLogs.length, 50) - 1 ? "1px solid #F1F5F9" : "none" }}>
                        <td style={{ padding: "8px 12px", color: "#6B7280", whiteSpace: "nowrap" }}>
                          {new Date(log.createdAt).toLocaleString("en-AU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td style={{ padding: "8px 12px", color: "#374151", fontWeight: 600 }}>{log.clientName ?? "—"}</td>
                        <td style={{ padding: "8px 12px", color: "#374151" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 10.5, background: "#F1F5F9", padding: "2px 6px", borderRadius: 4 }}>{log.eventType}</span>
                        </td>
                        <td style={{ padding: "8px 12px", color: "#6B7280" }}>{log.toolName ?? "—"}</td>
                        <td style={{ padding: "8px 12px" }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: log.status === "success" ? "#059669" : "#DC2626" }}>
                            {log.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
