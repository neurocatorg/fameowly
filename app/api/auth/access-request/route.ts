import { NextRequest, NextResponse } from "next/server";
import { getPluginRoute } from "@/lib/plugins";

/** Public: delegates the access request form of the login page to a plugin. */
export async function POST(req: NextRequest) {
  const handler = getPluginRoute("access-request", "POST");
  if (!handler) return NextResponse.json({ error: "Plugin not available" }, { status: 404 });
  return handler(req);
}
