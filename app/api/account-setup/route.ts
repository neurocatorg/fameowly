import { NextRequest, NextResponse } from "next/server";
import { getPluginRoute } from "@/lib/plugins";

/** Delegates the signed-in user's account setup (consents, mailing flag) to a plugin. */

async function delegate(req: NextRequest, method: string) {
  const handler = getPluginRoute("account-setup", method);
  if (!handler) return NextResponse.json({ error: "Plugin not available" }, { status: 404 });
  return handler(req);
}

export async function GET(req: NextRequest) {
  return delegate(req, "GET");
}

export async function POST(req: NextRequest) {
  return delegate(req, "POST");
}

export async function PATCH(req: NextRequest) {
  return delegate(req, "PATCH");
}
