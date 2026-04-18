import { ConversationView } from "@/components/conversation-view";

export default async function ChatDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ConversationView chatId={id} />;
}
