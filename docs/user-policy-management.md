# User Policy Management Documentation

## Overview

The User Policy Management system provides administrators with granular, per-user security controls. It allows the management of authentication requirements, account access states, and credential policies through a unified dashboard interface (`UserPolicyControlView`) backed by a robust Node.js API and PostgreSQL database.

## Key Features

### 1. Password Policy Enforcement
Administrators can define specific password complexity requirements on a per-user basis.
* **Configurable Constraints:**
  * Minimum password length (default: 8).
  * Require uppercase letters (A-Z).
  * Require lowercase letters (a-z).
  * Require numerical digits (0-9).
  * Require special characters (!@#).
* **Administrative Overrides:** Administrators can manually reset a user's password and flag the account with `mustChangePassword`, forcing the user to select a new password upon their next login.

### 2. Two-Factor Authentication (2FA) Management
Provides comprehensive control over the second layer of authentication.
* **Status Tracking:** Visual indicators display whether 2FA is active or disabled for a user.
* **Toggle Access:** Administrators can enforce or disable 2FA requirements per user.
* **Secret Reset:** If a user loses their authenticator device, administrators can reset (nullify) their `twoFactorSecret`. This forces the system to generate a new QR code for the user to scan during their next login attempt.

### 3. Account Lockout & Status Monitoring
Protects against brute-force attacks and provides visibility into account health.
* **Auto-Lockout:** The system tracks failed login attempts (`failedAccessCount`). Upon reaching the maximum threshold (5 consecutive failed attempts), the account is automatically locked (`isLockedOut: true`) for 15 minutes.
* **Status Dashboard:** The User Policy dashboard displays an interactive "Active" or "Locked" badge. Clicking a locked badge reveals the exact reason and expiration of the lockout.
* **Manual Unlock:** Administrators can instantly restore access to a locked account via a one-click "Unlock" action.

### 4. Comprehensive Audit Logging (Serilog)
All sensitive security policy changes and access events are meticulously logged using a custom `BackendLogger` implementing the structured Serilog JSON format.
* **Storage:** Logs are persisted to a local file (`logs/system-events.log`).
* **Remote Sync:** Logs can be automatically emitted to an external Seq log aggregator via the `SEQ_URL` environment variable.
* **Tracked Events include:**
  * `AdminResetPassword`: When an admin resets another user's password.
  * `UpdatePasswordPolicy`: When complexity rules are modified.
  * `Toggle2FA` & `Reset2FASecret`: Tracking 2FA administrative actions.
  * `AccountLockout` & `UnlockAccount`: Recording access state changes.
  * `LoginSuccess` & `LoginFailed`: Tracking standard authentication attempts.

## Architecture & Database Schema

The user schema (`src/db/schema.ts`) has been extended to persist these policies in the Cloud SQL PostgreSQL database:

```typescript
// Authentication & Lockout
isLockedOut: boolean('is_locked_out').default(false),
failedAccessCount: integer('failed_access_count').default(0),
lockoutEnd: timestamp('lockout_end'),

// Password Management
mustChangePassword: boolean('must_change_password').default(false),
passwordHash: text('password_hash'),
passwordMinLength: integer('password_min_length').default(8),
passwordRequireSpecial: boolean('password_require_special').default(false),
passwordRequireNumber: boolean('password_require_number').default(false),
passwordRequireUppercase: boolean('password_require_uppercase').default(false),
passwordRequireLowercase: boolean('password_require_lowercase').default(false),

// 2FA Management
twoFactorEnabled: boolean('two_factor_enabled').default(false),
twoFactorSecret: text('two_factor_secret'),
```

## Security Considerations

1. **Authentication Routing:** The `src/middleware/auth.ts` intelligently distinguishes between custom system JWTs (`HS256`) and Firebase Auth tokens (`RS256`), ensuring that expired sessions correctly return a `401 Unauthorized` rather than triggering upstream SDK errors.
2. **CSRF Protection:** Administrative actions in the dashboard require a strict `x-app-action` header.
3. **Role Validation:** All backend routes processing policy updates strictly require the authenticated user to possess the `Admin` role.
