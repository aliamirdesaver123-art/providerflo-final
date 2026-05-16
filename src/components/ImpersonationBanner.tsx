import { useAuth } from "@/context/AuthContext";

export default function ImpersonationBanner() {
  const { user, logout } = useAuth();
  if (!(user as any)?._impersonating) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium shadow-lg">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 bg-amber-900/60 rounded-full animate-pulse" />
        <span>
          You are acting as <strong>{user?.email}</strong> — impersonation session by {(user as any)._adminEmail}
        </span>
      </div>
      <button
        onClick={logout}
        className="ml-4 px-3 py-1 bg-amber-900/20 hover:bg-amber-900/40 rounded-md text-xs font-semibold transition-colors"
      >
        End session
      </button>
    </div>
  );
}
