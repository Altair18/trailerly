// Journey steps 3 to 8 live here as the pack progresses. Each step is a placeholder for now.
export default async function PackPage({ params }: { params: Promise<{ packId: string }> }) {
  const { packId } = await params;
  return (
    <main>
      <h1>Pack</h1>
      <p className="muted">{packId}</p>
      <ol className="steps">
        <li>Review the brief (TODO M1)</li>
        <li>Pick up to 5 hooks and one headline (TODO M1)</li>
        <li>Preview drafts (TODO M2)</li>
        <li>Rules check (TODO M4)</li>
        <li>Pay (TODO M6)</li>
        <li>Download (TODO M4)</li>
      </ol>
    </main>
  );
}
