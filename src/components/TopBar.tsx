import Link from "next/link";

export const PACK_STEPS = ["Link", "Recording", "Brief", "Hooks", "Drafts", "Rules", "Pay", "Download"] as const;
export type PackStep = (typeof PACK_STEPS)[number];

export function Logo() {
  return (
    <Link href="/" className="logo" aria-label="Trailerly home">
      <span className="logo-mark">
        <svg width="10" height="10" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 3v18l15-9z" fill="#0A0A0E" />
        </svg>
      </span>
      <span className="disp" style={{ fontSize: 25 }}>trailerly</span>
    </Link>
  );
}

/** Sticky header with the logo and, inside a pack, the 8 journey steps. */
export function TopBar({ step }: { step?: PackStep }) {
  const current = step ? PACK_STEPS.indexOf(step) : -1;
  return (
    <header className="topbar">
      <div className="wrap">
        <Logo />
        {step && (
          <nav aria-label="Pack steps" style={{ flex: "1 1 640px", minWidth: 0 }}>
            <ol className="steps">
              {PACK_STEPS.map((label, i) => (
                <li key={label}>
                  <span
                    className={i < current ? "done" : i === current ? "cur" : undefined}
                    aria-current={i === current ? "step" : undefined}
                  >
                    <span className="n">{i < current ? "✓" : i + 1}</span>
                    {label}
                  </span>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </div>
    </header>
  );
}
