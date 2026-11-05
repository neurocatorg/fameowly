import { NextRequest, NextResponse } from "next/server";
import { authorize } from "@/lib/auth";
import { hasPlugins, getPlugins, getAdminTabs, getUiSlots } from "@/lib/plugins";

/** Guests (the login page) get slot ids only */
export async function GET(request: NextRequest) {
  const user = await authorize(request.cookies.get("session")?.value);
  return NextResponse.json({
    hasPlugins: hasPlugins(),
    plugins: user ? getPlugins().map((p) => p.id) : [],
    adminTabs: user ? getAdminTabs() : [],
    uiSlots: getUiSlots(),
  });
}
