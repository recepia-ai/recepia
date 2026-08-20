import { z } from "zod";

export const channelSchema = z.enum(["web", "whatsapp", "phone"]);

const baseEventSchema = z.object({
  clinicId: z.string().uuid(),
  channel: channelSchema,
  provider: z.string().trim().min(1),
  eventId: z.string().trim().min(1),
  externalThreadId: z.string().trim().min(1),
  occurredAt: z.string().datetime({ offset: true }),
  contact: z.object({
    externalId: z.string().trim().min(1),
    phone: z.string().trim().min(1).optional(),
    displayName: z.string().trim().min(1).optional(),
  }),
});

export const inboundChannelEventSchema = z.discriminatedUnion("type", [
  baseEventSchema.extend({
    type: z.literal("message.received"),
    externalMessageId: z.string().trim().min(1),
    content: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("text"), text: z.string().min(1) }),
      z.object({
        kind: z.literal("audio"),
        mediaId: z.string().trim().min(1),
        mimeType: z.string().trim().min(1),
        transcript: z.string().optional(),
      }),
      z.object({
        kind: z.literal("attachment"),
        mediaId: z.string().trim().min(1),
        mimeType: z.string().trim().min(1),
        filename: z.string().optional(),
        caption: z.string().optional(),
      }),
    ]),
  }),
  baseEventSchema.extend({
    type: z.literal("call.started"),
    externalCallId: z.string().trim().min(1),
    direction: z.enum(["inbound", "outbound"]),
    from: z.string().trim().min(1),
    to: z.string().trim().min(1),
  }),
  baseEventSchema.extend({
    type: z.literal("call.transcript"),
    externalCallId: z.string().trim().min(1),
    speaker: z.enum(["client", "agent", "human"]),
    text: z.string().min(1),
    isFinal: z.boolean(),
  }),
  baseEventSchema.extend({
    type: z.literal("call.ended"),
    externalCallId: z.string().trim().min(1),
    outcome: z.enum(["completed", "failed", "missed", "transferred"]),
    durationSeconds: z.number().int().nonnegative().optional(),
    recordingUrl: z.string().url().optional(),
  }),
]);

export const outboundMessageSchema = z.object({
  clinicId: z.string().uuid(),
  conversationId: z.string().uuid(),
  channel: channelSchema,
  externalThreadId: z.string().trim().min(1),
  idempotencyKey: z.string().trim().min(1),
  content: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("text"), text: z.string().min(1) }),
    z.object({
      kind: z.literal("audio"),
      storagePath: z.string().trim().min(1),
      mimeType: z.string().trim().min(1),
    }),
  ]),
});

export type Channel = z.infer<typeof channelSchema>;
export type InboundChannelEvent = z.infer<typeof inboundChannelEventSchema>;
export type OutboundMessage = z.infer<typeof outboundMessageSchema>;

export type SendResult = {
  externalMessageId: string;
  acceptedAt: string;
};

export interface ChannelAdapter {
  readonly channel: Channel;
  readonly provider: string;
  parseInbound(payload: unknown, headers: Headers): Promise<InboundChannelEvent[]>;
  send(message: OutboundMessage): Promise<SendResult>;
}
