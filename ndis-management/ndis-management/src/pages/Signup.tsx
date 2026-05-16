import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft, CheckCircle2, Building2, User, Hash, Mail } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLocation } from "wouter";

const BASE = import.meta.env.BASE_URL;

const BRAND_NAVY  = "#0f1e46";
const BRAND_BLUE  = "#6BBDE8";
const BRAND_BLUE2 = "#2563eb";
const SECTION_LABEL_COLOR = "#6BBDE8";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const FEATURES = [
  "Full access to all features",
  "Unlimited participants during trial",
  "Dedicated onboarding support",
  "No credit card required",
];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: 14, fontWeight: 700, color: "#0f172a", marginBottom: 10 }}>
      {children}
    </p>
  );
}

function FloatingInput({ label, icon, right, className = "", style: styleProp, ...props }: {
  label: string;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "style">) {
  return (
    <div className="relative">
      <span style={{
        position: "absolute", top: -8, left: icon ? 34 : 10,
        fontSize: 10.5, fontWeight: 500, lineHeight: 1,
        color: "#6b7280", background: "white",
        padding: "0 3px", zIndex: 1, pointerEvents: "none",
      }}>
        {label}
      </span>
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" style={{ zIndex: 2 }}>
          {icon}
        </span>
      )}
      <Input
        className={`h-10 bg-white border-gray-300 focus:bg-white ${icon ? "pl-9" : "pl-3"} ${right ? "pr-9" : ""} ${className}`}
        style={{ fontSize: 12.5, ...styleProp }}
        {...props}
      />
      {right && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2">{right}</span>
      )}
    </div>
  );
}

export default function Signup() {
  const { loginWithUserInfo } = useAuth();
  const [, navigate] = useLocation();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    company: "",
    abn: "",
    managerEmail: "",
    accountType: "business",
  });

  const isEmployee = form.accountType === "employee";
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (isEmployee && !form.managerEmail.trim()) { setError("Please enter your manager's email address."); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Signup failed");
      loginWithUserInfo({
        email: form.email,
        fullName: form.fullName,
        company: form.company,
        abn: form.abn || undefined,
        plan: data.plan ?? "growth",
        subscriptionStatus: data.subscriptionStatus ?? "trial",
        trialEndsAt: data.trialEndsAt ?? null,
      });
      navigate("/signup/success");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="h-screen overflow-hidden flex"
      style={{
        background: `linear-gradient(90deg, ${BRAND_NAVY} 50%, #dce6f7 50%)`,
        backgroundImage: `url('${BASE}login-bg2.webp'), url('${BASE}login-bg2.png')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* ── LEFT PANEL ─────────────────────────────────────── */}
      <div
        className="hidden lg:flex lg:w-[50%] flex-col justify-between px-12 relative overflow-hidden"
        style={{ paddingTop: "clamp(16px, 3vh, 28px)", paddingBottom: "clamp(16px, 3vh, 28px)" }}
      >
        {/* Logo */}
        <div>
          <picture>
            <source srcSet={`${BASE}logo-white.webp`} type="image/webp" />
            <img
              src={`${BASE}logo-white.png`}
              alt="ProviderFlo"
              style={{ height: "clamp(44px, 5.5vh, 60px)", width: "auto", objectFit: "contain", display: "block" }}
              fetchPriority="high"
            />
          </picture>
        </div>

        {/* Hero CTA */}
        <div className="relative z-10">
          <p
            style={{ fontSize: 10, letterSpacing: "0.14em", lineHeight: 1.2, color: "rgba(255,255,255,0.55)", marginBottom: "clamp(4px,0.8vh,8px)", textTransform: "uppercase", fontWeight: 600 }}
          >
            {getGreeting()}
          </p>

          <h2
            style={{ fontSize: "clamp(16px,2.2vh,22px)", lineHeight: 1.3, textShadow: "0 2px 12px rgba(0,0,0,0.3)", marginBottom: "clamp(6px,1vh,10px)", fontWeight: 800 }}
            className="text-white"
          >
            Start your{" "}
            <span style={{ color: BRAND_BLUE }}>14-day</span>{" "}
            free trial
          </h2>

          <p style={{ fontSize: 11.5, lineHeight: 1.45, color: "rgba(255,255,255,0.72)", marginBottom: 2 }}>
            Get full access to all features. No credit card required.
          </p>
          <p style={{ fontSize: 11.5, lineHeight: 1.45, color: "rgba(255,255,255,0.72)", marginBottom: "clamp(12px,1.8vh,20px)" }}>
            Set up your account in under 2 minutes.
          </p>

          {/* Feature bullets */}
          <ul style={{ marginBottom: "clamp(14px,2vh,22px)", display: "flex", flexDirection: "column", gap: "clamp(5px,0.8vh,9px)" }}>
            {FEATURES.map(f => (
              <li key={f} className="flex items-center gap-2">
                <CheckCircle2 style={{ width: 14, height: 14, color: BRAND_BLUE, flexShrink: 0 }} />
                <span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.82)" }}>{f}</span>
              </li>
            ))}
          </ul>

          {/* Back to login */}
          <a
            href={`${BASE}login`}
            onClick={(e) => { e.preventDefault(); navigate("/login"); }}
            className="inline-flex items-center gap-2 rounded-lg font-semibold transition-all hover:opacity-90 active:scale-95"
            style={{
              fontSize: 11,
              padding: "7px 14px",
              background: "rgba(255,255,255,0.13)",
              border: "1px solid rgba(255,255,255,0.25)",
              color: "#fff",
              backdropFilter: "blur(6px)",
              textDecoration: "none",
            }}
          >
            <ArrowLeft style={{ width: 12, height: 12 }} />
            Back to login
          </a>
        </div>

        {/* Testimonial */}
        <div className="relative z-10">
          <p style={{ fontSize: 10.5, lineHeight: 1.45, color: "rgba(255,255,255,0.72)", fontStyle: "italic", marginBottom: 4 }}>
            "ProviderFlo simplified our day-to-day."
          </p>
          <p style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>Sarah Jenkins</p>
          <p style={{ fontSize: 10.5, color: "rgba(255,255,255,0.5)" }}>Support Coordinator</p>
        </div>
      </div>

      {/* ── RIGHT PANEL — signup card ───────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-4 overflow-y-auto">

        {/* Mobile logo */}
        <div className="lg:hidden mb-4">
          <picture>
            <source srcSet={`${BASE}logo-dark.webp`} type="image/webp" />
            <img src={`${BASE}logo-dark.png`} alt="ProviderFlo" style={{ height: 30, width: "auto", objectFit: "contain" }} fetchPriority="high" />
          </picture>
        </div>

        {/* Card */}
        <div
          className="w-full bg-white rounded-2xl px-7 py-6"
          style={{
            maxWidth: 400,
            boxShadow: "0 24px 64px rgba(15,30,70,0.18), 0 6px 20px rgba(15,30,70,0.10)",
          }}
        >
          {/* Dark logo — clean, no transparent-padding artefacts */}
          <div className="flex justify-center mb-3">
            <picture>
              <source srcSet={`${BASE}logo-dark.webp`} type="image/webp" />
              <img
                src={`${BASE}logo-dark.png`}
                alt="ProviderFlo"
                style={{ height: 48, width: "auto", objectFit: "contain" }}
                fetchPriority="high"
              />
            </picture>
          </div>

          <h2 className="text-center font-bold text-gray-900" style={{ fontSize: 16, marginBottom: 2 }}>
            Create your account
          </h2>
          <p className="text-center text-gray-400" style={{ fontSize: 11.5, marginBottom: 18 }}>
            Start your 14-day free trial. No credit card required.
          </p>

          <form onSubmit={handleSubmit}>
            {/* YOUR DETAILS */}
            <SectionLabel>Your details</SectionLabel>
            <div style={{ marginBottom: 16 }}>
              <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 8 }}>
                <FloatingInput
                  label="Full name"
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 1 0-16 0"/></svg>}
                  placeholder="Jane Smith"
                  value={form.fullName}
                  onChange={set("fullName")}
                  required
                  autoComplete="name"
                />
                <FloatingInput
                  label="Work email"
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>}
                  type="email"
                  placeholder="jane@company.com"
                  value={form.email}
                  onChange={set("email")}
                  required
                  autoComplete="email"
                />
              </div>
              <div>
                <FloatingInput
                  label="Password"
                  icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>}
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={set("password")}
                  required
                  autoComplete="new-password"
                  right={
                    <button type="button" onClick={() => setShowPassword(v => !v)}
                      className="text-gray-400 hover:text-gray-600" tabIndex={-1}>
                      {showPassword ? <EyeOff style={{ width: 13, height: 13 }} /> : <Eye style={{ width: 13, height: 13 }} />}
                    </button>
                  }
                />
                <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, paddingLeft: 2 }}>Minimum 8 characters</p>
              </div>
            </div>

            {/* YOUR ORGANISATION (Business) / MANAGER DETAILS (Employee) */}
            {isEmployee ? (
              <>
                <SectionLabel>Manager details</SectionLabel>
                <div style={{ marginBottom: 16 }}>
                  <FloatingInput
                    label="Manager's email"
                    icon={<Mail style={{ width: 13, height: 13 }} />}
                    type="email"
                    placeholder="manager@company.com"
                    value={form.managerEmail}
                    onChange={set("managerEmail")}
                    required
                    autoComplete="email"
                  />
                  <p style={{ fontSize: 10, color: "#9ca3af", marginTop: 3, paddingLeft: 2 }}>
                    Your manager will receive a request to add you to their organisation.
                  </p>
                </div>
              </>
            ) : (
              <>
                <SectionLabel>Your organisation</SectionLabel>
                <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 16 }}>
                  <FloatingInput
                    label="Organisation name"
                    icon={<Building2 style={{ width: 13, height: 13 }} />}
                    placeholder="Your Organisation"
                    value={form.company}
                    onChange={set("company")}
                    required
                    autoComplete="organization"
                  />
                  <FloatingInput
                    label="ABN"
                    icon={<Hash style={{ width: 13, height: 13 }} />}
                    placeholder="12 345 678 901"
                    value={form.abn}
                    onChange={e => setForm(f => ({ ...f, abn: e.target.value.replace(/[^\d\s]/g, "") }))}
                    required
                    maxLength={14}
                  />
                </div>
              </>
            )}

            {/* ACCOUNT TYPE */}
            <SectionLabel>Account type</SectionLabel>
            <p style={{ fontSize: 11, color: "#6b7280", marginTop: -6, marginBottom: 10 }}>
              Choose the option that best describes you.
            </p>
            <div className="grid grid-cols-2 gap-2.5" style={{ marginBottom: 16 }}>
              {[
                { value: "business", label: "Business", icon: Building2, desc: "Manage staff, clients and billing" },
                { value: "employee", label: "Employee", icon: User, desc: "Join an existing organisation" },
              ].map(({ value, label, icon: Icon, desc }) => {
                const selected = form.accountType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, accountType: value }))}
                    className="relative text-left rounded-xl transition-all"
                    style={{
                      padding: "12px 12px 10px",
                      border: selected ? `2px solid ${BRAND_NAVY}` : "2px solid #e5e7eb",
                      background: selected ? "#edf0f7" : "#fff",
                    }}
                  >
                    {selected && (
                      <span className="absolute top-2 right-2 flex items-center justify-center rounded-full"
                        style={{ width: 18, height: 18, background: BRAND_NAVY }}>
                        <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    )}
                    <div style={{
                      width: 36, height: 36, borderRadius: "50%",
                      background: selected ? "#cdd3e8" : "#f3f4f6",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginBottom: 8,
                    }}>
                      <Icon style={{ width: 18, height: 18, color: selected ? BRAND_NAVY : "#9ca3af" }} />
                    </div>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: selected ? BRAND_NAVY : "#374151", marginBottom: 2 }}>{label}</p>
                    <p style={{ fontSize: 10.5, color: selected ? "#4a5580" : "#9ca3af", lineHeight: 1.35 }}>{desc}</p>
                  </button>
                );
              })}
            </div>

            {error && (
              <p className="rounded-lg px-3 py-2 border mb-3" style={{ fontSize: 11, color: "#dc2626", background: "#fef2f2", borderColor: "#fecaca" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 rounded-lg font-semibold transition-all hover:opacity-90 active:scale-[0.99] disabled:opacity-60"
              style={{ height: 44, backgroundColor: BRAND_NAVY, color: "#fff", fontSize: 14 }}
            >
              {loading
                ? <><Loader2 style={{ width: 14, height: 14 }} className="animate-spin" /> {isEmployee ? "Sending request…" : "Creating account…"}</>
                : isEmployee
                  ? <>Request an Invite <ArrowRight style={{ width: 13, height: 13 }} /></>
                  : <>Start Free Trial <ArrowRight style={{ width: 13, height: 13 }} /></>
              }
            </button>

            <div className="flex items-center justify-center gap-1.5" style={{ marginTop: 10, marginBottom: 4 }}>
              <CheckCircle2 style={{ width: 13, height: 13, color: BRAND_NAVY }} />
              <span style={{ fontSize: 11, color: "#374151" }}>Takes less than 2 minutes</span>
            </div>
            <p className="text-center" style={{ fontSize: 10, color: "#9ca3af" }}>
              By signing up you agree to our{" "}
              <a href="#" className="underline" style={{ color: "#6b7280" }}>Terms</a>{" "}
              and{" "}
              <a href="#" className="underline" style={{ color: "#6b7280" }}>Privacy Policy</a>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
