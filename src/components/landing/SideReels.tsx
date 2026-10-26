import { tile } from "@/lib/palette";

// Two slow columns of placeholder tiles in the black gutters beside the hero, on wide screens only.
// Swap the gradients for real render posters once the demo videos exist.

const HOOKS = [
  "Stop guessing when to water",
  "Ideas at 3am, sorted by 9",
  "When is high tide, really?",
  "See where your money goes",
  "Every plant, one reminder",
  "Voice notes become tidy text",
];
const RATIOS = ["9 / 16", "3 / 2", "9 / 16", "21 / 9", "9 / 16", "3 / 2"];

function Reel({ side, offset }: { side: "left" | "right"; offset: number }) {
  const tiles = HOOKS.map((h, k) => ({ h, ratio: RATIOS[(k + offset) % RATIOS.length]!, bg: tile(k + offset) }));
  return (
    <div className={`lp-reel ${side}`}>
      <div className="lp-reel-track">
        {[...tiles, ...tiles].map((t, k) => (
          <div key={k} className="lp-reel-tile" style={{ aspectRatio: t.ratio, backgroundImage: t.bg }}>
            <span className="disp">{t.h}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SideReels() {
  return (
    <div aria-hidden="true">
      <Reel side="left" offset={0} />
      <Reel side="right" offset={3} />
    </div>
  );
}
