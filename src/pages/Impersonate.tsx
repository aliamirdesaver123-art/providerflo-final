import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@/context/AuthContext";

export default function Impersonate() {
  const search = useSearch();
  const [, setLocation] = useLocation();
  const { loginWithUserInfo } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(search);
    const token = params.get("token");
    if (!token) { setError("No token provided."); return; }

    fetch(`/api/impersonate/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async res => {
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Invalid token"); }
        return res.json();
      })
      .then(data => {
        // Log in as the target user with an impersonation flag
        loginWithUserInfo({ ...data.user, _impersonating: true, _adminEmail: data.adminEmail });
        setLocation("/");
      })
      .catch(err => setError(err.message ?? "Token validation failed"));
  }, [search]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-red-500 text-lg font-semibold mb-2">Impersonation failed</div>
          <p className="text-gray-600 text-sm">{error}</p>
          <a href="/" className="mt-4 inline-block text-blue-600 text-sm hover:underline">Go home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-gray-600 text-sm">Verifying impersonation token…</p>
      </div>
    </div>
  );
}
