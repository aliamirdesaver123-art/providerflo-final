import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/context/AuthContext";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const API = "";

export default function Login() {
  const { loginWithUserInfo } = useAuth();
  const [, navigate] = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "session_expired") {
      setError("Your session has expired. Please sign in again.");
      const url = new URL(window.location.href);
      url.searchParams.delete("reason");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Invalid email or password");
      loginWithUserInfo(data);
      navigate("/");
    } catch (err: any) {
      setError(err.message ?? "Invalid email or password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg("");
    setForgotLoading(true);
    try {
      await fetch(`${API}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
      });
    } finally {
      setForgotMsg("If an account with that email exists, a reset link has been sent.");
      setForgotLoading(false);
    }
  };

  const fieldWrap = (field: string): React.CSSProperties => ({
    width: "100%",
    height: 52,
    borderRadius: 10,
    background: focusedField === field ? "#ffffff" : "#f1f5f9",
    border: `1.5px solid ${focusedField === field ? "#498BEB" : "#e2e8f0"}`,
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "0 16px",
    transition: "border-color 150ms ease, background 150ms ease",
    boxSizing: "border-box",
  });

  const inputEl: React.CSSProperties = {
    flex: 1,
    height: "100%",
    border: "none",
    background: "transparent",
    outline: "none",
    fontSize: 15,
    fontWeight: 500,
    color: "#0f172a",
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    letterSpacing: "-0.01em",
  };

  const labelEl: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: 700,
    color: "#475569",
    marginBottom: 8,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
  };

  const btn: React.CSSProperties = {
    width: "100%",
    height: 52,
    borderRadius: 10,
    background: "#498BEB",
    border: "none",
    color: "#ffffff",
    fontSize: 15,
    fontWeight: 700,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    fontFamily: "inherit",
    letterSpacing: "-0.01em",
  };

  const card: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.88)",
    borderRadius: 16,
    padding: "36px 40px 32px",
    boxSizing: "border-box",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        boxSizing: "border-box",
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        backgroundImage: `url(${BASE}/login-sky.webp)`,
        backgroundSize: "cover",
        backgroundPosition: "center 30%",
        backgroundRepeat: "no-repeat",
      }}
    >
      <style>{`
        .pf-card input::placeholder { color: #94a3b8; opacity: 1; }
        @media (max-width: 640px) {
          .pf-login-shell { max-width: 100% !important; }
          .pf-logo { width: 190px !important; }
          .pf-card { padding: 28px 24px 24px !important; }
          .pf-h1 { font-size: 22px !important; }
        }
      `}</style>

      <div
        className="pf-login-shell"
        style={{
          width: "100%",
          maxWidth: 460,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {/* LOGO — stays on the sky, above the card */}
        <img
          className="pf-logo"
          src={`${BASE}/providerflo-logo.webp`}
          alt="ProviderFlo"
          style={{
            width: 220,
            height: "auto",
            objectFit: "contain",
            marginBottom: 28,
            filter: "drop-shadow(0 2px 16px rgba(0,10,60,0.30))",
          }}
          fetchPriority="high"
        />

        {/* FLAT WHITE CARD */}
        <div className="pf-card" style={card}>
          {!forgotMode ? (
            <>
              <h1
                className="pf-h1"
                style={{
                  fontSize: 24,
                  fontWeight: 700,
                  color: "#0f172a",
                  margin: "0 0 6px",
                  textAlign: "center",
                  lineHeight: 1.2,
                  letterSpacing: "-0.03em",
                }}
              >
                Sign in to your account
              </h1>

              <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 28px", textAlign: "center" }}>
                Or{" "}
                <Link
                  to="/signup"
                  style={{ color: "#498BEB", textDecoration: "underline", textUnderlineOffset: 3, fontWeight: 500 }}
                >
                  create a new account
                </Link>
              </p>

              <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelEl}>Email Address</label>
                  <div style={fieldWrap("email")}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                    <input
                      type="email"
                      autoComplete="email"
                      required
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      onFocus={() => setFocusedField("email")}
                      onBlur={() => setFocusedField(null)}
                      style={inputEl}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={labelEl}>Password</label>
                  <div style={fieldWrap("password")}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                    <input
                      type={showPw ? "text" : "password"}
                      autoComplete="current-password"
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onFocus={() => setFocusedField("password")}
                      onBlur={() => setFocusedField(null)}
                      style={inputEl}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw((v) => !v)}
                      tabIndex={-1}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#94a3b8", padding: 0, display: "flex", alignItems: "center" }}
                    >
                      {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#475569" }}>
                    <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 16, height: 16, accentColor: "#498BEB", cursor: "pointer" }} />
                    Remember me
                  </label>
                  <button
                    type="button"
                    onClick={() => { setForgotMode(true); setForgotEmail(email); }}
                    style={{ fontSize: 13, fontWeight: 500, color: "#498BEB", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}
                  >
                    Forgot password?
                  </button>
                </div>

                {error && (
                  <div style={{ marginBottom: 14, padding: "10px 14px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, fontSize: 13, color: "#b91c1c" }}>
                    {error}
                  </div>
                )}

                <button type="submit" disabled={loading} style={{ ...btn, opacity: loading ? 0.72 : 1 }}>
                  {loading
                    ? <><Loader2 size={16} className="animate-spin" />Signing in…</>
                    : <><span>Sign In</span><ArrowRight size={17} /></>
                  }
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="pf-h1" style={{ fontSize: 24, fontWeight: 700, color: "#0f172a", margin: "0 0 8px", textAlign: "center", letterSpacing: "-0.03em" }}>
                Reset your password
              </h1>
              <p style={{ fontSize: 14, color: "#64748b", margin: "0 0 28px", textAlign: "center" }}>
                Enter your email and we'll send a reset link.
              </p>

              <div>
                {forgotMsg ? (
                  <div style={{ padding: "14px 16px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)", borderRadius: 10, fontSize: 14, color: "#1e40af", marginBottom: 20 }}>
                    {forgotMsg}
                  </div>
                ) : (
                  <form onSubmit={handleForgot} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                    <div>
                      <label style={labelEl}>Email Address</label>
                      <div style={fieldWrap("forgotEmail")}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                        </svg>
                        <input
                          type="email"
                          autoComplete="email"
                          required
                          placeholder="Enter your email address"
                          value={forgotEmail}
                          onChange={(e) => setForgotEmail(e.target.value)}
                          onFocus={() => setFocusedField("forgotEmail")}
                          onBlur={() => setFocusedField(null)}
                          style={inputEl}
                        />
                      </div>
                    </div>
                    <button type="submit" disabled={forgotLoading} style={{ ...btn, opacity: forgotLoading ? 0.72 : 1 }}>
                      {forgotLoading
                        ? <><Loader2 size={16} className="animate-spin" />Sending…</>
                        : <><span>Send reset link</span><ArrowRight size={17} /></>
                      }
                    </button>
                  </form>
                )}
                <button
                  onClick={() => { setForgotMode(false); setForgotMsg(""); setForgotEmail(""); }}
                  style={{ marginTop: 18, width: "100%", textAlign: "center", fontSize: 13, color: "#64748b", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline", textUnderlineOffset: 3 }}
                >
                  ← Back to sign in
                </button>
              </div>
            </>
          )}
        </div>

        <p style={{ marginTop: 24, fontSize: 12, color: "rgba(255,255,255,0.55)", textAlign: "center", textShadow: "0 1px 4px rgba(0,10,60,0.25)" }}>
          © 2026 ProviderFlo PTY LTD. All rights reserved.
        </p>
      </div>
    </div>
  );
}
