import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/app/(app)/_components/status-badge";
import { CategoryBadge } from "@/app/(app)/_components/category-badge";
import { relativeTime } from "./relative-time";
import type { Database } from "@recepia/db";

type ConversationRow = {
  id: string;
  client_name: string | null;
  client_phone: string | null;
  pet_name: string | null;
  status: Database["public"]["Enums"]["conversation_status"];
  category: Database["public"]["Enums"]["conversation_category"] | null;
  message_count: number;
  last_message_at: string | null;
};

type Props = {
  conversations: ConversationRow[];
};

export function ConversationsTable({ conversations }: Props) {
  if (conversations.length === 0) return null;

  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-stone-100 bg-stone-50 hover:bg-stone-50">
            <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-stone-500">
              Cliente
            </TableHead>
            <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-stone-500">
              Mascota
            </TableHead>
            <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-stone-500">
              Estado
            </TableHead>
            <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-stone-500">
              Categoría
            </TableHead>
            <TableHead className="px-6 py-3 text-xs font-medium uppercase tracking-wider text-stone-500">
              Mensajes
            </TableHead>
            <TableHead className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-stone-500">
              Última actividad
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {conversations.map((conv) => (
            <TableRow
              key={conv.id}
              className="border-stone-100 transition-colors hover:bg-stone-50/50"
            >
              <TableCell className="px-6 py-4 text-sm text-stone-900">
                {conv.client_name ?? conv.client_phone ?? "Sin nombre"}
              </TableCell>
              <TableCell className="px-6 py-4 text-sm text-stone-600">
                {conv.pet_name ?? "—"}
              </TableCell>
              <TableCell className="px-6 py-4">
                <StatusBadge status={conv.status} />
              </TableCell>
              <TableCell className="px-6 py-4">
                {conv.category ? (
                  <CategoryBadge category={conv.category} />
                ) : (
                  <span className="text-xs text-stone-400">—</span>
                )}
              </TableCell>
              <TableCell className="px-6 py-4 text-sm tabular-nums text-stone-600">
                {conv.message_count}
              </TableCell>
              <TableCell className="px-6 py-4 text-right text-sm text-stone-500 tabular-nums">
                {conv.last_message_at
                  ? relativeTime(conv.last_message_at)
                  : "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
