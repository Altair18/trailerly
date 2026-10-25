// Inline stroke icons (Lucide-style, 24px grid) used across the app.
const base = { fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round" } as const;

export const Up = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2.2" aria-hidden="true" {...base}><path d="m6 15 6-6 6 6" /></svg>
);
export const Down = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" strokeWidth="2.2" aria-hidden="true" {...base}><path d="m6 9 6 6 6-6" /></svg>
);
export const Close = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" strokeWidth={size < 14 ? 3 : 2.2} aria-hidden="true" {...base}><path d="M18 6 6 18M6 6l12 12" /></svg>
);
export const LinkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" strokeWidth="1.8" aria-hidden="true" {...base}><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /></svg>
);
