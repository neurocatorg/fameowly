import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authorize } from "@/lib/auth";
import { container, initializeContainer } from "@/lib/plugin-loader";
import { HOME_PAGE_ID, getPublicPage } from "@/lib/plugins";
import { PluginSlot } from "@/lib/plugin-ui";
import { PublicShell } from "@/components/public/public-shell";
import { ChatApp } from "./_components/chat-app";
import { AccessBlocked } from "./_components/access-blocked";

/** Signed-in users get the app unless `accessGate` blocks it; guests get a plugin landing or the login form */
export default async function HomePage() {
  const user = await authorize((await cookies()).get("session")?.value);
  if (user) {
    initializeContainer();
    const block = await container.get("accessGate").check(user.id);
    if (!block) {
      const optionIcons = {
        chips: process.env.CHAT_OPTION_ICONS !== "false",
        list: process.env.CHAT_OPTION_LIST_ICONS === "true",
      };
      return <ChatApp optionIcons={optionIcons} />;
    }
    return (
      <PluginSlot
        id="access-gate"
        props={{ gate: block.id, message: block.message }}
        fallback={<AccessBlocked message={block.message} />}
      />
    );
  }

  const landing = getPublicPage(HOME_PAGE_ID);
  if (!landing) redirect("/login");

  const Landing = await landing.load();
  return (
    <PublicShell>
      <Landing />
    </PublicShell>
  );
}
