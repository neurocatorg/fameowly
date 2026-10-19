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
  UserLifecycle,
} from "../contracts";
import type { ModelsConfig } from "../models";

/** Reports "not billed" for every request */
export class NoPricingPolicy implements PricingPolicy {
  chatCost(): CostSnapshot | null {
    return null;
  }

  imageCost(): CostSnapshot | null {
    return null;
  }
}

/** Every model is available to every user */
export class OpenModelAccessPolicy implements ModelAccessPolicy {
  filter(_userId: string, config: ModelsConfig): ModelsConfig {
    return config;
  }

  canUse(): boolean {
    return true;
  }
}

/** No balances in OSS, so nothing is ever refused */
export class OpenSpendingGuard implements SpendingGuard {
  check(): string | null {
    return null;
  }
}

/** Nothing to clean up outside users.json */
export class NoopUserLifecycle implements UserLifecycle {
  async onUserDeleted(): Promise<void> {}
}
