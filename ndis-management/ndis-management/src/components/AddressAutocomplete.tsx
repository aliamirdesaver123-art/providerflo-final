import { MapPin, X, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface StructuredAddress {
  formattedAddress: string;
  address: string;
  suburb: string;
  state: string;
  postcode: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
}

interface Prediction {
  display: string;
  value: string;
  placeId?: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  onStructuredChange?: (data: StructuredAddress) => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onStructuredChange,
  placeholder = "Search for an address…",
  className,
}: Props) {
  const [query, setQuery] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [open, setOpen] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const search = useCallback((text: string) => {
    setQuery(text);
    onChange(text);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (text.length < 2) {
      setPredictions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    timeoutRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem("pf_token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const r = await fetch(`/api/places-autocomplete?q=${encodeURIComponent(text)}`, { headers });
        if (r.ok) {
          const data: Prediction[] = await r.json();
          setPredictions(data);
          setOpen(data.length > 0);
        }
      } catch {
      } finally {
        setLoading(false);
      }
    }, 300);
  }, [onChange]);

  const select = async (p: Prediction) => {
    setQuery(p.value);
    onChange(p.value);
    setPredictions([]);
    setOpen(false);

    if (onStructuredChange && p.placeId) {
      setResolving(true);
      try {
        const token = localStorage.getItem("pf_token");
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const r = await fetch(`/api/places-details?placeId=${encodeURIComponent(p.placeId)}`, { headers });
        if (r.ok) {
          const data: StructuredAddress = await r.json();
          onStructuredChange(data);
        }
      } catch {
      } finally {
        setResolving(false);
      }
    }
  };

  const clear = () => {
    setQuery("");
    onChange("");
    setPredictions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div className="relative">
        <Input
          value={query}
          onChange={e => search(e.target.value)}
          onFocus={() => predictions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="pr-8"
          autoComplete="off"
        />
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {(loading || resolving) && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          {query && !loading && !resolving && (
            <button type="button" onClick={clear} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {open && predictions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-xl border border-border bg-white shadow-lg overflow-hidden">
          {predictions.map((p, i) => (
            <button
              key={p.placeId ?? i}
              type="button"
              onMouseDown={e => { e.preventDefault(); select(p); }}
              className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0"
            >
              <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
              <span className="text-sm text-foreground leading-snug">{p.value}</span>
            </button>
          ))}
          <div className="px-3 py-1.5 flex items-center justify-end gap-1 bg-muted/30 border-t border-border/40">
            <span className="text-[10px] text-muted-foreground">Powered by</span>
            <span className="text-[10px] font-semibold text-muted-foreground">Google Maps</span>
          </div>
        </div>
      )}
    </div>
  );
}
