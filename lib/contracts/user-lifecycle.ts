/**
 * Contract: user lifecycle events.
 * Lets plugins react to new accounts and drop data they keep outside `users`.
 */

export interface CreatedUser {
  id: string;
  name: string;
  email?: string;
  role: "admin" | "user";
}

export interface UserCreatedContext {
  /** `admin` — added in the admin panel; `signup` — created on email code verification */
  source: "admin" | "signup";
}

export interface UserLifecycle {
  onUserDeleted(userId: string): Promise<void>;
  /** Not called when an existing user links an email */
  onUserCreated?(user: CreatedUser, context: UserCreatedContext): Promise<void>;
}
