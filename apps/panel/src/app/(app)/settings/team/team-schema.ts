import { z } from "zod";

export const inviteMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email no válido"),
  role: z.enum(["admin", "recepcion", "veterinario"]),
  display_name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(60, "Máximo 60 caracteres")
    .optional()
    .or(z.literal("")),
});

export type InviteMemberValues = z.infer<typeof inviteMemberSchema>;

export type InviteMemberState = {
  success?: boolean;
  error?: string;
  invitation_id?: string;
};

// Schema para aceptar invitación (página pública)
export const acceptInvitationSchema = z.object({
  token: z.string().min(10, "Token inválido"),
  display_name: z
    .string()
    .trim()
    .min(2, "Mínimo 2 caracteres")
    .max(60, "Máximo 60 caracteres"),
});

export type AcceptInvitationValues = z.infer<typeof acceptInvitationSchema>;

export type AcceptInvitationState = {
  success?: boolean;
  error?: string;
};

// Schema para cambiar rol de miembro
export const updateMemberRoleSchema = z.object({
  member_id: z.string().uuid("ID inválido"),
  new_role: z.enum(["admin", "recepcion", "veterinario"]),
});

export type UpdateMemberRoleValues = z.infer<typeof updateMemberRoleSchema>;
export type UpdateMemberRoleState = { success?: boolean; error?: string };

// Schema para eliminar miembro
export const removeMemberSchema = z.object({
  member_id: z.string().uuid("ID inválido"),
});

export type RemoveMemberValues = z.infer<typeof removeMemberSchema>;
export type RemoveMemberState = { success?: boolean; error?: string };
