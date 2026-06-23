"use client";

import { useForm, Controller } from "react-hook-form";
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
  clinicSchema,
  type ClinicFormValues,
} from "./clinic-schema";
import { updateClinic } from "./clinic-actions";

// ---------------------------------------------------------------------------
// Options for selects
// ---------------------------------------------------------------------------

const COUNTRY_OPTIONS: { value: string; label: string }[] = [
  { value: "ES", label: "España" },
  { value: "PT", label: "Portugal" },
  { value: "FR", label: "Francia" },
  { value: "AD", label: "Andorra" },
];

const LOCALE_OPTIONS: { value: string; label: string }[] = [
  { value: "es-ES", label: "Español de España" },
  { value: "ca-ES", label: "Català" },
  { value: "en-GB", label: "English UK" },
];

const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "Europe/Madrid", label: "Madrid (CET/CEST)" },
  { value: "Atlantic/Canary", label: "Canarias (WET/WEST)" },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  defaultValues: ClinicFormValues;
  readOnly?: boolean;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ClinicForm({ defaultValues, readOnly = false }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { isDirty, errors },
  } = useForm<ClinicFormValues>({
    resolver: zodResolver(clinicSchema),
    defaultValues,
  });

  const onSubmit = async (data: ClinicFormValues) => {
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      for (const [key, value] of Object.entries(data)) {
        formData.set(key, value ?? "");
      }
      const result = await updateClinic({}, formData);

      if (result.success) {
        toast.success("Clínica actualizada");
        reset(data);
      } else if (result.error) {
        toast.error(result.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // -----------------------------------------------------------------------
  // RHF register for Controlled select: register onChange/onBlur/name/ref
  // but value is managed by the Controller.
  // -----------------------------------------------------------------------

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* ============================================================= */}
      {/* Card 1: Identidad                                              */}
      {/* ============================================================= */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-stone-900">Identidad</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Nombre comercial y datos legales de la clínica.
          </p>
        </div>

        <div className="space-y-4">
          {/* name (requerido) */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm text-stone-700">
              Nombre comercial
            </Label>
            <Input
              id="name"
              {...register("name")}
              disabled={readOnly}
              aria-invalid={errors.name ? true : undefined}
            />
            {errors.name && (
              <p className="text-xs text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>

          {/* legal_name */}
          <div className="space-y-1.5">
            <Label htmlFor="legal_name" className="text-sm text-stone-700">
              Razón social
            </Label>
            <Input
              id="legal_name"
              {...register("legal_name")}
              placeholder="S.L., S.A., etc."
              disabled={readOnly}
            />
            {errors.legal_name && (
              <p className="text-xs text-destructive">
                {errors.legal_name.message}
              </p>
            )}
          </div>

          {/* tax_id */}
          <div className="space-y-1.5">
            <Label htmlFor="tax_id" className="text-sm text-stone-700">
              CIF / NIF
            </Label>
            <Input
              id="tax_id"
              {...register("tax_id")}
              placeholder="B12345678"
              disabled={readOnly}
            />
            {errors.tax_id && (
              <p className="text-xs text-destructive">
                {errors.tax_id.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* Card 2: Contacto                                               */}
      {/* ============================================================= */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-stone-900">Contacto</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Email y teléfono públicos de la clínica.
          </p>
        </div>

        <div className="space-y-4">
          {/* email */}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-sm text-stone-700">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              {...register("email")}
              placeholder="clinica@ejemplo.com"
              disabled={readOnly}
              aria-invalid={errors.email ? true : undefined}
            />
            {errors.email && (
              <p className="text-xs text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>

          {/* phone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone" className="text-sm text-stone-700">
              Teléfono
            </Label>
            <Input
              id="phone"
              {...register("phone")}
              placeholder="+34 977 123 456"
              disabled={readOnly}
              aria-invalid={errors.phone ? true : undefined}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">
                {errors.phone.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* Card 3: Dirección                                              */}
      {/* ============================================================= */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-stone-900">Dirección</h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Dirección postal de la clínica.
          </p>
        </div>

        <div className="space-y-4">
          {/* address_street (full width) */}
          <div className="space-y-1.5">
            <Label htmlFor="address_street" className="text-sm text-stone-700">
              Calle / Vía
            </Label>
            <Input
              id="address_street"
              {...register("address_street")}
              disabled={readOnly}
            />
          </div>

          {/* address_city + address_postal_code (2 cols) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="address_city" className="text-sm text-stone-700">
                Ciudad
              </Label>
              <Input
                id="address_city"
                {...register("address_city")}
                disabled={readOnly}
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="address_postal_code"
                className="text-sm text-stone-700"
              >
                Código postal
              </Label>
              <Input
                id="address_postal_code"
                {...register("address_postal_code")}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* address_country (select) */}
          <div className="space-y-1.5">
            <Label htmlFor="address_country" className="text-sm text-stone-700">
              País
            </Label>
            <Controller
              name="address_country"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={readOnly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un país" />
                  </SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.address_country && (
              <p className="text-xs text-destructive">
                {errors.address_country.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* Card 4: Configuración regional                                 */}
      {/* ============================================================= */}
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-card">
        <div className="mb-5">
          <h3 className="text-sm font-semibold text-stone-900">
            Configuración regional
          </h3>
          <p className="mt-0.5 text-xs text-stone-500">
            Idioma y zona horaria de la clínica.
          </p>
        </div>

        <div className="space-y-4">
          {/* locale (select) */}
          <div className="space-y-1.5">
            <Label htmlFor="locale" className="text-sm text-stone-700">
              Idioma
            </Label>
            <Controller
              name="locale"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={readOnly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona un idioma" />
                  </SelectTrigger>
                  <SelectContent>
                    {LOCALE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.locale && (
              <p className="text-xs text-destructive">
                {errors.locale.message}
              </p>
            )}
          </div>

          {/* timezone (select) */}
          <div className="space-y-1.5">
            <Label htmlFor="timezone" className="text-sm text-stone-700">
              Zona horaria
            </Label>
            <Controller
              name="timezone"
              control={control}
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={readOnly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona zona horaria" />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.timezone && (
              <p className="text-xs text-destructive">
                {errors.timezone.message}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================= */}
      {/* Footer: Cancelar + Guardar                                     */}
      {/* ============================================================= */}
      {!readOnly && (
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
      )}
    </form>
  );
}
