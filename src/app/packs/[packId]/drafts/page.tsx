import { Drafts } from "./Drafts";

export default async function DraftsPage({ params }: { params: Promise<{ packId: string }> }) {
  return <Drafts packId={(await params).packId} />;
}
