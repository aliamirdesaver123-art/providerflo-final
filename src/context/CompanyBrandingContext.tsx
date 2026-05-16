import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { fetchWithAuthJson } from "@/lib/fetchWithAuth";
import { useAuth } from "@/context/AuthContext";
import {
  type BusinessProfileDTO,
  emptyBusinessProfile,
} from "@/types/businessProfile";

type CompanyBrandingContextValue = {
  branding: BusinessProfileDTO;
  loading: boolean;
  reloadBranding: () => Promise<void>;
  setBrandingFromProfile: (profile: BusinessProfileDTO) => void;
};

const CompanyBrandingContext = createContext<CompanyBrandingContextValue | null>(null);

export function CompanyBrandingProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [branding, setBranding] = useState<BusinessProfileDTO>(emptyBusinessProfile);
  const [loading, setLoading] = useState(true);

  const reloadBranding = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchWithAuthJson<BusinessProfileDTO>("/api/org/settings");
      setBranding({ ...emptyBusinessProfile, ...data });
    } catch {
      // Silently keep current branding on failure
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    reloadBranding().catch(() => setLoading(false));
  }, [reloadBranding, isAuthenticated]);

  const value = useMemo(
    () => ({
      branding,
      loading,
      reloadBranding,
      setBrandingFromProfile: setBranding,
    }),
    [branding, loading, reloadBranding]
  );

  return (
    <CompanyBrandingContext.Provider value={value}>
      {children}
    </CompanyBrandingContext.Provider>
  );
}

export function useCompanyBranding() {
  const ctx = useContext(CompanyBrandingContext);
  if (!ctx) {
    throw new Error("useCompanyBranding must be used inside CompanyBrandingProvider");
  }
  return ctx;
}
