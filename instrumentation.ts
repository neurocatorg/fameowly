/** Next.js server start hook: plugin background tasks, Node.js runtime only. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startPluginBackgroundTasks } = await import("./lib/plugin-loader");
  await startPluginBackgroundTasks();
}
