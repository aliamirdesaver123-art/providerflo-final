import { AIStar } from "./AIStar";

export function PageHead({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="pf-page-head">
      <div>
        <h2 className="pf-page-title">{title}</h2>
        {description && <p className="pf-page-desc">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function PFCard({ title, children, action, style }: { title?: string; children: React.ReactNode; action?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <section className="pf-card" style={style}>
      {title && (
        <div className="pf-card-header">
          <h3 className="pf-card-title">{title}</h3>
          {action}
        </div>
      )}
      <div className="pf-card-body">{children}</div>
    </section>
  );
}

export function PFButton({ children, variant = "primary", className = "", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  const cls = variant === "secondary" ? "pf-button-secondary" : variant === "ghost" ? "pf-button-ghost" : "pf-button-primary";
  return (
    <button className={`pf-button ${cls} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function PFStatus({ children }: { children: React.ReactNode }) {
  const text = String(children).toLowerCase();
  const cls = (text.includes("active") || text.includes("paid") || text.includes("complete") || text.includes("sent") || text.includes("compliant"))
    ? "pf-chip-success"
    : (text.includes("pending") || text.includes("progress") || text.includes("soon") || text.includes("leave") || text.includes("expir"))
    ? "pf-chip-warning"
    : (text.includes("overdue") || text.includes("inactive") || text.includes("expired") || text.includes("critical") || text.includes("discharged"))
    ? "pf-chip-error"
    : "";
  return <span className={`pf-chip ${cls}`}>{children}</span>;
}

export function AIChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pf-ai-inline">
      <AIStar size={13} />
      {children}
    </span>
  );
}
