import { z } from "zod";

export const profileSchema = z.object({
  display_name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(60, "Máximo 60 caracteres"),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export type ProfileFormState = {
  success?: boolean;
  error?: string;
};
