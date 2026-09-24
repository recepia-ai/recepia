export type ChannelEventClaimAction = "reuse" | "retry";

export function channelEventClaimAction(status: string): ChannelEventClaimAction {
  return status === "failed" ? "retry" : "reuse";
}
