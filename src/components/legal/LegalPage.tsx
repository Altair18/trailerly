import Link from "next/link";
import { TopBar } from "@/components/TopBar";

/** Shared shell for the privacy and terms pages: top bar, a readable column, and a back link. */
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <main className="wrap legal">
        <h1 className="disp">{title}</h1>
        <p className="mu">Last updated {updated}</p>
        {children}
        <p style={{ marginTop: 40 }}>
          <Link href="/">Back to Trailerly</Link>
        </p>
      </main>
    </>
  );
}

/** Where people can reach us. Set this before the pages go public; the sentence is hidden while it's null. */
export const CONTACT_EMAIL: string | null = null;

export function ContactLine() {
  if (!CONTACT_EMAIL) return null;
  return (
    <p>
      Questions? Email <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
    </p>
  );
}
