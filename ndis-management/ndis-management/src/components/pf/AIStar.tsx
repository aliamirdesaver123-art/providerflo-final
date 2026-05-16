export function AIStar({ className = "", size = 18 }: { className?: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={`pf-ai-star ${className}`} aria-hidden="true">
      <path d="M32 4c2.3 14.7 12.9 25.3 28 28-15.1 2.7-25.7 13.3-28 28C29.7 45.3 19.1 34.7 4 32 19.1 29.3 29.7 18.7 32 4Z" />
      <path d="M13 7c1 6.3 5.5 10.8 12 12-6.5 1.2-11 5.7-12 12C12 24.7 7.5 20.2 1 19c6.5-1.2 11-5.7 12-12Z" opacity=".82" />
      <path d="M52 42c.9 5.6 4.9 9.6 10 10-5.1 1.1-9.1 5.1-10 10-.9-4.9-4.9-8.9-10-10 5.1-.4 9.1-4.4 10-10Z" opacity=".82" />
    </svg>
  );
}
