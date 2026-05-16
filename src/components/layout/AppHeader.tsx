import { Bell, Menu, Search, Settings, X } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { useCompanyBranding } from "@/context/CompanyBrandingContext";
import { BrandLogo } from "@/components/branding/BrandLogo";

const PAGE_TITLES: Record<string, string> = {
  "/":                   "Dashboard",
  "/roster":             "Scheduler",
  "/participants":       "Participants",
  "/staff":              "Staff",
  "/invoices":           "Invoices",
  "/timesheet":          "Timesheet",
  "/incidents":          "Incidents",
  "/case-notes":         "Case Notes",
  "/tasks":              "Tasks",
  "/quotes":             "Quotes",
  "/reports":            "Reports",
  "/messages":           "Messages",
  "/facilities":         "Facilities",
  "/forms":              "Forms",
  "/migration":          "Import",
  "/account":            "Settings",
  "/billing":            "Billing & Plans",
  "/service-agreements": "Service Agreements",
  "/ai-actions":         "AI Actions",
  "/compliance":         "Compliance",
};

interface AppHeaderProps {
  collapsed: boolean;
  onToggle: () => void;
}

export default function AppHeader({ collapsed, onToggle }: AppHeaderProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  const { branding } = useCompanyBranding();

  const title = Object.entries(PAGE_TITLES)
    .filter(([path]) => location === path || (path !== "/" && location.startsWith(path)))
    .sort((a, b) => b[0].length - a[0].length)[0]?.[1] ?? "ProviderFlo";

  const initials = user?.fullName
    ? user.fullName.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    : user?.email?.slice(0, 2).toUpperCase() ?? "PF";

  return (
    <header className="pf-header">
      <button className="pf-icon-button" onClick={onToggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
        {collapsed ? <Menu size={17} /> : <X size={17} />}
      </button>

      {branding.logoUrl && (
        <div style={{ height: 34, maxWidth: 110, display: "flex", alignItems: "center", overflow: "hidden", flexShrink: 0 }}>
          <BrandLogo
            logoUrl={branding.logoUrl}
            brandingVersion={branding.brandingVersion}
            alt="Company logo"
            className="max-h-[30px] max-w-[100px] object-contain"
          />
        </div>
      )}

      <h1 className="pf-header-title" style={{ minWidth: 0, flexShrink: 0 }}>{title}</h1>

      <div className="pf-header-search" style={{ display: "flex" }} id="pf-global-search">
        <Search size={15} />
        <input placeholder="Search participants, staff, shifts..." />
      </div>

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <button className="pf-icon-button" title="Notifications">
          <Bell size={16} />
        </button>
        <button className="pf-icon-button" title="Settings">
          <Settings size={16} />
        </button>

        <div
          style={{
            display: "flex", alignItems: "center", gap: 8, marginLeft: 4,
            padding: "5px 10px 5px 5px", borderRadius: 10,
            border: "1px solid var(--pf-border)", background: "#fff",
            cursor: "default",
          }}
        >
          <div className="pf-avatar" style={{ background: "#dbeafe", color: "#1d4ed8" }}>
            {initials}
          </div>
        </div>
      </div>
    </header>
  );
}
