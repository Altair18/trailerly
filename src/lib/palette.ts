// Accent colours and tile gradients from the approved mockup, cycled through lists.
export const ACCENTS = ["#B8F23A", "#38D9FF", "#FFE135", "#FF7A1A", "#9D7BFF", "#FF2E88", "#2EE6A6", "#FF5A4E"];

export const TILE_GRADIENTS = [
  "linear-gradient(135deg,#B8F23A,#2EE6A6)",
  "linear-gradient(135deg,#38D9FF,#9D7BFF)",
  "linear-gradient(135deg,#FFE135,#FF7A1A)",
  "linear-gradient(135deg,#FF2E88,#FF7A1A)",
  "linear-gradient(135deg,#9D7BFF,#FF2E88)",
  "linear-gradient(135deg,#2EE6A6,#38D9FF)",
  "linear-gradient(135deg,#FF5A4E,#FFE135)",
  "linear-gradient(135deg,#FFE135,#B8F23A)",
  "linear-gradient(135deg,#38D9FF,#B8F23A)",
  "linear-gradient(135deg,#FF7A1A,#9D7BFF)",
];

export const accent = (i: number) => ACCENTS[i % ACCENTS.length]!;
export const tile = (i: number) => TILE_GRADIENTS[i % TILE_GRADIENTS.length]!;
