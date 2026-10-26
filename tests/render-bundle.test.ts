import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { expect, it } from "vitest";

// Remotion bundles the compositions from source on the Trigger.dev worker, so every file they import has to be
// shipped with additionalFiles in trigger.config.ts. A missing one only fails in production ("Can't resolve ...").

const ROOT = process.cwd();

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function resolve(spec: string, from: string): string | null {
  const base = spec.startsWith("@/") ? join(ROOT, "src", spec.slice(2)) : spec.startsWith(".") ? join(dirname(from), spec) : null;
  if (!base) return null;
  for (const c of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts")]) if (existsSync(c) && statSync(c).isFile()) return c;
  throw new Error(`${relative(ROOT, from)} imports ${spec}, which doesn't exist`);
}

/** Every source file the compositions load at runtime (type-only imports are erased, so they don't count). */
function reachable(): string[] {
  const seen = new Set<string>();
  const queue = walk(join(ROOT, "src/remotion")).filter((f) => /\.tsx?$/.test(f));
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const m of readFileSync(file, "utf8").matchAll(/^(import|export)\s+(?!type\s)[^;]*?from\s+["']([^"']+)["']/gm)) {
      const next = resolve(m[2]!, file);
      if (next) queue.push(next);
    }
  }
  return [...seen].map((f) => relative(ROOT, f));
}

it("ships every file the Remotion compositions import to the render worker", () => {
  const config = readFileSync(join(ROOT, "trigger.config.ts"), "utf8");
  const files = [...config.matchAll(/additionalFiles\(\{\s*files:\s*\[([^\]]*)\]/g)].flatMap((m) => [...m[1]!.matchAll(/"\.\/([^"]+)"/g)].map((f) => f[1]!));
  expect(files.length).toBeGreaterThan(0);
  const shipped = (f: string) => files.some((g) => (g.endsWith("/**") ? f.startsWith(g.slice(0, -2)) : f === g));
  expect(reachable().filter((f) => !shipped(f))).toEqual([]);
});
