"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  profileSchema,
  type ProfileFormValues,
} from "./profile-schema";
import { updateProfile } from "./profile-actions";

type Props = {
  displayName: string | null;
  email: string;
};

export function ProfileForm({ displayName, email }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isDirty, errors },
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { display_name: displayName ?? "" },
  });

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("display_name", data.display_name);
      const result = await updateProfile({}, formData);

      if (result.success) {
        toast.success("Perfil actualizado");
        reset({ display_name: data.display_name });
      } else if (result.error) {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
      <div className="mb-5">
        <h3 className="text-sm font-semibold text-stone-900">
          Información personal
        </h3>
        <p className="mt-0.5 text-xs text-stone-500">
          Esta información aparece en la barra lateral y en notificaciones.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Display name */}
        <div className="space-y-1.5">
          <Label htmlFor="display_name" className="text-sm text-stone-700">
            Nombre completo
          </Label>
          <Input
            id="display_name"
            {...register("display_name")}
            placeholder="Tu nombre"
            aria-invalid={errors.display_name ? true : undefined}
          />
          {errors.display_name && (
            <p className="text-xs text-destructive">
              {errors.display_name.message}
            </p>
          )}
        </div>

        {/* Email (read-only) */}
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm text-stone-700">
            Email
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            disabled
            className="bg-stone-50 text-stone-500"
          />
          <p className="text-xs text-stone-400">
            El email no se puede cambiar desde aquí.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-2">
          {isDirty && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => reset()}
            >
              Cancelar
            </Button>
          )}
          <Button
            type="submit"
            size="sm"
            disabled={!isDirty || isSubmitting}
            variant={isDirty ? "default" : "outline"}
          >
            {isSubmitting ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </div>
  );
}
