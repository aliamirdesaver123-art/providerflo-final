import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  Search, Plus, Shield, Calendar, DollarSign, Users,
  Paperclip, Smile, AtSign, FileText, Send, Pin, Trash2, MoreHorizontal, X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { fetchWithAuth, fetchWithAuthJson } from "@/lib/fetchWithAuth";

/* ── API helpers ─────────────────────────────────────────────────────────── */
function useMessages() {
  return useQuery({
    queryKey: ["messages"],
    queryFn: () => fetchWithAuthJson<any[]>("/api/messages"),
  });
}
function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchWithAuthJson(`/api/messages/${id}/read`, { method: "PUT" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}
function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { subject: string; body: string; messageType: string }) =>
      fetchWithAuthJson("/api/messages", {
        method: "POST",
        body: JSON.stringify({ ...data, isSystem: "false" }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}
function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => fetchWithAuth(`/api/messages/${id}`, { method: "DELETE" }).then(async r => {
      if (!r.ok) {
        const body = await r.json().catch(() => ({}));
        throw new Error(body.error ?? `Delete failed (${r.status})`);
      }
      return r.json().catch(() => ({}));
    }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["messages"] }),
  });
}

/* ── Types ────────────────────────────────────────────────────────────────── */
interface Msg {
  id: number;
  fromName: string;
  fromLabel?: string;
  subject: string;
  body: string;
  messageType: "system" | "direct" | "group" | "internal_note";
  isRead: boolean;
  isSystem: boolean;
  createdAt: string;
  avatarUrl?: string;
  previousBody?: string;
  previousDate?: string;
  actionLabel?: string;
}

const FILTER_TABS = ["All", "Direct", "System", "Group"];

/* ── System icon badge ───────────────────────────────────────────────────── */
function SysIcon({ subject }: { subject: string }) {
  const s = subject.toLowerCase();
  if (s.includes("compliance") || s.includes("alert")) return (
    <div style={{ width: 46, height: 46, borderRadius: 14, background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 10px rgba(15,23,42,0.08)", border: "2px solid #FFFFFF" }}>
      <Shield style={{ width: 22, height: 22, color: "#EA580C", strokeWidth: 1.8 }} />
    </div>
  );
  if (s.includes("shift") || s.includes("roster")) return (
    <div style={{ width: 46, height: 46, borderRadius: 14, background: "#ECFDF5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 10px rgba(15,23,42,0.08)", border: "2px solid #FFFFFF" }}>
      <Calendar style={{ width: 22, height: 22, color: "#059669", strokeWidth: 1.8 }} />
    </div>
  );
  if (s.includes("invoice")) return (
    <div style={{ width: 46, height: 46, borderRadius: 14, background: "#EDE9FE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 10px rgba(15,23,42,0.08)", border: "2px solid #FFFFFF" }}>
      <DollarSign style={{ width: 22, height: 22, color: "#7C3AED", strokeWidth: 1.8 }} />
    </div>
  );
  if (s.includes("care team")) return (
    <div style={{ width: 46, height: 46, borderRadius: 14, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 10px rgba(15,23,42,0.08)", border: "2px solid #FFFFFF" }}>
      <Users style={{ width: 22, height: 22, color: "#2563EB", strokeWidth: 1.8 }} />
    </div>
  );
  return (
    <div style={{ width: 46, height: 46, borderRadius: 14, background: "#F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 10px rgba(15,23,42,0.08)", border: "2px solid #FFFFFF" }}>
      <Shield style={{ width: 22, height: 22, color: "#64748B", strokeWidth: 1.8 }} />
    </div>
  );
}

/* ── Conversation header icon ─────────────────────────────────────────────── */
function ConvIcon({ msg }: { msg: Msg }) {
  if (msg.avatarUrl) return (
    <img src={msg.avatarUrl} alt={msg.fromName} style={{ width: 52, height: 52, borderRadius: 999, objectFit: "cover", border: "2px solid #FFFFFF", boxShadow: "0 4px 12px rgba(15,23,42,0.12)" }} />
  );
  if (msg.messageType === "group") return (
    <div style={{ width: 52, height: 52, borderRadius: 14, background: "#EFF6FF", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Users style={{ width: 24, height: 24, color: "#2563EB", strokeWidth: 1.8 }} />
    </div>
  );
  return (
    <div style={{ width: 52, height: 52, borderRadius: 14, background: "#FFF7ED", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <SysIcon subject={msg.subject} />
    </div>
  );
}

function formatMsgDate(iso: string) {
  const d = parseISO(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return format(d, "h:mm a");
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return format(d, "EEE");
  return format(d, "d MMM");
}

/* ── Hover button helper ─────────────────────────────────────────────────── */
function ActionBtn({ children, title, onClick }: { children: React.ReactNode; title: string; onClick?: () => void }) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{ width: 40, height: 40, borderRadius: 11, background: "#F8FAFC", border: "1px solid #E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", color: "#334155", transition: "all 160ms cubic-bezier(.2,.8,.2,1)", cursor: "pointer" }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#F1F5F9"; el.style.transform = "translateY(-1px)"; el.style.boxShadow = "0 6px 14px rgba(15,23,42,0.07)"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#F8FAFC"; el.style.transform = ""; el.style.boxShadow = ""; }}
    >
      {children}
    </button>
  );
}

/* ── Main page ───────────────────────────────────────────────────────────── */
export default function Messages() {
  const { data: apiMessages = [] } = useMessages();
  const markRead = useMarkRead();
  const sendMessage = useSendMessage();
  const deleteMessage = useDeleteMessage();
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<number>(-1);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyTab, setReplyTab] = useState<"Reply" | "Internal Note">("Reply");
  const [showCompose, setShowCompose] = useState(false);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeType, setComposeType] = useState<"direct" | "group">("direct");

  const allMessages: Msg[] = (Array.isArray(apiMessages) ? [...apiMessages] as Msg[] : []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const filtered = allMessages.filter(m => {
    if (filter !== "All" && m.messageType !== filter.toLowerCase()) return false;
    if (search) {
      const s = search.toLowerCase();
      return m.subject?.toLowerCase().includes(s) || m.body?.toLowerCase().includes(s) || m.fromName?.toLowerCase().includes(s);
    }
    return true;
  });

  const selectedMsg = filtered.find(m => m.id === selectedId) ?? filtered[0] ?? null;
  const unreadCount = allMessages.filter(m => !m.isRead).length;

  const handleSelect = (m: Msg) => {
    setSelectedId(m.id);
    if (!m.isRead && m.id > 0) markRead.mutate(m.id);
  };

  const handleSend = () => {
    if (!replyBody.trim()) return;
    const messageType = replyTab === "Internal Note" ? "internal_note" : "direct";
    sendMessage.mutate({ subject: `Re: ${selectedMsg?.subject ?? ""}`, body: replyBody, messageType }, {
      onSuccess: () => {
        setReplyBody("");
        toast({ title: replyTab === "Internal Note" ? "Internal note added" : "Reply sent" });
      },
      onError: (err) => toast({ title: `Send failed: ${err.message}`, variant: "destructive" }),
    });
  };

  const handleComposeSend = () => {
    if (!composeSubject.trim() || !composeBody.trim()) return;
    sendMessage.mutate({ subject: composeSubject, body: composeBody, messageType: composeType }, {
      onSuccess: () => {
        setShowCompose(false);
        setComposeSubject("");
        setComposeBody("");
        setComposeType("direct");
        toast({ title: "Message sent" });
      },
      onError: (err) => toast({ title: `Send failed: ${err.message}`, variant: "destructive" }),
    });
  };

  const handleDeleteMessage = (msg: Msg) => {
    if (!confirm(`Delete "${msg.subject}"? This cannot be undone.`)) return;
    deleteMessage.mutate(msg.id, {
      onSuccess: () => {
        setSelectedId(-1);
        toast({ title: "Message deleted" });
      },
      onError: (err) => toast({ title: `Delete failed: ${err.message}`, variant: "destructive" }),
    });
  };

  return (
    <AppLayout>
      <div
        style={{ display: "flex", height: "calc(100vh - 64px)", padding: 24, gap: 20, background: "#F8FAFC", overflow: "hidden" }}
      >
        {/* ════════════════ LEFT PANEL ════════════════ */}
        <div
          style={{ width: 360, flexShrink: 0, background: "#FFFFFF", border: "1px solid #E6ECF3", borderRadius: 16, boxShadow: "0 8px 24px rgba(15,23,42,0.04)", display: "flex", flexDirection: "column", overflow: "hidden" }}
        >
          {/* Header */}
          <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: "#0B1F3A", lineHeight: 1, letterSpacing: "-0.02em" }}>Messages</h2>
              {unreadCount > 0 && (
                <div style={{ width: 28, height: 28, borderRadius: 999, background: "#0B2F6B", color: "#FFFFFF", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {unreadCount}
                </div>
              )}
            </div>
            <button
              onClick={() => setShowCompose(true)}
              style={{ height: 42, padding: "0 18px", borderRadius: 11, background: "linear-gradient(180deg, #0D3778 0%, #0B2F6B 100%)", color: "#FFFFFF", fontSize: 14, fontWeight: 700, border: "none", boxShadow: "0 10px 24px rgba(11,47,107,0.24)", display: "flex", alignItems: "center", gap: 7, cursor: "pointer", transition: "all 160ms cubic-bezier(.2,.8,.2,1)" }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "linear-gradient(180deg, #164A93 0%, #0D3778 100%)"; el.style.transform = "translateY(-2px)"; el.style.boxShadow = "0 16px 34px rgba(11,47,107,0.32)"; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "linear-gradient(180deg, #0D3778 0%, #0B2F6B 100%)"; el.style.transform = ""; el.style.boxShadow = "0 10px 24px rgba(11,47,107,0.24)"; }}
            >
              <Plus style={{ width: 16, height: 16, strokeWidth: 2.2 }} />
              Compose
            </button>
          </div>

          {/* Search */}
          <div style={{ margin: "14px 20px 0", position: "relative" }}>
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#94A3B8", strokeWidth: 1.8 }} />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search messages..."
              style={{ width: "100%", height: 42, paddingLeft: 38, paddingRight: 14, fontSize: 13, background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 12, outline: "none", color: "#334155" }}
            />
          </div>

          {/* Filter tabs */}
          <div style={{ display: "flex", gap: 6, padding: "12px 20px" }}>
            {FILTER_TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                style={{
                  height: 34, padding: "0 12px", borderRadius: 9, fontSize: 13, fontWeight: 600, border: "none", cursor: "pointer", transition: "all 160ms cubic-bezier(.2,.8,.2,1)",
                  ...(filter === tab
                    ? { background: "#0B2F6B", color: "#FFFFFF", boxShadow: "0 6px 14px rgba(11,47,107,0.18)" }
                    : { background: "transparent", color: "#64748B" }),
                }}
                onMouseEnter={e => { if (filter !== tab) (e.currentTarget as HTMLElement).style.background = "#F1F5F9"; }}
                onMouseLeave={e => { if (filter !== tab) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Message list */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {filtered.map(m => {
              const isSelected = selectedMsg?.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => handleSelect(m)}
                  style={{
                    width: "100%", textAlign: "left", display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "16px 20px", borderBottom: "1px solid #EEF2F7", cursor: "pointer",
                    transition: "all 160ms cubic-bezier(.2,.8,.2,1)", position: "relative",
                    background: isSelected ? "linear-gradient(90deg, #EFF6FF 0%, #FFFFFF 100%)" : "#FFFFFF",
                    border: "none",
                  }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#F8FAFC"; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "#FFFFFF"; }}
                >
                  {/* Unread dot */}
                  {!m.isRead && (
                    <div style={{ position: "absolute", left: 6, top: "50%", transform: "translateY(-50%)", width: 8, height: 8, borderRadius: 999, background: "#2563EB" }} />
                  )}

                  {/* Avatar / icon */}
                  {m.avatarUrl ? (
                    <img src={m.avatarUrl} alt={m.fromName} style={{ width: 46, height: 46, borderRadius: 999, objectFit: "cover", border: "2px solid #FFFFFF", boxShadow: "0 4px 10px rgba(15,23,42,0.08)", flexShrink: 0 }} />
                  ) : (
                    <SysIcon subject={m.subject} />
                  )}

                  {/* Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 6, marginBottom: 3 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#64748B" }}>{m.fromLabel || m.fromName}</span>
                      <span style={{ fontSize: 12, color: "#64748B", whiteSpace: "nowrap", flexShrink: 0 }}>{formatMsgDate(m.createdAt)}</span>
                    </div>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "#0B1F3A", lineHeight: 1.25, marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.subject}</p>
                    <p style={{ fontSize: 12, color: "#64748B", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.body.split("\n").filter(Boolean)[0]}</p>
                    {m.isSystem && (
                      <span style={{ display: "inline-block", marginTop: 6, background: "#FFF7ED", color: "#EA580C", border: "1px solid #FED7AA", borderRadius: 7, padding: "3px 7px", fontSize: 11, fontWeight: 600 }}>
                        System
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* ════════════════ RIGHT PANEL ════════════════ */}
        {selectedMsg ? (
          <div style={{ flex: 1, background: "#FFFFFF", border: "1px solid #E6ECF3", borderRadius: 16, boxShadow: "0 8px 24px rgba(15,23,42,0.04)", display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>

            {/* Conversation header */}
            <div style={{ height: 90, padding: "0 24px", borderBottom: "1px solid #EEF2F7", display: "flex", alignItems: "center", gap: 16, flexShrink: 0 }}>
              <ConvIcon msg={selectedMsg} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <h3 style={{ fontSize: 22, fontWeight: 800, color: "#0B1F3A", letterSpacing: "-0.02em", lineHeight: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedMsg.subject}</h3>
                  {selectedMsg.isSystem && (
                    <span style={{ fontSize: 11, fontWeight: 700, background: "#F1F5F9", color: "#64748B", borderRadius: 7, padding: "3px 9px", border: "1px solid #E2E8F0", flexShrink: 0 }}>System</span>
                  )}
                </div>
                <p style={{ fontSize: 13, color: "#64748B" }}>
                  {selectedMsg.isSystem ? `To: Alex Brown (You)` : `From: ${selectedMsg.fromName}`}
                </p>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                <ActionBtn title="Pin"><Pin style={{ width: 18, height: 18, strokeWidth: 1.8 }} /></ActionBtn>
                <ActionBtn title="Delete message" onClick={() => selectedMsg && handleDeleteMessage(selectedMsg)}><Trash2 style={{ width: 18, height: 18, strokeWidth: 1.8 }} /></ActionBtn>
                <ActionBtn title="More"><MoreHorizontal style={{ width: 18, height: 18, strokeWidth: 1.8 }} /></ActionBtn>
              </div>
            </div>

            {/* Message body */}
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
              {/* Timestamp */}
              <p style={{ textAlign: "right", fontSize: 12, color: "#64748B", marginBottom: 18 }}>
                {format(parseISO(selectedMsg.createdAt), "h:mm a, d MMM yyyy")}
              </p>

              {/* Main message card */}
              <div style={{ maxWidth: 520, background: "linear-gradient(180deg, #FFF9ED 0%, #FFFDF7 100%)", border: "1px solid #FDE7B2", borderRadius: 14, padding: 22, boxShadow: "0 8px 22px rgba(245,158,11,0.08)", marginBottom: 24 }}>
                {selectedMsg.body.split("\n").filter(Boolean).map((line, i) => (
                  <p key={i} style={{ fontSize: 14, lineHeight: 1.65, color: "#0F172A", marginBottom: i < selectedMsg.body.split("\n").filter(Boolean).length - 1 ? 12 : 0 }}>{line}</p>
                ))}
                {selectedMsg.actionLabel && (
                  <button
                    style={{ marginTop: 20, height: 40, padding: "0 16px", borderRadius: 10, background: "#FFFFFF", border: "1px solid #CBD5E1", color: "#0B1F3A", fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 160ms cubic-bezier(.2,.8,.2,1)" }}
                    onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#F8FAFC"; el.style.transform = "translateY(-1px)"; el.style.boxShadow = "0 6px 14px rgba(15,23,42,0.07)"; }}
                    onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#FFFFFF"; el.style.transform = ""; el.style.boxShadow = ""; }}
                  >
                    {selectedMsg.actionLabel}
                  </button>
                )}
              </div>

              {/* Previous messages divider */}
              {selectedMsg.previousBody && (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 14, margin: "30px 0 20px" }}>
                    <div style={{ flex: 1, height: 1, background: "#E6ECF3" }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: "#64748B", whiteSpace: "nowrap" }}>Previous messages</span>
                    <div style={{ flex: 1, height: 1, background: "#E6ECF3" }} />
                  </div>
                  <div style={{ maxWidth: 430, background: "#FFFDF7", border: "1px solid #FDE7B2", borderRadius: 13, padding: 18 }}>
                    <p style={{ fontSize: 13, lineHeight: 1.55, color: "#0F172A" }}>{selectedMsg.previousBody}</p>
                    {selectedMsg.previousDate && (
                      <p style={{ fontSize: 12, color: "#64748B", marginTop: 14 }}>{selectedMsg.previousDate}</p>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* ── Reply composer ── */}
            <div style={{ borderTop: "1px solid #EEF2F7", padding: "20px 24px", borderBottomLeftRadius: 16, borderBottomRightRadius: 16, background: "#FFFFFF", flexShrink: 0 }}>
              {/* Tabs */}
              <div style={{ display: "flex", gap: 28, marginBottom: 14 }}>
                {(["Reply", "Internal Note"] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setReplyTab(tab)}
                    style={{
                      background: "none", border: "none", padding: "0 0 8px 0", fontSize: 14, cursor: "pointer", transition: "all 160ms ease",
                      ...(replyTab === tab
                        ? { color: "#0B2F6B", fontWeight: 800, borderBottom: "3px solid #0B2F6B" }
                        : { color: "#64748B", fontWeight: 500, borderBottom: "3px solid transparent" }),
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {/* Text area */}
              <textarea
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder={replyTab === "Reply" ? "Type your message..." : "Add an internal note..."}
                style={{ width: "100%", height: 110, padding: 16, fontSize: 14, color: "#0F172A", background: "#FFFFFF", border: "1px solid #DDE5EF", borderRadius: 12, resize: "none", outline: "none", transition: "all 160ms ease", fontFamily: "inherit", lineHeight: 1.6 }}
                onFocus={e => { e.target.style.borderColor = "#2563EB"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)"; }}
                onBlur={e => { e.target.style.borderColor = "#DDE5EF"; e.target.style.boxShadow = ""; }}
              />

              {/* Toolbar */}
              <div style={{ marginTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", gap: 8 }}>
                  {[
                    { Icon: Paperclip, title: "Attach file" },
                    { Icon: Smile, title: "Emoji" },
                    { Icon: AtSign, title: "Mention" },
                    { Icon: FileText, title: "Template" },
                  ].map(({ Icon, title }) => (
                    <button
                      key={title}
                      title={title}
                      style={{ width: 36, height: 36, borderRadius: 9, border: "1px solid #E2E8F0", background: "#FFFFFF", display: "flex", alignItems: "center", justifyContent: "center", color: "#334155", cursor: "pointer", transition: "all 160ms cubic-bezier(.2,.8,.2,1)" }}
                      onMouseEnter={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#F8FAFC"; el.style.borderColor = "#CBD5E1"; el.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = "#FFFFFF"; el.style.borderColor = "#E2E8F0"; el.style.transform = ""; }}
                    >
                      <Icon style={{ width: 16, height: 16, strokeWidth: 1.8 }} />
                    </button>
                  ))}
                </div>
                <button
                  onClick={handleSend}
                  disabled={!replyBody.trim()}
                  style={{ height: 42, padding: "0 20px", borderRadius: 11, background: replyBody.trim() ? "linear-gradient(180deg, #0D3778 0%, #0B2F6B 100%)" : "#CBD5E1", color: "#FFFFFF", fontSize: 14, fontWeight: 800, border: "none", boxShadow: replyBody.trim() ? "0 10px 24px rgba(11,47,107,0.24)" : "none", display: "flex", alignItems: "center", gap: 8, cursor: replyBody.trim() ? "pointer" : "not-allowed", transition: "all 160ms cubic-bezier(.2,.8,.2,1)" }}
                  onMouseEnter={e => { if (replyBody.trim()) { const el = e.currentTarget as HTMLElement; el.style.background = "linear-gradient(180deg, #164A93 0%, #0D3778 100%)"; el.style.transform = "translateY(-2px)"; el.style.boxShadow = "0 16px 34px rgba(11,47,107,0.32)"; } }}
                  onMouseLeave={e => { const el = e.currentTarget as HTMLElement; el.style.background = replyBody.trim() ? "linear-gradient(180deg, #0D3778 0%, #0B2F6B 100%)" : "#CBD5E1"; el.style.transform = ""; el.style.boxShadow = replyBody.trim() ? "0 10px 24px rgba(11,47,107,0.24)" : "none"; }}
                >
                  <Send style={{ width: 18, height: 18, strokeWidth: 2 }} />
                  Send
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, background: "#FFFFFF", border: "1px solid #E6ECF3", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 14 }}>
            Select a message to read it
          </div>
        )}
      </div>

      {/* ════════════════ COMPOSE MODAL ════════════════ */}
      {showCompose && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div style={{ background: "#FFFFFF", borderRadius: 20, boxShadow: "0 24px 60px rgba(15,23,42,0.18)", width: "100%", maxWidth: 540, padding: 32 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: "#0B1F3A", letterSpacing: "-0.02em" }}>New Message</h2>
              <button
                onClick={() => setShowCompose(false)}
                style={{ width: 36, height: 36, borderRadius: 10, background: "#F1F5F9", border: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "#64748B", cursor: "pointer" }}
              >
                <X style={{ width: 18, height: 18 }} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Subject</label>
                <input
                  value={composeSubject}
                  onChange={e => setComposeSubject(e.target.value)}
                  placeholder="Message subject..."
                  style={{ width: "100%", height: 42, padding: "0 14px", fontSize: 14, border: "1px solid #DDE5EF", borderRadius: 10, outline: "none", color: "#0F172A", fontFamily: "inherit" }}
                  onFocus={e => { e.target.style.borderColor = "#2563EB"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)"; }}
                  onBlur={e => { e.target.style.borderColor = "#DDE5EF"; e.target.style.boxShadow = ""; }}
                />
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Type</label>
                <select
                  value={composeType}
                  onChange={e => setComposeType(e.target.value as "direct" | "group")}
                  style={{ width: "100%", height: 42, padding: "0 14px", fontSize: 14, border: "1px solid #DDE5EF", borderRadius: 10, outline: "none", color: "#0F172A", background: "#FFFFFF", fontFamily: "inherit" }}
                >
                  <option value="direct">Direct Message</option>
                  <option value="group">Group Message</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: "#334155", display: "block", marginBottom: 6 }}>Message</label>
                <textarea
                  value={composeBody}
                  onChange={e => setComposeBody(e.target.value)}
                  placeholder="Type your message..."
                  style={{ width: "100%", height: 140, padding: 14, fontSize: 14, border: "1px solid #DDE5EF", borderRadius: 10, outline: "none", color: "#0F172A", resize: "none", fontFamily: "inherit", lineHeight: 1.6 }}
                  onFocus={e => { e.target.style.borderColor = "#2563EB"; e.target.style.boxShadow = "0 0 0 3px rgba(37,99,235,0.12)"; }}
                  onBlur={e => { e.target.style.borderColor = "#DDE5EF"; e.target.style.boxShadow = ""; }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 4 }}>
                <button
                  onClick={() => setShowCompose(false)}
                  style={{ height: 42, padding: "0 20px", borderRadius: 11, background: "#F1F5F9", color: "#334155", fontSize: 14, fontWeight: 600, border: "none", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleComposeSend}
                  disabled={!composeSubject.trim() || !composeBody.trim() || sendMessage.isPending}
                  style={{ height: 42, padding: "0 24px", borderRadius: 11, background: composeSubject.trim() && composeBody.trim() ? "linear-gradient(180deg, #0D3778 0%, #0B2F6B 100%)" : "#CBD5E1", color: "#FFFFFF", fontSize: 14, fontWeight: 800, border: "none", display: "flex", alignItems: "center", gap: 8, cursor: composeSubject.trim() && composeBody.trim() ? "pointer" : "not-allowed", boxShadow: composeSubject.trim() && composeBody.trim() ? "0 10px 24px rgba(11,47,107,0.24)" : "none" }}
                >
                  <Send style={{ width: 16, height: 16, strokeWidth: 2 }} />
                  {sendMessage.isPending ? "Sending..." : "Send Message"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
