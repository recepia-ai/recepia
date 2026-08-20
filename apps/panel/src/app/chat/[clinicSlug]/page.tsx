import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ChatWidget } from "./chat-widget";

export default async function PublicClinicChatPage({
  params,
}: {
  params: Promise<{ clinicSlug: string }>;
}) {
  const { clinicSlug } = await params;
  const supabaseAdmin = createAdminClient();
  const { data: clinic } = await supabaseAdmin
    .from("clinics")
    .select("name, slug, status")
    .eq("slug", clinicSlug)
    .maybeSingle();

  if (!clinic || clinic.status !== "active") notFound();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-gradient-to-b from-emerald-50 to-stone-100 p-4">
      <ChatWidget clinicSlug={clinic.slug} clinicName={clinic.name} />
    </main>
  );
}
