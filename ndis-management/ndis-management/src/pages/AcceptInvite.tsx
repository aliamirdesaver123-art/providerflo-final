import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from "lucide-react";

const API = "";
const BRAND_NAVY = "#0f1e46";
const BRAND_BLUE = "#2563eb";

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
        className={`h-10 bg-white border-gray-300 focus:bg-white transition-colors ${icon ? "pl-9" : "pl-3"} ${right ? "pr-9" : ""} ${className}`}
        style={{ fontSize: 13, ...styleProp }}
        {...props}
      />
      {right && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2">{right}</span>
      )}
    </div>
  );
}

type InviteInfo = {
  valid: boolean;
  email: string;
  role: string;
  organisationName: string;
  expiresAt: string;
};

export default function AcceptInvite() {
  const [, navigate] = useLocation();

  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") ?? "";
  const emailParam = params.get("email") ?? "";

  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [validating, setValidating] = useState(true);
  const [validationError, setValidationError] = useState("");

  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token || !emailParam) {
      setValidationError("This invite link is invalid or incomplete.");
      setValidating(false);
      return;
    }
    (async () => {
      try {
        const res = await fetch(
          `${API}/api/invites/validate?token=${encodeURIComponent(token)}&email=${encodeURIComponent(emailParam)}`
        );
        const data = await res.json();
        if (!res.ok || !data.valid) {
          setValidationError(data.error ?? "This invite link is invalid or has expired.");
        } else {
          setInviteInfo(data);
        }
      } catch {
        setValidationError("Failed to validate invite. Please check your connection and try again.");
      } finally {
        setValidating(false);
      }
    })();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/invites/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, email: emailParam, fullName: fullName.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to create account. Please try again.");
      } else {
        setSuccess(true);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const roleLabel = inviteInfo?.role === "admin" ? "Administrator" : "Support Worker";

  return (
    <div className="min-h-screen flex" style={{ background: "#f3f4f6" }}>
      {/* Left panel */}
      <div
        className="hidden lg:flex flex-col justify-between w-[420px] min-h-screen p-10"
        style={{ background: BRAND_NAVY }}
      >
        <div>
          <div className="flex items-center gap-2 mb-12">
            <img src="/logo.png" alt="ProviderFlo" className="h-8 w-8 object-contain" onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
            }} />
            <span style={{ color: "#fff", fontWeight: 700, fontSize: 20, letterSpacing: "-0.5px" }}>
              ProviderFlo
            </span>
          </div>
          <h2 style={{ color: "#fff", fontSize: 28, fontWeight: 700, lineHeight: 1.2, marginBottom: 12 }}>
            You've been invited to join
          </h2>
          {inviteInfo && (
            <p style={{ color: "#93c5fd", fontSize: 16, fontWeight: 500 }}>
              {inviteInfo.organisationName}
            </p>
          )}
          <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 16, lineHeight: 1.6 }}>
            Create your account to get started with ProviderFlo — purpose-built for NDIS and Aged Care providers.
          </p>
        </div>
        <p style={{ color: "#475569", fontSize: 12 }}>
          © {new Date().getFullYear()} ProviderFlo. All rights reserved.
        </p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-[400px]">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
            {validating ? (
              <div className="flex flex-col items-center py-8 gap-4">
                <Loader2 className="animate-spin text-blue-600" size={32} />
                <p className="text-gray-500 text-sm">Validating your invite…</p>
              </div>
            ) : validationError ? (
              <div className="flex flex-col items-center py-8 gap-4 text-center">
                <XCircle size={40} className="text-red-500" />
                <h2 className="text-lg font-semibold text-gray-900">Invite not valid</h2>
                <p className="text-sm text-gray-500">{validationError}</p>
                <Link href="/login" className="mt-4 text-sm text-blue-600 hover:underline">
                  Go to Login
                </Link>
              </div>
            ) : success ? (
              <div className="flex flex-col items-center py-8 gap-4 text-center">
                <CheckCircle2 size={40} className="text-green-500" />
                <h2 className="text-lg font-semibold text-gray-900">Account created!</h2>
                <p className="text-sm text-gray-500">
                  Your account has been set up. You can now log in to{" "}
                  <strong>{inviteInfo?.organisationName}</strong>.
                </p>
                <button
                  onClick={() => navigate("/login")}
                  className="mt-4 w-full h-10 rounded-full font-semibold text-white text-sm"
                  style={{ background: BRAND_BLUE }}
                >
                  Go to Login →
                </button>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h1 className="text-xl font-bold text-gray-900 mb-1">Accept Invitation</h1>
                  <p className="text-sm text-gray-500">
                    You're joining{" "}
                    <span className="font-medium text-gray-700">{inviteInfo?.organisationName}</span>{" "}
                    as a{" "}
                    <span className="font-medium text-gray-700">{roleLabel}</span>.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                  {/* Email — locked */}
                  <FloatingInput
                    label="Email address"
                    type="email"
                    value={emailParam}
                    readOnly
                    style={{ background: "#f9fafb", color: "#6b7280", cursor: "not-allowed" }}
                  />

                  <FloatingInput
                    label="Full name"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your full name"
                    autoFocus
                    required
                  />

                  <FloatingInput
                    label="Password"
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Min. 8 characters"
                    required
                    right={
                      <button type="button" onClick={() => setShowPw((p) => !p)} className="text-gray-400 hover:text-gray-600">
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    }
                  />

                  <FloatingInput
                    label="Confirm password"
                    type={showConfirmPw ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    required
                    right={
                      <button type="button" onClick={() => setShowConfirmPw((p) => !p)} className="text-gray-400 hover:text-gray-600">
                        {showConfirmPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    }
                  />

                  {error && (
                    <p className="text-red-600 text-xs rounded-lg bg-red-50 border border-red-100 px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="h-10 rounded-full font-semibold text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
                    style={{ background: BRAND_BLUE }}
                  >
                    {submitting ? (
                      <><Loader2 size={15} className="animate-spin" /> Creating account…</>
                    ) : (
                      "Create Account →"
                    )}
                  </button>
                </form>

                <p className="text-center text-xs text-gray-400 mt-6">
                  Already have an account?{" "}
                  <Link href="/login" className="text-blue-600 hover:underline">
                    Sign in
                  </Link>
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
