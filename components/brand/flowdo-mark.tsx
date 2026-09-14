export function FlowDoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" className="fill-primary-container" />
      <path
        d="M9 21.5c2.8 0 4.2-3 4.2-6.5S15.2 9 18 9s4.8 3 4.8 6.5-2 6.5-4.8 6.5"
        stroke="white"
        strokeWidth="2.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}
