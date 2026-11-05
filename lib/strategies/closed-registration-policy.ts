/**
 * Strategy: OSS registration policy — accounts are added by an admin only.
 */

import type { RegistrationPolicy, UnknownEmailAction } from "../contracts";

export class ClosedRegistrationPolicy implements RegistrationPolicy {
  async resolveUnknownEmail(): Promise<UnknownEmailAction> {
    return "closed";
  }

  async canCreateUser(): Promise<boolean> {
    return false;
  }
}
