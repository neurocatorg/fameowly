import { NextRequest, NextResponse } from "next/server";
import { getPluginRoute } from "@/lib/plugins";

/** Delegates payment creation to the payments plugin. */

export async function POST(req: NextRequest) {
  const handler = getPluginRoute("payments", "POST");
  if (!handler) return NextResponse.json({ error: "Plugin not available" }, { status: 404 });
  return handler(req);
}
