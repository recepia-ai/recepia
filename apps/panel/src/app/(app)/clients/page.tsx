import { EmptyDetail } from "./_components/empty-detail";

/**
 * /clients — when no client is selected, show the empty detail
 * prompt in the right panel (desktop) or fill the screen (mobile via layout).
 */
export default function ClientsPage() {
  return <EmptyDetail />;
}
