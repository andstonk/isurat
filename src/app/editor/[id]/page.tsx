import { SubtitleEditor } from "@/components/subtitle-editor";

export default async function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  return <SubtitleEditor videoId={(await params).id} />;
}