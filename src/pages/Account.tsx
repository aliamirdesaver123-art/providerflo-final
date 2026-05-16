import { useState, useEffect, useRef } from "react";
import { differenceInDays, parseISO, format } from "date-fns";
import {
  User, Mail, Building2, Hash, CreditCard, Calendar,
  CheckCircle2, Clock, Star, Infinity, LogOut, ChevronRight,
  Shield, AlertTriangle, Loader2, Lock, MapPin,
  Landmark, Save, Upload,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useCompanyBranding } from "@/context/CompanyBrandingContext";
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { fetchWithAuth, fetchWithAuthJson, ApiError } from "@/lib/fetchWithAuth";
import { AddressAutocomplete, type StructuredAddress } from "@/components/AddressAutocomplete";
import { BrandLogo } from "@/components/branding/BrandLogo";
import {
  type BusinessProfileDTO,
  emptyBusinessProfile,
  toBusinessProfileUpdatePayload,
} from "@/types/businessProfile";

const PLAN_INFO: Record<string, { label: string; price: string; description: string; color: string }> = {
  starter:    { label: "Starter",    price: "$89/mo",     description: "Up to 20 participants",        color: "text-blue-600 bg-blue-50 border-blue-200" },
  growth:     { label: "Growth",     price: "$199/mo",    description: "Up to 100 participants",       color: "text-purple-600 bg-purple-50 border-purple-200" },
  enterprise: { label: "Enterprise", price: "Custom",     description: "Unlimited participants",       color: "text-gray-700 bg-gray-50 border-gray-200" },
  trial:      { label: "Free Trial", price: "Free",       description: "14-day full access",           color: "text-green-700 bg-green-50 border-green-200" },
};

function getReadableError(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "string") return err;
  return fallback;
}

function StatusBadge({ status }: { status: string }) {
  if (status === "active")   return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700"><CheckCircle2 className="w-3.5 h-3.5" /> Active</span>;
  if (status === "lifetime") return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700"><Infinity className="w-3.5 h-3.5" /> Lifetime</span>;
  if (status === "trial")    return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-700"><Clock className="w-3.5 h-3.5" /> Free Trial</span>;
  if (status === "expired")  return <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700"><AlertTriangle className="w-3.5 h-3.5" /> Expired</span>;
  return null;
}

export default function Account() {
  const { user, logout } = useAuth();
  const { setBrandingFromProfile } = useCompanyBranding();

  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeError, setUpgradeError] = useState("");

  const [orgSettings, setOrgSettings] = useState<BusinessProfileDTO>(emptyBusinessProfile);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgSaving, setOrgSaving] = useState(false);
  const [orgSaveMsg, setOrgSaveMsg] = useState("");
  const [orgSaveError, setOrgSaveError] = useState("");
  const [orgFieldErrors, setOrgFieldErrors] = useState<Record<string, string[]>>({});

  const [logoUploading, setLogoUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const logoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchWithAuthJson<BusinessProfileDTO>("/api/org/settings")
      .then((data) => {
        setOrgSettings({ ...emptyBusinessProfile, ...data });
      })
      .catch(() => {})
      .finally(() => setOrgLoading(false));
  }, []);

  if (!user) return null;

  const { email, fullName, company, abn, plan, subscriptionStatus, trialEndsAt } = user;

  const initials = fullName
    ? fullName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : email.slice(0, 2).toUpperCase();

  const daysLeft = subscriptionStatus === "trial" && trialEndsAt
    ? Math.max(0, differenceInDays(parseISO(trialEndsAt), new Date()))
    : null;

  const trialEndFormatted = trialEndsAt
    ? format(parseISO(trialEndsAt), "d MMMM yyyy")
    : null;

  const planKey = subscriptionStatus === "trial" ? "trial" : (plan || "starter");
  const planInfo = PLAN_INFO[planKey] ?? PLAN_INFO["starter"];
  const canUpgrade = subscriptionStatus === "trial" || subscriptionStatus === "expired";

  const handleUpgrade = async () => {
    setUpgradeError("");
    setUpgradeLoading(true);
    try {
      const res = await fetchWithAuth(`/api/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, planKey: "growth" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start checkout");
      if (data.url) window.location.href = data.url;
    } catch (err: unknown) {
      setUpgradeError(getReadableError(err, "Something went wrong. Please try again."));
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleOrgChange =
    (field: keyof BusinessProfileDTO) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setOrgSettings((prev) => ({ ...prev, [field]: e.target.value }));
    };

  const handleAddressStructured = (data: StructuredAddress) => {
    setOrgSettings((prev) => ({
      ...prev,
      formattedAddress: data.formattedAddress ?? prev.formattedAddress,
      address: data.address ?? prev.address,
      suburb: data.suburb ?? prev.suburb,
      state: data.state ?? prev.state,
      postcode: data.postcode ?? prev.postcode,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      placeId: data.placeId ?? null,
    }));
  };

  const handleSaveOrg = async () => {
    setOrgSaving(true);
    setOrgSaveMsg("");
    setOrgSaveError("");
    setOrgFieldErrors({});

    try {
      const updated = await fetchWithAuthJson<BusinessProfileDTO>("/api/org/settings", {
        method: "PUT",
        body: JSON.stringify(toBusinessProfileUpdatePayload(orgSettings)),
      });

      const merged = { ...emptyBusinessProfile, ...updated };
      setOrgSettings(merged);
      setBrandingFromProfile(merged);
      setOrgSaveMsg("Business settings saved successfully.");
      setTimeout(() => setOrgSaveMsg(""), 4000);
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setOrgFieldErrors(err.fields);
      }
      setOrgSaveError(getReadableError(err, "Failed to save business settings."));
    } finally {
      setOrgSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      setLogoError("Please upload a PNG, JPG, WEBP, or SVG file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setLogoError("File must be under 5 MB.");
      return;
    }

    setLogoUploading(true);
    setLogoError("");
    setOrgSaveError("");

    try {
      const uploadRequest = await fetchWithAuthJson<{
        uploadURL: string;
        logoUrl: string;
        objectId: string;
      }>("/api/storage/branding/logos/request-url", {
        method: "POST",
        body: JSON.stringify({
          name: file.name,
          size: file.size,
          contentType: file.type,
        }),
      });

      const uploadRes = await fetch(uploadRequest.uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadRes.ok) {
        throw new Error(`Logo upload failed (${uploadRes.status}).`);
      }

      await fetchWithAuthJson("/api/storage/branding/logos/verify", {
        method: "POST",
        body: JSON.stringify({ logoUrl: uploadRequest.logoUrl }),
      });

      const updated = await fetchWithAuthJson<BusinessProfileDTO>("/api/org/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...toBusinessProfileUpdatePayload(orgSettings),
          logoUrl: uploadRequest.logoUrl,
        }),
      });

      const merged = { ...emptyBusinessProfile, ...updated };
      setOrgSettings(merged);
      setBrandingFromProfile(merged);
      setOrgSaveMsg("Logo uploaded and saved successfully.");
      setTimeout(() => setOrgSaveMsg(""), 4000);
    } catch (err) {
      setLogoError(getReadableError(err, "Logo upload failed."));
    } finally {
      setLogoUploading(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = async () => {
    setLogoError("");
    setOrgSaveError("");

    try {
      const updated = await fetchWithAuthJson<BusinessProfileDTO>("/api/org/settings", {
        method: "PUT",
        body: JSON.stringify({
          ...toBusinessProfileUpdatePayload(orgSettings),
          logoUrl: "",
        }),
      });

      const merged = { ...emptyBusinessProfile, ...updated };
      setOrgSettings(merged);
      setBrandingFromProfile(merged);
      setOrgSaveMsg("Logo removed successfully.");
      setTimeout(() => setOrgSaveMsg(""), 4000);
    } catch (err) {
      setLogoError(getReadableError(err, "Failed to remove logo."));
    }
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="pf-page-head" style={{ margin: 0 }}>
          <div>
            <h1 className="pf-page-title">Account</h1>
            <p className="pf-page-desc">Manage your profile, subscription and business settings.</p>
          </div>
        </div>

        {/* Profile */}
        <div className="pf-card" style={{ overflow: "hidden" }}>
          <div className="pf-card-header">
            <span className="pf-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <User style={{ width: 14, height: 14, color: "var(--pf-primary)", strokeWidth: 1.8 }} />Profile
            </span>
          </div>
          <div className="pf-card-body" style={{ display: "flex", alignItems: "flex-start", gap: 20 }}>
            <div style={{ width: 56, height: 56, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 800, color: "#fff", flexShrink: 0, background: "var(--pf-sidebar)" }}>
              {initials}
            </div>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 32px" }}>
              <Detail icon={<User style={{ width: 14, height: 14, color: "var(--pf-muted)", strokeWidth: 1.8 }} />} label="Full name" value={fullName || "—"} />
              <Detail icon={<Mail style={{ width: 14, height: 14, color: "var(--pf-muted)", strokeWidth: 1.8 }} />} label="Email address" value={email} />
              <Detail icon={<Building2 style={{ width: 14, height: 14, color: "var(--pf-muted)", strokeWidth: 1.8 }} />} label="Organisation" value={company || "—"} />
              <Detail icon={<Hash style={{ width: 14, height: 14, color: "var(--pf-muted)", strokeWidth: 1.8 }} />} label="ABN" value={abn || "—"} />
            </div>
          </div>
        </div>

        {/* Business Settings */}
        <div className="pf-card" style={{ overflow: "hidden" }}>
          <div className="pf-card-header">
            <span className="pf-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Building2 style={{ width: 14, height: 14, color: "var(--pf-primary)", strokeWidth: 1.8 }} />Business Settings
            </span>
            <span style={{ fontSize: 11, color: "var(--pf-muted)" }}>Used on invoices and documents</span>
          </div>

          {orgLoading ? (
            <div className="pf-card-body" style={{ display: "flex", justifyContent: "center", padding: 32 }}>
              <Loader2 style={{ width: 20, height: 20, color: "var(--pf-muted)" }} className="animate-spin" />
            </div>
          ) : (
            <div className="pf-card-body" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              {/* Logo upload */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--pf-muted)", marginBottom: 10 }}>Company Logo</p>
                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <div style={{ width: 112, minHeight: 64, borderRadius: 10, border: "2px dashed var(--pf-border)", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--pf-surface)", flexShrink: 0, overflow: "hidden", padding: 8 }}>
                    <BrandLogo logoUrl={orgSettings.logoUrl} brandingVersion={orgSettings.brandingVersion} className="max-w-full max-h-[64px] object-contain" fallbackClassName="w-8 h-8 text-gray-300" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml" className="hidden" onChange={handleLogoUpload} />
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Button type="button" variant="outline" size="sm" className="gap-2" disabled={logoUploading} onClick={() => logoInputRef.current?.click()}>
                        {logoUploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Uploading…</> : <><Upload className="w-3.5 h-3.5" />{orgSettings.logoUrl ? "Replace Logo" : "Upload Logo"}</>}
                      </Button>
                      {orgSettings.logoUrl && <button type="button" style={{ fontSize: 12, color: "var(--pf-muted)", background: "none", border: "none", cursor: "pointer" }} onClick={handleRemoveLogo}>Remove</button>}
                    </div>
                    <p style={{ fontSize: 11, color: "var(--pf-muted)", marginTop: 6 }}>PNG, JPG, WEBP or SVG · Max 5 MB · Preserves transparency · Appears on invoices</p>
                    {logoError && <p style={{ fontSize: 11, color: "var(--pf-error)", marginTop: 4 }}>{logoError}</p>}
                  </div>
                </div>
              </div>

              {/* Business info */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--pf-muted)", marginBottom: 10 }}>Business Information</p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="pf-field"><Label htmlFor="org-name">Business Name</Label><Input id="org-name" value={orgSettings.name ?? ""} onChange={handleOrgChange("name")} placeholder="e.g. Sunrise Support Services" /></div>
                  <div className="pf-field"><Label htmlFor="org-abn">ABN</Label><Input id="org-abn" value={orgSettings.abn ?? ""} onChange={handleOrgChange("abn")} placeholder="e.g. 12345678901" />{orgFieldErrors.abn?.[0] && <p style={{ fontSize: 11, color: "var(--pf-error)" }}>{orgFieldErrors.abn[0]}</p>}</div>
                  <div className="pf-field"><Label htmlFor="org-email">Business Email</Label><Input id="org-email" type="email" value={orgSettings.email ?? ""} onChange={handleOrgChange("email")} placeholder="accounts@business.com.au" />{orgFieldErrors.email?.[0] && <p style={{ fontSize: 11, color: "var(--pf-error)" }}>{orgFieldErrors.email[0]}</p>}</div>
                  <div className="pf-field"><Label htmlFor="org-phone">Business Phone</Label><Input id="org-phone" value={orgSettings.phone ?? ""} onChange={handleOrgChange("phone")} placeholder="07 3000 0000" /></div>
                </div>
              </div>

              {/* Address */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--pf-muted)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <MapPin style={{ width: 12, height: 12 }} />Business Address
                  <span className="pf-chip pf-chip-info" style={{ fontSize: 10 }}>Google Maps</span>
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div className="pf-field">
                    <Label>Search Address</Label>
                    <AddressAutocomplete value={orgSettings.address ?? ""} onChange={(val) => setOrgSettings((prev) => ({ ...prev, address: val }))} onStructuredChange={handleAddressStructured} placeholder="Start typing your business address…" />
                    <p style={{ fontSize: 11, color: "var(--pf-muted)" }}>Selecting a suggestion auto-fills suburb, state, and postcode.</p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    <div className="pf-field"><Label htmlFor="org-suburb">Suburb</Label><Input id="org-suburb" value={orgSettings.suburb ?? ""} onChange={handleOrgChange("suburb")} placeholder="e.g. Brisbane City" /></div>
                    <div className="pf-field"><Label htmlFor="org-state">State</Label><Input id="org-state" value={orgSettings.state ?? ""} onChange={handleOrgChange("state")} placeholder="QLD" /></div>
                    <div className="pf-field"><Label htmlFor="org-postcode">Postcode</Label><Input id="org-postcode" value={orgSettings.postcode ?? ""} onChange={handleOrgChange("postcode")} placeholder="4000" /></div>
                  </div>
                </div>
              </div>

              {/* Bank details */}
              <div>
                <p style={{ fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: ".05em", color: "var(--pf-muted)", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                  <Landmark style={{ width: 12, height: 12 }} />Bank Details (for invoice payments)
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div className="pf-field" style={{ gridColumn: "1 / -1" }}><Label htmlFor="org-bank-name">Account Name</Label><Input id="org-bank-name" value={orgSettings.bankAccountName ?? ""} onChange={handleOrgChange("bankAccountName")} placeholder="e.g. Sunrise Support Services Pty Ltd" /></div>
                  <div className="pf-field"><Label htmlFor="org-bsb">BSB</Label><Input id="org-bsb" value={orgSettings.bankBsb ?? ""} onChange={handleOrgChange("bankBsb")} placeholder="084-034" />{orgFieldErrors.bankBsb?.[0] && <p style={{ fontSize: 11, color: "var(--pf-error)" }}>{orgFieldErrors.bankBsb[0]}</p>}</div>
                  <div className="pf-field"><Label htmlFor="org-acc">Account Number</Label><Input id="org-acc" value={orgSettings.bankAccountNumber ?? ""} onChange={handleOrgChange("bankAccountNumber")} placeholder="357961787" />{orgFieldErrors.bankAccountNumber?.[0] && <p style={{ fontSize: 11, color: "var(--pf-error)" }}>{orgFieldErrors.bankAccountNumber[0]}</p>}</div>
                  <div className="pf-field" style={{ gridColumn: "1 / -1" }}><Label htmlFor="org-payment-notes">Payment Instructions (optional)</Label><Textarea id="org-payment-notes" value={orgSettings.paymentInstructions ?? ""} onChange={handleOrgChange("paymentInstructions")} placeholder="e.g. Please include the invoice number as the payment reference." rows={2} className="resize-none" /></div>
                </div>
              </div>

              {orgSaveMsg && (
                <div className="pf-chip pf-chip-success" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", height: "auto", borderRadius: 10, fontSize: 13 }}>
                  <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} />{orgSaveMsg}
                </div>
              )}
              {orgSaveError && (
                <div className="pf-chip pf-chip-error" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", height: "auto", borderRadius: 10, fontSize: 13 }}>
                  {orgSaveError}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <Button onClick={handleSaveOrg} disabled={orgSaving} className="gap-2">
                  {orgSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Business Settings
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Subscription */}
        <div className="pf-card" style={{ overflow: "hidden" }}>
          <div className="pf-card-header">
            <span className="pf-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <CreditCard style={{ width: 14, height: 14, color: "var(--pf-primary)", strokeWidth: 1.8 }} />Subscription
            </span>
          </div>
          <div className="pf-card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <StatusBadge status={subscriptionStatus} />
                  <span className="pf-chip">{planInfo.label}</span>
                </div>
                <p style={{ fontSize: 12, color: "var(--pf-muted)" }}>{planInfo.description} · {planInfo.price}</p>
              </div>
              {canUpgrade && (
                <Button onClick={handleUpgrade} disabled={upgradeLoading} style={{ borderRadius: 9999, fontWeight: 700 }}>
                  {upgradeLoading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Redirecting…</> : <>Upgrade Now <ChevronRight className="w-4 h-4 ml-1" /></>}
                </Button>
              )}
            </div>
            {upgradeError && <div className="pf-chip pf-chip-error" style={{ display: "inline-flex", padding: "8px 12px", height: "auto", borderRadius: 8, fontSize: 12 }}>{upgradeError}</div>}
            {subscriptionStatus === "trial" && trialEndsAt && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, paddingTop: 12, borderTop: "1px solid var(--pf-border)" }}>
                <Detail icon={<Calendar style={{ width: 14, height: 14, color: "var(--pf-muted)", strokeWidth: 1.8 }} />} label="Trial ends" value={trialEndFormatted!} />
                <Detail icon={<Clock style={{ width: 14, height: 14, color: "var(--pf-muted)", strokeWidth: 1.8 }} />} label="Days remaining" value={<span style={{ fontWeight: 700, color: daysLeft! <= 3 ? "var(--pf-error)" : "var(--pf-primary)" }}>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</span>} />
              </div>
            )}
            {subscriptionStatus === "lifetime" && (
              <div className="pf-chip pf-chip-warning" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", height: "auto", borderRadius: 10, fontSize: 13 }}>
                <Star style={{ width: 14, height: 14, flexShrink: 0 }} />You have lifetime free access to ProviderFlo. No billing required.
              </div>
            )}
            {subscriptionStatus === "active" && (
              <div className="pf-chip pf-chip-success" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", height: "auto", borderRadius: 10, fontSize: 13 }}>
                <CheckCircle2 style={{ width: 14, height: 14, flexShrink: 0 }} />Your subscription is active. To manage billing or cancel, contact <a href="mailto:hello@providerflo.com.au" style={{ textDecoration: "underline" }}>hello@providerflo.com.au</a>.
              </div>
            )}
          </div>
        </div>

        {/* Security */}
        <div className="pf-card" style={{ overflow: "hidden" }}>
          <div className="pf-card-header">
            <span className="pf-card-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Shield style={{ width: 14, height: 14, color: "var(--pf-primary)", strokeWidth: 1.8 }} />Security
            </span>
          </div>
          <div className="pf-card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="pf-metric-icon" style={{ width: 34, height: 34, borderRadius: 9 }}>
                <Lock style={{ width: 15, height: 15, color: "var(--pf-primary)", strokeWidth: 1.8 }} />
              </div>
              <div>
                <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)" }}>Password</p>
                <p style={{ fontSize: 11, color: "var(--pf-muted)" }}>Contact support to change your password</p>
              </div>
            </div>
            <button style={{ fontSize: 12, fontWeight: 700, color: "var(--pf-primary)", background: "none", border: "none", cursor: "pointer" }}>Change password</button>
          </div>
        </div>

        {/* Danger zone */}
        <div className="pf-card" style={{ overflow: "hidden", borderColor: "rgba(220,38,38,.2)" }}>
          <div className="pf-card-header" style={{ borderColor: "rgba(220,38,38,.1)" }}>
            <span className="pf-card-title" style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--pf-error)" }}>
              <AlertTriangle style={{ width: 14, height: 14, strokeWidth: 1.8 }} />Danger Zone
            </span>
          </div>
          <div className="pf-card-body" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)" }}>Sign out</p>
              <p style={{ fontSize: 11, color: "var(--pf-muted)" }}>Sign out of your ProviderFlo account on this device</p>
            </div>
            <Button variant="outline" size="sm" onClick={logout} className="gap-2" style={{ color: "var(--pf-error)", borderColor: "rgba(220,38,38,.3)" }}>
              <LogOut className="w-4 h-4" />Sign out
            </Button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
      <div style={{ marginTop: 2, flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ fontSize: 10, color: "var(--pf-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--pf-text)" }}>{value}</p>
      </div>
    </div>
  );
}
