import { NextResponse } from "next/server";
import { secureEqual } from "@/lib/channels/webhook-security";
import { processGestorVetOutbox } from "@/lib/gestorvet/outbox";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "Worker is not configured" }, { status: 503 });
  }

  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  if (!secureEqual(supplied, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await processGestorVetOutbox();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Worker execution failed" }, { status: 500 });
  }
}
