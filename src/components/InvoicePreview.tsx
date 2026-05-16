import { useEffect, useMemo, useState } from "react";
import { X, Download, RefreshCw, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/lib/fetchWithAuth";

const PRINT_STYLE = `
  @media print {
    @page {
      size: A4 portrait;
      margin: 0;
    }

    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body * {
      visibility: hidden !important;
    }

    #invoice-print-content,
    #invoice-print-content * {
      visibility: visible !important;
    }

    #invoice-print-content {
      position: fixed !important;
      inset: 0 auto auto 0 !important;
      width: 210mm !important;
      min-height: 297mm !important;
      margin: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
      border-radius: 0 !important;
      background: white !important;
      overflow: visible !important;
    }

    .invoice-no-print {
      display: none !important;
    }
  }
`;

type SnapshotCompany = {
  name?: string | null;
  abn?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  fullAddress?: string | null;
  logoUrl?: string | null;
  brandingVersion?: number | null;
  bankAccountName?: string | null;
  bankBsb?: string | null;
  bankAccountNumber?: string | null;
  paymentInstructions?: string | null;
};

type SnapshotParticipant = {
  name?: string | null;
  ndisNumber?: string | null;
  address?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  suburb?: string | null;
  state?: string | null;
  postcode?: string | null;
  fullAddress?: string | null;
  phone?: string | null;
  email?: string | null;
};

type InvoiceLineItem = {
  id: number;
  shiftId?: number | null;
  timesheetId?: number | null;
  description: string;
  type?: string | null;
  quantity: number;
  rate?: number;
  unitPrice?: number;
  tax?: number;
  cost?: number;
  amount?: number;
  serviceDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  supportDescription?: string | null;
  ndisItemNumber?: string | null;
};

type InvoiceData = {
  id: number;
  invoiceNumber: string;
  issueDate?: string;
  dueDate?: string;
  status: string;
  companySnapshot?: SnapshotCompany | null;
  participantSnapshot?: SnapshotParticipant | null;
  org?: SnapshotCompany | null;
  participant?: SnapshotParticipant | null;
  lineItems: InvoiceLineItem[];
  subtotal?: number;
  tax?: number;
  total?: number;
  totalAmount?: number;
  gstAmount?: number;
  createdAt?: string;
  notes?: string | null;
};

interface Props {
  invoiceId: number;
  onClose: () => void;
  onRegenerate?: () => void;
}

function money(value: number): string {
  return value.toLocaleString("en-AU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normaliseNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number.parseFloat(value);
  return Number.NaN;
}

function normaliseDate(value?: string | null): string {
  if (!value) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) return value;

  const d = new Date(value.includes("T") ? value : `${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;

  return d.toLocaleDateString("en-AU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function joinAddress(data?: SnapshotCompany | SnapshotParticipant | null): string {
  if (!data) return "";

  if (data.fullAddress) return data.fullAddress;

  return [
    data.addressLine1 || data.address,
    data.addressLine2,
    data.suburb,
    data.state,
    data.postcode,
  ]
    .filter(Boolean)
    .join(", ");
}

function stripInvPrefix(invoiceNumber: string): string {
  return invoiceNumber?.startsWith("INV-")
    ? invoiceNumber.replace(/^INV-/, "")
    : invoiceNumber;
}

function normaliseInvoice(raw: InvoiceData): InvoiceData {
  const companySnapshot = raw.companySnapshot ?? raw.org ?? null;
  const participantSnapshot = raw.participantSnapshot ?? raw.participant ?? null;

  const normalisedItems = (raw.lineItems || []).map((item) => {
    const rate = normaliseNumber(item.rate ?? item.unitPrice);
    const cost = normaliseNumber(item.cost ?? item.amount);
    const quantity = normaliseNumber(item.quantity);
    const tax = normaliseNumber(item.tax ?? 0);

    return {
      ...item,
      type: item.type || "Hours",
      quantity,
      rate,
      tax,
      cost,
    };
  });

  const subtotal =
    Number.isFinite(normaliseNumber(raw.subtotal))
      ? normaliseNumber(raw.subtotal)
      : Number.isFinite(normaliseNumber(raw.totalAmount))
        ? normaliseNumber(raw.totalAmount)
        : normalisedItems.reduce((sum, item) => sum + normaliseNumber(item.cost), 0);

  const tax =
    Number.isFinite(normaliseNumber(raw.tax))
      ? normaliseNumber(raw.tax)
      : Number.isFinite(normaliseNumber(raw.gstAmount))
        ? normaliseNumber(raw.gstAmount)
        : 0;

  const total =
    Number.isFinite(normaliseNumber(raw.total))
      ? normaliseNumber(raw.total)
      : subtotal + tax;

  return {
    ...raw,
    companySnapshot,
    participantSnapshot,
    lineItems: normalisedItems,
    subtotal,
    tax,
    total,
  };
}

function findInvalidInvoiceReason(invoice: InvoiceData): string | null {
  if (!invoice.companySnapshot?.name) return "Company name is missing.";
  if (!invoice.participantSnapshot?.name) return "Participant name is missing.";
  if (!Array.isArray(invoice.lineItems) || invoice.lineItems.length === 0) {
    return "No invoice line items were returned by the backend.";
  }

  for (const item of invoice.lineItems) {
    if (!item.description) return `Line item ${item.id} is missing description.`;
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      return `Line item ${item.id} has invalid quantity.`;
    }
    if (!Number.isFinite(item.rate as number) || (item.rate as number) <= 0) {
      return `Line item ${item.id} has invalid rate.`;
    }
    if (!Number.isFinite(item.cost as number) || (item.cost as number) <= 0) {
      return `Line item ${item.id} has invalid cost.`;
    }
  }

  if (!Number.isFinite(invoice.subtotal as number) || (invoice.subtotal as number) <= 0) {
    return "Invoice subtotal is invalid.";
  }

  if (!Number.isFinite(invoice.total as number) || (invoice.total as number) <= 0) {
    return "Invoice total is invalid.";
  }

  return null;
}

const invoicePaper: React.CSSProperties = {
  width: "210mm",
  minHeight: "297mm",
  background: "#ffffff",
  color: "#000000",
  fontFamily: "Arial, Helvetica, sans-serif",
  fontSize: "12px",
  lineHeight: 1.28,
  boxSizing: "border-box",
};

const topHeader: React.CSSProperties = {
  padding: "18mm 14mm 10mm 14mm",
  borderBottom: "1px solid #000",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const titleStyle: React.CSSProperties = {
  fontSize: "20px",
  lineHeight: 1.15,
  fontWeight: 700,
  color: "#000",
  margin: 0,
};

const invoiceTitleStyle: React.CSSProperties = {
  fontSize: "24px",
  lineHeight: 1,
  fontWeight: 800,
  letterSpacing: "0.5px",
  color: "#000",
  textTransform: "uppercase",
  margin: 0,
};

const detailsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 0.78fr",
  columnGap: "9mm",
  padding: "6mm 14mm 7mm 14mm",
  borderBottom: "1px solid #d6d6d6",
  minHeight: "34mm",
};

const sectionLabel: React.CSSProperties = {
  fontSize: "10px",
  lineHeight: 1,
  fontWeight: 700,
  color: "#333",
  textTransform: "uppercase",
  letterSpacing: "0.7px",
  marginBottom: "4mm",
};

const bodyStrong: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 700,
  color: "#000",
  marginBottom: "2mm",
};

const bodyText: React.CSSProperties = {
  fontSize: "12px",
  color: "#000",
  margin: 0,
  marginBottom: "1.7mm",
};

const verticalDivider: React.CSSProperties = {
  borderLeft: "1px solid #d6d6d6",
  paddingLeft: "5mm",
};

const tableWrap: React.CSSProperties = {
  padding: "8mm 14mm 5mm 14mm",
};

const tableStyle: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  tableLayout: "fixed",
};

const thBase: React.CSSProperties = {
  fontSize: "11px",
  lineHeight: 1,
  color: "#000",
  fontWeight: 700,
  textAlign: "left",
  padding: "0 0 3mm 0",
  borderBottom: "1px solid #000",
};

const tdBase: React.CSSProperties = {
  fontSize: "12px",
  lineHeight: 1.25,
  color: "#000",
  verticalAlign: "top",
  padding: "4mm 0 2.5mm 0",
};

const bottomSection: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 70mm",
  columnGap: "10mm",
  padding: "3mm 14mm 0 14mm",
  alignItems: "start",
};

export default function InvoicePreview({ invoiceId, onClose, onRegenerate }: Props) {
  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");

  const fetchInvoice = async () => {
    setLoading(true);
    setError("");

    try {
      const res = await fetchWithAuth(`/api/invoices/${invoiceId}`);
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.error || "Failed to load invoice");
      }

      setInvoice(normaliseInvoice(body));
    } catch (e: any) {
      setError(e?.message || "Failed to load invoice");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "invoice-print-style";
    style.textContent = PRINT_STYLE;
    document.head.appendChild(style);

    return () => {
      document.getElementById("invoice-print-style")?.remove();
    };
  }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    setError("");

    try {
      const res = await fetchWithAuth(`/api/invoices/${invoiceId}/regenerate`, {
        method: "POST",
      });

      const body = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(body?.error || "Failed to regenerate invoice");
      }

      setInvoice(normaliseInvoice(body));
      onRegenerate?.();
    } catch (e: any) {
      setError(e?.message || "Failed to regenerate invoice");
    } finally {
      setRegenerating(false);
    }
  };

  const invalidReason = useMemo(() => {
    if (!invoice) return null;
    return findInvalidInvoiceReason(invoice);
  }, [invoice]);

  const company = invoice?.companySnapshot;
  const participant = invoice?.participantSnapshot;

  const issueDate = normaliseDate(invoice?.issueDate || invoice?.createdAt);
  const dueDate = normaliseDate(invoice?.dueDate);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 overflow-y-auto">
      <div className="invoice-no-print sticky top-0 z-10 bg-gray-950 px-5 py-3 flex items-center justify-between">
        <div className="min-w-0">
          <p className="text-white text-sm font-semibold truncate">
            {invoice ? `Invoice ${invoice.invoiceNumber}` : "Invoice Preview"}
          </p>
          {invoice?.status && (
            <p className="text-gray-400 text-xs capitalize">{invoice.status}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-white border-gray-600 hover:bg-gray-800 hover:text-white"
            onClick={handleRegenerate}
            disabled={loading || regenerating}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? "animate-spin" : ""}`} />
            Regenerate
          </Button>

          <Button
            size="sm"
            className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white"
            onClick={() => window.print()}
            disabled={loading || !invoice || !!invalidReason}
          >
            <Download className="w-3.5 h-3.5" />
            Download PDF
          </Button>

          <button
            onClick={onClose}
            className="ml-1 text-gray-400 hover:text-white transition-colors p-1.5 rounded-md hover:bg-gray-800"
            aria-label="Close invoice preview"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex justify-center p-6">
        {loading ? (
          <div className="bg-white w-[210mm] min-h-[297mm] flex items-center justify-center">
            <div className="text-center text-gray-400">
              <Printer className="w-10 h-10 mx-auto mb-3 animate-pulse" />
              <p>Loading invoice...</p>
            </div>
          </div>
        ) : error ? (
          <div className="bg-white w-[210mm] min-h-[297mm] flex items-center justify-center p-10">
            <div className="text-center text-red-600">
              <p className="font-bold mb-2">Could not load invoice</p>
              <p className="text-sm text-gray-600">{error}</p>
              <Button size="sm" className="mt-4" onClick={fetchInvoice}>
                Retry
              </Button>
            </div>
          </div>
        ) : invoice ? (
          <div id="invoice-print-content" style={invoicePaper}>
            <div style={topHeader}>
              <div>
                {company?.logoUrl ? (
                  <img
                    src={
                      company.brandingVersion
                        ? `${company.logoUrl}?v=${company.brandingVersion}`
                        : company.logoUrl
                    }
                    alt={company?.name || "Company logo"}
                    onError={(event) => {
                      event.currentTarget.style.display = "none";
                    }}
                    style={{
                      display: "block",
                      maxWidth: "34mm",
                      maxHeight: "16mm",
                      objectFit: "contain",
                      objectPosition: "left center",
                      marginBottom: "4mm",
                    }}
                  />
                ) : null}

                <h1 style={titleStyle}>{company?.name || ""}</h1>
              </div>

              <div style={{ textAlign: "right" }}>
                <h2 style={invoiceTitleStyle}>TAX INVOICE</h2>
                <p style={{ ...bodyText, marginTop: "4mm", fontSize: "12px" }}>
                  #{stripInvPrefix(invoice.invoiceNumber)}
                </p>
              </div>
            </div>

            <div style={detailsGrid}>
              <div>
                <div style={sectionLabel}>From</div>
                <div style={bodyStrong}>{company?.name || ""}</div>
                {joinAddress(company) && <p style={bodyText}>{joinAddress(company)}</p>}
                {company?.phone && <p style={bodyText}>Phone: {company.phone}</p>}
                {company?.email && <p style={bodyText}>Email:</p>}
                {company?.email && <p style={bodyText}>{company.email}</p>}
                {company?.abn && <p style={bodyText}>ABN: {company.abn}</p>}
              </div>

              <div style={verticalDivider}>
                <div style={sectionLabel}>To</div>
                <div style={bodyStrong}>{participant?.name || "—"}</div>
                {joinAddress(participant) && <p style={bodyText}>{joinAddress(participant)}</p>}
                {participant?.phone && <p style={bodyText}>Phone: {participant.phone}</p>}
                <p style={bodyText}>Email:</p>
                {participant?.email && <p style={bodyText}>{participant.email}</p>}
              </div>

              <div style={verticalDivider}>
                <div style={sectionLabel}>Invoice Details</div>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <tbody>
                    <MetaRow label="Tax Invoice #" value={invoice.invoiceNumber} />
                    <MetaRow label="Issue Date" value={issueDate} />
                    <MetaRow label="Payment Due" value={dueDate} highlight />
                    {participant?.ndisNumber && (
                      <MetaRow label="NDIS" value={participant.ndisNumber} />
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {invalidReason ? (
              <div style={{ padding: "9mm 14mm", borderBottom: "1px solid #d6d6d6" }}>
                <div
                  style={{
                    border: "1px solid #ff0000",
                    padding: "8mm 10mm",
                    color: "#d00",
                    fontSize: "12px",
                  }}
                >
                  <strong>Invoice data invalid</strong>
                  <p style={{ margin: "4mm 0 0 0", color: "#000" }}>{invalidReason}</p>
                </div>
              </div>
            ) : (
              <div style={tableWrap}>
                <table style={tableStyle}>
                  <colgroup>
                    <col style={{ width: "47%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "12%" }} />
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "9%" }} />
                    <col style={{ width: "11%" }} />
                  </colgroup>

                  <thead>
                    <tr>
                      <th style={thBase}>Description</th>
                      <th style={{ ...thBase, textAlign: "left" }}>Type</th>
                      <th style={{ ...thBase, textAlign: "right" }}>Quantity</th>
                      <th style={{ ...thBase, textAlign: "right" }}>Rate</th>
                      <th style={{ ...thBase, textAlign: "right" }}>Tax</th>
                      <th style={{ ...thBase, textAlign: "right" }}>Cost</th>
                    </tr>
                  </thead>

                  <tbody>
                    {invoice.lineItems.map((item) => (
                      <tr key={item.id}>
                        <td style={{ ...tdBase, paddingRight: "5mm" }}>{item.description}</td>
                        <td style={tdBase}>{item.type || "Hours"}</td>
                        <td style={{ ...tdBase, textAlign: "right" }}>
                          {item.quantity.toFixed(2)}
                        </td>
                        <td style={{ ...tdBase, textAlign: "right" }}>
                          ${money(item.rate as number)}
                        </td>
                        <td style={{ ...tdBase, textAlign: "right" }}>
                          ${money(item.tax || 0)}
                        </td>
                        <td style={{ ...tdBase, textAlign: "right" }}>
                          ${money(item.cost as number)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={bottomSection}>
              <div>
                <div style={{ ...sectionLabel, marginBottom: "4mm" }}>Payment Methods:</div>
                <p style={{ ...bodyText, maxWidth: "90mm" }}>
                  please make payment via bank transfer. Account
                  <br />
                  Name: <strong>{company?.bankAccountName || ""}</strong>{" "}
                  BSB: <strong>{company?.bankBsb || ""}</strong>{" "}
                  Account Number: <strong>{company?.bankAccountNumber || ""}</strong>
                </p>
                {company?.paymentInstructions && (
                  <p style={{ ...bodyText, maxWidth: "90mm" }}>{company.paymentInstructions}</p>
                )}
              </div>

              <div>
                <div style={{ ...bodyText, display: "flex", justifyContent: "space-between" }}>
                  <span>Amount Due {dueDate}</span>
                </div>

                <TotalRow label="Subtotal:" value={`$${money(invoice.subtotal || 0)}`} />
                <TotalRow label="Tax:" value={`$${money(invoice.tax || 0)}`} />

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    paddingTop: "2mm",
                    fontSize: "12px",
                    fontWeight: 700,
                  }}
                >
                  <span>Total:</span>
                  <span>${money(invoice.total || 0)}</span>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MetaRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <tr>
      <td
        style={{
          fontSize: "10px",
          color: "#333",
          padding: "0 4mm 2.2mm 0",
          whiteSpace: "nowrap",
          verticalAlign: "top",
        }}
      >
        {label}:
      </td>
      <td
        style={{
          fontSize: "12px",
          color: highlight ? "#c00000" : "#000",
          fontWeight: 700,
          padding: "0 0 2.2mm 0",
          verticalAlign: "top",
        }}
      >
        {value || "—"}
      </td>
    </tr>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: "12px",
        lineHeight: 1.3,
        color: "#000",
        marginBottom: "1.5mm",
      }}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
