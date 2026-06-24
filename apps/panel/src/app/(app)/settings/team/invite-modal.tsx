"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import {
  inviteMemberSchema,
  type InviteMemberValues,
} from "./team-schema";
import { inviteMember } from "./team-actions";

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "admin", label: "Administrador" },
  { value: "recepcion", label: "Recepción" },
  { value: "veterinario", label: "Veterinario" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InviteModal() {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<InviteMemberValues>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: {
      email: "",
      role: "recepcion",
      display_name: "",
    },
  });

  const selectedRole = watch("role");

  const onSubmit = async (data: InviteMemberValues) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("email", data.email);
      formData.set("role", data.role);
      if (data.display_name) formData.set("display_name", data.display_name);

      const result = await inviteMember({}, formData);

      if (result.success) {
        toast.success("Invitación enviada");
        if (result.error) {
          // Partial success — email may have failed
          toast.warning(result.error);
        }
        reset();
        setOpen(false);
      } else if (result.error) {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="size-3.5" strokeWidth={1.75} />
          Invitar miembro
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-stone-900">
            Invitar miembro
          </DialogTitle>
          <DialogDescription className="text-stone-500">
            Envía una invitación por email para unirse a tu clínica.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2">
          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm text-stone-700">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="usuario@ejemplo.com"
              {...register("email")}
              aria-invalid={errors.email ? true : undefined}
            />
            {errors.email && (
              <p className="text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* Role */}
          <div className="space-y-1.5">
            <Label htmlFor="role" className="text-sm text-stone-700">
              Rol
            </Label>
            <Select
              value={selectedRole}
              onValueChange={(value) =>
                setValue("role", value as InviteMemberValues["role"], {
                  shouldValidate: true,
                })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-xs text-destructive">
                {errors.role.message}
              </p>
            )}
          </div>

          {/* Display name (optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="display_name" className="text-sm text-stone-700">
              Nombre visible{" "}
              <span className="text-stone-400">(opcional)</span>
            </Label>
            <Input
              id="display_name"
              placeholder="Dra. Ana García"
              {...register("display_name")}
            />
            {errors.display_name && (
              <p className="text-xs text-destructive">
                {errors.display_name.message}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                reset();
                setOpen(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Enviando…" : "Enviar invitación"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
