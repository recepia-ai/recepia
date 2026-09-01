import { createClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "No autenticado" }, { status: 401 });

  const { data: membership } = await supabase
    .from("clinic_users")
    .select("clinic_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!membership) return Response.json({ error: "Sin clínica" }, { status: 403 });

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, updated_at, client_id, pet_id")
    .eq("id", id)
    .eq("clinic_id", membership.clinic_id)
    .maybeSingle();
  if (conversationError) {
    return Response.json({ error: "No se pudo comprobar la conversación" }, { status: 500 });
  }
  if (!conversation) return Response.json({ error: "Conversación no encontrada" }, { status: 404 });

  const { data: latestMessage, error: messageError } = await supabase
    .from("messages")
    .select("id, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (messageError) {
    return Response.json({ error: "No se pudo comprobar los mensajes" }, { status: 500 });
  }

  const [{ data: client }, { data: pet }, { data: clientPets }] = await Promise.all([
    conversation.client_id
      ? supabase.from("clients").select("updated_at").eq("id", conversation.client_id).maybeSingle()
      : Promise.resolve({ data: null }),
    conversation.pet_id
      ? supabase.from("pets").select("updated_at").eq("id", conversation.pet_id).maybeSingle()
      : Promise.resolve({ data: null }),
    conversation.client_id
      ? supabase
          .from("pets")
          .select("id, updated_at")
          .eq("client_id", conversation.client_id)
          .eq("active", true)
          .is("deleted_at", null)
          .order("id", { ascending: true })
      : Promise.resolve({ data: [] }),
  ]);

  return Response.json(
    {
      version: [
        conversation.updated_at,
        client?.updated_at,
        pet?.updated_at,
        ...(clientPets ?? []).flatMap((clientPet) => [clientPet.id, clientPet.updated_at]),
        latestMessage?.created_at,
        latestMessage?.id,
      ]
        .filter(Boolean)
        .join(":"),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
