import { z } from "zod";
import { uuidSchema } from "@/lib/uuid-schema";

export const sendMessageSchema = z.object({
  conversation_id: uuidSchema,
  content: z
    .string()
    .trim()
    .min(1, "Mensaje vacío")
    .max(2000, "Máximo 2000 caracteres"),
});

export type SendMessageValues = z.infer<typeof sendMessageSchema>;
export type SendMessageState = { success?: boolean; error?: string };

export const takeControlSchema = z.object({
  conversation_id: uuidSchema,
});

export type TakeControlValues = z.infer<typeof takeControlSchema>;
export type TakeControlState = { success?: boolean; error?: string };

export const returnToAgentSchema = z.object({
  conversation_id: uuidSchema,
});

export type ReturnToAgentValues = z.infer<typeof returnToAgentSchema>;
export type ReturnToAgentState = { success?: boolean; error?: string };
