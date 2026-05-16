import { ImageIcon } from "lucide-react";
import { useMemo, useState } from "react";

type BrandLogoProps = {
  logoUrl?: string | null;
  brandingVersion?: number;
  alt?: string;
  className?: string;
  fallbackClassName?: string;
};

export function BrandLogo({
  logoUrl,
  brandingVersion,
  alt = "Company logo",
  className = "max-w-full max-h-full object-contain",
  fallbackClassName = "text-slate-400",
}: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  const src = useMemo(() => {
    if (!logoUrl || failed) return "";
    const separator = logoUrl.includes("?") ? "&" : "?";
    const version = brandingVersion || Date.now();
    return `${logoUrl}${separator}v=${version}`;
  }, [logoUrl, brandingVersion, failed]);

  if (!src) {
    return <ImageIcon className={fallbackClassName} />;
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
