/**
 * Contract: what happens when someone signs in with an email that has no account.
 * The core never creates accounts on its own; this policy is the only door.
 */

export type UnknownEmailAction = "send-code" | "request-access" | "closed";

export interface RegistrationPolicy {
  /**
   * `send-code` — send a login code, the account is created on verification;
   * `request-access` — the login page shows the access request form;
   * `closed` — neutral answer, no code, no account.
   * Asked on every code request, known emails included: the reply must not reveal accounts.
   */
  resolveUnknownEmail(email: string): Promise<UnknownEmailAction>;
  /** Re-checked when the code is verified, so a direct verify call cannot bypass the mode */
  canCreateUser(email: string): Promise<boolean>;
}
