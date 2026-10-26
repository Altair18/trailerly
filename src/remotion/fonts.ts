import { useEffect, useState } from "react";
import { continueRender, delayRender, staticFile } from "remotion";

// The brand fonts ship with the app in public/fonts (both are SIL Open Font License), so renders never depend
// on a font host being reachable from the worker, and the Remotion bundle and the in-browser draft player load
// the same files. Both are variable fonts.
const LATIN = "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const LATIN_EXT = "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF";

const FACES: { family: string; url: string; range: string; weight: string; stretch?: string }[] = [
  { family: "Archivo", url: "fonts/archivo-latin.woff2", range: LATIN, weight: "500 900", stretch: "62% 125%" },
  { family: "Archivo", url: "fonts/archivo-latin-ext.woff2", range: LATIN_EXT, weight: "500 900", stretch: "62% 125%" },
  { family: "Geist", url: "fonts/geist-latin.woff2", range: LATIN, weight: "100 900" },
  { family: "Geist", url: "fonts/geist-latin-ext.woff2", range: LATIN_EXT, weight: "100 900" },
];

let loading: Promise<unknown> | undefined;

function loadFaces() {
  loading ??= Promise.all(
    FACES.map(async (f) => {
      const face = new FontFace(f.family, `url(${staticFile(f.url)}) format("woff2")`, {
        weight: f.weight,
        stretch: f.stretch,
        unicodeRange: f.range,
        display: "block",
      });
      document.fonts.add(await face.load());
    }),
  );
  return loading;
}

/** Load the brand fonts once and hold the render until they are ready. */
export function useBrandFonts() {
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    let finished = false;
    const done = () => {
      if (finished) return;
      finished = true;
      continueRender(handle);
    };
    // Fonts are a nicety: never block a render for more than a few seconds on them.
    const timeout = setTimeout(done, 8000);
    void loadFaces()
      .then(() => document.fonts.ready)
      .then(() => clearTimeout(timeout))
      .finally(done);
  }, [handle]);
}
