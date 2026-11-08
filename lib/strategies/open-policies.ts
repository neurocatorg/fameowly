/**
 * Strategy: OSS defaults for the pricing, model access and user lifecycle
 * contracts. They deliberately do nothing — pricing and access control are
 * plugin territory.
 */

import type {
  PricingPolicy,
  CostSnapshot,
  ModelAccessPolicy,
  SpendingGuard,
  AccessBlock,
  AccessGate,
  UserLifecycle,
} from "../contracts";
import type { ModelsConfig } from "../models";

/** Reports "not billed" for every request */
export class NoPricingPolicy implements PricingPolicy {
  async chatCost(): Promise<CostSnapshot | null> {
    return null;
  }

  async imageCost(): Promise<CostSnapshot | null> {
    return null;
  }
}

/** Every model is available to every user */
export class OpenModelAccessPolicy implements ModelAccessPolicy {
  async filter(_userId: string, config: ModelsConfig): Promise<ModelsConfig> {
    return config;
  }

  async canUse(): Promise<boolean> {
    return true;
  }
}

/** No balances in OSS, so nothing is ever refused */
export class OpenSpendingGuard implements SpendingGuard {
  async check(): Promise<string | null> {
    return null;
  }
}

/** Every signed-in user may use the app */
export class OpenAccessGate implements AccessGate {
  async check(): Promise<AccessBlock | null> {
    return null;
  }
}

/** Nothing to clean up outside users.json */
export class NoopUserLifecycle implements UserLifecycle {
  async onUserDeleted(): Promise<void> {}
}
