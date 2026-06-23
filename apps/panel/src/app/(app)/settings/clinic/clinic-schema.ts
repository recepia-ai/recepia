import { z } from "zod";

// Validaciones específicas españolas pero permisivas (cliente puede ser empresa extranjera futura)
const taxIdSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(8, "Mínimo 8 caracteres")
  .max(15, "Máximo 15 caracteres")
  .optional()
  .or(z.literal(""));

const phoneSchema = z
  .string()
  .trim()
  .regex(/^[+0-9\s()-]+$/, "Solo números, +, espacios y guiones")
  .min(7, "Teléfono demasiado corto")
  .max(20, "Teléfono demasiado largo")
  .optional()
  .or(z.literal(""));

const emailSchema = z
  .string()
  .trim()
  .email("Email no válido")
  .optional()
  .or(z.literal(""));

const postalCodeSchema = z
  .string()
  .trim()
  .max(10, "Código postal demasiado largo")
  .optional()
  .or(z.literal(""));

// Países soportados para address_country
const countrySchema = z
  .string()
  .trim()
  .length(2, "Código país de 2 letras")
  .optional()
  .or(z.literal("ES"));

// Locale y timezone: string para evitar conflictos de tipo con zodResolver
const localeSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal("es-ES"));

const timezoneSchema = z
  .string()
  .trim()
  .optional()
  .or(z.literal("Europe/Madrid"));

export const clinicSchema = z.object({
  // Identidad
  name: z
    .string()
    .trim()
    .min(2, "Nombre demasiado corto")
    .max(100, "Máximo 100 caracteres"),
  legal_name: z
    .string()
    .trim()
    .max(150, "Máximo 150 caracteres")
    .optional()
    .or(z.literal("")),
  tax_id: taxIdSchema,

  // Contacto
  email: emailSchema,
  phone: phoneSchema,

  // Dirección
  address_street: z
    .string()
    .trim()
    .max(200, "Máximo 200 caracteres")
    .optional()
    .or(z.literal("")),
  address_city: z
    .string()
    .trim()
    .max(100, "Máximo 100 caracteres")
    .optional()
    .or(z.literal("")),
  address_postal_code: postalCodeSchema,
  address_country: countrySchema,

  // Configuración regional (select en UI, no input libre)
  locale: localeSchema,
  timezone: timezoneSchema,
});

export type ClinicFormValues = z.infer<typeof clinicSchema>;

export type ClinicFormState = {
  success?: boolean;
  error?: string;
};
