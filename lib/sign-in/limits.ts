/** Email sign-in limits; windows are fixed hours */

export const CODE_DIGITS = 8;
export const CODE_TTL_SECONDS = 10 * 60;
export const CODE_MAX_ATTEMPTS = 5;
export const RESEND_COOLDOWN_SECONDS = 45;

export const HOUR_SECONDS = 60 * 60;
export const SENDS_PER_EMAIL_PER_HOUR = 5;
export const SENDS_PER_IP_PER_HOUR = 20;
export const CODE_FAILURES_PER_IP_PER_HOUR = 30;
export const PASSWORD_FAILURES_PER_LOGIN_PER_HOUR = 10;
export const PASSWORD_FAILURES_PER_IP_PER_HOUR = 30;
