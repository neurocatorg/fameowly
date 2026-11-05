import { NextRequest, NextResponse } from "next/server";
import { getPluginRoute } from "@/lib/plugins";

/** Delegates registration settings and access request review to a plugin. */

async function delegate(req: NextRequest, method: string) {
  const handler = getPluginRoute("registration", method);
  if (!handler) return NextResponse.json({ error: "Plugin not available" }, { status: 404 });
  return handler(req);
}

export const GET = (req: NextRequest) => delegate(req, "GET");
export const PUT = (req: NextRequest) => delegate(req, "PUT");
export const PATCH = (req: NextRequest) => delegate(req, "PATCH");
