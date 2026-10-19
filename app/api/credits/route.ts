import { NextRequest, NextResponse } from "next/server";
import { getPluginRoute } from "@/lib/plugins";

/** Delegates credit balances and settings to the billing plugin. */

async function delegate(req: NextRequest, method: string) {
  const handler = getPluginRoute("credits", method);
  if (!handler) return NextResponse.json({ error: "Plugin not available" }, { status: 404 });
  return handler(req);
}

export async function GET(req: NextRequest) {
  return delegate(req, "GET");
}

export async function PUT(req: NextRequest) {
  return delegate(req, "PUT");
}

export async function POST(req: NextRequest) {
  return delegate(req, "POST");
}
