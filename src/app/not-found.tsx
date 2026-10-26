import type { Metadata } from "next";
import Link from "next/link";
import { TopBar } from "@/components/TopBar";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <>
      <TopBar />
      <main className="wrap legal not-found">
        <p className="mono mu">404 · Cut from the final edit</p>
        <h1 className="disp">This scene isn&apos;t in the trailer</h1>
        <p className="mu">The page you were after has moved or never existed. The good bits are back on the home page.</p>
        <p className="not-found-links">
          <Link href="/" className="btn btn-primary">Back to Trailerly</Link>
          <Link href="/#before-after" className="btn btn-ghost">See an example</Link>
        </p>
      </main>
    </>
  );
}
