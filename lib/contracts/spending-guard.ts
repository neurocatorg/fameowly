/**
 * Contract: whether a user may start a paid request right now.
 * The OSS implementation never blocks.
 */

export interface SpendingGuard {
  /** @returns a message for the user when the request must be refused, otherwise null */
  check(userId: string): string | null;
}
