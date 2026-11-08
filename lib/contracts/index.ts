/**
 * Contracts — pure TypeScript interfaces for the DI container.
 * No implementations, no side effects.
 */

export type { ProviderResolver } from "./credential-resolver";
export type { ModelFactory } from "./model-factory";
export type { UsageTracker, ChatFinishContext } from "./usage-tracker";
export type { PricingPolicy, CostSnapshot } from "./pricing-policy";
export type { ModelAccessPolicy } from "./model-access-policy";
export type { SpendingGuard } from "./spending-guard";
export type { UserLifecycle, CreatedUser, UserCreatedContext } from "./user-lifecycle";
export type { Mailer, MailMessage } from "./mailer";
export type { RegistrationPolicy, UnknownEmailAction } from "./registration-policy";
export type { AccessGate, AccessBlock } from "./access-gate";
export type {
  WebToolsProvider,
  WebToolsRequest,
  WebContextRequest,
  WebContextResult,
  WebToolOutput,
} from "./web-tools-provider";
export type {
  ReasoningOptionsProvider,
  ReasoningOptionsRequest,
} from "./reasoning-options-provider";
export type {
  DocumentStore,
  Collection,
  CollectionOptions,
  IndexSpec,
  StoredDocument,
  Filter,
  ComparisonOperators,
  FindOptions,
  SortSpec,
  UpdateSpec,
} from "./document-store";
