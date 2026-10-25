import { RecordingUpload } from "./RecordingUpload";

export default async function RecordingPage({ params }: { params: Promise<{ packId: string }> }) {
  return <RecordingUpload packId={(await params).packId} />;
}
