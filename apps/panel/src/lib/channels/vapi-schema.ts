import { z } from "zod";

const optionalStringSchema = z
  .string()
  .nullish()
  .transform((value) => value ?? undefined);

const partySchema = z
  .object({ number: optionalStringSchema, phoneNumber: optionalStringSchema })
  .passthrough();

const optionalPartySchema = partySchema.nullish().transform((value) => value ?? undefined);

export const vapiWebhookSchema = z.object({
  message: z
    .object({
      type: z.string().min(1),
      timestamp: z
        .union([z.string(), z.number()])
        .nullish()
        .transform((value) => value ?? undefined),
      status: optionalStringSchema,
      endedReason: optionalStringSchema,
      transcript: optionalStringSchema,
      transcriptType: optionalStringSchema,
      role: optionalStringSchema,
      call: z
        .object({
          id: z.string().min(1),
          startedAt: optionalStringSchema,
          endedAt: optionalStringSchema,
          phoneNumberId: optionalStringSchema,
          customer: optionalPartySchema,
          phoneNumber: optionalPartySchema,
        })
        .passthrough(),
      customer: optionalPartySchema,
      phoneNumber: optionalPartySchema,
      artifact: z
        .object({
          transcript: optionalStringSchema,
          recording: z
            .object({
              url: z
                .string()
                .url()
                .nullish()
                .transform((value) => value ?? undefined),
              stereoUrl: z
                .string()
                .url()
                .nullish()
                .transform((value) => value ?? undefined),
            })
            .passthrough()
            .nullish()
            .transform((value) => value ?? undefined),
        })
        .passthrough()
        .nullish()
        .transform((value) => value ?? undefined),
    })
    .passthrough(),
});

export type VapiWebhook = z.infer<typeof vapiWebhookSchema>;
