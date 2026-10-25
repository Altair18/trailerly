import { PackReview } from "./PackReview";

// Journey steps 3 and 4 (brief, hooks) for M1. Drafts, rules, payment and download come in later phases.
export default async function PackPage({ params }: { params: Promise<{ packId: string }> }) {
  const { packId } = await params;
  return <PackReview packId={packId} />;
}
