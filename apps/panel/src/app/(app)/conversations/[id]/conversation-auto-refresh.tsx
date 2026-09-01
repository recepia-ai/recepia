"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

const POLL_INTERVAL_MS = 3_000;

export function ConversationAutoRefresh({
  conversationId,
  initialVersion,
}: {
  conversationId: string;
  initialVersion: string;
}) {
  const router = useRouter();
  const currentVersion = useRef(initialVersion);

  useEffect(() => {
    currentVersion.current = initialVersion;
    let stopped = false;
    let requestInFlight = false;

    const checkForChanges = async () => {
      if (stopped || requestInFlight || document.visibilityState !== "visible") return;
      requestInFlight = true;
      try {
        const response = await fetch(`/api/conversations/${conversationId}/version`, {
          cache: "no-store",
        });
        if (!response.ok) return;
        const body = (await response.json()) as { version?: string };
        if (body.version && body.version !== currentVersion.current) {
          currentVersion.current = body.version;
          router.refresh();
        }
      } catch {
        // A transient network failure must never break the conversation UI.
      } finally {
        requestInFlight = false;
      }
    };

    const timer = window.setInterval(checkForChanges, POLL_INTERVAL_MS);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkForChanges();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [conversationId, initialVersion, router]);

  return null;
}
