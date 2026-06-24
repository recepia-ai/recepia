"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  acceptInvitationSchema,
  type AcceptInvitationValues,
} from "@/app/(app)/settings/team/team-schema";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  token: string;
  defaultDisplayName: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AcceptInvitationForm({
  token,
  defaultDisplayName,
}: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInvitationValues>({
    resolver: zodResolver(acceptInvitationSchema),
    defaultValues: {
      token,
      display_name: defaultDisplayName,
    },
  });

  const onSubmit = async (data: AcceptInvitationValues) => {
    setIsSubmitting(true);
    try {
      // Imported dynamically to ensure it's only loaded on client
      const { acceptInvitation } = await import(
        "@/app/(app)/settings/team/team-actions"
      );

      const formData = new FormData();
      formData.set("token", data.token);
      formData.set("display_name", data.display_name);

      const result = await acceptInvitation({}, formData);

      if (result.success) {
        toast.success("¡Bienvenido al equipo! Redirigiendo al login…");
        setTimeout(() => router.push("/login"), 1500);
      } else if (result.error) {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Hidden token */}
      <input type="hidden" {...register("token")} />

      {/* Display name */}
      <div className="space-y-1.5">
        <Label htmlFor="display_name" className="text-sm text-stone-700">
          Tu nombre
        </Label>
        <Input
          id="display_name"
          placeholder="Dra. Ana García"
          {...register("display_name")}
          aria-invalid={errors.display_name ? true : undefined}
        />
        {errors.display_name && (
          <p className="text-xs text-destructive">
            {errors.display_name.message}
          </p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full"
      >
        {isSubmitting ? "Uniéndote…" : "Unirme a la clínica"}
      </Button>

      <p className="text-center text-xs text-stone-400">
        Al unirte aceptas los términos del servicio.
      </p>
    </form>
  );
}
