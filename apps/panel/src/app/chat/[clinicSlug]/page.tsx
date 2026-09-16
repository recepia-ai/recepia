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
    .select("name, slug, status, phone")
    .eq("slug", clinicSlug)
    .maybeSingle();

  if (clinic?.status !== "active") notFound();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-emerald-50/60 p-4">
      <ChatWidget clinicSlug={clinic.slug} clinicName={clinic.name} clinicPhone={clinic.phone} />
    </main>
  );
}
