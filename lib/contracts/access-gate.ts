/**
 * Contract: whether a signed-in user may use the app (chats, images) right now.
 * A plugin blocks it until the user does something, e.g. confirms an email.
 * The OSS implementation never blocks.
 */

export interface AccessBlock {
  /** Passed to the `access-gate` UI slot, so the plugin knows which screen to show */
  id: string;
  /** For API refusals and the core fallback screen */
  message: string;
}

export interface AccessGate {
  check(userId: string): Promise<AccessBlock | null>;
}
