import { EmptyDetail } from "./_components/empty-detail";

/**
 * /conversations — when no conversation is selected, show the empty detail
 * prompt in the right panel (desktop) or fill the screen (mobile via layout).
 */
export default function ConversationsPage() {
  return <EmptyDetail />;
}
