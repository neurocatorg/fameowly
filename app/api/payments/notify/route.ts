import { NextRequest, NextResponse } from "next/server";
import { getPluginRoute } from "@/lib/plugins";

/** Acquirer webhook: public in middleware, the plugin verifies the signature. */

export async function POST(req: NextRequest) {
  const handler = getPluginRoute("payments-notify", "POST");
  if (!handler) return NextResponse.json({ error: "Plugin not available" }, { status: 404 });
  return handler(req);
}
