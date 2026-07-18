export default function BackButton({ onClick, label = "Kembali", className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`fixed top-3 left-3 z-40 flex items-center gap-1.5 bg-panel/80 backdrop-blur-sm border border-line rounded-full pl-2.5 pr-3 py-2 text-sm text-parchment/80 hover:text-parchment hover:border-shield/60 active:scale-95 transition ${className}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M15 18l-6-6 6-6" />
      </svg>
      <span className="hidden sm:inline font-display">{label}</span>
    </button>
  );
}
