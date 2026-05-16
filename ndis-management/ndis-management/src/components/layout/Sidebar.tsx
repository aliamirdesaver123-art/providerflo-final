import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, UserCheck, Calendar, AlertTriangle,
  BookOpen, Receipt, ChevronRight, ChevronDown, MessageSquare, Building2,
  CheckSquare, Clock, ClipboardList, FileSignature, BarChart3, Settings,
  LogOut, ArrowDownToLine, Users, ShieldCheck, Sparkles, Network,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const SB_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const SB_DUR  = "200ms";

interface NavItem {
  label: string;
  path?: string;
  icon: React.ElementType;
  badge?: number;
  children?: { label: string; path: string }[];
  isAI?: boolean;
}

const navItems: NavItem[] = [
  { label: "Dashboard",  path: "/",             icon: LayoutDashboard },
  { label: "Scheduler",  path: "/roster",        icon: Calendar },
  { label: "Messages",   path: "/messages",      icon: MessageSquare },
  {
    label: "Staff", icon: UserCheck,
    children: [
      { label: "All Staff",        path: "/staff" },
      { label: "Add Staff Member", path: "/staff/new" },
      { label: "Compliance",       path: "/staff/compliance" },
      { label: "Availability",     path: "/staff/availability" },
    ],
  },
  {
    label: "Participants", icon: Users,
    children: [
      { label: "All Participants",   path: "/participants" },
      { label: "Service Agreements", path: "/service-agreements" },
      { label: "Goals",              path: "/participants/goals" },
      { label: "Documents",          path: "/participants/documents" },
    ],
  },
  {
    label: "Timesheet", icon: Clock,
    children: [
      { label: "Weekly View",       path: "/timesheet" },
      { label: "Pending Approval",  path: "/timesheet/approval" },
    ],
  },
  {
    label: "Invoices", icon: Receipt,
    children: [
      { label: "All Invoices",   path: "/invoices" },
      { label: "Create Invoice", path: "/invoices/new" },
      { label: "NDIS Claiming",  path: "/invoices/claiming" },
    ],
  },
  {
    label: "Incidents", icon: AlertTriangle,
    children: [
      { label: "All Incidents",    path: "/incidents" },
      { label: "Report Incident",  path: "/incidents/new" },
    ],
  },
  { label: "Case Notes", path: "/case-notes", icon: BookOpen },
  { label: "Tasks",      path: "/tasks",      icon: CheckSquare },
  {
    label: "Quotes", icon: FileSignature,
    children: [
      { label: "All Quotes", path: "/quotes" },
      { label: "New Quote",  path: "/quotes/new" },
    ],
  },
  {
    label: "Forms", icon: ClipboardList,
    children: [
      { label: "Templates", path: "/forms" },
      { label: "Responses", path: "/forms/responses" },
    ],
  },
  { label: "Compliance",  path: "/compliance",  icon: ShieldCheck },
  { label: "Facilities",  path: "/facilities",  icon: Building2 },
  { label: "Reports",     path: "/reports",      icon: BarChart3 },
  { label: "AI Actions",      path: "/ai-actions",    icon: Sparkles, isAI: true },
  { label: "Import",      path: "/migration",    icon: ArrowDownToLine },
  { label: "Settings",    path: "/account",      icon: Settings },
];

function NavItemRow({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const [location] = useLocation();
  const [open, setOpen] = useState(() => {
    if (!item.children) return false;
    return item.children.some(c => location === c.path || location.startsWith(c.path));
  });

  const isActive = !!(item.path
    ? item.path === "/" ? location === "/" : location.startsWith(item.path)
    : item.children?.some(c => location === c.path || location.startsWith(c.path)));

  const destination = item.path ?? item.children?.[0]?.path ?? "/";
  const hasChildren = Boolean(item.children);
  const Icon: any = item.icon;

  const iconEl = (
    <Icon
      className="pf-nav-icon"
      style={{ color: isActive ? "#fff" : item.isAI ? "var(--pf-ai)" : "rgba(255,255,255,.72)" }}
    />
  );

  if (collapsed) {
    return (
      <Link href={destination}>
        <a
          className={`pf-nav-item ${isActive ? "pf-nav-item-active" : ""}`}
          title={item.label}
          style={{ justifyContent: "center", padding: 0 }}
        >
          {iconEl}
        </a>
      </Link>
    );
  }

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(o => !o)}
          className={`pf-nav-item ${isActive ? "pf-nav-item-active" : ""}`}
          style={{ width: "100%" }}
        >
          {iconEl}
          <span className="pf-nav-label" style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
          <span style={{ opacity: .45, flexShrink: 0, display: "flex", alignItems: "center" }}>
            {open
              ? <ChevronDown  style={{ width: 13, height: 13, strokeWidth: 1.8 }} />
              : <ChevronRight style={{ width: 13, height: 13, strokeWidth: 1.8 }} />}
          </span>
        </button>
        {open && (
          <div className="pf-nav-child">
            {item.children!.map(child => {
              const childActive = location === child.path || (child.path !== "/" && location.startsWith(child.path));
              return (
                <Link key={child.path} href={child.path}>
                  <a className={`pf-nav-child-item ${childActive ? "pf-nav-child-item-active" : ""}`}>
                    {child.label}
                  </a>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <Link href={item.path!}>
      <a className={`pf-nav-item ${isActive ? "pf-nav-item-active" : ""}`}>
        {iconEl}
        <span className="pf-nav-label">{item.label}</span>
        {item.badge != null && item.badge > 0 && (
          <span style={{ fontSize: 10, borderRadius: 999, padding: "2px 6px", fontWeight: 700, background: "rgba(239,68,68,.85)", color: "#fff", flexShrink: 0, marginLeft: "auto" }}>
            {item.badge}
          </span>
        )}
      </a>
    </Link>
  );
}

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const { user, logout } = useAuth();

  const initials = user?.fullName
    ? user.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "PF";

  return (
    <aside
      className={`pf-sidebar-wrap ${collapsed ? "pf-sidebar-wrap-collapsed" : "pf-sidebar-wrap-expanded"}`}
      style={{ transition: `width ${SB_DUR} ${SB_EASE}, min-width ${SB_DUR} ${SB_EASE}` }}
    >
      {/* Brand */}
      <div className="pf-brand">
        <div
          style={{
            width: collapsed ? 34 : SB_EXPANDED_TEXT_W,
            height: 42,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-start",
            flexShrink: 0,
            transition: `width ${SB_DUR} ${SB_EASE}`,
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}providerflo-icon.png`}
            alt="ProviderFlo"
            draggable={false}
            style={{
              height: 30,
              width: "auto",
              minWidth: 140,
              maxWidth: "none",
              objectFit: "contain",
              objectPosition: "left center",
              display: "block",
              flexShrink: 0,
              userSelect: "none",
              pointerEvents: "none",
            }}
          />
        </div>
      </div>

      {/* Nav */}
      <nav className="pf-nav">
        {navItems.map(item => (
          <NavItemRow key={item.label} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {/* Footer */}
      <div className="pf-sidebar-footer">
        {collapsed ? (
          <div className="pf-avatar" style={{ margin: "0 auto" }} title={user?.fullName || user?.email || "User"}>
            {initials}
          </div>
        ) : (
          <div className="pf-user">
            <div className="pf-avatar">{initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,.9)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", lineHeight: 1.2 }}>
                {user?.fullName || "User"}
              </p>
              <p style={{ fontSize: 11, color: "rgba(255,255,255,.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {user?.email}
              </p>
            </div>
            <button
              onClick={logout}
              title="Sign out"
              style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, background: "transparent", border: "none", cursor: "pointer", color: "rgba(255,255,255,.4)", flexShrink: 0, transition: "all .14s ease" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.08)"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.85)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.4)"; }}
            >
              <LogOut style={{ width: 14, height: 14, strokeWidth: 1.8 }} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

const SB_EXPANDED_TEXT_W = 190;
