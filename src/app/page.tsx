import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Trailerly</h1>
      <p className="muted">
        Paste an App Store link, upload a screen recording, and get one pack of rule-checked videos:
        3 App Store videos and 5 social ads.
      </p>
      <p>
        <Link href="/packs/new">Start a pack</Link>
      </p>
    </main>
  );
}
