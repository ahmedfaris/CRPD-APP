/**
 * Google Docs API Integration Service
 * Creates and updates Google Docs documents directly using the Google Docs & Drive REST APIs.
 */

export interface GoogleDocResult {
  documentId: string;
  title: string;
  documentUrl: string;
}

/**
 * Creates a new blank Google Doc in Google Drive and inserts the provided structured text.
 * 
 * @param title Document Title
 * @param content Text content to insert into the document
 * @param accessToken Valid Google OAuth access token with 'documents' and 'drive.file' scopes
 */
export async function createGoogleDocWithDocumentation(
  title: string,
  content: string,
  accessToken: string
): Promise<GoogleDocResult> {
  // 1. Create a new Google Document via Google Docs API
  const createRes = await fetch('https://docs.googleapis.com/v1/documents', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    let errMsg = `Failed to create Google Doc (HTTP ${createRes.status})`;
    try {
      const parsed = JSON.parse(errText);
      if (parsed.error?.message) {
        errMsg = parsed.error.message;
      }
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  const docData = await createRes.json();
  const documentId = docData.documentId;
  const docTitle = docData.title || title;

  // 2. Insert document body text using batchUpdate
  if (content && content.trim().length > 0) {
    const updateRes = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        requests: [
          {
            insertText: {
              location: {
                index: 1
              },
              text: content
            }
          }
        ]
      })
    });

    if (!updateRes.ok) {
      console.warn('Document was created, but failed to insert content:', await updateRes.text());
    }
  }

  const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;

  return {
    documentId,
    title: docTitle,
    documentUrl
  };
}

/**
 * The standard authentication and login documentation content for CRPD APP
 */
export const CRPD_LOGIN_DOCUMENTATION_TEXT = `CRPD APP — AUTHENTICATION & LOGIN PROCESS DOCUMENTATION
Generated: ${new Date().toLocaleString()}
System: CRPD Electronic Records & Ticketing Management Platform

================================================================================
1. OVERVIEW
================================================================================
The CRPD application authentication architecture is built using a secure multi-layer
security framework combining Express REST APIs, PostgreSQL (via Drizzle ORM), Bcrypt
password hashing, JSON Web Tokens (JWT), TOTP Two-Factor Authentication (RFC 6238),
and progressive brute-force account lockout protection.

================================================================================
2. DEFAULT SEEDED ACCOUNTS
================================================================================
* System Administrator:
  - Email: admin@system.local
  - Password: Admin@2026!
  - Role: Admin
  - User Type: System Admin
  - Permissions: Full administrative control, user policy control, team configuration,
    database export (SQL/JSON), session management, and system settings.

* Operational Staff:
  - Email: ahmed.faris89@gmail.com
  - Role: Employee
  - User Type: Operational User
  - Access: Ticketing operations and document archiving.

================================================================================
3. AUTHENTICATION & LOGIN WORKFLOW
================================================================================
Step 1: User Submits Credentials
  - User inputs email and password on the Login screen (LoginView.tsx).
  - Client sends: POST /api/auth/login with { email, password }.

Step 2: Progressive Account Lockout Check
  - The server verifies if the account is currently locked out in PostgreSQL.
  - Policy: Maximum 6 consecutive failed attempts.
  - Progressive Lockout Durations:
      * 1st Lockout: 5 minutes
      * 2nd Lockout: 15 minutes
      * 3rd Lockout: 30 minutes
      * 4th+ Lockout: 60 minutes
  - If lockout duration has elapsed, lockout is automatically lifted.
  - If locked, server returns HTTP 423 Locked with bilingual remaining time notices.

Step 3: Password Verification & Tolerance
  - Passwords are encrypted with Bcrypt (10 salt rounds).
  - Upon successful verification, failed attempt counter resets to 0.
  - Upon incorrect password, failedAccessCount increments by 1, returning
    remaining attempts before lockout (e.g., "Attempt 2 of 6").

Step 4: Two-Factor Authentication (2FA / TOTP)
  - If 2FA is active on the account:
      * Server responds with { success: true, requires2FA: true, tempToken }.
      * Client transitions to 2FA prompt requesting the 6-digit TOTP code.
      * User inputs the authenticator code (Google Authenticator / Microsoft Authenticator).
      * Client sends: POST /api/auth/verify-2fa with { tempToken, totpCode }.
      * Server validates the code with time-step tolerance (±1 step / 30s) against the secret.

Step 5: Session Issuance
  - Upon successful authentication, a database session record is inserted into user_sessions.
  - A cryptographically signed JWT token is issued (8-hour expiration).
  - Sent via HTTP-only Strict cookie ('session_token') and JSON response body for Bearer Authorization headers.

================================================================================
4. SESSION MAINTENANCE & SECURITY CONTROLS
================================================================================
* Inactivity / Idle Timeout:
  - Client tracks user activity (mouse, keyboard, touch).
  - Automatically signs out user after 15 minutes of inactivity.

* Session Heartbeat:
  - Client periodically verifies active session with GET /api/auth/session-status.
  - If session is terminated by an administrator or account is locked, client immediately logs out.

* Forced Password Change:
  - If mustChangePassword flag is true, user is navigated to password update screen before accessing apps.

* Safe Error Handlers:
  - Strict /api/* 404 guards prevent single-page HTML fallthroughs.
  - Safe JSON response parser handles network interruptions and gateway timeouts seamlessly.

================================================================================
DOCUMENTATION END
================================================================================
`;
